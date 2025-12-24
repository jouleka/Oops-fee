// @ts-nocheck
// deno-lint-ignore-file
/**
 * wallet-topup Edge Function
 *
 * Charges user's card and credits their wallet balance.
 * Uses off-session Stripe payment with saved payment method.
 */

import { corsHeaders, handleCorsOptions } from '../_shared/cors.ts';
import { createStripeClient } from '../_shared/stripe.ts';
import { createAdminClient, getUserFromRequest } from '../_shared/supabase.ts';

// Minimum and maximum top-up amounts in cents
const MIN_AMOUNT_CENTS = 500;   // $5
const MAX_AMOUNT_CENTS = 50000; // $500

interface TopUpRequest {
  amount_cents: number;
  setup_only?: boolean;      // If true, create PaymentIntent but don't confirm (for PaymentSheet)
  payment_intent_id?: string; // For confirming a previously created PaymentIntent
}

interface TopUpResponse {
  success: boolean;
  balance?: number;          // New balance in cents
  charged?: number;          // Amount charged in cents
  message: string;
  requiresAction?: boolean;
  clientSecret?: string;
  paymentIntentId?: string;
  customerId?: string;       // For PaymentSheet initialization
  ephemeralKey?: string;     // For PaymentSheet initialization
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsOptions();
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // Authenticate user
    const user = await getUserFromRequest(req);
    if (!user) {
      return new Response(
        JSON.stringify({ success: false, message: 'Unauthorized' } as TopUpResponse),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Parse request
    const body = await req.json();
    const { amount_cents, setup_only, payment_intent_id } = body as TopUpRequest;

    const supabase = createAdminClient();
    const stripe = createStripeClient();

    // Get user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_customer_id, default_payment_method_id, balance_cents')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('[wallet-topup] Profile not found:', profileError);
      return new Response(
        JSON.stringify({ success: false, message: 'Profile not found' } as TopUpResponse),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { stripe_customer_id } = profile;

    // ─────────────────────────────────────────────────────────────
    // MODE 1: Confirm a previously created PaymentIntent (after PaymentSheet success)
    // ─────────────────────────────────────────────────────────────
    if (payment_intent_id) {
      console.log(`[wallet-topup] Confirming PaymentIntent ${payment_intent_id} for user ${user.id}`);
      
      try {
        // Retrieve the PaymentIntent to verify it succeeded
        const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);
        
        if (paymentIntent.status !== 'succeeded') {
          return new Response(
            JSON.stringify({ 
              success: false, 
              message: `Payment not completed. Status: ${paymentIntent.status}` 
            } as TopUpResponse),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }

        // Verify this PaymentIntent belongs to this user's customer
        if (paymentIntent.customer !== stripe_customer_id) {
          return new Response(
            JSON.stringify({ success: false, message: 'Payment does not belong to this user' } as TopUpResponse),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }

        // Credit the wallet
        const amountCents = paymentIntent.amount;
        const amountDisplay = `$${(amountCents / 100).toFixed(amountCents % 100 === 0 ? 0 : 2)}`;

        const { data: newBalance, error: creditError } = await supabase.rpc('credit_wallet_with_log', {
          target_user_id: user.id,
          amount_cents: amountCents,
          tx_type: 'topup',
          promise_id: null,
          claim_id: null,
          stripe_pi_id: payment_intent_id,
          description_text: `Top-up ${amountDisplay}`,
        });

        if (creditError) {
          console.error('[wallet-topup] Credit wallet error:', creditError);
          return new Response(
            JSON.stringify({ 
              success: false, 
              message: 'Payment succeeded but wallet credit failed. Contact support.',
              paymentIntentId: payment_intent_id,
            } as TopUpResponse),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }

        console.log(`[wallet-topup] User ${user.id} credited ${amountCents} cents, new balance: ${newBalance}`);

        return new Response(
          JSON.stringify({
            success: true,
            balance: newBalance,
            charged: amountCents,
            message: `Added ${amountDisplay} to your wallet`,
            paymentIntentId: payment_intent_id,
          } as TopUpResponse),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      } catch (err: unknown) {
        console.error('[wallet-topup] Confirm error:', err);
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: err instanceof Error ? err.message : 'Failed to confirm payment' 
          } as TopUpResponse),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    // ─────────────────────────────────────────────────────────────
    // Validate amount (required for setup_only and off-session modes)
    // ─────────────────────────────────────────────────────────────
    if (!amount_cents || typeof amount_cents !== 'number') {
      return new Response(
        JSON.stringify({ success: false, message: 'Missing or invalid amount_cents' } as TopUpResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (amount_cents < MIN_AMOUNT_CENTS) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `Minimum top-up is $${(MIN_AMOUNT_CENTS / 100).toFixed(0)}` 
        } as TopUpResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (amount_cents > MAX_AMOUNT_CENTS) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `Maximum top-up is $${(MAX_AMOUNT_CENTS / 100).toFixed(0)}` 
        } as TopUpResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Ensure whole dollar amounts (cents must be divisible by 100)
    if (amount_cents % 100 !== 0) {
      return new Response(
        JSON.stringify({ success: false, message: 'Amount must be in whole dollars' } as TopUpResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const amountDisplay = `$${(amount_cents / 100).toFixed(amount_cents % 100 === 0 ? 0 : 2)}`;

    // ─────────────────────────────────────────────────────────────
    // MODE 2: Setup only - Create PaymentIntent for PaymentSheet (Apple Pay / Google Pay)
    // ─────────────────────────────────────────────────────────────
    if (setup_only) {
      console.log(`[wallet-topup] Creating PaymentIntent for PaymentSheet, amount: ${amountDisplay}, user: ${user.id}`);
      
      try {
        // Ensure we have a Stripe customer
        let customerId = stripe_customer_id;
        
        if (!customerId) {
          // Create a new Stripe customer
          const customer = await stripe.customers.create({
            metadata: { supabase_user_id: user.id },
          });
          customerId = customer.id;
          
          // Save to profile
          await supabase
            .from('profiles')
            .update({ stripe_customer_id: customerId })
            .eq('id', user.id);
        }

        // Create ephemeral key for PaymentSheet
        const ephemeralKey = await stripe.ephemeralKeys.create(
          { customer: customerId },
          { apiVersion: '2024-04-10' }
        );

        // Create PaymentIntent (not confirmed - app will present PaymentSheet)
        // Restrict to card-based methods (Card, Apple Pay, Google Pay, Link)
        // NOT Cash App, Amazon Pay, Crypto, etc.
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount_cents,
          currency: 'usd',
          customer: customerId,
          payment_method_types: ['card', 'link'],
          metadata: {
            type: 'wallet_topup',
            user_id: user.id,
          },
          description: `OopsFee: Wallet top-up ${amountDisplay}`,
        });

        console.log(`[wallet-topup] Created PaymentIntent ${paymentIntent.id} for PaymentSheet`);

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Ready for PaymentSheet',
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            customerId: customerId,
            ephemeralKey: ephemeralKey.secret,
          } as TopUpResponse),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      } catch (err: unknown) {
        console.error('[wallet-topup] Setup error:', err);
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: err instanceof Error ? err.message : 'Failed to setup payment' 
          } as TopUpResponse),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    // ─────────────────────────────────────────────────────────────
    // MODE 3: Off-session charge (legacy - charge saved card directly)
    // ─────────────────────────────────────────────────────────────
    const { default_payment_method_id } = profile;

    // Require payment method for off-session
    if (!stripe_customer_id || !default_payment_method_id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'No payment method on file. Add a card first.' 
        } as TopUpResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log(`[wallet-topup] Off-session charging ${amountDisplay} for user ${user.id}`);

    try {
      // Use idempotency key to prevent duplicate charges
      const idempotencyKey = `wallet-topup-${user.id}-${amount_cents}-${Date.now()}`;

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount_cents,
        currency: 'usd',
        customer: stripe_customer_id,
        payment_method: default_payment_method_id,
        off_session: true,
        confirm: true,
        metadata: {
          type: 'wallet_topup',
          user_id: user.id,
        },
        description: `OopsFee: Wallet top-up ${amountDisplay}`,
      }, {
        idempotencyKey,
      });

      console.log(`[wallet-topup] PaymentIntent ${paymentIntent.id} status: ${paymentIntent.status}`);

      if (paymentIntent.status === 'succeeded') {
        // Credit wallet via RPC function
        const { data: newBalance, error: creditError } = await supabase.rpc('credit_wallet_with_log', {
          target_user_id: user.id,
          amount_cents: amount_cents,
          tx_type: 'topup',
          promise_id: null,
          claim_id: null,
          stripe_pi_id: paymentIntent.id,
          description_text: `Top-up ${amountDisplay}`,
        });

        if (creditError) {
          console.error('[wallet-topup] Credit wallet error:', creditError);
          // Payment succeeded but credit failed - this is bad, log for manual intervention
          console.error(`[wallet-topup] CRITICAL: Payment ${paymentIntent.id} succeeded but wallet credit failed for user ${user.id}`);
          return new Response(
            JSON.stringify({ 
              success: false, 
              message: 'Payment succeeded but wallet credit failed. Contact support.',
              paymentIntentId: paymentIntent.id,
            } as TopUpResponse),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }

        console.log(`[wallet-topup] User ${user.id} new balance: ${newBalance} cents`);

        return new Response(
          JSON.stringify({
            success: true,
            balance: newBalance,
            charged: amount_cents,
            message: `Added ${amountDisplay} to your wallet`,
            paymentIntentId: paymentIntent.id,
          } as TopUpResponse),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      if (paymentIntent.status === 'requires_action') {
        // SCA required - return client secret for app to complete
        console.log(`[wallet-topup] Payment requires action for user ${user.id}`);
        return new Response(
          JSON.stringify({
            success: true,
            charged: amount_cents,
            message: 'Your bank requires confirmation.',
            requiresAction: true,
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
          } as TopUpResponse),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      // Other status - payment processing
      return new Response(
        JSON.stringify({
          success: true,
          charged: amount_cents,
          message: `Payment processing (${paymentIntent.status})`,
          paymentIntentId: paymentIntent.id,
        } as TopUpResponse),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );

    } catch (stripeError: unknown) {
      const err = stripeError as { code?: string; message?: string };
      console.error('[wallet-topup] Stripe error:', err);

      // User-friendly error messages
      let userMessage = 'Payment failed';
      if (err.code === 'card_declined') {
        userMessage = 'Card declined. Please try a different card.';
      } else if (err.code === 'insufficient_funds') {
        userMessage = 'Insufficient funds on card.';
      } else if (err.code === 'expired_card') {
        userMessage = 'Card has expired. Please update your payment method.';
      } else if (err.message) {
        userMessage = `Payment failed: ${err.message}`;
      }

      return new Response(
        JSON.stringify({
          success: false,
          message: userMessage,
        } as TopUpResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

  } catch (error: unknown) {
    console.error('[wallet-topup] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ success: false, message } as TopUpResponse),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});


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
}

interface TopUpResponse {
  success: boolean;
  balance?: number;        // New balance in cents
  charged?: number;        // Amount charged in cents
  message: string;
  requiresAction?: boolean;
  clientSecret?: string;
  paymentIntentId?: string;
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
    const { amount_cents } = body as TopUpRequest;

    // Validate amount
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

    const supabase = createAdminClient();
    const stripe = createStripeClient();

    // Get user's payment method
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

    const { stripe_customer_id, default_payment_method_id } = profile;

    // Require payment method
    if (!stripe_customer_id || !default_payment_method_id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'No payment method on file. Add a card first.' 
        } as TopUpResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const amountDisplay = `$${(amount_cents / 100).toFixed(amount_cents % 100 === 0 ? 0 : 2)}`;
    console.log(`[wallet-topup] Charging ${amountDisplay} for user ${user.id}`);

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


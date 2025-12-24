// @ts-nocheck
// deno-lint-ignore-file
/**
 * wallet-withdraw Edge Function
 *
 * Sends user's wallet balance to their PayPal or Stripe Connect account.
 * Supports PayPal Payouts API and Stripe Transfers.
 */

import { corsHeaders, handleCorsOptions } from '../_shared/cors.ts';
import { centsToDollars, createPayout } from '../_shared/paypal.ts';
import { createStripeClient } from '../_shared/stripe.ts';
import { createAdminClient, getUserFromRequest } from '../_shared/supabase.ts';

// Minimum withdrawal amount in cents
const MIN_WITHDRAW_CENTS = 500; // $5

interface WithdrawRequest {
  amount_cents: number;
  method: 'paypal' | 'stripe';
  destination: string; // PayPal email or Stripe Connect account ID
}

interface WithdrawResponse {
  success: boolean;
  balance?: number;        // New balance in cents after withdrawal
  withdrawn?: number;      // Amount withdrawn in cents
  message: string;
  paypal_batch_id?: string;
  stripe_transfer_id?: string;
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
        JSON.stringify({ success: false, message: 'Unauthorized' } as WithdrawResponse),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Parse request
    const body = await req.json();
    const { amount_cents, method, destination } = body as WithdrawRequest;

    // Validate amount
    if (!amount_cents || typeof amount_cents !== 'number') {
      return new Response(
        JSON.stringify({ success: false, message: 'Missing or invalid amount_cents' } as WithdrawResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (amount_cents < MIN_WITHDRAW_CENTS) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `Minimum withdrawal is $${(MIN_WITHDRAW_CENTS / 100).toFixed(0)}` 
        } as WithdrawResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Validate method
    if (!method || (method !== 'paypal' && method !== 'stripe')) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid method. Must be "paypal" or "stripe"' } as WithdrawResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Validate destination
    if (!destination || typeof destination !== 'string' || destination.trim() === '') {
      return new Response(
        JSON.stringify({ success: false, message: 'Missing destination' } as WithdrawResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createAdminClient();

    // Get user's current wallet balance
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('balance_cents, paypal_payout_email, stripe_connect_account_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('[wallet-withdraw] Profile not found:', profileError);
      return new Response(
        JSON.stringify({ success: false, message: 'Profile not found' } as WithdrawResponse),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { balance_cents } = profile;

    // Check sufficient balance
    if (balance_cents < amount_cents) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `Insufficient balance. You have $${(balance_cents / 100).toFixed(2)} available.` 
        } as WithdrawResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const amountDisplay = `$${(amount_cents / 100).toFixed(2)}`;
    console.log(`[wallet-withdraw] Processing ${amountDisplay} ${method} withdrawal for user ${user.id}`);

    if (method === 'paypal') {
      // Validate PayPal email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(destination)) {
        return new Response(
          JSON.stringify({ success: false, message: 'Invalid PayPal email address' } as WithdrawResponse),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      // Create a unique withdrawal ID
      const withdrawalId = `withdraw-${user.id}-${Date.now()}`;

      // Call PayPal Payouts API
      const payoutResult = await createPayout({
        claimId: withdrawalId,
        recipientEmail: destination,
        amountDollars: centsToDollars(amount_cents),
        note: 'OopsFee wallet withdrawal',
        emailSubject: 'Your OopsFee withdrawal',
        emailMessage: `You've withdrawn ${amountDisplay} from your OopsFee wallet.`,
      });

      if (!payoutResult.success) {
        console.error('[wallet-withdraw] PayPal payout failed:', payoutResult.error);
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: payoutResult.error || 'PayPal payout failed' 
          } as WithdrawResponse),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      console.log(`[wallet-withdraw] PayPal payout created: batch ${payoutResult.batchId}`);

      // Debit wallet via RPC function (with PayPal batch ID)
      const { data: newBalance, error: debitError } = await supabase.rpc('debit_wallet_withdraw', {
        target_user_id: user.id,
        amount_cents: amount_cents,
        paypal_batch: payoutResult.batchId,
        description_text: `Withdrawal to PayPal ${destination}`,
      });

      if (debitError) {
        console.error('[wallet-withdraw] Debit wallet error:', debitError);
        // PayPal payout was created but debit failed - log for manual intervention
        console.error(`[wallet-withdraw] CRITICAL: PayPal batch ${payoutResult.batchId} created but wallet debit failed for user ${user.id}`);
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Payout initiated but wallet debit failed. Contact support.',
            paypal_batch_id: payoutResult.batchId,
          } as WithdrawResponse),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      if (newBalance === -1) {
        // Insufficient balance (shouldn't happen since we checked earlier)
        console.error('[wallet-withdraw] Unexpected insufficient balance after PayPal payout');
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Insufficient balance',
            paypal_batch_id: payoutResult.batchId,
          } as WithdrawResponse),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      // Optionally save PayPal email for future use
      if (destination !== profile.paypal_payout_email) {
        await supabase
          .from('profiles')
          .update({ paypal_payout_email: destination })
          .eq('id', user.id);
      }

      console.log(`[wallet-withdraw] User ${user.id} new balance: ${newBalance} cents (PayPal)`);

      return new Response(
        JSON.stringify({
          success: true,
          balance: newBalance,
          withdrawn: amount_cents,
          message: `Withdrew ${amountDisplay} to PayPal. Funds typically arrive within minutes.`,
          paypal_batch_id: payoutResult.batchId,
        } as WithdrawResponse),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );

    } else {
      // Stripe Connect Transfer
      const stripe = createStripeClient();

      // Validate Stripe Connect account ID format
      if (!destination.startsWith('acct_')) {
        return new Response(
          JSON.stringify({ success: false, message: 'Invalid Stripe Connect account ID' } as WithdrawResponse),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      try {
        // Use idempotency key to prevent duplicate transfers
        const idempotencyKey = `wallet-withdraw-${user.id}-${amount_cents}-${Date.now()}`;

        // Create Stripe Transfer to connected account
        const transfer = await stripe.transfers.create({
          amount: amount_cents,
          currency: 'usd',
          destination: destination,
          metadata: {
            type: 'wallet_withdraw',
            user_id: user.id,
          },
          description: `OopsFee wallet withdrawal`,
        }, {
          idempotencyKey,
        });

        console.log(`[wallet-withdraw] Stripe transfer created: ${transfer.id}`);

        // Debit wallet via RPC function
        const { data: newBalance, error: debitError } = await supabase.rpc('debit_wallet_withdraw', {
          target_user_id: user.id,
          amount_cents: amount_cents,
          paypal_batch: null, // No PayPal batch for Stripe
          description_text: `Withdrawal to Stripe Connect ${destination}`,
        });

        if (debitError) {
          console.error('[wallet-withdraw] Debit wallet error:', debitError);
          // Stripe transfer was created but debit failed - log for manual intervention
          console.error(`[wallet-withdraw] CRITICAL: Stripe transfer ${transfer.id} created but wallet debit failed for user ${user.id}`);
          return new Response(
            JSON.stringify({ 
              success: false, 
              message: 'Transfer initiated but wallet debit failed. Contact support.',
              stripe_transfer_id: transfer.id,
            } as WithdrawResponse),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }

        if (newBalance === -1) {
          // Insufficient balance (shouldn't happen since we checked earlier)
          console.error('[wallet-withdraw] Unexpected insufficient balance after Stripe transfer');
          return new Response(
            JSON.stringify({ 
              success: false, 
              message: 'Insufficient balance',
              stripe_transfer_id: transfer.id,
            } as WithdrawResponse),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }

        // Optionally save Stripe Connect account ID for future use
        if (destination !== profile.stripe_connect_account_id) {
          await supabase
            .from('profiles')
            .update({ stripe_connect_account_id: destination })
            .eq('id', user.id);
        }

        console.log(`[wallet-withdraw] User ${user.id} new balance: ${newBalance} cents (Stripe)`);

        return new Response(
          JSON.stringify({
            success: true,
            balance: newBalance,
            withdrawn: amount_cents,
            message: `Withdrew ${amountDisplay} to your bank account. Funds typically arrive in 2-3 business days.`,
            stripe_transfer_id: transfer.id,
          } as WithdrawResponse),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );

      } catch (stripeError: unknown) {
        const err = stripeError as { code?: string; message?: string };
        console.error('[wallet-withdraw] Stripe error:', err);

        // User-friendly error messages
        let userMessage = 'Transfer failed';
        if (err.code === 'invalid_destination') {
          userMessage = 'Invalid Stripe account. Please reconnect your bank account.';
        } else if (err.code === 'insufficient_funds') {
          userMessage = 'Platform has insufficient funds. Contact support.';
        } else if (err.message) {
          userMessage = `Transfer failed: ${err.message}`;
        }

        return new Response(
          JSON.stringify({
            success: false,
            message: userMessage,
          } as WithdrawResponse),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

  } catch (error: unknown) {
    console.error('[wallet-withdraw] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ success: false, message } as WithdrawResponse),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});


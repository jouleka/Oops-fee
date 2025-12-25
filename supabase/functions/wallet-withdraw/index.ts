// @ts-nocheck
// deno-lint-ignore-file
/**
 * wallet-withdraw Edge Function
 *
 * Sends user's wallet balance to their PayPal account.
 */

import { corsHeaders, handleCorsOptions } from '../_shared/cors.ts';
import { centsToDollars, createPayout } from '../_shared/paypal.ts';
import { createAdminClient, getUserFromRequest } from '../_shared/supabase.ts';

// Minimum withdrawal amount in cents
const MIN_WITHDRAW_CENTS = 500; // $5

interface WithdrawRequest {
  amount_cents: number;
  method: 'paypal';
  destination: string; // PayPal email
}

interface WithdrawResponse {
  success: boolean;
  balance?: number;        // New balance in cents after withdrawal
  withdrawn?: number;      // Amount withdrawn in cents
  message: string;
  paypal_batch_id?: string;
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

    // Validate method (only PayPal supported)
    if (method !== 'paypal') {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid method. Only "paypal" is supported.' } as WithdrawResponse),
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
      .select('balance_cents, paypal_payout_email')
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
    console.log(`[wallet-withdraw] Processing ${amountDisplay} PayPal withdrawal for user ${user.id}`);

    // Validate PayPal email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(destination)) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid PayPal email address' } as WithdrawResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Create a unique withdrawal ID (max 63 chars for PayPal)
    const shortUserId = user.id.replace(/-/g, '').slice(0, 12);
    const withdrawalId = `wd-${shortUserId}-${Date.now()}`;

    // Call PayPal Payouts API
    console.log(`[wallet-withdraw] Creating PayPal payout: ${centsToDollars(amount_cents)} USD to ${destination}`);
    
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
      
      // Provide more helpful error messages for common issues
      let userMessage = payoutResult.error || 'PayPal payout failed';
      
      // Check for common sandbox issues
      const errorLower = (payoutResult.error || '').toLowerCase();
      if (errorLower.includes('receiver') || errorLower.includes('email')) {
        userMessage = `Invalid PayPal email. Make sure this email is linked to a verified PayPal account.`;
      } else if (errorLower.includes('insufficient') || errorLower.includes('balance')) {
        userMessage = 'PayPal payout service temporarily unavailable. Please try again later.';
      } else if (errorLower.includes('authorization') || errorLower.includes('permission')) {
        userMessage = 'PayPal payout service is not configured. Contact support.';
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: userMessage 
        } as WithdrawResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log(`[wallet-withdraw] PayPal payout created: batch ${payoutResult.batchId}, status: ${payoutResult.status}`);

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

    console.log(`[wallet-withdraw] User ${user.id} new balance: ${newBalance} cents`);

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

  } catch (error: unknown) {
    console.error('[wallet-withdraw] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ success: false, message } as WithdrawResponse),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

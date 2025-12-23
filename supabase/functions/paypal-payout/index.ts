// @ts-nocheck
// deno-lint-ignore-file
/**
 * paypal-payout Edge Function
 *
 * Sends a PayPal payout to a friend when they choose PayPal on the claim page.
 * 
 * POST /paypal-payout
 * Body: { token: string, paypalEmail: string }
 *
 * Flow:
 * 1. Validate claim token and status
 * 2. Update claim with payout_method='paypal' and paypal_email
 * 3. Call PayPal Payouts API
 * 4. Store batch_id and payout_item_id
 * 5. Update claim status to 'transferred'
 */

import { corsHeaders, handleCorsOptions } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/supabase.ts';
import { createPayout, centsToDollars } from '../_shared/paypal.ts';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface PaypalPayoutRequest {
  token: string;
  paypalEmail: string;
}

interface PaypalPayoutResponse {
  success: boolean;
  batchId?: string;
  message?: string;
  error?: string;
}

// ─────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────

function isValidEmail(email: string): boolean {
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// ─────────────────────────────────────────────────────────────
// Main Handler
// ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsOptions();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    // 1. Parse request body
    const body: PaypalPayoutRequest = await req.json();
    const { token, paypalEmail } = body;

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing token parameter' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!paypalEmail || !isValidEmail(paypalEmail)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid PayPal email address' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabase = createAdminClient();

    // 2. Look up claim by token
    const { data: claim, error: claimError } = await supabase
      .from('friend_claims')
      .select(`
        id,
        promise_id,
        friend_name,
        friend_email,
        claim_status,
        claim_token,
        claim_expires_at,
        amount_cents,
        payout_method
      `)
      .eq('claim_token', token)
      .single();

    if (claimError || !claim) {
      console.error('[paypal-payout] Claim not found:', claimError);
      return new Response(
        JSON.stringify({ success: false, error: 'Claim not found or invalid token' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 3. Validate claim status
    if (claim.claim_status !== 'notified') {
      console.error('[paypal-payout] Invalid claim status:', claim.claim_status);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: claim.claim_status === 'transferred' 
            ? 'This claim has already been paid out' 
            : 'This claim is not eligible for payout' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 4. Check if claim is expired
    const now = new Date();
    const claimExpiresAt = claim.claim_expires_at ? new Date(claim.claim_expires_at) : null;
    
    if (claimExpiresAt && claimExpiresAt < now) {
      console.error('[paypal-payout] Claim expired:', claim.claim_expires_at);
      return new Response(
        JSON.stringify({ success: false, error: 'This claim has expired' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 5. Check that we have an amount to pay out
    if (!claim.amount_cents || claim.amount_cents <= 0) {
      console.error('[paypal-payout] Invalid amount:', claim.amount_cents);
      return new Response(
        JSON.stringify({ success: false, error: 'No payout amount available' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 6. Get promise details for the payout note
    const { data: promise } = await supabase
      .from('promises')
      .select('text')
      .eq('id', claim.promise_id)
      .single();

    const promiseText = promise?.text || 'a promise';
    const truncatedPromise = promiseText.length > 50 
      ? promiseText.slice(0, 50) + '...' 
      : promiseText;

    // 7. Update claim with PayPal selection (before payout to track intent)
    const { error: updateError } = await supabase
      .from('friend_claims')
      .update({
        payout_method: 'paypal',
        paypal_email: paypalEmail,
      })
      .eq('id', claim.id);

    if (updateError) {
      console.error('[paypal-payout] Failed to update claim with PayPal info:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to process payout request' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 8. Call PayPal Payouts API
    console.log(`[paypal-payout] Initiating payout for claim ${claim.id}: ${claim.amount_cents} cents to ${paypalEmail}`);

    const payoutResult = await createPayout({
      claimId: claim.id,
      recipientEmail: paypalEmail,
      amountDollars: centsToDollars(claim.amount_cents),
      note: `Payout for broken promise: "${truncatedPromise}"`,
      emailSubject: "You've got money from OopsFee!",
      emailMessage: `${claim.friend_name || 'Someone'}'s friend didn't keep their promise. Here's your payout!`,
    });

    if (!payoutResult.success) {
      console.error('[paypal-payout] PayPal payout failed:', payoutResult.error);
      
      // Revert payout_method update on failure
      await supabase
        .from('friend_claims')
        .update({
          payout_method: null,
          paypal_email: null,
        })
        .eq('id', claim.id);

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: payoutResult.error || 'PayPal payout failed' 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 9. Update claim with payout details and mark as transferred
    const { error: finalUpdateError } = await supabase
      .from('friend_claims')
      .update({
        paypal_batch_id: payoutResult.batchId,
        paypal_payout_item_id: payoutResult.payoutItemId,
        claim_status: 'transferred',
      })
      .eq('id', claim.id);

    if (finalUpdateError) {
      // Payout was sent but we failed to update the claim
      // Log this for manual reconciliation but return success to user
      console.error('[paypal-payout] Failed to update claim status after successful payout:', finalUpdateError);
      console.error(`[paypal-payout] MANUAL RECONCILIATION NEEDED: claim ${claim.id}, batch ${payoutResult.batchId}`);
    }

    console.log(`[paypal-payout] Successfully initiated payout for claim ${claim.id}: batch ${payoutResult.batchId}`);

    // 10. Return success response
    const response: PaypalPayoutResponse = {
      success: true,
      batchId: payoutResult.batchId,
      message: `Payout of $${centsToDollars(claim.amount_cents)} initiated to ${paypalEmail}. Check your PayPal account!`,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[paypal-payout] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});


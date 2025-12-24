// @ts-nocheck
// deno-lint-ignore-file
/**
 * claim-payout-to-card Edge Function
 *
 * Sends an instant payout to a friend's debit card when they claim via the claim page.
 * Uses Stripe instant payouts with a lightweight Custom Connect account.
 *
 * POST /claim-payout-to-card
 * Body: {
 *   token: string,           // Claim token from URL
 *   card_number: string,     // Debit card number
 *   exp_month: number,       // Expiration month
 *   exp_year: number,        // Expiration year
 *   cvc?: string,            // CVC (optional but recommended)
 *   cardholder_name: string, // Name on card
 * }
 *
 * Flow:
 * 1. Validate claim token and status
 * 2. Create temporary Connect account for the recipient
 * 3. Add debit card as external account
 * 4. Create instant payout
 * 5. Update claim status to 'transferred'
 *
 * Fee: 1.5% instant payout fee (deducted from payout amount)
 */

import { corsHeaders, handleCorsOptions } from '../_shared/cors.ts';
import { createStripeClient } from '../_shared/stripe.ts';
import { createAdminClient } from '../_shared/supabase.ts';

// Fee percentage for instant payouts
const INSTANT_PAYOUT_FEE_PERCENT = 1.5;
const INSTANT_PAYOUT_FEE_CAP_CENTS = 1500; // $15 cap

interface ClaimPayoutToCardRequest {
  token: string;
  card_number: string;
  exp_month: number;
  exp_year: number;
  cvc?: string;
  cardholder_name: string;
}

interface ClaimPayoutToCardResponse {
  success: boolean;
  payout_amount?: number;     // Net amount sent in cents
  fee_amount?: number;        // Fee in cents
  message?: string;
  payout_id?: string;
  card_last4?: string;
  card_brand?: string;
  error?: string;
}

/**
 * Calculate instant payout fee
 */
function calculatePayoutFee(amountCents: number): number {
  const fee = Math.ceil(amountCents * (INSTANT_PAYOUT_FEE_PERCENT / 100));
  return Math.min(fee, INSTANT_PAYOUT_FEE_CAP_CENTS);
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsOptions();
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  try {
    // Parse request body
    const body: ClaimPayoutToCardRequest = await req.json();
    const { token, card_number, exp_month, exp_year, cvc, cardholder_name } = body;

    // Validate required fields
    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing token parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!card_number || !exp_month || !exp_year || !cardholder_name) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing card details' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createAdminClient();
    const stripe = createStripeClient();

    // Look up claim by token
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
      console.error('[claim-payout-to-card] Claim not found:', claimError);
      return new Response(
        JSON.stringify({ success: false, error: 'Claim not found or invalid token' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Validate claim status
    if (claim.claim_status !== 'notified') {
      console.error('[claim-payout-to-card] Invalid claim status:', claim.claim_status);
      return new Response(
        JSON.stringify({
          success: false,
          error: claim.claim_status === 'transferred'
            ? 'This claim has already been paid out'
            : 'This claim is not eligible for payout',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Check if claim is expired
    const now = new Date();
    const claimExpiresAt = claim.claim_expires_at ? new Date(claim.claim_expires_at) : null;

    if (claimExpiresAt && claimExpiresAt < now) {
      console.error('[claim-payout-to-card] Claim expired:', claim.claim_expires_at);
      return new Response(
        JSON.stringify({ success: false, error: 'This claim has expired' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Check that we have an amount to pay out
    if (!claim.amount_cents || claim.amount_cents <= 0) {
      console.error('[claim-payout-to-card] Invalid amount:', claim.amount_cents);
      return new Response(
        JSON.stringify({ success: false, error: 'No payout amount available' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Calculate fee and net payout
    const grossAmountCents = claim.amount_cents;
    const feeAmountCents = calculatePayoutFee(grossAmountCents);
    const netPayoutCents = grossAmountCents - feeAmountCents;

    const grossDisplay = `$${(grossAmountCents / 100).toFixed(2)}`;
    const netDisplay = `$${(netPayoutCents / 100).toFixed(2)}`;
    const feeDisplay = `$${(feeAmountCents / 100).toFixed(2)}`;

    console.log(`[claim-payout-to-card] Processing claim ${claim.id}: ${grossDisplay} (net: ${netDisplay}, fee: ${feeDisplay})`);

    // Update claim to indicate card payout in progress
    const { error: updateError } = await supabase
      .from('friend_claims')
      .update({
        payout_method: 'card',
      })
      .eq('id', claim.id);

    if (updateError) {
      console.error('[claim-payout-to-card] Failed to update claim:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to process payout request' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Step 1: Create temporary Connect account for this payout
    let connectAccountId: string;

    try {
      const account = await stripe.accounts.create({
        type: 'custom',
        country: 'US',
        email: claim.friend_email || undefined,
        capabilities: {
          transfers: { requested: true },
        },
        business_type: 'individual',
        business_profile: {
          mcc: '5969',
          url: 'https://oopsfee.app',
        },
        individual: {
          email: claim.friend_email || undefined,
          first_name: cardholder_name.split(' ')[0] || 'Recipient',
          last_name: cardholder_name.split(' ').slice(1).join(' ') || 'User',
        },
        tos_acceptance: {
          date: Math.floor(Date.now() / 1000),
          ip: req.headers.get('x-forwarded-for')?.split(',')[0] || '0.0.0.0',
        },
        metadata: {
          claim_id: claim.id,
          purpose: 'claim_card_payout',
        },
      });

      connectAccountId = account.id;
      console.log(`[claim-payout-to-card] Created Connect account: ${connectAccountId}`);

    } catch (createError: unknown) {
      const err = createError as { message?: string };
      console.error('[claim-payout-to-card] Failed to create Connect account:', err);

      // Revert payout method
      await supabase
        .from('friend_claims')
        .update({ payout_method: null })
        .eq('id', claim.id);

      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to set up payout: ${err.message || 'Unknown error'}`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Step 2: Add debit card as external account
    let externalAccountId: string;
    let cardLast4: string;
    let cardBrand: string;

    try {
      // Create card token
      const tokenResult = await stripe.tokens.create({
        card: {
          number: card_number,
          exp_month: exp_month,
          exp_year: exp_year,
          cvc: cvc,
          currency: 'usd',
          name: cardholder_name,
        },
      });

      // Verify it's a debit card
      if (tokenResult.card?.funding !== 'debit') {
        // Clean up Connect account
        await stripe.accounts.del(connectAccountId).catch(() => {});

        // Revert payout method
        await supabase
          .from('friend_claims')
          .update({ payout_method: null })
          .eq('id', claim.id);

        return new Response(
          JSON.stringify({
            success: false,
            error: 'Only debit cards are eligible for instant payouts. Please use a debit card.',
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      // Add as external account
      const externalAccount = await stripe.accounts.createExternalAccount(connectAccountId, {
        external_account: tokenResult.id,
        default_for_currency: true,
      });

      externalAccountId = externalAccount.id;
      cardLast4 = externalAccount.last4;
      cardBrand = externalAccount.brand;

      console.log(`[claim-payout-to-card] Added card ending in ${cardLast4}`);

    } catch (cardError: unknown) {
      const err = cardError as { code?: string; message?: string; decline_code?: string };
      console.error('[claim-payout-to-card] Failed to add card:', err);

      // Clean up Connect account
      await stripe.accounts.del(connectAccountId).catch(() => {});

      // Revert payout method
      await supabase
        .from('friend_claims')
        .update({ payout_method: null })
        .eq('id', claim.id);

      let userMessage = 'Failed to add card';
      if (err.code === 'card_declined' || err.decline_code) {
        userMessage = 'Card declined. Please try a different card.';
      } else if (err.code === 'invalid_card_type') {
        userMessage = 'This card type is not supported for instant payouts.';
      } else if (err.code === 'incorrect_number') {
        userMessage = 'Invalid card number.';
      } else if (err.code === 'invalid_expiry_month' || err.code === 'invalid_expiry_year') {
        userMessage = 'Invalid expiration date.';
      } else if (err.message) {
        userMessage = err.message;
      }

      return new Response(
        JSON.stringify({ success: false, error: userMessage }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Step 3: Create instant payout
    let payout;
    try {
      payout = await stripe.payouts.create(
        {
          amount: netPayoutCents,
          currency: 'usd',
          method: 'instant',
          destination: externalAccountId,
          description: `OopsFee claim payout`,
          metadata: {
            claim_id: claim.id,
            gross_amount: grossAmountCents,
            fee_amount: feeAmountCents,
          },
        },
        {
          stripeAccount: connectAccountId,
        }
      );

      console.log(`[claim-payout-to-card] Payout created: ${payout.id}, status: ${payout.status}`);

    } catch (payoutError: unknown) {
      const err = payoutError as { code?: string; message?: string };
      console.error('[claim-payout-to-card] Payout failed:', err);

      // Clean up Connect account
      await stripe.accounts.del(connectAccountId).catch(() => {});

      // Revert payout method
      await supabase
        .from('friend_claims')
        .update({ payout_method: null })
        .eq('id', claim.id);

      let userMessage = 'Payout failed';
      if (err.code === 'instant_payouts_unsupported') {
        userMessage = 'This card does not support instant payouts. Please try a different debit card.';
      } else if (err.message) {
        userMessage = `Payout failed: ${err.message}`;
      }

      return new Response(
        JSON.stringify({ success: false, error: userMessage }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Step 4: Update claim as transferred
    const { error: finalUpdateError } = await supabase
      .from('friend_claims')
      .update({
        claim_status: 'transferred',
        card_payout_transfer_id: payout.id,
        card_last4: cardLast4,
        card_brand: cardBrand,
      })
      .eq('id', claim.id);

    if (finalUpdateError) {
      console.error('[claim-payout-to-card] Failed to update claim status after payout:', finalUpdateError);
      console.error(`[claim-payout-to-card] MANUAL RECONCILIATION NEEDED: claim ${claim.id}, payout ${payout.id}`);
    }

    console.log(`[claim-payout-to-card] Successfully completed payout for claim ${claim.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        payout_amount: netPayoutCents,
        fee_amount: feeAmountCents,
        message: `Sent ${netDisplay} to your card ending in ${cardLast4}. Funds arrive within minutes!`,
        payout_id: payout.id,
        card_last4: cardLast4,
        card_brand: cardBrand,
      } as ClaimPayoutToCardResponse),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (error: unknown) {
    console.error('[claim-payout-to-card] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});


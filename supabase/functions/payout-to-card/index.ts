// @ts-nocheck
// deno-lint-ignore-file
/**
 * payout-to-card Edge Function
 *
 * Sends user's wallet balance instantly to their debit card via Stripe.
 * Uses Stripe Connect Custom accounts with minimal onboarding for card payouts.
 *
 * Flow:
 * 1. Check if user has a payout Connect account, create if not
 * 2. Tokenize/attach debit card as external account (or use saved)
 * 3. Create instant payout to the debit card
 * 4. Debit user's wallet
 *
 * Fee: Stripe charges 1.5% for instant payouts (capped at $15)
 */

import { corsHeaders, handleCorsOptions } from '../_shared/cors.ts';
import { createStripeClient } from '../_shared/stripe.ts';
import { createAdminClient, getUserFromRequest } from '../_shared/supabase.ts';

// Minimum payout amount in cents
const MIN_PAYOUT_CENTS = 500; // $5

// Maximum payout amount in cents (Stripe instant payout limit)
const MAX_PAYOUT_CENTS = 100000; // $1,000

// Stripe instant payout fee percentage
const INSTANT_PAYOUT_FEE_PERCENT = 1.5;
const INSTANT_PAYOUT_FEE_CAP_CENTS = 1500; // $15 cap

interface PayoutToCardRequest {
  amount_cents: number;
  // Card details for new card
  card_number?: string;
  exp_month?: number;
  exp_year?: number;
  cvc?: string;
  // Or use saved card (fingerprint to identify)
  use_saved_card?: boolean;
  // Cardholder name (required for new cards)
  cardholder_name?: string;
}

interface PayoutToCardResponse {
  success: boolean;
  balance?: number;           // New balance in cents after payout
  payout_amount?: number;     // Net amount sent in cents
  fee_amount?: number;        // Fee charged in cents
  message: string;
  payout_id?: string;
  card_last4?: string;
  card_brand?: string;
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
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // Authenticate user
    const user = await getUserFromRequest(req);
    if (!user) {
      return new Response(
        JSON.stringify({ success: false, message: 'Unauthorized' } as PayoutToCardResponse),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Parse request
    const body = await req.json();
    const {
      amount_cents,
      card_number,
      exp_month,
      exp_year,
      cvc,
      use_saved_card,
      cardholder_name,
    } = body as PayoutToCardRequest;

    // Validate amount
    if (!amount_cents || typeof amount_cents !== 'number') {
      return new Response(
        JSON.stringify({ success: false, message: 'Missing or invalid amount_cents' } as PayoutToCardResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (amount_cents < MIN_PAYOUT_CENTS) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Minimum payout is $${(MIN_PAYOUT_CENTS / 100).toFixed(0)}`,
        } as PayoutToCardResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (amount_cents > MAX_PAYOUT_CENTS) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Maximum instant payout is $${(MAX_PAYOUT_CENTS / 100).toFixed(0)}`,
        } as PayoutToCardResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Validate card details provided (either new card OR use saved)
    const hasNewCardDetails = card_number && exp_month && exp_year;
    if (!hasNewCardDetails && !use_saved_card) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Provide card details or use_saved_card flag',
        } as PayoutToCardResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createAdminClient();
    const stripe = createStripeClient();

    // Get user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('balance_cents, email, display_name, payout_connect_account_id, payout_card_last4, payout_card_fingerprint')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('[payout-to-card] Profile not found:', profileError);
      return new Response(
        JSON.stringify({ success: false, message: 'Profile not found' } as PayoutToCardResponse),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { balance_cents } = profile;

    // Calculate fee - user pays the fee from their balance
    const feeAmountCents = calculatePayoutFee(amount_cents);
    const totalDebitCents = amount_cents; // Total debited from wallet
    const netPayoutCents = amount_cents - feeAmountCents; // What user actually receives

    // Check sufficient balance (amount + we could charge fee separately, but keeping it simple)
    if (balance_cents < totalDebitCents) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Insufficient balance. You have $${(balance_cents / 100).toFixed(2)} available.`,
        } as PayoutToCardResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const amountDisplay = `$${(amount_cents / 100).toFixed(2)}`;
    const netDisplay = `$${(netPayoutCents / 100).toFixed(2)}`;
    const feeDisplay = `$${(feeAmountCents / 100).toFixed(2)}`;

    console.log(`[payout-to-card] Processing ${amountDisplay} payout (net: ${netDisplay}, fee: ${feeDisplay}) for user ${user.id}`);

    // Step 1: Get or create payout Connect account
    let connectAccountId = profile.payout_connect_account_id;

    if (!connectAccountId) {
      console.log(`[payout-to-card] Creating payout Connect account for user ${user.id}`);

      try {
        // Create minimal Custom Connect account for payouts
        const account = await stripe.accounts.create({
          type: 'custom',
          country: 'US',
          email: profile.email || user.email,
          capabilities: {
            // Only request card_payments capability for receiving card payouts
            transfers: { requested: true },
          },
          business_type: 'individual',
          business_profile: {
            mcc: '5969', // Other direct marketers
            url: 'https://oopsfee.app',
          },
          individual: {
            email: profile.email || user.email,
            first_name: profile.display_name?.split(' ')[0] || 'User',
            last_name: profile.display_name?.split(' ').slice(1).join(' ') || user.id.slice(0, 8),
          },
          tos_acceptance: {
            date: Math.floor(Date.now() / 1000),
            ip: req.headers.get('x-forwarded-for')?.split(',')[0] || '0.0.0.0',
          },
          metadata: {
            user_id: user.id,
            purpose: 'card_payout',
          },
        });

        connectAccountId = account.id;
        console.log(`[payout-to-card] Created Connect account: ${connectAccountId}`);

        // Save to profile
        await supabase
          .from('profiles')
          .update({ payout_connect_account_id: connectAccountId })
          .eq('id', user.id);

      } catch (createError: unknown) {
        const err = createError as { message?: string };
        console.error('[payout-to-card] Failed to create Connect account:', err);
        return new Response(
          JSON.stringify({
            success: false,
            message: `Failed to set up payout account: ${err.message || 'Unknown error'}`,
          } as PayoutToCardResponse),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    // Step 2: Add or retrieve external card
    let externalAccountId: string;
    let cardLast4: string;
    let cardBrand: string;

    if (use_saved_card && profile.payout_card_fingerprint) {
      // Use saved card - find it in external accounts
      console.log(`[payout-to-card] Using saved card ending in ${profile.payout_card_last4}`);

      try {
        const externalAccounts = await stripe.accounts.listExternalAccounts(connectAccountId, {
          object: 'card',
          limit: 10,
        });

        const savedCard = externalAccounts.data.find(
          (ea: { fingerprint?: string }) => ea.fingerprint === profile.payout_card_fingerprint
        );

        if (!savedCard) {
          return new Response(
            JSON.stringify({
              success: false,
              message: 'Saved card not found. Please add a new card.',
            } as PayoutToCardResponse),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }

        externalAccountId = savedCard.id;
        cardLast4 = savedCard.last4;
        cardBrand = savedCard.brand;

      } catch (listError: unknown) {
        const err = listError as { message?: string };
        console.error('[payout-to-card] Failed to list external accounts:', err);
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Failed to retrieve saved card',
          } as PayoutToCardResponse),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

    } else {
      // Add new card
      if (!card_number || !exp_month || !exp_year) {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Card number, expiration month, and year are required',
          } as PayoutToCardResponse),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      console.log(`[payout-to-card] Adding new card for user ${user.id}`);

      try {
        // Create card token first
        const token = await stripe.tokens.create({
          card: {
            number: card_number,
            exp_month: exp_month,
            exp_year: exp_year,
            cvc: cvc,
            currency: 'usd',
            name: cardholder_name || profile.display_name || 'Cardholder',
          },
        });

        // Verify it's a debit card
        if (token.card?.funding !== 'debit') {
          return new Response(
            JSON.stringify({
              success: false,
              message: 'Only debit cards are eligible for instant payouts. Please use a debit card.',
            } as PayoutToCardResponse),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }

        // Add as external account to Connect account
        const externalAccount = await stripe.accounts.createExternalAccount(connectAccountId, {
          external_account: token.id,
          default_for_currency: true,
        });

        externalAccountId = externalAccount.id;
        cardLast4 = externalAccount.last4;
        cardBrand = externalAccount.brand;

        console.log(`[payout-to-card] Added card ending in ${cardLast4}`);

        // Save card info to profile for future use
        await supabase
          .from('profiles')
          .update({
            payout_card_last4: cardLast4,
            payout_card_brand: cardBrand,
            payout_card_fingerprint: externalAccount.fingerprint,
          })
          .eq('id', user.id);

      } catch (cardError: unknown) {
        const err = cardError as { code?: string; message?: string; decline_code?: string };
        console.error('[payout-to-card] Failed to add card:', err);

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
          JSON.stringify({
            success: false,
            message: userMessage,
          } as PayoutToCardResponse),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    // Step 3: Create instant payout
    console.log(`[payout-to-card] Creating instant payout of ${netDisplay} to card ${externalAccountId}`);

    let payout;
    try {
      // Create payout to the debit card
      // Note: Net amount is sent (amount minus fee)
      payout = await stripe.payouts.create(
        {
          amount: netPayoutCents,
          currency: 'usd',
          method: 'instant',
          destination: externalAccountId,
          description: `OopsFee instant withdrawal`,
          metadata: {
            user_id: user.id,
            gross_amount: amount_cents,
            fee_amount: feeAmountCents,
          },
        },
        {
          stripeAccount: connectAccountId,
        }
      );

      console.log(`[payout-to-card] Payout created: ${payout.id}, status: ${payout.status}`);

    } catch (payoutError: unknown) {
      const err = payoutError as { code?: string; message?: string };
      console.error('[payout-to-card] Payout failed:', err);

      let userMessage = 'Payout failed';
      if (err.code === 'balance_insufficient') {
        // Platform balance issue
        userMessage = 'Payout service temporarily unavailable. Please try again later.';
      } else if (err.code === 'instant_payouts_unsupported') {
        userMessage = 'This card does not support instant payouts. Please try a different debit card.';
      } else if (err.code === 'payout_not_allowed') {
        userMessage = 'Payouts are not available for this account. Please contact support.';
      } else if (err.message) {
        userMessage = `Payout failed: ${err.message}`;
      }

      return new Response(
        JSON.stringify({
          success: false,
          message: userMessage,
        } as PayoutToCardResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Step 4: Debit user's wallet
    const { data: newBalance, error: debitError } = await supabase.rpc('debit_wallet_withdraw', {
      target_user_id: user.id,
      amount_cents: totalDebitCents,
      paypal_batch: null, // Not a PayPal transaction
      description_text: `Instant payout to card •••• ${cardLast4} (Stripe: ${payout.id})`,
    });

    if (debitError) {
      console.error('[payout-to-card] Debit wallet error:', debitError);
      // Payout was created but debit failed - CRITICAL: log for manual intervention
      console.error(`[payout-to-card] CRITICAL: Payout ${payout.id} created but wallet debit failed for user ${user.id}`);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Payout initiated but wallet debit failed. Contact support.',
          payout_id: payout.id,
        } as PayoutToCardResponse),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (newBalance === -1) {
      // Insufficient balance (shouldn't happen since we checked earlier)
      console.error('[payout-to-card] Unexpected insufficient balance after payout');
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Insufficient balance',
          payout_id: payout.id,
        } as PayoutToCardResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log(`[payout-to-card] User ${user.id} new balance: ${newBalance} cents. Payout complete.`);

    return new Response(
      JSON.stringify({
        success: true,
        balance: newBalance,
        payout_amount: netPayoutCents,
        fee_amount: feeAmountCents,
        message: `Sent ${netDisplay} to your card ending in ${cardLast4}. ${feeDisplay} instant payout fee applied. Funds arrive within minutes.`,
        payout_id: payout.id,
        card_last4: cardLast4,
        card_brand: cardBrand,
      } as PayoutToCardResponse),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (error: unknown) {
    console.error('[payout-to-card] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ success: false, message } as PayoutToCardResponse),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});


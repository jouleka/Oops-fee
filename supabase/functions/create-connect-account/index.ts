// @ts-nocheck
// deno-lint-ignore-file
/**
 * create-connect-account Edge Function
 *
 * Creates a Stripe Connect Express account for a friend to receive payouts.
 * Returns an onboarding link that the friend uses to complete setup.
 *
 * POST /create-connect-account
 * Body: { token: string }  // claim token
 *
 * Returns: { accountId: string, onboardingUrl: string }
 */

import { corsHeaders, handleCorsOptions } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/supabase.ts';
import { createStripeClient } from '../_shared/stripe.ts';

const APP_URL = Deno.env.get('APP_URL') || 'https://oopsfee.app';

// ─────────────────────────────────────────────────────────────
// Main Handler
// ─────────────────────────────────────────────────────────────

interface CreateConnectAccountRequest {
  token: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsOptions();
  }

  try {
    // 1. Parse request body
    const body: CreateConnectAccountRequest = await req.json();
    const { token } = body;

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Missing token' }),
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
        stripe_account_id,
        stripe_account_status,
        claim_status,
        claim_expires_at,
        amount_cents
      `)
      .eq('claim_token', token)
      .single();

    if (claimError || !claim) {
      return new Response(
        JSON.stringify({ error: 'Claim not found or invalid token' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 3. Validate claim status
    if (claim.claim_status !== 'notified') {
      if (claim.claim_status === 'pending') {
        return new Response(
          JSON.stringify({ error: 'Claim is not yet available - the promise is still active' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      if (claim.claim_status === 'expired') {
        return new Response(
          JSON.stringify({ error: 'This claim has expired' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      if (claim.claim_status === 'transferred') {
        return new Response(
          JSON.stringify({ error: 'Funds have already been transferred' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      if (claim.claim_status === 'claimed') {
        // Already started onboarding - return existing account link
        if (claim.stripe_account_id) {
          const stripe = createStripeClient();
          const accountLink = await stripe.accountLinks.create({
            account: claim.stripe_account_id,
            refresh_url: `${APP_URL}/claim/${token}?refresh=true`,
            return_url: `${APP_URL}/claim/${token}?success=true`,
            type: 'account_onboarding',
          });

          return new Response(
            JSON.stringify({
              accountId: claim.stripe_account_id,
              onboardingUrl: accountLink.url,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
      }
    }

    // 4. Check if claim has expired
    if (claim.claim_expires_at) {
      const expiresAt = new Date(claim.claim_expires_at);
      if (expiresAt < new Date()) {
        // Update claim status to expired
        await supabase
          .from('friend_claims')
          .update({ claim_status: 'expired' })
          .eq('id', claim.id);

        return new Response(
          JSON.stringify({ error: 'This claim has expired' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // 5. Check if friend already has a Stripe account from a previous claim
    let stripeAccountId = claim.stripe_account_id;
    const stripe = createStripeClient();

    if (!stripeAccountId && claim.friend_email) {
      // Check if this email has an existing Connect account from another claim
      const { data: existingClaims } = await supabase
        .from('friend_claims')
        .select('stripe_account_id, stripe_account_status')
        .eq('friend_email', claim.friend_email)
        .not('stripe_account_id', 'is', null)
        .limit(1);

      if (existingClaims && existingClaims.length > 0) {
        const existingAccount = existingClaims[0];
        // Verify the account still exists in Stripe
        try {
          const account = await stripe.accounts.retrieve(existingAccount.stripe_account_id);
          if (account && !account.deleted) {
            stripeAccountId = existingAccount.stripe_account_id;
            
            // Update this claim with the existing account
            await supabase
              .from('friend_claims')
              .update({
                stripe_account_id: stripeAccountId,
                stripe_account_status: existingAccount.stripe_account_status,
                claim_status: 'claimed',
              })
              .eq('id', claim.id);

            // If account is already active, transfer immediately
            if (account.charges_enabled && account.payouts_enabled) {
              console.log('[create-connect-account] Account already active, triggering transfer');
              
              // Only transfer if claim has pending funds and hasn't been transferred
              if (claim.amount_cents && claim.amount_cents > 0 && claim.claim_status === 'notified') {
                try {
                  const transfer = await stripe.transfers.create({
                    amount: claim.amount_cents,
                    currency: 'usd',
                    destination: stripeAccountId,
                    metadata: {
                      claim_id: claim.id,
                    },
                  });

                  console.log('[create-connect-account] Transfer created:', transfer.id);

                  // Update claim to transferred
                  await supabase
                    .from('friend_claims')
                    .update({
                      stripe_account_id: stripeAccountId,
                      stripe_account_status: 'active',
                      claim_status: 'transferred',
                      transfer_id: transfer.id,
                    })
                    .eq('id', claim.id);

                  return new Response(
                    JSON.stringify({
                      accountId: stripeAccountId,
                      transferred: true,
                      transferId: transfer.id,
                      message: 'Funds have been transferred to your account',
                    }),
                    {
                      status: 200,
                      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    }
                  );
                } catch (transferError: unknown) {
                  const transferMessage = transferError instanceof Error 
                    ? transferError.message 
                    : 'Transfer failed';
                  console.error('[create-connect-account] Transfer failed:', transferMessage);
                  // Continue to return onboarding link - account may need updates
                }
              }
            }
          }
        } catch {
          // Account doesn't exist, create new one
          stripeAccountId = null;
        }
      }
    }

    // 6. Create new Stripe Connect Express account if needed
    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'US', // Default to US, can be changed during onboarding
        email: claim.friend_email || undefined,
        capabilities: {
          transfers: { requested: true },
        },
        business_type: 'individual',
        metadata: {
          claim_id: claim.id,
          promise_id: claim.promise_id,
          friend_name: claim.friend_name,
        },
      });

      stripeAccountId = account.id;

      // Update claim with Stripe account info
      const { error: updateError } = await supabase
        .from('friend_claims')
        .update({
          stripe_account_id: stripeAccountId,
          stripe_account_status: 'onboarding',
          claim_status: 'claimed',
        })
        .eq('id', claim.id);

      if (updateError) {
        console.error('[create-connect-account] Failed to update claim:', updateError);
      }

      console.log('[create-connect-account] Created Stripe account:', {
        claimId: claim.id,
        accountId: stripeAccountId,
      });
    }

    // 7. Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${APP_URL}/claim/${token}?refresh=true`,
      return_url: `${APP_URL}/claim/${token}?success=true`,
      type: 'account_onboarding',
    });

    return new Response(
      JSON.stringify({
        accountId: stripeAccountId,
        onboardingUrl: accountLink.url,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    console.error('[create-connect-account] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});


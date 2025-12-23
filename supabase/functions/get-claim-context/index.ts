// @ts-nocheck
// deno-lint-ignore-file
/**
 * get-claim-context Edge Function
 *
 * Public endpoint to get claim context for rendering the claim page.
 * Looks up claim by token and returns promise/claim details.
 *
 * GET /get-claim-context?token={claimToken}
 *
 * Returns: ClaimContext object with all necessary info for the claim page
 */

import { corsHeaders, handleCorsOptions } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/supabase.ts';

// ─────────────────────────────────────────────────────────────
// Main Handler
// ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsOptions();
  }

  try {
    // 1. Get token from query params
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Missing token parameter' }),
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
        claim_token,
        claim_expires_at,
        amount_cents,
        transfer_id,
        created_at,
        payout_method,
        paypal_email,
        paypal_batch_id,
        paypal_payout_item_id
      `)
      .eq('claim_token', token)
      .single();

    if (claimError || !claim) {
      console.error('[get-claim-context] Claim not found:', claimError);
      return new Response(
        JSON.stringify({ error: 'Claim not found or invalid token' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 3. Get promise details
    const { data: promise, error: promiseError } = await supabase
      .from('promises')
      .select(`
        id,
        text,
        stake,
        deadline_at,
        status,
        completed_at,
        failed_at,
        expired_at,
        user_id
      `)
      .eq('id', claim.promise_id)
      .single();

    if (promiseError || !promise) {
      console.error('[get-claim-context] Promise not found:', promiseError);
      return new Response(
        JSON.stringify({ error: 'Associated promise not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 4. Get user's display name
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', promise.user_id)
      .single();

    const userName = profile?.display_name || 'Someone';

    // 5. Determine promise status
    let promiseStatus: 'active' | 'completed' | 'failed' | 'expired' = 'active';
    if (promise.status === 'completed' || promise.completed_at) {
      promiseStatus = 'completed';
    } else if (promise.status === 'failed' || promise.failed_at) {
      promiseStatus = 'failed';
    } else if (promise.status === 'expired' || promise.expired_at) {
      promiseStatus = 'expired';
    }

    // 6. Calculate derived states
    const now = new Date();
    const claimExpiresAt = claim.claim_expires_at ? new Date(claim.claim_expires_at) : null;
    const isExpired = claimExpiresAt ? claimExpiresAt < now : false;
    const isTransferred = claim.claim_status === 'transferred';
    
    // Can claim if: status is 'notified', not expired, and not already transferred
    const canClaim = claim.claim_status === 'notified' && !isExpired && !isTransferred;

    // Calculate days until expiry
    let daysUntilExpiry: number | null = null;
    if (claimExpiresAt && canClaim) {
      const diffMs = claimExpiresAt.getTime() - now.getTime();
      daysUntilExpiry = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    // 7. Build response - all money values in dollars for UI
    const response = {
      claimId: claim.id,
      claimStatus: claim.claim_status,
      claimExpiresAt: claim.claim_expires_at,
      amount: claim.amount_cents ? claim.amount_cents / 100 : null, // convert cents to dollars
      
      friendName: claim.friend_name,
      
      promiseText: promise.text,
      stake: promise.stake, // in dollars
      deadline: promise.deadline_at,
      promiseStatus,
      
      userName,
      
      stripeAccountStatus: claim.stripe_account_status,
      
      // PayPal payout info
      payoutMethod: claim.payout_method, // 'stripe' | 'paypal' | null
      paypalEmail: claim.paypal_email,
      paypalBatchId: claim.paypal_batch_id,
      
      canClaim,
      isExpired,
      isTransferred,
      daysUntilExpiry,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('[get-claim-context] Error:', error);
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


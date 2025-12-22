// @ts-nocheck
// deno-lint-ignore-file
/**
 * settle-promises Edge Function (Cron)
 *
 * Runs every 5 minutes to:
 * 1. Auto-fail/expire promises past their settlement deadline
 * 2. Handle partner verification timeouts
 * 3. Create off-session Stripe charges for failed promises
 * 4. Retry previously failed payments
 *
 * This function is invoked by Supabase cron (pg_cron) or external scheduler.
 * It uses the service role key to bypass RLS.
 */

import { corsHeaders, handleCorsOptions } from '../_shared/cors.ts';
import { createStripeClient } from '../_shared/stripe.ts';
import { createAdminClient } from '../_shared/supabase.ts';

// Grace period after deadline before auto-fail (1 hour)
const GRACE_PERIOD_MS = 60 * 60 * 1000;

// Retry schedule: immediate, 24h, 72h (3 days), 168h (7 days)
const RETRY_DELAYS_HOURS = [0, 24, 72, 168];
const MAX_RETRIES = 4;

// High-stakes threshold: $50 - default to fail if partner doesn't respond
// Stake is stored in dollars
const HIGH_STAKES_THRESHOLD = 50;

// Batch size for processing (avoid timeouts)
const BATCH_SIZE = 50;

interface Promise {
  id: string;
  user_id: string;
  text: string;
  stake: number;
  sponsor_total: number | null; // Stored in cents
  status: string;
  deadline_at: string;
  settle_at: string;
  verification_type: string;
  partner_state: string | null;
  partner_deadline_at: string | null;
  payment_status: string | null;
  payment_retry_count: number;
  payment_next_retry_at: string | null;
}

interface Profile {
  id: string;
  stripe_customer_id: string | null;
  default_payment_method_id: string | null;
  failed_payment_count: number;
  payment_blocked: boolean;
}

interface SettlementResult {
  promiseId: string;
  action: 'completed' | 'failed' | 'expired' | 'pending_partner' | 'charged' | 'charge_failed' | 'requires_action' | 'no_payment_method' | 'skipped';
  message: string;
  paymentIntentId?: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsOptions();
  }

  // Accept both GET (for cron) and POST (for manual trigger)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Optional: Verify cron secret for security
  const cronSecret = Deno.env.get('SETTLEMENT_CRON_SECRET');
  if (cronSecret) {
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  try {
    const supabase = createAdminClient();
    const stripe = createStripeClient();
    const now = new Date();

    const results: SettlementResult[] = [];

    // =========================================================================
    // STEP 1: Find promises that need settlement (past settle_at)
    // =========================================================================
    const { data: promisesToSettle, error: settleError } = await supabase
      .from('promises')
      .select('*')
      .eq('status', 'active')
      .lt('settle_at', now.toISOString())
      .limit(BATCH_SIZE);

    if (settleError) {
      console.error('[settle-promises] Error fetching promises to settle:', settleError);
      throw settleError;
    }

    console.log(`[settle-promises] Found ${promisesToSettle?.length ?? 0} promises to settle`);

    // Process each promise
    for (const promise of (promisesToSettle ?? []) as Promise[]) {
      const result = await processPromiseSettlement(promise, supabase, stripe, now);
      results.push(result);
    }

    // =========================================================================
    // STEP 2: Retry failed payments that are due
    // =========================================================================
    const { data: paymentsToRetry, error: retryError } = await supabase
      .from('promises')
      .select('*')
      .eq('payment_status', 'failed')
      .lt('payment_next_retry_at', now.toISOString())
      .limit(BATCH_SIZE);

    if (retryError) {
      console.error('[settle-promises] Error fetching payments to retry:', retryError);
      throw retryError;
    }

    console.log(`[settle-promises] Found ${paymentsToRetry?.length ?? 0} payments to retry`);

    // Retry each failed payment
    for (const promise of (paymentsToRetry ?? []) as Promise[]) {
      const result = await retryPayment(promise, supabase, stripe);
      results.push(result);
    }

    // Summary
    const summary = {
      timestamp: now.toISOString(),
      promisesSettled: promisesToSettle?.length ?? 0,
      paymentsRetried: paymentsToRetry?.length ?? 0,
      results,
    };

    console.log('[settle-promises] Settlement complete:', JSON.stringify(summary, null, 2));

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('[settle-promises] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

/**
 * Process settlement for a single promise
 */
async function processPromiseSettlement(
  promise: Promise,
  supabase: ReturnType<typeof createAdminClient>,
  stripe: ReturnType<typeof createStripeClient>,
  now: Date,
): Promise<SettlementResult> {
  console.log(`[settle-promises] Processing promise: ${promise.id}`);

  // =========================================================================
  // PARTNER VERIFICATION HANDLING
  // =========================================================================
  if (promise.verification_type === 'partner') {
    // Check if we're still waiting for partner response
    if (promise.partner_state === 'awaiting') {
      const partnerDeadline = promise.partner_deadline_at
        ? new Date(promise.partner_deadline_at)
        : null;

      // Partner deadline not yet passed - skip this promise
      if (partnerDeadline && partnerDeadline > now) {
        return {
          promiseId: promise.id,
          action: 'pending_partner',
          message: `Waiting for partner response until ${partnerDeadline.toISOString()}`,
        };
      }

      // Partner deadline passed - apply timeout logic
      console.log(`[settle-promises] Partner deadline expired for promise: ${promise.id}`);

      if (promise.stake >= HIGH_STAKES_THRESHOLD) {
        // High stakes: default to FAILED (prevent gaming)
        return await markPromiseFailed(
          promise,
          supabase,
          stripe,
          'partner_expired_high_stakes',
        );
      } else {
        // Low stakes: benefit of the doubt, mark as completed
        return await markPromiseCompleted(
          promise,
          supabase,
          'partner_expired_low_stakes',
        );
      }
    }

    // Partner already approved - mark completed
    if (promise.partner_state === 'approved') {
      return await markPromiseCompleted(promise, supabase, 'partner_approved');
    }

    // Partner rejected - mark failed
    if (promise.partner_state === 'rejected') {
      return await markPromiseFailed(promise, supabase, stripe, 'partner_rejected');
    }
  }

  // =========================================================================
  // STANDARD PROMISE SETTLEMENT (no verification submitted = failed)
  // =========================================================================
  
  // Promise deadline + grace period has passed with no completion
  return await markPromiseFailed(promise, supabase, stripe, 'deadline_passed');
}

/**
 * Mark a promise as completed
 */
async function markPromiseCompleted(
  promise: Promise,
  supabase: ReturnType<typeof createAdminClient>,
  reason: string,
): Promise<SettlementResult> {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('promises')
    .update({
      status: 'completed',
      completed_at: now,
      partner_state: promise.partner_state === 'awaiting' ? 'expired' : promise.partner_state,
    })
    .eq('id', promise.id);

  if (error) {
    console.error(`[settle-promises] Error marking promise ${promise.id} as completed:`, error);
    return {
      promiseId: promise.id,
      action: 'skipped',
      message: `Failed to update: ${error.message}`,
    };
  }

  console.log(`[settle-promises] Promise ${promise.id} marked as completed (${reason})`);

  return {
    promiseId: promise.id,
    action: 'completed',
    message: `Marked completed: ${reason}`,
  };
}

/**
 * Mark a promise as failed and initiate payment if applicable
 */
async function markPromiseFailed(
  promise: Promise,
  supabase: ReturnType<typeof createAdminClient>,
  stripe: ReturnType<typeof createStripeClient>,
  reason: string,
): Promise<SettlementResult> {
  const now = new Date().toISOString();

  // Update promise status to failed
  const { error: updateError } = await supabase
    .from('promises')
    .update({
      status: 'failed',
      failed_at: now,
      partner_state: promise.partner_state === 'awaiting' ? 'expired' : promise.partner_state,
    })
    .eq('id', promise.id);

  if (updateError) {
    console.error(`[settle-promises] Error marking promise ${promise.id} as failed:`, updateError);
    return {
      promiseId: promise.id,
      action: 'skipped',
      message: `Failed to update: ${updateError.message}`,
    };
  }

  console.log(`[settle-promises] Promise ${promise.id} marked as failed (${reason})`);

  // If no stake, we're done
  if (promise.stake <= 0) {
    return {
      promiseId: promise.id,
      action: 'failed',
      message: `Marked failed (no stake): ${reason}`,
    };
  }

  // Attempt to charge for the failed promise
  return await chargeForFailedPromise(promise, supabase, stripe, 1);
}

/**
 * Charge user for a failed promise using off-session payment
 */
async function chargeForFailedPromise(
  promise: Promise,
  supabase: ReturnType<typeof createAdminClient>,
  stripe: ReturnType<typeof createStripeClient>,
  attemptNumber: number,
): Promise<SettlementResult> {
  // Get user's payment info
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('stripe_customer_id, default_payment_method_id')
    .eq('id', promise.user_id)
    .single();

  if (profileError || !profile) {
    console.error(`[settle-promises] Error fetching profile for user ${promise.user_id}:`, profileError);
    return {
      promiseId: promise.id,
      action: 'no_payment_method',
      message: 'User profile not found',
    };
  }

  const { stripe_customer_id, default_payment_method_id } = profile as Profile;

  // No payment method - can't charge
  if (!stripe_customer_id || !default_payment_method_id) {
    console.log(`[settle-promises] No payment method for promise ${promise.id}`);
    
    // Update promise to reflect no payment possible
    await supabase
      .from('promises')
      .update({
        payment_status: 'abandoned',
      })
      .eq('id', promise.id);

    return {
      promiseId: promise.id,
      action: 'no_payment_method',
      message: 'No payment method on file',
    };
  }

  // Calculate total amount including sponsor contributions
  // Stake is stored in dollars, sponsor_total is stored in cents
  const sponsorCents = promise.sponsor_total ?? 0;
  const stakeCents = promise.stake * 100;
  const amountInCents = stakeCents + sponsorCents;
  const totalAmount = amountInCents / 100; // For display/logging

  try {
    // Create off-session PaymentIntent
    console.log(`[settle-promises] Creating PaymentIntent for promise ${promise.id}, amount: $${totalAmount} (stake: $${promise.stake}, sponsor: $${sponsorCents / 100})`);

    // Use idempotency key to prevent duplicate charges from cron retries
    const idempotencyKey = `settle-promise-${promise.id}-attempt-${attemptNumber}`;
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      customer: stripe_customer_id,
      payment_method: default_payment_method_id,
      off_session: true,
      confirm: true,
      metadata: {
        promise_id: promise.id,
        user_id: promise.user_id,
        attempt_number: String(attemptNumber),
      },
      description: `OopsFee: Failed promise "${promise.text.substring(0, 50)}..."`,
    }, {
      idempotencyKey,
    });

    console.log(`[settle-promises] PaymentIntent created: ${paymentIntent.id}, status: ${paymentIntent.status}`);

    // Handle different payment statuses
    if (paymentIntent.status === 'succeeded') {
      await handlePaymentSuccess(promise, supabase, paymentIntent.id, attemptNumber, amountInCents);
      return {
        promiseId: promise.id,
        action: 'charged',
        message: 'Payment succeeded',
        paymentIntentId: paymentIntent.id,
      };
    }

    if (paymentIntent.status === 'requires_action') {
      await handlePaymentRequiresAction(promise, supabase, paymentIntent, attemptNumber, amountInCents);
      return {
        promiseId: promise.id,
        action: 'requires_action',
        message: 'Payment requires user action (SCA)',
        paymentIntentId: paymentIntent.id,
      };
    }

    // Any other status is treated as pending
    await supabase
      .from('promises')
      .update({
        payment_status: 'pending',
        payment_retry_count: attemptNumber,
      })
      .eq('id', promise.id);

    return {
      promiseId: promise.id,
      action: 'charged',
      message: `Payment status: ${paymentIntent.status}`,
      paymentIntentId: paymentIntent.id,
    };

  } catch (err: unknown) {
    // Handle Stripe errors
    const stripeError = err as {
      type?: string;
      code?: string;
      message?: string;
      raw?: { code?: string; message?: string };
    };

    console.error(`[settle-promises] Payment failed for promise ${promise.id}:`, stripeError);

    // Log the failed payment attempt (store amount in cents)
    await supabase.from('payments').insert({
      promise_id: promise.id,
      amount: amountInCents,
      currency: 'usd',
      status: 'failed',
      attempt_number: attemptNumber,
      error_code: stripeError.code || stripeError.raw?.code || 'unknown',
      error_message: stripeError.message || stripeError.raw?.message || 'Unknown error',
    });

    // Schedule retry or mark as abandoned
    await handlePaymentFailure(promise, supabase, attemptNumber, stripeError);

    return {
      promiseId: promise.id,
      action: 'charge_failed',
      message: stripeError.message || 'Payment failed',
    };
  }
}

/**
 * Handle successful payment
 */
async function handlePaymentSuccess(
  promise: Promise,
  supabase: ReturnType<typeof createAdminClient>,
  paymentIntentId: string,
  attemptNumber: number,
  amountInCents: number,
): Promise<void> {
  // Update promise
  await supabase
    .from('promises')
    .update({
      payment_status: 'succeeded',
      payment_client_secret: null,
    })
    .eq('id', promise.id);

  // Log the successful payment (store amount in cents)
  await supabase.from('payments').insert({
    promise_id: promise.id,
    amount: amountInCents,
    currency: 'usd',
    stripe_payment_intent_id: paymentIntentId,
    status: 'succeeded',
    attempt_number: attemptNumber,
  });

  console.log(`[settle-promises] Payment succeeded for promise ${promise.id}`);
}

/**
 * Handle payment that requires user action (SCA)
 */
async function handlePaymentRequiresAction(
  promise: Promise,
  supabase: ReturnType<typeof createAdminClient>,
  paymentIntent: { id: string; client_secret: string },
  attemptNumber: number,
  amountInCents: number,
): Promise<void> {
  // Store client secret for app to complete payment
  await supabase
    .from('promises')
    .update({
      payment_status: 'requires_action',
      payment_client_secret: paymentIntent.client_secret,
      payment_retry_count: attemptNumber,
    })
    .eq('id', promise.id);

  // Log the payment attempt (store amount in cents)
  await supabase.from('payments').insert({
    promise_id: promise.id,
    amount: amountInCents,
    currency: 'usd',
    stripe_payment_intent_id: paymentIntent.id,
    status: 'requires_action',
    attempt_number: attemptNumber,
  });

  console.log(`[settle-promises] Payment requires action for promise ${promise.id}`);
}

/**
 * Handle payment failure - schedule retry or abandon
 */
async function handlePaymentFailure(
  promise: Promise,
  supabase: ReturnType<typeof createAdminClient>,
  attemptNumber: number,
  error: { code?: string; message?: string },
): Promise<void> {
  if (attemptNumber >= MAX_RETRIES) {
    // All retries exhausted - mark as abandoned
    console.log(`[settle-promises] All retries exhausted for promise ${promise.id}`);

    await supabase
      .from('promises')
      .update({
        payment_status: 'abandoned',
        payment_client_secret: null,
      })
      .eq('id', promise.id);

    // Block user from creating new staked promises
    await supabase
      .from('profiles')
      .update({
        payment_blocked: true,
        failed_payment_count: 1, // Increment would require RPC
      })
      .eq('id', promise.user_id);

  } else {
    // Schedule next retry
    const nextRetryIndex = attemptNumber; // 0-indexed: after attempt 1, use index 1
    const delayHours = RETRY_DELAYS_HOURS[nextRetryIndex] ?? 168;
    const nextRetryAt = new Date(Date.now() + delayHours * 60 * 60 * 1000);

    console.log(
      `[settle-promises] Scheduling retry ${attemptNumber + 1} for promise ${promise.id} at ${nextRetryAt.toISOString()}`,
    );

    await supabase
      .from('promises')
      .update({
        payment_status: 'failed',
        payment_retry_count: attemptNumber,
        payment_next_retry_at: nextRetryAt.toISOString(),
      })
      .eq('id', promise.id);
  }
}

/**
 * Retry a previously failed payment
 */
async function retryPayment(
  promise: Promise,
  supabase: ReturnType<typeof createAdminClient>,
  stripe: ReturnType<typeof createStripeClient>,
): Promise<SettlementResult> {
  console.log(`[settle-promises] Retrying payment for promise: ${promise.id}, attempt: ${(promise.payment_retry_count ?? 0) + 1}`);

  const attemptNumber = (promise.payment_retry_count ?? 0) + 1;
  return await chargeForFailedPromise(promise, supabase, stripe, attemptNumber);
}


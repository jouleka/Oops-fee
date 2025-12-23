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

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const APP_URL = Deno.env.get('APP_URL') || 'https://oopsfee.app';

// Friend claim expiration: 7 days
const CLAIM_EXPIRY_DAYS = 7;

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
  money_destination: string | null; // 'oopsfee' | 'charity' | 'friend'
  friend_claim_id: string | null;
}

interface FriendClaim {
  id: string;
  promise_id: string;
  friend_email: string | null;
  friend_phone: string | null;
  friend_name: string;
  claim_token: string;
  claim_status: string;
}

interface Profile {
  id: string;
  stripe_customer_id: string | null;
  default_payment_method_id: string | null;
  failed_payment_count: number;
  payment_blocked: boolean;
  expo_push_token: string | null;
}

// ─────────────────────────────────────────────────────────────
// Settlement notification copy (matches client constants)
// ─────────────────────────────────────────────────────────────
const SETTLEMENT_NOTIFICATIONS = {
  chargeSuccess: [
    '💸 You lost ${amount}',
    '${amount} gone. Promise broken.',
    "That's ${amount} you won't see again.",
    'Promise failed. ${amount} charged.',
    'The wallet remembers: -${amount}.',
  ],
  chargeFailed: [
    '⚠️ Payment failed for "${promise}"',
    "We couldn't charge ${amount}. Card issue.",
    'Payment declined. ${amount} still owed.',
    'Your card said no to ${amount}.',
    'Failed charge: ${amount}. Check your card.',
  ],
  requiresAction: [
    '🔐 Action needed: ${amount} charge',
    'Your bank needs confirmation for ${amount}.',
    'Authenticate the ${amount} payment in the app.',
    '${amount} charge pending your approval.',
    'One more step: confirm ${amount} payment.',
  ],
  paymentAbandoned: [
    '🚫 ${amount} charge abandoned. Account restricted.',
    "Couldn't collect ${amount}. Your account is blocked.",
    'Payment failed permanently. New stakes disabled.',
    '${amount} uncollected. Account frozen.',
  ],
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatAmount(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

/**
 * Send a push notification via Expo Push API
 */
async function sendPushNotification(
  pushToken: string | null,
  title: string,
  body: string,
  data: Record<string, unknown> = {},
): Promise<void> {
  if (!pushToken) {
    console.log('[settle-promises] No push token, skipping notification');
    return;
  }

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: pushToken,
        title,
        body,
        sound: 'default',
        data,
      }),
    });

    const result = await response.json();
    console.log('[settle-promises] Push notification sent:', JSON.stringify(result));
  } catch (error) {
    console.error('[settle-promises] Failed to send push notification:', error);
    // Don't throw - push failure shouldn't break settlement
  }
}

/**
 * Send "claim your money" email to friend when user fails
 */
interface ClaimEmailParams {
  to: string;
  friendName: string;
  userName: string;
  amountCents: number;
  promiseText: string;
  claimUrl: string;
  expiresAt: Date;
}

async function sendClaimNotificationEmail(params: ClaimEmailParams): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.log('[settle-promises] Resend API key not configured, skipping claim email');
    return false;
  }

  const { to, friendName, userName, amountCents, promiseText, claimUrl, expiresAt } = params;
  const amountDisplay = `$${(amountCents / 100).toFixed(amountCents % 100 === 0 ? 0 : 2)}`;
  const expiryDate = expiresAt.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const subject = `💰 ${userName} failed — claim your ${amountDisplay}!`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Claim Your Money</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0a; color: #ffffff;">
  <div style="max-width: 480px; margin: 0 auto; padding: 40px 24px;">
    <div style="text-align: center; margin-bottom: 32px;">
      <h1 style="font-size: 32px; font-weight: 700; margin: 0 0 8px 0; color: #22c55e;">
        💸 Cha-ching!
      </h1>
      <p style="font-size: 18px; color: #ffffff; margin: 0;">
        ${userName} didn't follow through
      </p>
    </div>
    
    <div style="background: linear-gradient(135deg, #134e2a 0%, #166534 100%); border-radius: 16px; padding: 32px; margin-bottom: 24px; border: 1px solid #22c55e; text-align: center;">
      <p style="font-size: 14px; color: #86efac; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.5px;">
        Your Winnings
      </p>
      <p style="font-size: 48px; font-weight: 700; margin: 0; color: #22c55e;">
        ${amountDisplay}
      </p>
    </div>
    
    <div style="background: #1a1a2e; border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid #333;">
      <p style="font-size: 12px; color: #888888; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.5px;">
        The Failed Promise
      </p>
      <p style="font-size: 16px; margin: 0; color: #ffffff;">
        "${promiseText}"
      </p>
    </div>
    
    <div style="text-align: center; margin-bottom: 24px;">
      <a href="${claimUrl}" style="display: inline-block; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: #ffffff; text-decoration: none; padding: 18px 40px; border-radius: 12px; font-size: 18px; font-weight: 700;">
        Claim Your ${amountDisplay}
      </a>
    </div>
    
    <p style="font-size: 14px; color: #ef4444; text-align: center; margin: 0 0 16px 0; font-weight: 500;">
      ⏰ Claim expires ${expiryDate}
    </p>
    
    <p style="font-size: 14px; color: #888888; text-align: center; margin: 0;">
      Click the button above to connect your bank account and receive your payout.
    </p>
    
    <hr style="border: none; border-top: 1px solid #333; margin: 40px 0 24px 0;">
    
    <p style="font-size: 12px; color: #666666; text-align: center; margin: 0;">
      Sent by <a href="${APP_URL}" style="color: #7c3aed;">OopsFee</a> — accountability with stakes
    </p>
  </div>
</body>
</html>
  `.trim();

  const textBody = `Hey ${friendName}!

${userName} failed to keep their promise: "${promiseText}"

That means ${amountDisplay} is yours!

Claim it here: ${claimUrl}

⏰ This offer expires ${expiryDate}.

Click the link to connect your bank account and receive your payout.

— OopsFee`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'OopsFee <hello@oopsfee.app>',
        to: [to],
        subject,
        html: htmlBody,
        text: textBody,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[settle-promises] Resend API error:', response.status, errorText);
      return false;
    }

    const result = await response.json();
    console.log('[settle-promises] Claim notification email sent:', result.id);
    return true;
  } catch (error) {
    console.error('[settle-promises] Claim email send error:', error);
    return false;
  }
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
  // Get user's payment info and push token
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('stripe_customer_id, default_payment_method_id, expo_push_token')
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

    const pushToken = (profile as Profile).expo_push_token;

    // Handle different payment statuses
    if (paymentIntent.status === 'succeeded') {
      await handlePaymentSuccess(promise, supabase, paymentIntent.id, attemptNumber, amountInCents, pushToken);
      return {
        promiseId: promise.id,
        action: 'charged',
        message: 'Payment succeeded',
        paymentIntentId: paymentIntent.id,
      };
    }

    if (paymentIntent.status === 'requires_action') {
      await handlePaymentRequiresAction(promise, supabase, paymentIntent, attemptNumber, amountInCents, pushToken);
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

    const pushToken = (profile as Profile).expo_push_token;

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

    // Send push notification for failed payment
    const body = pickRandom(SETTLEMENT_NOTIFICATIONS.chargeFailed)
      .replace('${amount}', formatAmount(amountInCents))
      .replace('"${promise}"', `"${promise.text.substring(0, 30)}..."`);
    await sendPushNotification(
      pushToken,
      'Payment Failed',
      body,
      { promiseId: promise.id, type: 'settlement_failed' },
    );

    // Schedule retry or mark as abandoned
    await handlePaymentFailure(promise, supabase, attemptNumber, stripeError, pushToken, amountInCents);

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
  pushToken: string | null,
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

  // Send push notification to user
  const body = pickRandom(SETTLEMENT_NOTIFICATIONS.chargeSuccess)
    .replace('${amount}', formatAmount(amountInCents));
  await sendPushNotification(
    pushToken,
    'Promise Failed',
    body,
    { promiseId: promise.id, type: 'settlement_charged' },
  );

  // ─────────────────────────────────────────────────────────────
  // FRIEND PAYOUT: Update friend claim and notify friend
  // ─────────────────────────────────────────────────────────────
  if (promise.money_destination === 'friend' && promise.friend_claim_id) {
    await handleFriendClaimNotification(promise, supabase, amountInCents);
  }
}

/**
 * Update friend claim and notify friend that money is available to claim.
 * If friend is an in-app user (has a profile), credit their wallet directly.
 * Otherwise, send claim notification email for external payout.
 */
async function handleFriendClaimNotification(
  promise: Promise,
  supabase: ReturnType<typeof createAdminClient>,
  amountInCents: number,
): Promise<void> {
  console.log(`[settle-promises] Processing friend claim for promise ${promise.id}`);

  // 1. Fetch the friend claim record
  const { data: claim, error: claimError } = await supabase
    .from('friend_claims')
    .select('id, friend_email, friend_phone, friend_name, claim_token, claim_status')
    .eq('id', promise.friend_claim_id)
    .single();

  if (claimError || !claim) {
    console.error(`[settle-promises] Friend claim not found for promise ${promise.id}:`, claimError);
    return;
  }

  const friendClaim = claim as FriendClaim;

  // 2. Get user's display name for notifications
  const { data: promiserProfile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', promise.user_id)
    .single();

  const userName = promiserProfile?.display_name || 'Someone';

  // 3. Check if friend is an in-app user (has a profile with matching email)
  if (friendClaim.friend_email) {
    const { data: friendProfile, error: friendProfileError } = await supabase
      .from('profiles')
      .select('id, expo_push_token')
      .eq('email', friendClaim.friend_email)
      .single();

    if (!friendProfileError && friendProfile) {
      // ─────────────────────────────────────────────────────────────
      // IN-APP FRIEND: Credit wallet directly, skip external payout
      // ─────────────────────────────────────────────────────────────
      console.log(`[settle-promises] Friend ${friendClaim.friend_email} is an in-app user (${friendProfile.id}), crediting wallet`);

      // Credit wallet via RPC
      const { error: creditError } = await supabase.rpc('credit_wallet', {
        target_user_id: friendProfile.id,
        amount_cents: amountInCents,
      });

      if (creditError) {
        console.error(`[settle-promises] Error crediting wallet for ${friendProfile.id}:`, creditError);
        // Fall through to external payout flow as fallback
      } else {
        // Update friend claim: mark as transferred (no external payout needed)
        const { error: updateError } = await supabase
          .from('friend_claims')
          .update({
            amount_cents: amountInCents,
            claim_status: 'transferred',
            payout_method: 'wallet',
          })
          .eq('id', friendClaim.id);

        if (updateError) {
          console.error(`[settle-promises] Error updating friend claim ${friendClaim.id}:`, updateError);
        }

        console.log(`[settle-promises] Wallet credited: ${amountInCents} cents to user ${friendProfile.id}`);

        // Send push notification to friend
        const amountDisplay = formatAmount(amountInCents);
        await sendPushNotification(
          friendProfile.expo_push_token,
          '💰 You got paid!',
          `${userName} broke their promise. ${amountDisplay} added to your wallet!`,
          { type: 'wallet_credit', amount: amountInCents, promiseId: promise.id },
        );

        return; // Done - wallet credited, no external payout needed
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // NON-APP FRIEND: Send claim email for external payout (existing flow)
  // ─────────────────────────────────────────────────────────────

  // Calculate claim expiration (7 days from now)
  const claimExpiresAt = new Date(Date.now() + CLAIM_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  // Update friend claim: set amount, status, and expiration
  const { error: updateError } = await supabase
    .from('friend_claims')
    .update({
      amount_cents: amountInCents,
      claim_status: 'notified',
      claim_expires_at: claimExpiresAt.toISOString(),
    })
    .eq('id', friendClaim.id);

  if (updateError) {
    console.error(`[settle-promises] Error updating friend claim ${friendClaim.id}:`, updateError);
    return;
  }

  console.log(`[settle-promises] Friend claim ${friendClaim.id} updated: amount=${amountInCents}, expires=${claimExpiresAt.toISOString()}`);

  const claimUrl = `${APP_URL}/claim/${friendClaim.claim_token}`;

  // Send claim notification email to friend
  if (friendClaim.friend_email) {
    const emailSent = await sendClaimNotificationEmail({
      to: friendClaim.friend_email,
      friendName: friendClaim.friend_name,
      userName,
      amountCents: amountInCents,
      promiseText: promise.text.substring(0, 100),
      claimUrl,
      expiresAt: claimExpiresAt,
    });

    console.log(`[settle-promises] Claim email sent to ${friendClaim.friend_email}: ${emailSent}`);
  } else {
    console.log(`[settle-promises] No email for friend claim ${friendClaim.id}, skipping email notification`);
  }

  // TODO: Add SMS notification via Twilio if friend_phone is set
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
  pushToken: string | null,
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

  // Send push notification - user needs to authenticate
  const body = pickRandom(SETTLEMENT_NOTIFICATIONS.requiresAction)
    .replace('${amount}', formatAmount(amountInCents));
  await sendPushNotification(
    pushToken,
    'Action Required',
    body,
    { promiseId: promise.id, type: 'settlement_requires_action' },
  );
}

/**
 * Handle payment failure - schedule retry or abandon
 */
async function handlePaymentFailure(
  promise: Promise,
  supabase: ReturnType<typeof createAdminClient>,
  attemptNumber: number,
  error: { code?: string; message?: string },
  pushToken: string | null,
  amountInCents: number,
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

    // Send push notification for abandoned payment
    const body = pickRandom(SETTLEMENT_NOTIFICATIONS.paymentAbandoned)
      .replace('${amount}', formatAmount(amountInCents));
    await sendPushNotification(
      pushToken,
      'Account Restricted',
      body,
      { promiseId: promise.id, type: 'settlement_abandoned' },
    );

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


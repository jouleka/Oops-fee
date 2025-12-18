// @ts-nocheck
// deno-lint-ignore-file
/**
 * stripe-webhook Edge Function
 *
 * Handles Stripe webhook events:
 * - setup_intent.succeeded: Save payment method to user profile
 * - payment_intent.succeeded: Mark promise payment as completed
 * - payment_intent.payment_failed: Update payment status, schedule retry
 * - payment_intent.requires_action: Store client secret for SCA
 */

import { corsHeaders } from '../_shared/cors.ts';
import { createStripeClient, verifyWebhookSignature } from '../_shared/stripe.ts';
import { createAdminClient } from '../_shared/supabase.ts';

// Retry schedule: immediate, 24h, 72h (3 days), 168h (7 days)
const RETRY_DELAYS_HOURS = [0, 24, 72, 168];
const MAX_RETRIES = 4;

Deno.serve(async (req: Request) => {
  // Only accept POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // Get raw body and signature
    const payload = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return new Response('Missing stripe-signature header', { status: 400 });
    }

    // Verify webhook signature
    let event: any;
    try {
      event = await verifyWebhookSignature(payload, signature);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[stripe-webhook] Signature verification failed:', message);
      return new Response(
        `Webhook signature verification failed: ${message}`,
        { status: 400 },
      );
    }

    const supabase = createAdminClient();
    const stripe = createStripeClient();

    console.log(`[stripe-webhook] Processing event: ${event.type}`);

    // Handle different event types
    switch (event.type) {
      case 'setup_intent.succeeded': {
        await handleSetupIntentSucceeded(event, supabase, stripe);
        break;
      }

      case 'payment_intent.succeeded': {
        await handlePaymentIntentSucceeded(event, supabase);
        break;
      }

      case 'payment_intent.payment_failed': {
        await handlePaymentIntentFailed(event, supabase);
        break;
      }

      case 'payment_intent.requires_action': {
        await handlePaymentIntentRequiresAction(event, supabase);
        break;
      }

      default:
        console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('[stripe-webhook] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

/**
 * Handle setup_intent.succeeded
 * Save the payment method to the user's profile
 */
async function handleSetupIntentSucceeded(
  event: { data: { object: Record<string, unknown> } },
  supabase: ReturnType<typeof createAdminClient>,
  stripe: ReturnType<typeof createStripeClient>,
) {
  const setupIntent = event.data.object as {
    customer: string;
    payment_method: string;
    metadata?: { supabase_user_id?: string };
  };

  const customerId = setupIntent.customer;
  const paymentMethodId = setupIntent.payment_method;
  const userId = setupIntent.metadata?.supabase_user_id;

  console.log(
    `[stripe-webhook] SetupIntent succeeded for customer: ${customerId}`,
  );

  if (!customerId || !paymentMethodId) {
    console.error('[stripe-webhook] Missing customer or payment_method');
    return;
  }

  // Set as default payment method on Stripe customer
  try {
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });
  } catch (err: unknown) {
    console.error('[stripe-webhook] Error setting default payment method:', err);
  }

  // Find profile by stripe_customer_id or supabase_user_id
  let query = supabase.from('profiles').update({
    default_payment_method_id: paymentMethodId,
    updated_at: new Date().toISOString(),
  });

  if (userId) {
    query = query.eq('id', userId);
  } else {
    query = query.eq('stripe_customer_id', customerId);
  }

  const { error } = await query;

  if (error) {
    console.error('[stripe-webhook] Error updating profile:', error);
  } else {
    console.log('[stripe-webhook] Profile updated with payment method');
  }
}

/**
 * Handle payment_intent.succeeded
 * Mark the promise payment as completed
 */
async function handlePaymentIntentSucceeded(
  event: { data: { object: Record<string, unknown> } },
  supabase: ReturnType<typeof createAdminClient>,
) {
  const paymentIntent = event.data.object as {
    id: string;
    amount: number;
    metadata?: { promise_id?: string };
  };

  const promiseId = paymentIntent.metadata?.promise_id;

  console.log(`[stripe-webhook] PaymentIntent succeeded: ${paymentIntent.id}`);

  if (!promiseId) {
    console.log('[stripe-webhook] No promise_id in metadata, skipping');
    return;
  }

  // Update promise payment status
  const { error: promiseError } = await supabase
    .from('promises')
    .update({
      payment_status: 'succeeded',
      payment_client_secret: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', promiseId);

  if (promiseError) {
    console.error('[stripe-webhook] Error updating promise:', promiseError);
  }

  // Log the payment
  const { error: paymentError } = await supabase.from('payments').insert({
    promise_id: promiseId,
    amount: paymentIntent.amount,
    currency: 'usd',
    stripe_payment_intent_id: paymentIntent.id,
    status: 'succeeded',
  });

  if (paymentError) {
    console.error('[stripe-webhook] Error logging payment:', paymentError);
  }
}

/**
 * Handle payment_intent.payment_failed
 * Schedule retry or mark as abandoned
 */
async function handlePaymentIntentFailed(
  event: { data: { object: Record<string, unknown> } },
  supabase: ReturnType<typeof createAdminClient>,
) {
  const paymentIntent = event.data.object as {
    id: string;
    amount: number;
    last_payment_error?: { code?: string; message?: string };
    metadata?: { promise_id?: string };
  };

  const promiseId = paymentIntent.metadata?.promise_id;
  const errorCode = paymentIntent.last_payment_error?.code;
  const errorMessage = paymentIntent.last_payment_error?.message;

  console.log(
    `[stripe-webhook] PaymentIntent failed: ${paymentIntent.id}, error: ${errorCode}`,
  );

  if (!promiseId) {
    console.log('[stripe-webhook] No promise_id in metadata, skipping');
    return;
  }

  // Get current retry count
  const { data: promise, error: fetchError } = await supabase
    .from('promises')
    .select('payment_retry_count, user_id')
    .eq('id', promiseId)
    .single();

  if (fetchError || !promise) {
    console.error('[stripe-webhook] Error fetching promise:', fetchError);
    return;
  }

  const currentRetryCount = promise.payment_retry_count ?? 0;
  const nextRetryCount = currentRetryCount + 1;

  // Log the failed payment
  await supabase.from('payments').insert({
    promise_id: promiseId,
    amount: paymentIntent.amount,
    currency: 'usd',
    stripe_payment_intent_id: paymentIntent.id,
    status: 'failed',
    attempt_number: nextRetryCount,
    error_code: errorCode,
    error_message: errorMessage,
  });

  if (nextRetryCount >= MAX_RETRIES) {
    // All retries exhausted - mark as abandoned
    console.log(
      `[stripe-webhook] All retries exhausted for promise: ${promiseId}`,
    );

    await supabase
      .from('promises')
      .update({
        payment_status: 'abandoned',
        payment_client_secret: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', promiseId);

    // Block user from creating new staked promises
    // Note: Increment would require RPC, using fixed value for now
    await supabase
      .from('profiles')
      .update({
        payment_blocked: true,
        failed_payment_count: 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', promise.user_id);
  } else {
    // Schedule next retry
    const delayHours = RETRY_DELAYS_HOURS[nextRetryCount] ?? 168;
    const nextRetryAt = new Date(Date.now() + delayHours * 60 * 60 * 1000);

    console.log(
      `[stripe-webhook] Scheduling retry ${nextRetryCount} at ${nextRetryAt.toISOString()}`,
    );

    await supabase
      .from('promises')
      .update({
        payment_status: 'failed',
        payment_retry_count: nextRetryCount,
        payment_next_retry_at: nextRetryAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', promiseId);
  }
}

/**
 * Handle payment_intent.requires_action
 * Store client secret for user to complete SCA
 */
async function handlePaymentIntentRequiresAction(
  event: { data: { object: Record<string, unknown> } },
  supabase: ReturnType<typeof createAdminClient>,
) {
  const paymentIntent = event.data.object as {
    id: string;
    client_secret: string;
    metadata?: { promise_id?: string };
  };

  const promiseId = paymentIntent.metadata?.promise_id;

  console.log(
    `[stripe-webhook] PaymentIntent requires action: ${paymentIntent.id}`,
  );

  if (!promiseId) {
    console.log('[stripe-webhook] No promise_id in metadata, skipping');
    return;
  }

  // Store client secret for app to use
  const { error } = await supabase
    .from('promises')
    .update({
      payment_status: 'requires_action',
      payment_client_secret: paymentIntent.client_secret,
      updated_at: new Date().toISOString(),
    })
    .eq('id', promiseId);

  if (error) {
    console.error('[stripe-webhook] Error updating promise:', error);
  }
}

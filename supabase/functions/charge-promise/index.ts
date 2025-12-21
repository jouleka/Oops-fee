// @ts-nocheck
// deno-lint-ignore-file
/**
 * charge-promise Edge Function
 *
 * Immediately charges a user for a failed promise.
 * Called when user manually marks a promise as failed.
 *
 * Returns the charge result so the app can show appropriate feedback.
 */

import { corsHeaders, handleCorsOptions } from '../_shared/cors.ts';
import { createStripeClient } from '../_shared/stripe.ts';
import { createAdminClient, getUserFromRequest } from '../_shared/supabase.ts';

interface ChargeRequest {
  promiseId: string;
}

interface ChargeResponse {
  success: boolean;
  charged: boolean;
  amount?: number;
  message: string;
  requiresAction?: boolean;
  clientSecret?: string;
  paymentIntentId?: string;
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
        JSON.stringify({ success: false, charged: false, message: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Parse request
    const { promiseId } = (await req.json()) as ChargeRequest;
    if (!promiseId) {
      return new Response(
        JSON.stringify({ success: false, charged: false, message: 'Missing promiseId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createAdminClient();
    const stripe = createStripeClient();

    // Fetch the promise
    const { data: promise, error: promiseError } = await supabase
      .from('promises')
      .select('*')
      .eq('id', promiseId)
      .eq('user_id', user.id)
      .single();

    if (promiseError || !promise) {
      console.error('[charge-promise] Promise not found:', promiseError);
      return new Response(
        JSON.stringify({ success: false, charged: false, message: 'Promise not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Check if already charged or in progress - PREVENT DOUBLE CHARGES
    if (promise.payment_status === 'succeeded') {
      console.log(`[charge-promise] Promise ${promiseId} already charged, skipping`);
      return new Response(
        JSON.stringify({
          success: true,
          charged: true,
          amount: promise.stake,
          message: 'Already charged',
        } as ChargeResponse),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Check if payment is already in progress (pending or requires_action)
    if (promise.payment_status === 'pending' || promise.payment_status === 'requires_action') {
      console.log(`[charge-promise] Promise ${promiseId} payment already in progress: ${promise.payment_status}`);
      return new Response(
        JSON.stringify({
          success: true,
          charged: false,
          amount: promise.stake,
          message: promise.payment_status === 'requires_action' 
            ? 'Payment requires authentication - check your app'
            : 'Payment already in progress',
        } as ChargeResponse),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Mark as pending BEFORE attempting charge to prevent race conditions
    const { error: lockError } = await supabase
      .from('promises')
      .update({ payment_status: 'pending' })
      .eq('id', promiseId)
      .is('payment_status', null); // Only update if not already set

    if (lockError) {
      console.error(`[charge-promise] Failed to lock promise ${promiseId}:`, lockError);
    }

    // No stake = nothing to charge
    if (!promise.stake || promise.stake <= 0) {
      return new Response(
        JSON.stringify({
          success: true,
          charged: false,
          amount: 0,
          message: 'No stake to charge',
        } as ChargeResponse),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Get user's payment method
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_customer_id, default_payment_method_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('[charge-promise] Profile not found:', profileError);
      return new Response(
        JSON.stringify({
          success: false,
          charged: false,
          message: 'Profile not found',
        } as ChargeResponse),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { stripe_customer_id, default_payment_method_id } = profile;

    // No payment method
    if (!stripe_customer_id || !default_payment_method_id) {
      // Mark promise as failed but payment abandoned
      await supabase
        .from('promises')
        .update({
          status: 'failed',
          failed_at: new Date().toISOString(),
          payment_status: 'abandoned',
        })
        .eq('id', promiseId);

      return new Response(
        JSON.stringify({
          success: true,
          charged: false,
          amount: promise.stake,
          message: 'No payment method on file. You got away with it... this time.',
        } as ChargeResponse),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Create and confirm PaymentIntent
    // Stake is stored in dollars, Stripe expects cents
    const amountInCents = promise.stake * 100;
    console.log(`[charge-promise] Charging $${promise.stake} (${amountInCents} cents) for promise ${promiseId}`);

    try {
      // Use idempotency key to prevent duplicate charges
      const idempotencyKey = `charge-promise-${promiseId}-${user.id}`;
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: 'usd',
        customer: stripe_customer_id,
        payment_method: default_payment_method_id,
        off_session: true,
        confirm: true,
        metadata: {
          promise_id: promiseId,
          user_id: user.id,
          trigger: 'manual_fail',
        },
        description: `OopsFee: Failed promise "${promise.text.substring(0, 50)}..."`,
      }, {
        idempotencyKey,
      });

      console.log(`[charge-promise] PaymentIntent ${paymentIntent.id} status: ${paymentIntent.status}`);

      if (paymentIntent.status === 'succeeded') {
        // Update promise
        await supabase
          .from('promises')
          .update({
            status: 'failed',
            failed_at: new Date().toISOString(),
            payment_status: 'succeeded',
            payment_client_secret: null,
          })
          .eq('id', promiseId);

        // Log payment (store in cents)
        await supabase.from('payments').insert({
          promise_id: promiseId,
          amount: amountInCents,
          currency: 'usd',
          stripe_payment_intent_id: paymentIntent.id,
          status: 'succeeded',
          attempt_number: 1,
        });

        return new Response(
          JSON.stringify({
            success: true,
            charged: true,
            amount: promise.stake, // Return in dollars for display
            message: `$${promise.stake} charged. The universe has collected.`,
            paymentIntentId: paymentIntent.id,
          } as ChargeResponse),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      if (paymentIntent.status === 'requires_action') {
        // SCA required - store client secret for app to complete
        await supabase
          .from('promises')
          .update({
            status: 'failed',
            failed_at: new Date().toISOString(),
            payment_status: 'requires_action',
            payment_client_secret: paymentIntent.client_secret,
          })
          .eq('id', promiseId);

        // Log payment attempt (store in cents)
        await supabase.from('payments').insert({
          promise_id: promiseId,
          amount: amountInCents,
          currency: 'usd',
          stripe_payment_intent_id: paymentIntent.id,
          status: 'requires_action',
          attempt_number: 1,
        });

        return new Response(
          JSON.stringify({
            success: true,
            charged: false,
            amount: promise.stake, // Return in dollars
            message: 'Your bank requires confirmation. One more tap to face the music.',
            requiresAction: true,
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
          } as ChargeResponse),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      // Other status - mark as pending
      await supabase
        .from('promises')
        .update({
          status: 'failed',
          failed_at: new Date().toISOString(),
          payment_status: 'pending',
        })
        .eq('id', promiseId);

      return new Response(
        JSON.stringify({
          success: true,
          charged: false,
          amount: promise.stake,
          message: `Payment processing (${paymentIntent.status})`,
          paymentIntentId: paymentIntent.id,
        } as ChargeResponse),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );

    } catch (stripeError: unknown) {
      const err = stripeError as { code?: string; message?: string };
      console.error('[charge-promise] Stripe error:', err);

      // Log failed payment (store in cents)
      await supabase.from('payments').insert({
        promise_id: promiseId,
        amount: amountInCents,
        currency: 'usd',
        status: 'failed',
        attempt_number: 1,
        error_code: err.code || 'unknown',
        error_message: err.message || 'Unknown error',
      });

      // Schedule for retry via settlement cron
      const nextRetryAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await supabase
        .from('promises')
        .update({
          status: 'failed',
          failed_at: new Date().toISOString(),
          payment_status: 'failed',
          payment_retry_count: 1,
          payment_next_retry_at: nextRetryAt.toISOString(),
        })
        .eq('id', promiseId);

      return new Response(
        JSON.stringify({
          success: true,
          charged: false,
          amount: promise.stake,
          message: `Payment failed: ${err.message || 'Card declined'}. We'll try again.`,
        } as ChargeResponse),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

  } catch (error: unknown) {
    console.error('[charge-promise] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ success: false, charged: false, message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});


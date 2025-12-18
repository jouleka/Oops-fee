// @ts-nocheck
// deno-lint-ignore-file
/**
 * Stripe Remove Payment Method Edge Function
 *
 * Removes the user's saved payment method from Stripe and clears it from their profile.
 *
 * Endpoint: POST /functions/v1/stripe-remove-payment-method
 * Auth: Required (Bearer token)
 */

import { corsHeaders } from '../_shared/cors.ts';
import { createStripeClient } from '../_shared/stripe.ts';
import { createAdminClient, getUserFromRequest } from '../_shared/supabase.ts';

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const user = await getUserFromRequest(req);
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createAdminClient();
    const stripe = createStripeClient();

    // Get user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_customer_id, default_payment_method_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.stripe_customer_id) {
      return new Response(
        JSON.stringify({ error: 'No payment method found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!profile.default_payment_method_id) {
      return new Response(
        JSON.stringify({ error: 'No payment method to remove' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Detach the payment method from Stripe
    try {
      await stripe.paymentMethods.detach(profile.default_payment_method_id);
    } catch (stripeErr) {
      console.error('Stripe detach error:', stripeErr);
      // Continue anyway - might already be detached
    }

    // Update customer's default payment method in Stripe
    try {
      await stripe.customers.update(profile.stripe_customer_id, {
        invoice_settings: {
          default_payment_method: null,
        },
      });
    } catch (stripeErr) {
      console.error('Stripe customer update error:', stripeErr);
    }

    // Clear payment method from profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        default_payment_method_id: null,
        payment_method_brand: null,
        payment_method_last4: null,
        payment_method_type: null,
        payment_blocked: false, // Unblock since they're resetting
        failed_payment_count: 0, // Reset failure count
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Profile update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update profile' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Remove payment method error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});


// @ts-nocheck
// deno-lint-ignore-file
/**
 * stripe-confirm-setup Edge Function
 *
 * Called by the app after PaymentSheet succeeds to confirm
 * the payment method was attached and update the profile.
 * 
 * This is a fallback for when webhooks don't fire (local dev, etc.)
 */

import { corsHeaders, handleCorsOptions } from '../_shared/cors.ts';
import { createStripeClient } from '../_shared/stripe.ts';
import { createAdminClient, getUserFromRequest } from '../_shared/supabase.ts';

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsOptions();
  }

  try {
    // 1. Authenticate user
    const user = await getUserFromRequest(req);
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const supabase = createAdminClient();
    const stripe = createStripeClient();

    // 2. Get user profile with Stripe customer ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.stripe_customer_id) {
      return new Response(
        JSON.stringify({ error: 'No Stripe customer found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // 3. Get the customer's default payment method from Stripe
    const customer = await stripe.customers.retrieve(profile.stripe_customer_id);
    
    if (customer.deleted) {
      return new Response(
        JSON.stringify({ error: 'Customer deleted' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Get the default payment method
    let paymentMethodId = customer.invoice_settings?.default_payment_method;

    // If no default, try to get the first payment method
    if (!paymentMethodId) {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: profile.stripe_customer_id,
        type: 'card',
        limit: 1,
      });

      if (paymentMethods.data.length > 0) {
        paymentMethodId = paymentMethods.data[0].id;

        // Set it as default
        await stripe.customers.update(profile.stripe_customer_id, {
          invoice_settings: {
            default_payment_method: paymentMethodId,
          },
        });
      }
    }

    if (!paymentMethodId) {
      return new Response(
        JSON.stringify({ error: 'No payment method found', hasPaymentMethod: false }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // 4. Get payment method details
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    
    // Determine brand and last4 based on payment method type
    let brand = 'card';
    let last4 = '';
    let type = paymentMethod.type;

    if (paymentMethod.type === 'card' && paymentMethod.card) {
      brand = paymentMethod.card.brand || 'card';
      last4 = paymentMethod.card.last4 || '';
    } else if (paymentMethod.type === 'link') {
      brand = 'link';
      type = 'wallet';
    } else if (paymentMethod.type === 'cashapp') {
      brand = 'cashapp';
      type = 'wallet';
    } else if (paymentMethod.type === 'amazon_pay') {
      brand = 'amazon_pay';
      type = 'wallet';
    }

    // Check if card was added via Apple Pay or Google Pay (wallet)
    if (paymentMethod.card?.wallet) {
      const walletType = paymentMethod.card.wallet.type;
      if (walletType === 'apple_pay') {
        brand = 'apple_pay';
        type = 'wallet';
      } else if (walletType === 'google_pay') {
        brand = 'google_pay';
        type = 'wallet';
      }
      // Still capture last4 from the underlying card
      last4 = paymentMethod.card.last4 || '';
    }

    // 5. Update profile with payment method details
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        default_payment_method_id: paymentMethodId,
        payment_method_brand: brand,
        payment_method_last4: last4,
        payment_method_type: type,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('[stripe-confirm-setup] Update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update profile' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        hasPaymentMethod: true,
        paymentMethodId,
        brand,
        last4,
        type,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error: unknown) {
    console.error('[stripe-confirm-setup] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});


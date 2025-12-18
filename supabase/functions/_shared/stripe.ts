// @ts-nocheck
// deno-lint-ignore-file
/**
 * Stripe client for edge functions
 */
import Stripe from 'https://esm.sh/stripe@14.9.0?target=deno';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';

if (!STRIPE_SECRET_KEY) {
  console.warn('[Stripe] Missing STRIPE_SECRET_KEY environment variable');
}

/**
 * Create a Stripe client instance
 */
// deno-lint-ignore no-explicit-any
export function createStripeClient(): any {
  return new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
  });
}

/**
 * Verify Stripe webhook signature
 */
export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  // deno-lint-ignore no-explicit-any
): Promise<any> {
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
  const stripe = createStripeClient();

  return stripe.webhooks.constructEventAsync(
    payload,
    signature,
    webhookSecret,
  );
}


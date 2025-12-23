// @ts-nocheck
// deno-lint-ignore-file
/**
 * PayPal Payouts API client for edge functions
 */

const PAYPAL_CLIENT_ID = Deno.env.get('PAYPAL_CLIENT_ID') ?? '';
const PAYPAL_CLIENT_SECRET = Deno.env.get('PAYPAL_CLIENT_SECRET') ?? '';
const PAYPAL_ENVIRONMENT = Deno.env.get('PAYPAL_ENVIRONMENT') ?? 'sandbox';

const PAYPAL_BASE_URL =
  PAYPAL_ENVIRONMENT === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
  console.warn('[PayPal] Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET environment variables');
}

// Cache for access token
let cachedAccessToken: { token: string; expiresAt: number } | null = null;

/**
 * Get PayPal OAuth 2.0 access token using client credentials grant
 */
export async function getPayPalAccessToken(): Promise<string> {
  // Return cached token if still valid (with 5 min buffer)
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 300000) {
    return cachedAccessToken.token;
  }

  const credentials = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`);

  const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`PayPal OAuth failed: ${response.status} - ${error}`);
  }

  const data = await response.json();

  // Cache the token
  cachedAccessToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return data.access_token;
}

/**
 * Payout parameters
 */
export interface PayoutParams {
  /** Unique ID for the claim (used in batch ID) */
  claimId: string;
  /** Recipient PayPal email */
  recipientEmail: string;
  /** Amount in dollars (string with 2 decimals, e.g. "25.00") */
  amountDollars: string;
  /** Currency code (default: USD) */
  currency?: string;
  /** Note to recipient */
  note?: string;
  /** Email subject */
  emailSubject?: string;
  /** Email message */
  emailMessage?: string;
}

/**
 * Payout result
 */
export interface PayoutResult {
  success: boolean;
  batchId?: string;
  payoutItemId?: string;
  status?: string;
  error?: string;
}

/**
 * Create a PayPal payout
 */
export async function createPayout(params: PayoutParams): Promise<PayoutResult> {
  const {
    claimId,
    recipientEmail,
    amountDollars,
    currency = 'USD',
    note = "Your friend didn't keep their promise. Here's your payout!",
    emailSubject = "You've got money from OopsFee!",
    emailMessage = "Your friend didn't keep their promise. Here's your payout.",
  } = params;

  const accessToken = await getPayPalAccessToken();
  const senderBatchId = `oopsfee-${claimId}-${Date.now()}`;

  const payoutBody = {
    sender_batch_header: {
      sender_batch_id: senderBatchId,
      email_subject: emailSubject,
      email_message: emailMessage,
    },
    items: [
      {
        recipient_type: 'EMAIL',
        amount: {
          value: amountDollars,
          currency: currency,
        },
        receiver: recipientEmail,
        note: note,
        sender_item_id: `claim-${claimId}`,
      },
    ],
  };

  const response = await fetch(`${PAYPAL_BASE_URL}/v1/payments/payouts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payoutBody),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('[PayPal] Payout failed:', data);
    return {
      success: false,
      error: data.message || data.error_description || 'Payout failed',
    };
  }

  // Extract payout item ID from links if available
  const payoutItemId = data.items?.[0]?.payout_item_id;

  return {
    success: true,
    batchId: data.batch_header?.payout_batch_id,
    payoutItemId: payoutItemId,
    status: data.batch_header?.batch_status,
  };
}

/**
 * Get payout batch status
 */
export async function getPayoutStatus(batchId: string): Promise<{
  status: string;
  items?: Array<{
    payout_item_id: string;
    transaction_status: string;
    payout_item: {
      receiver: string;
      amount: { value: string; currency: string };
    };
    errors?: { name: string; message: string };
  }>;
}> {
  const accessToken = await getPayPalAccessToken();

  const response = await fetch(`${PAYPAL_BASE_URL}/v1/payments/payouts/${batchId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`PayPal get payout failed: ${response.status} - ${error}`);
  }

  const data = await response.json();

  return {
    status: data.batch_header?.batch_status,
    items: data.items,
  };
}

/**
 * Verify PayPal webhook signature
 * 
 * PayPal uses a verification endpoint rather than local signature verification
 */
export async function verifyWebhookSignature(req: Request): Promise<{
  valid: boolean;
  event?: any;
}> {
  const webhookId = Deno.env.get('PAYPAL_WEBHOOK_ID') ?? '';

  if (!webhookId) {
    console.error('[PayPal] Missing PAYPAL_WEBHOOK_ID environment variable');
    return { valid: false };
  }

  // Get required headers
  const transmissionId = req.headers.get('paypal-transmission-id');
  const transmissionTime = req.headers.get('paypal-transmission-time');
  const transmissionSig = req.headers.get('paypal-transmission-sig');
  const certUrl = req.headers.get('paypal-cert-url');
  const authAlgo = req.headers.get('paypal-auth-algo');

  if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo) {
    console.error('[PayPal] Missing required webhook headers');
    return { valid: false };
  }

  // Clone request and get body
  const body = await req.text();
  let webhookEvent: any;
  
  try {
    webhookEvent = JSON.parse(body);
  } catch {
    console.error('[PayPal] Invalid webhook body');
    return { valid: false };
  }

  const accessToken = await getPayPalAccessToken();

  // Call PayPal's verification endpoint
  const verifyBody = {
    transmission_id: transmissionId,
    transmission_time: transmissionTime,
    cert_url: certUrl,
    auth_algo: authAlgo,
    transmission_sig: transmissionSig,
    webhook_id: webhookId,
    webhook_event: webhookEvent,
  };

  const response = await fetch(`${PAYPAL_BASE_URL}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(verifyBody),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[PayPal] Webhook verification request failed:', error);
    return { valid: false };
  }

  const verifyResult = await response.json();

  if (verifyResult.verification_status === 'SUCCESS') {
    return { valid: true, event: webhookEvent };
  }

  console.error('[PayPal] Webhook signature verification failed:', verifyResult);
  return { valid: false };
}

/**
 * PayPal webhook event types we care about
 */
export const PayPalWebhookEvents = {
  BATCH_SUCCESS: 'PAYMENT.PAYOUTSBATCH.SUCCESS',
  BATCH_DENIED: 'PAYMENT.PAYOUTSBATCH.DENIED',
  ITEM_SUCCEEDED: 'PAYMENT.PAYOUTS-ITEM.SUCCEEDED',
  ITEM_FAILED: 'PAYMENT.PAYOUTS-ITEM.FAILED',
  ITEM_UNCLAIMED: 'PAYMENT.PAYOUTS-ITEM.UNCLAIMED',
  ITEM_RETURNED: 'PAYMENT.PAYOUTS-ITEM.RETURNED',
  ITEM_REFUNDED: 'PAYMENT.PAYOUTS-ITEM.REFUNDED',
  ITEM_BLOCKED: 'PAYMENT.PAYOUTS-ITEM.BLOCKED',
  ITEM_CANCELLED: 'PAYMENT.PAYOUTS-ITEM.CANCELLED',
} as const;

export type PayPalWebhookEventType = typeof PayPalWebhookEvents[keyof typeof PayPalWebhookEvents];

/**
 * Extract claim ID from sender_item_id (format: "claim-{claimId}")
 */
export function extractClaimIdFromPayoutItem(senderItemId: string): string | null {
  if (senderItemId.startsWith('claim-')) {
    return senderItemId.slice(6);
  }
  return null;
}

/**
 * Convert cents to dollars string (e.g. 2500 -> "25.00")
 */
export function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}


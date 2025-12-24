/**
 * Friend Claims API
 *
 * Client-side functions for interacting with friend claim edge functions.
 */

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export type ClaimStatus = 'pending' | 'notified' | 'claimed' | 'expired' | 'transferred';
export type StripeAccountStatus = 'pending' | 'onboarding' | 'active' | 'restricted';
export type PayoutMethod = 'stripe' | 'paypal' | 'card' | null;

export interface ClaimContext {
  // Claim info
  claimId: string;
  claimStatus: ClaimStatus;
  claimExpiresAt: string | null;
  amount: number | null; // in dollars
  
  // Friend info
  friendName: string;
  
  // Promise info
  promiseText: string;
  stake: number; // in dollars
  deadline: string;
  promiseStatus: 'active' | 'completed' | 'failed' | 'expired';
  
  // User info
  userName: string;
  
  // Stripe Connect status
  stripeAccountStatus: StripeAccountStatus | null;
  
  // PayPal payout info
  payoutMethod: PayoutMethod; // 'stripe' | 'paypal' | 'card' | null (not yet chosen)
  paypalEmail: string | null; // Email used for PayPal payout
  paypalBatchId: string | null; // PayPal batch ID for tracking
  
  // Card payout info
  cardLast4: string | null; // Last 4 of debit card used
  cardBrand: string | null; // Card brand (visa, mastercard, etc)
  
  // Derived states
  canClaim: boolean;           // True if claim_status='notified' and not expired
  isExpired: boolean;          // True if claim has expired
  isTransferred: boolean;      // True if funds already sent
  daysUntilExpiry: number | null; // Days left to claim (if claimable)
}

export interface CreateConnectAccountResponse {
  accountId: string;
  onboardingUrl: string;
}

export interface PayPalClaimResponse {
  success: boolean;
  batchId?: string;
  message?: string;
  error?: string;
}

export interface CardClaimResponse {
  success: boolean;
  payoutAmount?: number;    // Net amount in cents
  feeAmount?: number;       // Fee in cents
  payoutId?: string;
  cardLast4?: string;
  cardBrand?: string;
  message?: string;
  error?: string;
}

// ─────────────────────────────────────────────────────────────
// PUBLIC ENDPOINTS
// ─────────────────────────────────────────────────────────────

/**
 * Get claim context for a token (public endpoint).
 * Used to render the claim page.
 */
export async function getClaimContext(token: string): Promise<ClaimContext> {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/get-claim-context?token=${encodeURIComponent(token)}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to get claim context');
  }

  return data;
}

/**
 * Start Stripe Connect Express onboarding.
 * Creates a Connect account and returns the onboarding URL.
 */
export async function startClaimOnboarding(token: string): Promise<CreateConnectAccountResponse> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/create-connect-account`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to start onboarding');
  }

  return data;
}

/**
 * Claim payout via PayPal.
 * Sends an instant payout to the provided PayPal email address.
 */
export async function claimViaPayPal(
  token: string,
  paypalEmail: string
): Promise<PayPalClaimResponse> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/paypal-payout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token, paypalEmail }),
  });

  const data = await response.json();

  if (!response.ok) {
    return {
      success: false,
      error: data.error || 'Failed to process PayPal payout',
    };
  }

  return data;
}

/**
 * Claim payout via debit card.
 * Sends an instant payout to the provided debit card.
 * 
 * @param token - The claim token from the URL
 * @param cardToken - Stripe token from client-side tokenization (tok_xxx)
 * @param cardholderName - Name on the card
 */
export async function claimViaDebitCard(
  token: string,
  cardToken: string,
  cardholderName: string
): Promise<CardClaimResponse> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/claim-payout-to-card`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      token,
      card_token: cardToken,
      cardholder_name: cardholderName,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    return {
      success: false,
      error: data.error || 'Failed to process card payout',
    };
  }

  return {
    success: true,
    payoutAmount: data.payout_amount,
    feeAmount: data.fee_amount,
    payoutId: data.payout_id,
    cardLast4: data.card_last4,
    cardBrand: data.card_brand,
    message: data.message,
  };
}


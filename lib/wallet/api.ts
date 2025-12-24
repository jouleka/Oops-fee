/**
 * Wallet API
 *
 * Client-side functions for wallet operations:
 * - Balance queries
 * - Transaction history
 * - Top-up (add funds via card)
 * - Withdraw (PayPal or Stripe Connect)
 */

import { getSession, supabase } from '@/lib/supabase';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export type WalletTransactionType = 'topup' | 'stake' | 'refund' | 'credit' | 'withdraw';

export interface WalletTransaction {
  id: string;
  userId: string;
  type: WalletTransactionType;
  amountCents: number;       // Positive for credit, negative for debit
  balanceAfter: number;      // Balance in cents after transaction
  relatedPromiseId: string | null;
  relatedClaimId: string | null;
  stripePaymentIntentId: string | null;
  paypalBatchId: string | null;
  description: string | null;
  createdAt: string;
}

export interface TopUpResponse {
  success: boolean;
  balance?: number;         // New balance in cents
  charged?: number;         // Amount charged in cents
  message: string;
  requiresAction?: boolean;
  clientSecret?: string;    // For SCA confirmation or PaymentSheet
  paymentIntentId?: string;
  customerId?: string;      // For PaymentSheet initialization
  ephemeralKey?: string;    // For PaymentSheet initialization
}

export interface WithdrawParams {
  amountCents: number;
  method: 'paypal' | 'stripe';
  destination: string;      // PayPal email or Stripe Connect account ID
}

export interface WithdrawResponse {
  success: boolean;
  balance?: number;         // New balance in cents
  withdrawn?: number;       // Amount withdrawn in cents
  message: string;
  paypalBatchId?: string;
  stripeTransferId?: string;
}

export interface PayoutToCardParams {
  amountCents: number;
  // Stripe token ID (from client-side tokenization)
  cardToken?: string;
  // Or use saved card
  useSavedCard?: boolean;
}

export interface PayoutToCardResponse {
  success: boolean;
  balance?: number;         // New balance in cents
  payoutAmount?: number;    // Net amount sent in cents
  feeAmount?: number;       // Fee charged in cents
  message: string;
  payoutId?: string;
  cardLast4?: string;
  cardBrand?: string;
}

// ─────────────────────────────────────────────────────────────
// BALANCE & TRANSACTIONS
// ─────────────────────────────────────────────────────────────

/**
 * Get the current user's wallet balance in cents.
 * Returns 0 if not authenticated or profile not found.
 */
export async function getWalletBalance(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data, error } = await supabase
    .from('profiles')
    .select('balance_cents')
    .eq('id', user.id)
    .single();

  if (error || !data) {
    console.error('[wallet] Failed to get balance:', error?.message);
    return 0;
  }

  return data.balance_cents ?? 0;
}

/**
 * Get the current user's wallet transaction history.
 * Returns transactions sorted by date (newest first).
 */
export async function getWalletTransactions(
  limit: number = 50
): Promise<WalletTransaction[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[wallet] Failed to get transactions:', error.message);
    return [];
  }

  // Transform to camelCase
  return (data ?? []).map((tx) => ({
    id: tx.id,
    userId: tx.user_id,
    type: tx.type as WalletTransactionType,
    amountCents: tx.amount_cents,
    balanceAfter: tx.balance_after,
    relatedPromiseId: tx.related_promise_id,
    relatedClaimId: tx.related_claim_id,
    stripePaymentIntentId: tx.stripe_payment_intent_id,
    paypalBatchId: tx.paypal_batch_id,
    description: tx.description,
    createdAt: tx.created_at ?? new Date().toISOString(),
  }));
}

// ─────────────────────────────────────────────────────────────
// TOP-UP (Add Funds)
// ─────────────────────────────────────────────────────────────

/**
 * Top up wallet by charging the user's saved card (off-session).
 * 
 * @deprecated Use createTopUpIntent + confirmTopUp for PaymentSheet flow instead
 * @param amountCents Amount to add in cents (min: 500, max: 50000)
 * @returns Response with new balance or error details
 */
export async function topUpWallet(amountCents: number): Promise<TopUpResponse> {
  const session = await getSession();
  if (!session?.access_token) {
    return { success: false, message: 'Not authenticated' };
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/wallet-topup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ amount_cents: amountCents }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'Top-up failed',
      };
    }

    return {
      success: data.success,
      balance: data.balance,
      charged: data.charged,
      message: data.message,
      requiresAction: data.requiresAction,
      clientSecret: data.clientSecret,
      paymentIntentId: data.paymentIntentId,
    };
  } catch (error) {
    console.error('[wallet] Top-up error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Top-up failed',
    };
  }
}

/**
 * Create a PaymentIntent for wallet top-up (for use with PaymentSheet).
 * This supports Apple Pay, Google Pay, and card payments.
 * 
 * @param amountCents Amount to add in cents (min: 500, max: 50000)
 * @returns Response with clientSecret, customerId, and ephemeralKey for PaymentSheet
 */
export async function createTopUpIntent(amountCents: number): Promise<TopUpResponse> {
  const session = await getSession();
  if (!session?.access_token) {
    return { success: false, message: 'Not authenticated' };
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/wallet-topup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ amount_cents: amountCents, setup_only: true }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'Failed to create payment',
      };
    }

    return {
      success: data.success,
      message: data.message,
      clientSecret: data.clientSecret,
      paymentIntentId: data.paymentIntentId,
      customerId: data.customerId,
      ephemeralKey: data.ephemeralKey,
    };
  } catch (error) {
    console.error('[wallet] Create top-up intent error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create payment',
    };
  }
}

/**
 * Confirm a top-up after PaymentSheet succeeds.
 * This credits the wallet with the payment amount.
 * 
 * @param paymentIntentId The PaymentIntent ID from createTopUpIntent
 * @returns Response with new balance
 */
export async function confirmTopUp(paymentIntentId: string): Promise<TopUpResponse> {
  const session = await getSession();
  if (!session?.access_token) {
    return { success: false, message: 'Not authenticated' };
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/wallet-topup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ payment_intent_id: paymentIntentId }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'Failed to confirm top-up',
      };
    }

    return {
      success: data.success,
      balance: data.balance,
      charged: data.charged,
      message: data.message,
      paymentIntentId: data.paymentIntentId,
    };
  } catch (error) {
    console.error('[wallet] Confirm top-up error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to confirm top-up',
    };
  }
}

// ─────────────────────────────────────────────────────────────
// WITHDRAW
// ─────────────────────────────────────────────────────────────

/**
 * Withdraw funds from wallet to PayPal or bank account.
 * 
 * @param params.amountCents Amount to withdraw in cents
 * @param params.method 'paypal' or 'stripe'
 * @param params.destination PayPal email or Stripe Connect account ID
 * @returns Response with new balance or error details
 */
export async function withdrawWallet(params: WithdrawParams): Promise<WithdrawResponse> {
  const session = await getSession();
  if (!session?.access_token) {
    return { success: false, message: 'Not authenticated' };
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/wallet-withdraw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        amount_cents: params.amountCents,
        method: params.method,
        destination: params.destination,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'Withdrawal failed',
      };
    }

    return {
      success: data.success,
      balance: data.balance,
      withdrawn: data.withdrawn,
      message: data.message,
      paypalBatchId: data.paypal_batch_id,
      stripeTransferId: data.stripe_transfer_id,
    };
  } catch (error) {
    console.error('[wallet] Withdraw error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Withdrawal failed',
    };
  }
}

// ─────────────────────────────────────────────────────────────
// PAYOUT TO DEBIT CARD (Instant)
// ─────────────────────────────────────────────────────────────

/**
 * Instantly payout funds to a debit card.
 * 
 * @param params.amountCents Amount to payout in cents (min: 500, max: 100000)
 * @param params.cardNumber Debit card number (or use saved card)
 * @param params.expMonth Card expiration month
 * @param params.expYear Card expiration year
 * @param params.cvc Card CVC
 * @param params.cardholderName Cardholder name
 * @param params.useSavedCard Use previously saved payout card
 * @returns Response with new balance, net amount, fee, or error details
 */
export async function payoutToCard(params: PayoutToCardParams): Promise<PayoutToCardResponse> {
  const session = await getSession();
  if (!session?.access_token) {
    return { success: false, message: 'Not authenticated' };
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/payout-to-card`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        amount_cents: params.amountCents,
        card_token: params.cardToken,
        use_saved_card: params.useSavedCard,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'Payout failed',
      };
    }

    return {
      success: data.success,
      balance: data.balance,
      payoutAmount: data.payout_amount,
      feeAmount: data.fee_amount,
      message: data.message,
      payoutId: data.payout_id,
      cardLast4: data.card_last4,
      cardBrand: data.card_brand,
    };
  } catch (error) {
    console.error('[wallet] Payout to card error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Payout failed',
    };
  }
}

// ─────────────────────────────────────────────────────────────
// PAYOUT METHOD MANAGEMENT
// ─────────────────────────────────────────────────────────────

/**
 * Save the user's preferred payout method for withdrawals.
 * 
 * @param method 'paypal' or 'stripe'
 * @param destination PayPal email or Stripe Connect account ID
 */
export async function savePayoutMethod(
  method: 'paypal' | 'stripe',
  destination: string
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  const update = method === 'paypal'
    ? { paypal_payout_email: destination }
    : { stripe_connect_account_id: destination };

  const { error } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', user.id);

  if (error) {
    console.error('[wallet] Failed to save payout method:', error.message);
    throw new Error('Failed to save payout method');
  }
}

/**
 * Get the user's saved payout methods.
 */
export async function getPayoutMethods(): Promise<{
  paypalEmail: string | null;
  stripeConnectAccountId: string | null;
  savedCard: { last4: string; brand: string } | null;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { paypalEmail: null, stripeConnectAccountId: null, savedCard: null };
  }

  // Note: payout_card_* columns added in migration 011 - cast to handle pre-migration types
  const { data, error } = await supabase
    .from('profiles')
    .select('paypal_payout_email, stripe_connect_account_id, payout_card_last4, payout_card_brand')
    .eq('id', user.id)
    .single();

  if (error || !data) {
    return { paypalEmail: null, stripeConnectAccountId: null, savedCard: null };
  }

  // Cast to handle columns not yet in generated types (migration 011)
  const profile = data as unknown as {
    paypal_payout_email: string | null;
    stripe_connect_account_id: string | null;
    payout_card_last4?: string | null;
    payout_card_brand?: string | null;
  };

  return {
    paypalEmail: profile.paypal_payout_email,
    stripeConnectAccountId: profile.stripe_connect_account_id,
    savedCard: profile.payout_card_last4
      ? { last4: profile.payout_card_last4, brand: profile.payout_card_brand ?? 'unknown' }
      : null,
  };
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Format cents as a dollar string (e.g., 1250 -> "$12.50")
 */
export function formatCents(cents: number): string {
  const dollars = cents / 100;
  return `$${dollars.toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

/**
 * Get a user-friendly label for a transaction type.
 */
export function getTransactionLabel(type: WalletTransactionType): string {
  switch (type) {
    case 'topup':
      return 'Added Funds';
    case 'stake':
      return 'Promise Stake';
    case 'refund':
      return 'Refund';
    case 'credit':
      return 'Friend Payout';
    case 'withdraw':
      return 'Withdrawal';
    default:
      return type;
  }
}

/**
 * Get the icon name for a transaction type (for use with Ionicons).
 */
export function getTransactionIcon(type: WalletTransactionType): string {
  switch (type) {
    case 'topup':
      return 'add-circle';
    case 'stake':
      return 'hand-left';
    case 'refund':
      return 'arrow-undo';
    case 'credit':
      return 'gift';
    case 'withdraw':
      return 'arrow-down-circle';
    default:
      return 'cash';
  }
}


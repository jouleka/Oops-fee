/**
 * Wallet API
 *
 * Client-side functions for wallet operations:
 * - Balance queries
 * - Transaction history
 * - Top-up (add funds via card)
 * - Withdraw (PayPal or Stripe Connect)
 */

import { supabase, getSession } from '@/lib/supabase';

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
  clientSecret?: string;    // For SCA confirmation
  paymentIntentId?: string;
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
    createdAt: tx.created_at,
  }));
}

// ─────────────────────────────────────────────────────────────
// TOP-UP (Add Funds)
// ─────────────────────────────────────────────────────────────

/**
 * Top up wallet by charging the user's saved card.
 * 
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
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { paypalEmail: null, stripeConnectAccountId: null };
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('paypal_payout_email, stripe_connect_account_id')
    .eq('id', user.id)
    .single();

  if (error || !data) {
    return { paypalEmail: null, stripeConnectAccountId: null };
  }

  return {
    paypalEmail: data.paypal_payout_email,
    stripeConnectAccountId: data.stripe_connect_account_id,
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


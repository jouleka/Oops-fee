/**
 * Database types for Supabase
 * 
 * This file re-exports types from the auto-generated types.generated.ts
 * and adds convenience type aliases for the codebase.
 * 
 * To regenerate types:
 *   npx supabase gen types typescript --project-id <project-id> > lib/supabase/types.generated.ts
 */

// Re-export the generated Database type
export type { Database, Json, Tables, TablesInsert, TablesUpdate } from './types.generated';

// Import for creating aliases
import type { Database } from './types.generated';

// ============================================================================
// Table Row Type Aliases (for cleaner imports)
// ============================================================================

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type PromiseRow = Database['public']['Tables']['promises']['Row'];
export type ShareLink = Database['public']['Tables']['share_links']['Row'];
export type SponsorPledge = Database['public']['Tables']['sponsor_pledges']['Row'];
export type RoastMessage = Database['public']['Tables']['roast_messages']['Row'];
export type Payment = Database['public']['Tables']['payments']['Row'];
export type FriendClaim = Database['public']['Tables']['friend_claims']['Row'];
export type WalletTransaction = Database['public']['Tables']['wallet_transactions']['Row'];

// ============================================================================
// Insert Type Aliases
// ============================================================================

export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type PromiseInsert = Database['public']['Tables']['promises']['Insert'];
export type ShareLinkInsert = Database['public']['Tables']['share_links']['Insert'];
export type SponsorPledgeInsert = Database['public']['Tables']['sponsor_pledges']['Insert'];
export type RoastMessageInsert = Database['public']['Tables']['roast_messages']['Insert'];
export type PaymentInsert = Database['public']['Tables']['payments']['Insert'];
export type FriendClaimInsert = Database['public']['Tables']['friend_claims']['Insert'];
export type WalletTransactionInsert = Database['public']['Tables']['wallet_transactions']['Insert'];

// ============================================================================
// Update Type Aliases
// ============================================================================

export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];
export type PromiseUpdate = Database['public']['Tables']['promises']['Update'];
export type ShareLinkUpdate = Database['public']['Tables']['share_links']['Update'];
export type PaymentUpdate = Database['public']['Tables']['payments']['Update'];
export type FriendClaimUpdate = Database['public']['Tables']['friend_claims']['Update'];

// ============================================================================
// Enum Types (from our schema - not auto-generated as ENUMs)
// ============================================================================

export type PromiseStatus = 'active' | 'completed' | 'failed' | 'expired';
export type MoneyDestination = 'oopsfee' | 'charity' | 'friend';
export type VerificationType = 'honor' | 'photo' | 'partner' | 'healthkit' | 'location';
export type PartnerState = 'awaiting' | 'approved' | 'rejected' | 'expired';
export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'requires_action' | 'abandoned';
export type ShareLinkType = 'sponsor' | 'roast' | 'partner';
export type ClaimStatus = 'pending' | 'notified' | 'claimed' | 'expired' | 'transferred';
export type StripeAccountStatus = 'pending' | 'onboarding' | 'active' | 'restricted';
export type WalletTransactionType = 'topup' | 'stake' | 'refund' | 'credit' | 'withdraw';
export type PayoutMethod = 'stripe' | 'paypal' | 'wallet';

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Context returned by get-share-context edge function
 * Contains minimal data safe for public display
 */
export interface ShareContext {
  type: ShareLinkType;
  promiseText: string; // First 100 chars only
  deadlinePassed: boolean; // Not the actual deadline
  ownerFirstName?: string; // Not full name
  status: 'active' | 'resolved'; // Simplified
  // For sponsor links
  currentSponsorTotal?: number;
  // For partner links
  partnerState?: 'awaiting' | 'resolved';
}

/**
 * User payment state from profile
 */
export interface UserPaymentState {
  hasPaymentMethod: boolean;
  paymentBlocked: boolean;
  failedPaymentCount: number;
  /** Payment method brand: visa, mastercard, amex, apple_pay, google_pay, link, etc. */
  brand: string | null;
  /** Last 4 digits of card (if applicable) */
  last4: string | null;
  /** Payment method type: card, wallet, link */
  type: string | null;
}

/**
 * Database types for Supabase
 * 
 * These types mirror the SQL schema in supabase/migrations/001_initial_schema.sql
 * 
 * Note: In production, you would typically generate these types using:
 * npx supabase gen types typescript --project-id <your-project-id> > lib/supabase/types.ts
 * 
 * For now, these are manually maintained to match the schema.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ============================================================================
// Enum Types
// ============================================================================

export type PromiseStatus = 'active' | 'completed' | 'failed' | 'expired';
export type MoneyDestination = 'oopsfee' | 'charity' | 'friend';
export type VerificationType = 'honor' | 'photo' | 'partner' | 'healthkit' | 'location';
export type PartnerState = 'awaiting' | 'approved' | 'rejected' | 'expired';
export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'requires_action' | 'abandoned';
export type ShareLinkType = 'sponsor' | 'roast' | 'partner';

// ============================================================================
// Table Row Types
// ============================================================================

export interface Profile {
  id: string; // UUID
  display_name: string | null;
  avatar_url: string | null;
  stripe_customer_id: string | null;
  default_payment_method_id: string | null;
  failed_payment_count: number;
  payment_blocked: boolean;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

export interface Promise {
  id: string; // Text, matches local ID format
  user_id: string; // UUID
  text: string;
  stake: number; // In cents
  deadline_at: string; // ISO timestamp
  status: PromiseStatus;
  money_destination: MoneyDestination;
  verification_type: VerificationType;
  verification_proof_ref: string | null;
  verification_timestamp: string | null;
  partner_state: PartnerState | null;
  partner_deadline_at: string | null;
  sponsor_total: number;
  sponsor_count: number;
  has_roast: boolean;
  voice_note_ref: string | null;
  completed_at: string | null;
  failed_at: string | null;
  expired_at: string | null;
  streak_at_completion: number | null;
  settle_at: string | null;
  payment_status: PaymentStatus | null;
  payment_retry_count: number;
  payment_next_retry_at: string | null;
  payment_client_secret: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShareLink {
  id: string; // UUID
  promise_id: string;
  type: ShareLinkType;
  token_hash: string;
  expires_at: string | null;
  revoked: boolean;
  created_at: string;
}

export interface SponsorPledge {
  id: string; // UUID
  promise_id: string;
  amount: number; // In cents
  from_name: string;
  from_ip_hash: string | null;
  created_at: string;
}

export interface RoastMessage {
  id: string; // UUID
  promise_id: string;
  message: string;
  from_name: string;
  from_ip_hash: string | null;
  created_at: string;
}

export interface Payment {
  id: string; // UUID
  promise_id: string;
  amount: number; // In cents
  currency: string;
  stripe_payment_intent_id: string | null;
  status: 'pending' | 'succeeded' | 'failed' | 'requires_action';
  attempt_number: number;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
}

// ============================================================================
// Insert/Update Types (for type-safe mutations)
// ============================================================================

export type ProfileInsert = Omit<Profile, 'created_at' | 'updated_at' | 'failed_payment_count' | 'payment_blocked'> & {
  failed_payment_count?: number;
  payment_blocked?: boolean;
};

export type ProfileUpdate = Partial<Omit<Profile, 'id' | 'created_at'>>;

export type PromiseInsert = Omit<
  Promise,
  | 'created_at'
  | 'updated_at'
  | 'sponsor_total'
  | 'sponsor_count'
  | 'has_roast'
  | 'payment_retry_count'
> & {
  sponsor_total?: number;
  sponsor_count?: number;
  has_roast?: boolean;
  payment_retry_count?: number;
};

export type PromiseUpdate = Partial<Omit<Promise, 'id' | 'user_id' | 'created_at'>>;

export type ShareLinkInsert = Omit<ShareLink, 'id' | 'created_at' | 'revoked'> & {
  revoked?: boolean;
};

export type SponsorPledgeInsert = Omit<SponsorPledge, 'id' | 'created_at'>;

export type RoastMessageInsert = Omit<RoastMessage, 'id' | 'created_at'>;

export type PaymentInsert = Omit<Payment, 'id' | 'created_at' | 'attempt_number'> & {
  attempt_number?: number;
};

// ============================================================================
// Database Schema Type (for createClient<Database>)
// ============================================================================

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
      };
      promises: {
        Row: Promise;
        Insert: PromiseInsert;
        Update: PromiseUpdate;
      };
      share_links: {
        Row: ShareLink;
        Insert: ShareLinkInsert;
        Update: Partial<Pick<ShareLink, 'revoked'>>;
      };
      sponsor_pledges: {
        Row: SponsorPledge;
        Insert: SponsorPledgeInsert;
        Update: never; // No updates allowed
      };
      roast_messages: {
        Row: RoastMessage;
        Insert: RoastMessageInsert;
        Update: never; // No updates allowed
      };
      payments: {
        Row: Payment;
        Insert: PaymentInsert;
        Update: Partial<Pick<Payment, 'status' | 'error_code' | 'error_message'>>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      promise_status: PromiseStatus;
      money_destination: MoneyDestination;
      verification_type: VerificationType;
      partner_state: PartnerState;
      payment_status: PaymentStatus;
      share_link_type: ShareLinkType;
    };
  };
}

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
}


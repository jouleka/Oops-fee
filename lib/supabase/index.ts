/**
 * Supabase client and types for OopsFee
 * 
 * Usage:
 * ```ts
 * import { supabase, isSupabaseConfigured } from '@/lib/supabase';
 * import type { Promise, Profile } from '@/lib/supabase';
 * ```
 */

export { 
  supabase, 
  isSupabaseConfigured, 
  getCurrentUserId, 
  getSession 
} from './client';

export type {
  // Database schema
  Database,
  // Table types
  Profile,
  Promise,
  ShareLink,
  SponsorPledge,
  RoastMessage,
  Payment,
  // Insert/Update types
  ProfileInsert,
  ProfileUpdate,
  PromiseInsert,
  PromiseUpdate,
  ShareLinkInsert,
  SponsorPledgeInsert,
  RoastMessageInsert,
  PaymentInsert,
  // Enum types
  PromiseStatus,
  MoneyDestination,
  VerificationType,
  PartnerState,
  PaymentStatus,
  ShareLinkType,
  // Utility types
  ShareContext,
  UserPaymentState,
} from './types';


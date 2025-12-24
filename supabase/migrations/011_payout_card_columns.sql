-- ============================================================================
-- Payout Card Columns for Instant Debit Card Payouts
-- Migration: 011_payout_card_columns.sql
--
-- Adds columns to profiles table for storing payout card information
-- and the lightweight Connect account used for card payouts.
-- ============================================================================

-- ============================================================================
-- PROFILES TABLE: Add payout card destination fields
-- ============================================================================

-- Lightweight Custom Connect account for card payouts (different from full Express account)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS payout_connect_account_id TEXT;

-- Saved payout card details (for display and identification only, not card numbers)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS payout_card_last4 TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS payout_card_brand TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS payout_card_fingerprint TEXT;

COMMENT ON COLUMN profiles.payout_connect_account_id IS
  'Lightweight Stripe Custom Connect account ID for instant card payouts.';

COMMENT ON COLUMN profiles.payout_card_last4 IS
  'Last 4 digits of saved payout debit card for display.';

COMMENT ON COLUMN profiles.payout_card_brand IS
  'Brand of saved payout debit card (visa, mastercard, etc).';

COMMENT ON COLUMN profiles.payout_card_fingerprint IS
  'Stripe fingerprint of saved payout card for identification.';

-- ============================================================================
-- INDEX: For looking up profiles by Connect account
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_payout_connect_account 
  ON profiles(payout_connect_account_id) 
  WHERE payout_connect_account_id IS NOT NULL;

-- ============================================================================
-- SERVICE ROLE ACCESS DOCUMENTATION
-- ============================================================================

-- payout-to-card edge function operations:
-- - Creates/retrieves payout_connect_account_id for user
-- - Saves payout_card_last4, payout_card_brand, payout_card_fingerprint
-- - Uses debit_wallet_withdraw RPC to debit wallet after payout


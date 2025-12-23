-- ============================================================================
-- PayPal Payouts + Wallet Balance System
-- Migration: 009_paypal_and_wallet.sql
--
-- Adds PayPal as an alternative payout method for friend claims and
-- introduces a wallet balance system for in-app friend transfers.
-- ============================================================================

-- ============================================================================
-- PROFILES TABLE: Add wallet balance
-- ============================================================================

ALTER TABLE profiles ADD COLUMN balance_cents INTEGER DEFAULT 0;

COMMENT ON COLUMN profiles.balance_cents IS 
  'In-app wallet balance in cents. Credited when an in-app friend receives money from a broken promise.';

-- ============================================================================
-- FRIEND CLAIMS TABLE: Add PayPal payout fields
-- ============================================================================

-- Payout method selection (null = not chosen yet)
ALTER TABLE friend_claims ADD COLUMN payout_method TEXT;

-- PayPal-specific fields
ALTER TABLE friend_claims ADD COLUMN paypal_email TEXT;
ALTER TABLE friend_claims ADD COLUMN paypal_batch_id TEXT;
ALTER TABLE friend_claims ADD COLUMN paypal_payout_item_id TEXT;

-- Add constraint for valid payout methods
-- 'wallet' = credited directly to in-app friend's wallet balance
ALTER TABLE friend_claims ADD CONSTRAINT valid_payout_method 
  CHECK (payout_method IS NULL OR payout_method IN ('stripe', 'paypal', 'wallet'));

-- Index for finding claims by PayPal batch ID (for webhook handling)
CREATE INDEX idx_friend_claims_paypal_batch ON friend_claims (paypal_batch_id)
  WHERE paypal_batch_id IS NOT NULL;

-- Index for finding claims by PayPal payout item ID (for webhook handling)
CREATE INDEX idx_friend_claims_paypal_item ON friend_claims (paypal_payout_item_id)
  WHERE paypal_payout_item_id IS NOT NULL;

COMMENT ON COLUMN friend_claims.payout_method IS 
  'Payout method: stripe (Stripe Connect), paypal (PayPal Payouts), or wallet (in-app friend credit). NULL if not yet chosen.';

COMMENT ON COLUMN friend_claims.paypal_email IS 
  'Email address to send PayPal payout to. Set when friend chooses PayPal on claim page.';

COMMENT ON COLUMN friend_claims.paypal_batch_id IS 
  'PayPal Payouts API batch ID for tracking the payout batch.';

COMMENT ON COLUMN friend_claims.paypal_payout_item_id IS 
  'PayPal Payouts API item ID for tracking the individual payout item.';

-- ============================================================================
-- HELPER FUNCTION: Credit wallet balance
-- Used to credit in-app friends when their friend fails a promise
-- ============================================================================

CREATE OR REPLACE FUNCTION credit_wallet(target_user_id UUID, amount_cents INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE profiles 
  SET balance_cents = balance_cents + amount_cents
  WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

COMMENT ON FUNCTION credit_wallet(UUID, INTEGER) IS 
  'Credits the specified amount to a user wallet. Used when an in-app friend receives money from a broken promise.';

-- ============================================================================
-- HELPER FUNCTION: Debit wallet balance (for future withdrawals)
-- ============================================================================

CREATE OR REPLACE FUNCTION debit_wallet(target_user_id UUID, amount_cents INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  current_balance INTEGER;
BEGIN
  SELECT balance_cents INTO current_balance
  FROM profiles
  WHERE id = target_user_id
  FOR UPDATE;
  
  IF current_balance IS NULL OR current_balance < amount_cents THEN
    RETURN FALSE;
  END IF;
  
  UPDATE profiles 
  SET balance_cents = balance_cents - amount_cents
  WHERE id = target_user_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

COMMENT ON FUNCTION debit_wallet(UUID, INTEGER) IS 
  'Debits the specified amount from a user wallet. Returns FALSE if insufficient balance. Used for withdrawals.';


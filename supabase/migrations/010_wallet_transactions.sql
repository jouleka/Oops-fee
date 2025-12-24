-- ============================================================================
-- Wallet Transactions Ledger & Enhanced RPC Functions
-- Migration: 010_wallet_transactions.sql
--
-- Adds a transaction ledger for wallet audit trail, enhanced credit/debit
-- functions with logging, and profile fields for withdrawal destinations.
-- ============================================================================

-- ============================================================================
-- WALLET TRANSACTION TYPES ENUM
-- ============================================================================

CREATE TYPE wallet_transaction_type AS ENUM (
  'topup',     -- User added funds via card
  'stake',     -- Debited for promise stake
  'refund',    -- Refunded stake (e.g., promise cancelled or completed)
  'credit',    -- Credited from failed promise (friend payout)
  'withdraw'   -- User withdrew funds to PayPal/bank
);

-- ============================================================================
-- WALLET TRANSACTIONS TABLE (Ledger)
-- ============================================================================

CREATE TABLE wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type wallet_transaction_type NOT NULL,
  amount_cents INTEGER NOT NULL,  -- positive for credit, negative for debit
  balance_after INTEGER NOT NULL, -- balance after this transaction
  related_promise_id TEXT REFERENCES promises(id),
  related_claim_id UUID REFERENCES friend_claims(id),
  stripe_payment_intent_id TEXT,
  paypal_batch_id TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for user transaction history (newest first)
CREATE INDEX idx_wallet_transactions_user ON wallet_transactions(user_id, created_at DESC);

-- Index for finding transactions by promise
CREATE INDEX idx_wallet_transactions_promise ON wallet_transactions(related_promise_id)
  WHERE related_promise_id IS NOT NULL;

-- Index for finding transactions by claim
CREATE INDEX idx_wallet_transactions_claim ON wallet_transactions(related_claim_id)
  WHERE related_claim_id IS NOT NULL;

COMMENT ON TABLE wallet_transactions IS 
  'Ledger of all wallet transactions for audit trail and user transaction history.';

COMMENT ON COLUMN wallet_transactions.amount_cents IS
  'Amount in cents. Positive for credits (topup, credit, refund), negative for debits (stake, withdraw).';

COMMENT ON COLUMN wallet_transactions.balance_after IS
  'Wallet balance immediately after this transaction. Used for consistency checks and display.';

-- ============================================================================
-- PROFILES TABLE: Add payout destination fields
-- ============================================================================

-- Stripe Connect account for bank withdrawals
ALTER TABLE profiles ADD COLUMN stripe_connect_account_id TEXT;

-- Saved PayPal email for withdrawals
ALTER TABLE profiles ADD COLUMN paypal_payout_email TEXT;

COMMENT ON COLUMN profiles.stripe_connect_account_id IS
  'User Stripe Connect Express account ID for bank withdrawals.';

COMMENT ON COLUMN profiles.paypal_payout_email IS
  'Saved PayPal email for wallet withdrawals via PayPal Payouts.';

-- ============================================================================
-- FUNCTION: Debit wallet with transaction logging
-- ============================================================================

CREATE OR REPLACE FUNCTION debit_wallet_with_log(
  target_user_id UUID,
  amount_cents INTEGER,
  tx_type wallet_transaction_type,
  promise_id TEXT DEFAULT NULL,
  description_text TEXT DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  new_balance INTEGER;
BEGIN
  -- Validate amount is positive
  IF amount_cents <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Debit the balance atomically (fails if insufficient)
  UPDATE public.profiles 
  SET balance_cents = balance_cents - amount_cents
  WHERE id = target_user_id AND balance_cents >= amount_cents
  RETURNING balance_cents INTO new_balance;
  
  IF new_balance IS NULL THEN
    RETURN -1; -- Insufficient balance
  END IF;
  
  -- Log the transaction (negative amount for debit)
  INSERT INTO public.wallet_transactions (
    user_id, 
    type, 
    amount_cents, 
    balance_after, 
    related_promise_id, 
    description
  )
  VALUES (
    target_user_id, 
    tx_type, 
    -amount_cents,  -- Store as negative for debits
    new_balance, 
    promise_id, 
    description_text
  );
  
  RETURN new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public';

COMMENT ON FUNCTION debit_wallet_with_log IS
  'Atomically debits wallet and logs the transaction. Returns new balance, or -1 if insufficient funds.';

-- ============================================================================
-- FUNCTION: Credit wallet with transaction logging
-- ============================================================================

CREATE OR REPLACE FUNCTION credit_wallet_with_log(
  target_user_id UUID,
  amount_cents INTEGER,
  tx_type wallet_transaction_type,
  promise_id TEXT DEFAULT NULL,
  claim_id UUID DEFAULT NULL,
  stripe_pi_id TEXT DEFAULT NULL,
  description_text TEXT DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  new_balance INTEGER;
BEGIN
  -- Validate amount is positive
  IF amount_cents <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Credit the balance
  UPDATE public.profiles 
  SET balance_cents = balance_cents + amount_cents
  WHERE id = target_user_id
  RETURNING balance_cents INTO new_balance;
  
  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'User not found: %', target_user_id;
  END IF;
  
  -- Log the transaction (positive amount for credit)
  INSERT INTO public.wallet_transactions (
    user_id, 
    type, 
    amount_cents, 
    balance_after, 
    related_promise_id, 
    related_claim_id, 
    stripe_payment_intent_id, 
    description
  )
  VALUES (
    target_user_id, 
    tx_type, 
    amount_cents,  -- Store as positive for credits
    new_balance, 
    promise_id, 
    claim_id, 
    stripe_pi_id, 
    description_text
  );
  
  RETURN new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public';

COMMENT ON FUNCTION credit_wallet_with_log IS
  'Atomically credits wallet and logs the transaction. Returns new balance.';

-- ============================================================================
-- FUNCTION: Log withdrawal with PayPal batch ID
-- ============================================================================

CREATE OR REPLACE FUNCTION debit_wallet_withdraw(
  target_user_id UUID,
  amount_cents INTEGER,
  paypal_batch TEXT DEFAULT NULL,
  description_text TEXT DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  new_balance INTEGER;
BEGIN
  -- Validate amount is positive
  IF amount_cents <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Debit the balance atomically (fails if insufficient)
  UPDATE public.profiles 
  SET balance_cents = balance_cents - amount_cents
  WHERE id = target_user_id AND balance_cents >= amount_cents
  RETURNING balance_cents INTO new_balance;
  
  IF new_balance IS NULL THEN
    RETURN -1; -- Insufficient balance
  END IF;
  
  -- Log the transaction with PayPal batch ID
  INSERT INTO public.wallet_transactions (
    user_id, 
    type, 
    amount_cents, 
    balance_after, 
    paypal_batch_id,
    description
  )
  VALUES (
    target_user_id, 
    'withdraw', 
    -amount_cents,  -- Store as negative for debits
    new_balance, 
    paypal_batch,
    description_text
  );
  
  RETURN new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public';

COMMENT ON FUNCTION debit_wallet_withdraw IS
  'Atomically debits wallet for withdrawal and logs with PayPal batch ID. Returns new balance, or -1 if insufficient funds.';

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Users can view their own wallet transactions
CREATE POLICY "Users can view their own wallet transactions"
  ON wallet_transactions FOR SELECT
  USING ((select auth.uid()) = user_id);

-- Note: All inserts are via RPC functions with SECURITY DEFINER
-- or Edge Functions with service role, so no INSERT policy needed for users

-- ============================================================================
-- SERVICE ROLE ACCESS DOCUMENTATION
-- ============================================================================

-- wallet_transactions service role operations:
-- - wallet-topup: Credits wallet via credit_wallet_with_log
-- - wallet-withdraw: Debits wallet via debit_wallet_withdraw
-- - charge-promise: May debit wallet via debit_wallet_with_log
-- - settle-promises: May debit wallet or credit friend wallet via RPC functions


-- ============================================================================
-- Friend Claims for Friend Payout Feature
-- Migration: 008_friend_claims.sql
--
-- When a user creates a promise with money_destination='friend' and fails,
-- the money goes to their friend via Stripe Connect Express.
-- This table tracks the claim process and Stripe Connect onboarding.
-- ============================================================================

-- ============================================================================
-- FRIEND CLAIMS TABLE
-- Tracks friend payout claims with Stripe Connect integration
-- ============================================================================

CREATE TABLE friend_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promise_id TEXT NOT NULL REFERENCES promises(id) ON DELETE CASCADE,
  
  -- Friend contact (at least one required)
  friend_email TEXT,
  friend_phone TEXT,
  friend_name TEXT NOT NULL,
  
  -- Stripe Connect Express
  stripe_account_id TEXT,           -- Filled when friend starts onboarding
  stripe_account_status TEXT,       -- 'pending' | 'onboarding' | 'active' | 'restricted'
  
  -- Claim status
  claim_status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'notified' | 'claimed' | 'expired' | 'transferred'
  claim_token TEXT NOT NULL UNIQUE,              -- For claim link (e.g., /claim/{token})
  claim_expires_at TIMESTAMPTZ,                  -- Set when user fails (7 days from failure)
  
  -- Amounts (in cents)
  amount_cents INTEGER,             -- Filled when user fails (amount charged)
  transfer_id TEXT,                 -- Stripe transfer ID once complete
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Constraint: at least email or phone must be provided
ALTER TABLE friend_claims ADD CONSTRAINT friend_contact_required 
  CHECK (friend_email IS NOT NULL OR friend_phone IS NOT NULL);

-- Index for fast claim token lookup (public claim page)
CREATE INDEX idx_friend_claims_token ON friend_claims (claim_token);

-- Index for finding claims by promise
CREATE INDEX idx_friend_claims_promise ON friend_claims (promise_id);

-- Index for finding pending/notified claims (for expiration cron)
CREATE INDEX idx_friend_claims_expiration ON friend_claims (claim_status, claim_expires_at)
  WHERE claim_status IN ('pending', 'notified');

-- Index for finding claims by Stripe account (for webhook handling)
CREATE INDEX idx_friend_claims_stripe_account ON friend_claims (stripe_account_id)
  WHERE stripe_account_id IS NOT NULL;

-- Index for finding claims by friend email (aggregate multiple claims)
CREATE INDEX idx_friend_claims_email ON friend_claims (friend_email)
  WHERE friend_email IS NOT NULL;

-- Index for finding claims by friend phone (aggregate multiple claims)
CREATE INDEX idx_friend_claims_phone ON friend_claims (friend_phone)
  WHERE friend_phone IS NOT NULL;

-- Apply updated_at trigger to friend_claims
CREATE TRIGGER friend_claims_updated_at
  BEFORE UPDATE ON friend_claims
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ADD FRIEND CLAIM REFERENCE TO PROMISES TABLE
-- ============================================================================

ALTER TABLE promises ADD COLUMN friend_claim_id UUID REFERENCES friend_claims(id);

-- Index for finding promises by friend claim
CREATE INDEX idx_promises_friend_claim ON promises (friend_claim_id)
  WHERE friend_claim_id IS NOT NULL;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE friend_claims ENABLE ROW LEVEL SECURITY;

-- Users can view friend claims for their own promises
CREATE POLICY "Users can view friend claims for their promises"
  ON friend_claims FOR SELECT
  USING (
    promise_id IN (SELECT id FROM promises WHERE user_id = (select auth.uid()))
  );

-- Users can create friend claims for their own promises
CREATE POLICY "Users can create friend claims for their promises"
  ON friend_claims FOR INSERT
  WITH CHECK (
    promise_id IN (SELECT id FROM promises WHERE user_id = (select auth.uid()))
  );

-- Users can update friend claims for their own promises (limited updates)
CREATE POLICY "Users can update friend claims for their promises"
  ON friend_claims FOR UPDATE
  USING (
    promise_id IN (SELECT id FROM promises WHERE user_id = (select auth.uid()))
  )
  WITH CHECK (
    promise_id IN (SELECT id FROM promises WHERE user_id = (select auth.uid()))
  );

-- Note: Most updates (Stripe account linking, claim status changes, transfers)
-- are handled by Edge Functions with service role key, bypassing RLS.
-- The update policy above allows users to update friend contact info if needed.

-- ============================================================================
-- SERVICE ROLE ACCESS DOCUMENTATION
-- Edge Functions use service role key, bypassing RLS
-- ============================================================================

-- friend_claims service role operations:
-- - create-friend-claim: Creates claim record and sends invite notification
-- - settle-promises: Updates amount_cents, claim_status, claim_expires_at on failure
-- - create-connect-account: Updates stripe_account_id, stripe_account_status
-- - connect-webhook: Updates stripe_account_status, claim_status, transfer_id
-- - expire-claims: Updates claim_status to 'expired' for unclaimed funds

-- ============================================================================
-- HELPER FUNCTION: Generate secure claim token
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_claim_token()
RETURNS TEXT AS $$
BEGIN
  -- Generate a URL-safe random token (32 bytes = 43 chars base64url)
  RETURN encode(gen_random_bytes(32), 'base64');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- ============================================================================
-- COMMENT ON CLAIM STATUSES
-- ============================================================================

COMMENT ON COLUMN friend_claims.claim_status IS 
  'Claim lifecycle: pending (created) -> notified (user failed, friend notified) -> claimed (friend started onboarding) OR expired (7 days passed) -> transferred (funds sent)';

COMMENT ON COLUMN friend_claims.stripe_account_status IS
  'Stripe Connect account status: pending (not started) -> onboarding (in progress) -> active (ready for transfers) | restricted (needs attention)';


-- ========================================================================
-- MIGRATION 015: In-App Friend Beneficiary
-- ========================================================================
-- Adds friend_user_id column to promises table for in-app friend routing.
-- When a user creates a promise with money_destination='friend' and names
-- an in-app friend, the payout goes directly to their wallet on failure.
--
-- This is mutually exclusive with friend_claim_id:
-- - friend_user_id set: in-app friend, direct wallet credit
-- - friend_claim_id set: external friend, claim page flow
-- ========================================================================

-- ============================================================================
-- PROMISES: Add friend_user_id for in-app friend beneficiary
-- ============================================================================

ALTER TABLE promises ADD COLUMN friend_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Index for finding promises by friend beneficiary (e.g., "show promises where I'm the beneficiary")
CREATE INDEX idx_promises_friend_user_id ON promises (friend_user_id)
  WHERE friend_user_id IS NOT NULL;

COMMENT ON COLUMN promises.friend_user_id IS 'In-app friend beneficiary - receives direct wallet credit on failure. Mutually exclusive with friend_claim_id.';

-- ============================================================================
-- RLS POLICY: Friends can view promises where they are the beneficiary
-- ============================================================================

CREATE POLICY "Friends can view promises where they are beneficiary"
  ON promises FOR SELECT
  USING ((select auth.uid()) = friend_user_id);


-- ========================================================================
-- MIGRATION 016: Invite Rewards System
-- ========================================================================
-- When a new user signs up via an invite link, both the inviter and 
-- invitee get 1 free pass. A free pass waives the failure charge on 
-- one promise.
-- ========================================================================

-- ============================================================================
-- PROFILES: Add free_passes column
-- ============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS free_passes INTEGER DEFAULT 0 NOT NULL;

COMMENT ON COLUMN profiles.free_passes IS 'Number of free passes available. Each pass waives the failure charge on one promise.';

-- ============================================================================
-- PROMISES: Add uses_free_pass column
-- ============================================================================

ALTER TABLE promises ADD COLUMN IF NOT EXISTS uses_free_pass BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN promises.uses_free_pass IS 'If true, this promise uses a free pass and no charge is applied on failure.';

-- ============================================================================
-- RPC: Consume a free pass atomically
-- ============================================================================
-- Returns TRUE if a pass was consumed, FALSE if user had no passes.
-- Uses SELECT FOR UPDATE to prevent race conditions.
-- ============================================================================

CREATE OR REPLACE FUNCTION consume_free_pass(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  current_passes INTEGER;
BEGIN
  SELECT free_passes INTO current_passes 
  FROM profiles 
  WHERE id = user_uuid 
  FOR UPDATE;
  
  IF current_passes > 0 THEN
    UPDATE profiles 
    SET free_passes = free_passes - 1 
    WHERE id = user_uuid;
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION consume_free_pass IS 'Atomically consume a free pass. Returns TRUE if consumed, FALSE if no passes available.';

-- ============================================================================
-- RPC: Grant invite rewards to both users
-- ============================================================================
-- Called by claim-friend-invite edge function when an invite is claimed.
-- Credits both inviter and invitee with 1 free pass each.
-- ============================================================================

CREATE OR REPLACE FUNCTION grant_invite_rewards(inviter_uuid UUID, invitee_uuid UUID)
RETURNS VOID AS $$
BEGIN
  -- Credit inviter with 1 free pass
  UPDATE profiles 
  SET free_passes = free_passes + 1 
  WHERE id = inviter_uuid;
  
  -- Credit invitee with 1 free pass
  UPDATE profiles 
  SET free_passes = free_passes + 1 
  WHERE id = invitee_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION grant_invite_rewards IS 'Grant 1 free pass to both inviter and invitee when an invite is claimed.';

-- ============================================================================
-- RPC: Increment free passes (helper for direct updates)
-- ============================================================================
-- Simple increment function for use with supabase-js .rpc() calls.
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_free_passes(user_uuid UUID, amount INTEGER DEFAULT 1)
RETURNS INTEGER AS $$
DECLARE
  new_balance INTEGER;
BEGIN
  UPDATE profiles 
  SET free_passes = free_passes + amount 
  WHERE id = user_uuid
  RETURNING free_passes INTO new_balance;
  
  RETURN new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION increment_free_passes IS 'Increment free passes for a user and return new balance.';

-- ============================================================================
-- SECURITY: Restrict RPC functions to service role only
-- ============================================================================
-- These functions should only be called by edge functions (service role),
-- not by regular authenticated users who could abuse them.
-- ============================================================================

REVOKE EXECUTE ON FUNCTION consume_free_pass FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION grant_invite_rewards FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION increment_free_passes FROM PUBLIC, anon, authenticated;


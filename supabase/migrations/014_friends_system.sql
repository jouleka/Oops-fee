-- ========================================================================
-- MIGRATION 014: Friends System
-- ========================================================================
-- Adds mutual friendship system with:
-- - Username discovery for profiles
-- - Friendships table for friend requests and connections
-- - Friend invites for non-users to auto-connect on signup
-- Also includes: social_proof notification preference default (consolidated)
-- ========================================================================

-- ============================================================================
-- PROFILES: Update notification_preferences default to include social_proof
-- ============================================================================

ALTER TABLE profiles 
ALTER COLUMN notification_preferences 
SET DEFAULT '{"reengagement": true, "social_proof": true, "weekly_summary": true}'::jsonb;

-- ============================================================================
-- PROFILES: Add username column for friend discovery
-- ============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username_set_at TIMESTAMPTZ;

-- Case-insensitive index for username search/lookup
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles (LOWER(username))
  WHERE username IS NOT NULL;

COMMENT ON COLUMN profiles.username IS 'Unique username for friend discovery (3-20 chars, alphanumeric + underscores)';
COMMENT ON COLUMN profiles.username_set_at IS 'Timestamp when username was first set';

-- ============================================================================
-- FRIENDSHIPS TABLE
-- Tracks friend requests and mutual friendships
-- ============================================================================

CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending|accepted|rejected|blocked
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  
  -- Constraints
  UNIQUE(requester_id, addressee_id),
  CHECK (requester_id != addressee_id),
  CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked'))
);

-- Index for finding all friendships for a user (as requester)
CREATE INDEX idx_friendships_requester ON friendships (requester_id, status);

-- Index for finding all friendships for a user (as addressee)
CREATE INDEX idx_friendships_addressee ON friendships (addressee_id, status);

-- Index for accepted friendships (for friend list queries)
CREATE INDEX idx_friendships_accepted ON friendships (requester_id, addressee_id)
  WHERE status = 'accepted';

COMMENT ON TABLE friendships IS 'Mutual friendship system - requester sends request, addressee accepts/rejects';

-- ============================================================================
-- FRIEND INVITES TABLE
-- Shareable invite links for non-users that auto-connect on signup
-- ============================================================================

CREATE TABLE friend_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invite_token TEXT NOT NULL UNIQUE,  -- The shareable token in the URL
  claimed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast token lookup (public endpoint)
-- Note: expires_at check happens at query time, not in index predicate (NOW() is not immutable)
CREATE INDEX idx_friend_invites_token ON friend_invites (invite_token)
  WHERE claimed_by IS NULL;

-- Index for finding invites by inviter
CREATE INDEX idx_friend_invites_inviter ON friend_invites (inviter_id);

COMMENT ON TABLE friend_invites IS 'Shareable invite links that auto-create friendship when claimed on signup';

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_invites ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- FRIENDSHIPS POLICIES
-- Users can read their own friendships, insert as requester, update as addressee
-- Note: (select auth.uid()) evaluates once per query instead of per-row
-- ============================================================================

CREATE POLICY "Users can view their own friendships"
  ON friendships FOR SELECT
  USING ((select auth.uid()) = requester_id OR (select auth.uid()) = addressee_id);

CREATE POLICY "Users can send friend requests"
  ON friendships FOR INSERT
  WITH CHECK ((select auth.uid()) = requester_id);

CREATE POLICY "Addressees can respond to friend requests"
  ON friendships FOR UPDATE
  USING ((select auth.uid()) = addressee_id)
  WITH CHECK ((select auth.uid()) = addressee_id);

CREATE POLICY "Users can delete their own friend requests or unfriend"
  ON friendships FOR DELETE
  USING ((select auth.uid()) = requester_id OR (select auth.uid()) = addressee_id);

-- ============================================================================
-- FRIEND INVITES POLICIES
-- Users can manage their own invites, read-only for claimed check
-- Note: (select auth.uid()) evaluates once per query instead of per-row
-- ============================================================================

CREATE POLICY "Users can view their own invites"
  ON friend_invites FOR SELECT
  USING ((select auth.uid()) = inviter_id OR (select auth.uid()) = claimed_by);

CREATE POLICY "Users can create invites"
  ON friend_invites FOR INSERT
  WITH CHECK ((select auth.uid()) = inviter_id);

CREATE POLICY "Users can delete their own invites"
  ON friend_invites FOR DELETE
  USING ((select auth.uid()) = inviter_id);

-- Note: Invite claiming/lookup is handled via Edge Functions with service role
-- Public cannot read invites directly - must use claim-friend-invite function

-- ============================================================================
-- HELPER FUNCTION: Check if two users are friends
-- ============================================================================

CREATE OR REPLACE FUNCTION are_friends(user_a UUID, user_b UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.friendships
    WHERE status = 'accepted'
    AND (
      (requester_id = user_a AND addressee_id = user_b)
      OR (requester_id = user_b AND addressee_id = user_a)
    )
  );
END;
$$;

COMMENT ON FUNCTION are_friends IS 'Check if two users have an accepted friendship';

-- ============================================================================
-- HELPER FUNCTION: Get friend count for a user
-- ============================================================================

CREATE OR REPLACE FUNCTION get_friend_count(user_uuid UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = 'public'
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER FROM public.friendships
    WHERE status = 'accepted'
    AND (requester_id = user_uuid OR addressee_id = user_uuid)
  );
END;
$$;

COMMENT ON FUNCTION get_friend_count IS 'Get total count of accepted friends for a user';



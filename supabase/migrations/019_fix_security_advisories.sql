-- ========================================================================
-- MIGRATION 019: Fix Security Advisories
-- ========================================================================
-- 1. Revoke direct API access to leaderboard_stats materialized view
--    (access should only be via edge functions with service role)
-- 2. Combine multiple permissive SELECT policies on promises table
--    into a single policy for better performance
-- ========================================================================

-- ============================================================================
-- FIX 1: Revoke API access to leaderboard_stats materialized view
-- ============================================================================

-- Revoke SELECT from anon and authenticated roles
-- Edge functions use service role which bypasses these grants
REVOKE SELECT ON leaderboard_stats FROM anon;
REVOKE SELECT ON leaderboard_stats FROM authenticated;

COMMENT ON MATERIALIZED VIEW leaderboard_stats IS 
  'Leaderboard statistics - access via service role only (edge functions). Direct API access revoked.';

-- ============================================================================
-- FIX 2: Combine multiple SELECT policies on promises table
-- ============================================================================

-- Drop the two separate permissive policies
DROP POLICY IF EXISTS "Users can view their own promises" ON promises;
DROP POLICY IF EXISTS "Friends can view promises where they are beneficiary" ON promises;

-- Create a single combined policy (better performance - single evaluation)
CREATE POLICY "Users can view own promises or as friend beneficiary"
  ON promises FOR SELECT
  USING (
    (select auth.uid()) = user_id 
    OR (select auth.uid()) = friend_user_id
  );

-- ============================================================================
-- VERIFICATION QUERIES (for manual testing)
-- ============================================================================
-- 
-- Check materialized view grants:
-- SELECT grantee, privilege_type 
-- FROM information_schema.table_privileges 
-- WHERE table_name = 'leaderboard_stats';
--
-- Check promises policies:
-- SELECT policyname, cmd, qual 
-- FROM pg_policies 
-- WHERE tablename = 'promises';
--


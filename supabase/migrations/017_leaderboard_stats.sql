-- ============================================================================
-- OopsFee Leaderboard Stats
-- Migration: 017_leaderboard_stats.sql
-- 
-- Creates a materialized view for efficient global leaderboard queries
-- and adds privacy settings for leaderboard opt-out.
-- ============================================================================

-- ============================================================================
-- PROFILES: Add leaderboard privacy setting
-- ============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS 
  show_on_global_leaderboard BOOLEAN DEFAULT true;

COMMENT ON COLUMN profiles.show_on_global_leaderboard IS 'Whether user appears on the global leaderboard (opt-out setting)';

-- ============================================================================
-- MATERIALIZED VIEW: leaderboard_stats
-- Aggregates user promise statistics for efficient leaderboard queries.
-- Refreshed periodically via cron or on-demand.
-- ============================================================================

CREATE MATERIALIZED VIEW leaderboard_stats AS
SELECT 
  p.id AS user_id,
  p.username,
  p.display_name,
  p.avatar_url,
  p.show_on_global_leaderboard,
  
  -- Counts
  COUNT(pr.id) FILTER (WHERE pr.status IN ('completed', 'failed', 'expired')) AS total_decided,
  COUNT(pr.id) FILTER (WHERE pr.status = 'completed') AS completed,
  COUNT(pr.id) FILTER (WHERE pr.status IN ('failed', 'expired')) AS failed,
  
  -- Money (stored in cents)
  COALESCE(SUM(pr.stake) FILTER (WHERE pr.status = 'completed'), 0) AS money_saved,
  COALESCE(SUM(pr.stake) FILTER (WHERE pr.status IN ('failed', 'expired')), 0) AS money_lost,
  
  -- Success rate (only for users with 5+ decided promises)
  CASE 
    WHEN COUNT(pr.id) FILTER (WHERE pr.status IN ('completed', 'failed', 'expired')) >= 5 
    THEN ROUND(
      100.0 * COUNT(pr.id) FILTER (WHERE pr.status = 'completed') / 
      NULLIF(COUNT(pr.id) FILTER (WHERE pr.status IN ('completed', 'failed', 'expired')), 0)
    )
    ELSE NULL 
  END AS success_rate,
  
  -- Timestamps for filtering and freshness
  MAX(pr.updated_at) AS last_activity,
  NOW() AS refreshed_at

FROM profiles p
LEFT JOIN promises pr ON pr.user_id = p.id
WHERE p.username IS NOT NULL  -- Only users with usernames appear on leaderboards
GROUP BY p.id, p.username, p.display_name, p.avatar_url, p.show_on_global_leaderboard;

-- ============================================================================
-- INDEXES ON MATERIALIZED VIEW
-- ============================================================================

-- Unique index required for REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX idx_leaderboard_stats_user_id ON leaderboard_stats (user_id);

-- Indexes for ranking queries (DESC NULLS LAST to handle NULL success_rate)
CREATE INDEX idx_leaderboard_stats_success_rate ON leaderboard_stats (success_rate DESC NULLS LAST)
  WHERE show_on_global_leaderboard = true;

CREATE INDEX idx_leaderboard_stats_money_saved ON leaderboard_stats (money_saved DESC)
  WHERE show_on_global_leaderboard = true;

CREATE INDEX idx_leaderboard_stats_money_lost ON leaderboard_stats (money_lost DESC)
  WHERE show_on_global_leaderboard = true;

CREATE INDEX idx_leaderboard_stats_completed ON leaderboard_stats (completed DESC)
  WHERE show_on_global_leaderboard = true;

CREATE INDEX idx_leaderboard_stats_failed ON leaderboard_stats (failed DESC)
  WHERE show_on_global_leaderboard = true;

-- Index for last activity filtering (week/month periods)
CREATE INDEX idx_leaderboard_stats_last_activity ON leaderboard_stats (last_activity DESC NULLS LAST);

-- ============================================================================
-- FUNCTION: Refresh leaderboard stats
-- Called by cron job or on-demand after promise resolution
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_leaderboard_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Use CONCURRENTLY to avoid locking during refresh
  -- Requires the unique index on user_id
  REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_stats;
END;
$$;

COMMENT ON FUNCTION refresh_leaderboard_stats() IS 'Refreshes the leaderboard_stats materialized view. Call after promise completion/failure or via cron.';

-- ============================================================================
-- Note: Streak calculations (current_streak, longest_streak) are computed
-- dynamically in edge functions since they require ordered row-by-row
-- computation and cannot be efficiently materialized.
-- ============================================================================

-- ============================================================================
-- RLS NOTE
-- Materialized views in PostgreSQL do not support Row Level Security.
-- This is acceptable because:
-- 1. Leaderboard data is intentionally public (rankings, aggregated stats)
-- 2. Users who opt out are filtered via show_on_global_leaderboard = false
-- 3. Edge functions use service role for all leaderboard queries
-- 4. No sensitive data (only username, avatar, aggregated promise stats)
-- ============================================================================

-- ============================================================================
-- CRON JOB SETUP FOR REFRESH (Manual Configuration Required)
-- ============================================================================
--
-- After deploying this migration, set up a cron job to refresh the view:
--
-- 1. Go to Database > Extensions and ensure "pg_cron" and "pg_net" are enabled
--
-- 2. Go to Database > Cron Jobs (or SQL Editor)
--
-- 3. Create the cron job with this SQL (replace YOUR_PROJECT_REF):
--
--    SELECT cron.schedule(
--      'refresh-leaderboard-stats-cron',
--      '*/15 * * * *',
--      $$
--      SELECT net.http_post(
--        url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/refresh-leaderboard-stats',
--        headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SETTLEMENT_CRON_SECRET"}'::jsonb,
--        body := '{}'::jsonb
--      ) AS request_id;
--      $$
--    );
--
-- 4. Uses same SETTLEMENT_CRON_SECRET as other cron jobs.
--
-- ============================================================================
-- MONITORING QUERIES
-- ============================================================================
--
-- View cron job status:
-- SELECT * FROM cron.job WHERE jobname = 'refresh-leaderboard-stats-cron';
--
-- View recent job runs:
-- SELECT * FROM cron.job_run_details 
-- WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'refresh-leaderboard-stats-cron')
-- ORDER BY start_time DESC LIMIT 10;
--
-- Remove the cron job if needed:
-- SELECT cron.unschedule('refresh-leaderboard-stats-cron');
--
-- Manual refresh (for testing):
-- SELECT refresh_leaderboard_stats();
--
-- ============================================================================


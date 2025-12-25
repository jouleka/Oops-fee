-- ========================================================================
-- MIGRATION 013: Behavioral Insights Tracking
-- ========================================================================
-- Adds column to track when behavioral insights notifications were last sent
-- to prevent notification spam (weekly cooldown).
-- ========================================================================

-- Add last_insights_at column to track when we last sent a behavioral insight
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_insights_at TIMESTAMPTZ;

-- Index for efficient querying of users due for insights
CREATE INDEX IF NOT EXISTS idx_profiles_last_insights ON public.profiles (last_insights_at) 
WHERE expo_push_token IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN public.profiles.last_insights_at IS 'Timestamp of last behavioral insight notification sent (weekly cooldown to prevent spam)';


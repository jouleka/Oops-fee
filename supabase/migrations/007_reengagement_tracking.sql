-- ============================================================================
-- Re-engagement Tracking Migration
-- Migration: 007_reengagement_tracking.sql
-- 
-- Adds columns to track user activity and re-engagement notifications
-- to support automated win-back campaigns without spamming users.
-- ============================================================================

-- Add last_active_at column to track when user was last active in app
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT NOW();

-- Add last_reengagement_at column to track when we last sent a re-engagement notification
-- This prevents sending multiple re-engagement notifications in quick succession
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_reengagement_at TIMESTAMPTZ;

-- Add notification preferences (for future use)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"reengagement": true, "weekly_summary": true, "social_proof": false}'::jsonb;

-- Index for finding inactive users efficiently
CREATE INDEX IF NOT EXISTS idx_profiles_last_active ON public.profiles (last_active_at) 
  WHERE expo_push_token IS NOT NULL;

-- Index for re-engagement targeting
CREATE INDEX IF NOT EXISTS idx_profiles_reengagement ON public.profiles (last_reengagement_at, last_active_at) 
  WHERE expo_push_token IS NOT NULL;

-- Comments for documentation
COMMENT ON COLUMN public.profiles.last_active_at IS 'Timestamp of last user activity (updated on app open, promise creation, etc.)';
COMMENT ON COLUMN public.profiles.last_reengagement_at IS 'Timestamp of last re-engagement notification sent (to prevent spam)';
COMMENT ON COLUMN public.profiles.notification_preferences IS 'User preferences for notification types: {reengagement, weekly_summary, social_proof}';

-- ============================================================================
-- Function to update last_active_at on profile access
-- Can be called from client when user opens app
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_last_active()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles 
  SET last_active_at = NOW(), updated_at = NOW()
  WHERE id = auth.uid();
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.update_last_active() TO authenticated;


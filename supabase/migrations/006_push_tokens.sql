-- ============================================================================
-- Push Token Migration
-- Migration: 006_push_tokens.sql
-- 
-- Adds expo_push_token column to profiles for sending push notifications
-- from backend (settlement cron, etc.)
-- ============================================================================

-- Add expo push token column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS expo_push_token TEXT;

-- Index for efficient token lookup when sending notifications
CREATE INDEX IF NOT EXISTS idx_profiles_push_token ON public.profiles (expo_push_token) 
  WHERE expo_push_token IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN public.profiles.expo_push_token IS 'Expo push token for sending notifications from backend (e.g. ExponentPushToken[xxx])';


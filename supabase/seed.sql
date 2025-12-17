-- ============================================================================
-- OopsFee Development Seed Data
-- 
-- This file is used for local development with `supabase db reset`
-- DO NOT run this in production!
-- ============================================================================

-- Note: You can't insert directly into auth.users via SQL seed
-- Use the Supabase Dashboard or create test users via the Auth API
-- 
-- After creating a test user, their profile will be auto-created by the
-- handle_new_user() trigger.
--
-- Example local test setup:
-- 1. Run `supabase start` to start local Supabase
-- 2. Go to http://localhost:54323 (Studio)
-- 3. Create a test user in Auth section
-- 4. The profile will be auto-created
-- 5. Insert test promises using the user's UUID

-- ============================================================================
-- Test data can be inserted after creating a user
-- Replace 'USER_UUID_HERE' with actual user UUID from auth.users
-- ============================================================================

-- Example (uncomment and replace UUID after creating a test user):
/*
-- Test promise with stake
INSERT INTO promises (id, user_id, text, stake, deadline_at, status, verification_type, money_destination, settle_at)
VALUES (
  '1702847600000_abc123',
  'USER_UUID_HERE'::uuid,
  'Go to the gym 3 times this week',
  1000,  -- $10.00
  NOW() + INTERVAL '7 days',
  'active',
  'photo',
  'oopsfee',
  NOW() + INTERVAL '7 days 1 hour'
);

-- Test promise without stake (free)
INSERT INTO promises (id, user_id, text, stake, deadline_at, status, verification_type, money_destination)
VALUES (
  '1702847700000_def456',
  'USER_UUID_HERE'::uuid,
  'Read for 30 minutes before bed',
  0,
  NOW() + INTERVAL '1 day',
  'active',
  'honor',
  'oopsfee'
);

-- Test completed promise
INSERT INTO promises (id, user_id, text, stake, deadline_at, status, verification_type, money_destination, completed_at)
VALUES (
  '1702847500000_ghi789',
  'USER_UUID_HERE'::uuid,
  'Meditate for 10 minutes',
  500,  -- $5.00
  NOW() - INTERVAL '1 day',
  'completed',
  'photo',
  'oopsfee',
  NOW() - INTERVAL '2 hours'
);
*/


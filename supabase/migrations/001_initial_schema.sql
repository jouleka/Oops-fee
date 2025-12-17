-- ============================================================================
-- OopsFee Initial Database Schema
-- Migration: 001_initial_schema.sql
-- 
-- This creates all tables, indexes, RLS policies, and helper functions
-- for the OopsFee accountability app.
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- PROFILES TABLE
-- User profiles linked to Supabase Auth
-- ============================================================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  
  -- Stripe integration
  stripe_customer_id TEXT,
  default_payment_method_id TEXT,
  
  -- Payment failure tracking
  failed_payment_count INTEGER DEFAULT 0,
  payment_blocked BOOLEAN DEFAULT FALSE,  -- True if user has unresolved payment failures
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for Stripe customer lookup
CREATE INDEX idx_profiles_stripe_customer ON profiles (stripe_customer_id) 
  WHERE stripe_customer_id IS NOT NULL;

-- ============================================================================
-- PROMISES TABLE
-- Core accountability promises with payment and verification tracking
-- ============================================================================

CREATE TABLE promises (
  id TEXT PRIMARY KEY,  -- Matches local ID format (Date.now()_random)
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Core promise data
  text TEXT NOT NULL,
  stake INTEGER NOT NULL DEFAULT 0,  -- Amount in cents
  deadline_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',  -- active|completed|failed|expired
  money_destination TEXT NOT NULL DEFAULT 'oopsfee',  -- oopsfee|charity|friend (friend/charity deferred)
  
  -- Verification
  verification_type TEXT NOT NULL DEFAULT 'photo',  -- honor|photo|partner|healthkit|location
  verification_proof_ref TEXT,  -- Supabase Storage path for proof (photo, etc.)
  verification_timestamp TIMESTAMPTZ,  -- When verification was submitted
  
  -- Partner verification state machine
  partner_state TEXT,  -- NULL|awaiting|approved|rejected|expired
  partner_deadline_at TIMESTAMPTZ,  -- 24h after user claims completion
  
  -- Virality: Sponsor My Failure (denormalized for realtime efficiency)
  sponsor_total INTEGER DEFAULT 0,  -- Total $ pledged by sponsors
  sponsor_count INTEGER DEFAULT 0,  -- Number of sponsors
  
  -- Virality: I Told You So (roast message)
  has_roast BOOLEAN DEFAULT FALSE,  -- Whether there's a roast message
  
  -- Voice note
  voice_note_ref TEXT,  -- Supabase Storage path for voice commitment
  
  -- Resolution timestamps
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  streak_at_completion INTEGER,  -- Streak count when completed
  
  -- Settlement & Payment
  settle_at TIMESTAMPTZ,  -- deadline + 1 hour grace period
  payment_status TEXT,  -- NULL|pending|succeeded|failed|requires_action|abandoned
  payment_retry_count INTEGER DEFAULT 0,
  payment_next_retry_at TIMESTAMPTZ,
  payment_client_secret TEXT,  -- For SCA resolution in-app
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient settlement cron queries
CREATE INDEX idx_promises_settlement ON promises (status, settle_at) 
  WHERE status = 'active';

-- Index for realtime subscription efficiency (user's active promises)
CREATE INDEX idx_promises_user_active ON promises (user_id, status)
  WHERE status = 'active';

-- Index for payment retry queries
CREATE INDEX idx_promises_payment_retry ON promises (payment_status, payment_next_retry_at)
  WHERE payment_status = 'failed';

-- Index for user's all promises (ordered by creation)
CREATE INDEX idx_promises_user_created ON promises (user_id, created_at DESC);

-- ============================================================================
-- SHARE LINKS TABLE
-- Shareable links for sponsor/roast/partner verification flows
-- ============================================================================

CREATE TABLE share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promise_id TEXT NOT NULL REFERENCES promises(id) ON DELETE CASCADE,
  type TEXT NOT NULL,  -- sponsor|roast|partner
  token_hash TEXT NOT NULL UNIQUE,  -- SHA256 of the share token
  expires_at TIMESTAMPTZ,  -- 24h for partner links, NULL for sponsor/roast
  revoked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast token lookup (public endpoint)
CREATE INDEX idx_share_links_token ON share_links (token_hash) 
  WHERE revoked = FALSE;

-- Index for finding links by promise
CREATE INDEX idx_share_links_promise ON share_links (promise_id);

-- ============================================================================
-- SPONSOR PLEDGES TABLE
-- Records of people pledging to "sponsor" a user's potential failure
-- Note: MVP uses shame-only pledges, not real money
-- ============================================================================

CREATE TABLE sponsor_pledges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promise_id TEXT NOT NULL REFERENCES promises(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,  -- Shame amount in cents (not real money in MVP)
  from_name TEXT NOT NULL,  -- Display name of sponsor
  from_ip_hash TEXT,  -- SHA256 of IP for rate limiting
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for aggregating pledges per promise
CREATE INDEX idx_sponsor_pledges_promise ON sponsor_pledges (promise_id);

-- ============================================================================
-- ROAST MESSAGES TABLE
-- "I Told You So" messages revealed on failure
-- ============================================================================

CREATE TABLE roast_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promise_id TEXT NOT NULL REFERENCES promises(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  from_name TEXT NOT NULL,
  from_ip_hash TEXT,  -- SHA256 of IP for rate limiting
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for finding roast messages by promise
CREATE INDEX idx_roast_messages_promise ON roast_messages (promise_id);

-- ============================================================================
-- PAYMENTS TABLE
-- Audit log of all payment attempts
-- ============================================================================

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promise_id TEXT NOT NULL REFERENCES promises(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,  -- Amount in cents
  currency TEXT DEFAULT 'usd',
  stripe_payment_intent_id TEXT,
  status TEXT NOT NULL,  -- pending|succeeded|failed|requires_action
  attempt_number INTEGER DEFAULT 1,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for finding payments by promise
CREATE INDEX idx_payments_promise ON payments (promise_id);

-- Index for Stripe payment intent lookup (webhook handling)
CREATE INDEX idx_payments_stripe_pi ON payments (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to profiles
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply updated_at trigger to promises
CREATE TRIGGER promises_updated_at
  BEFORE UPDATE ON promises
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FUNCTION: Auto-create profile on user signup
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile when user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- FUNCTION: Update sponsor totals (denormalized)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_sponsor_totals()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE promises
    SET sponsor_total = sponsor_total + NEW.amount,
        sponsor_count = sponsor_count + 1
    WHERE id = NEW.promise_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE promises
    SET sponsor_total = sponsor_total - OLD.amount,
        sponsor_count = sponsor_count - 1
    WHERE id = OLD.promise_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update denormalized sponsor totals
CREATE TRIGGER sponsor_pledge_totals
  AFTER INSERT OR DELETE ON sponsor_pledges
  FOR EACH ROW
  EXECUTE FUNCTION update_sponsor_totals();

-- ============================================================================
-- FUNCTION: Update has_roast flag
-- ============================================================================

CREATE OR REPLACE FUNCTION update_has_roast()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE promises SET has_roast = TRUE WHERE id = NEW.promise_id;
  ELSIF TG_OP = 'DELETE' THEN
    -- Check if any roast messages remain
    IF NOT EXISTS (SELECT 1 FROM roast_messages WHERE promise_id = OLD.promise_id) THEN
      UPDATE promises SET has_roast = FALSE WHERE id = OLD.promise_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update has_roast flag
CREATE TRIGGER roast_message_flag
  AFTER INSERT OR DELETE ON roast_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_has_roast();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE promises ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsor_pledges ENABLE ROW LEVEL SECURITY;
ALTER TABLE roast_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PROFILES POLICIES
-- Users can only read/update their own profile
-- ============================================================================

CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Note: Profile creation is handled by trigger, not user action

-- ============================================================================
-- PROMISES POLICIES
-- Users have full CRUD on their own promises
-- ============================================================================

CREATE POLICY "Users can view their own promises"
  ON promises FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own promises"
  ON promises FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own promises"
  ON promises FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own promises"
  ON promises FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- SHARE LINKS POLICIES
-- Users can manage share links for their own promises
-- ============================================================================

CREATE POLICY "Users can view share links for their promises"
  ON share_links FOR SELECT
  USING (
    promise_id IN (SELECT id FROM promises WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create share links for their promises"
  ON share_links FOR INSERT
  WITH CHECK (
    promise_id IN (SELECT id FROM promises WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can revoke share links for their promises"
  ON share_links FOR UPDATE
  USING (
    promise_id IN (SELECT id FROM promises WHERE user_id = auth.uid())
  )
  WITH CHECK (
    promise_id IN (SELECT id FROM promises WHERE user_id = auth.uid())
  );

-- Note: Public access to share links is via Edge Functions with service role

-- ============================================================================
-- SPONSOR PLEDGES POLICIES
-- Users can view sponsors on their own promises
-- Creation is via Edge Functions (public, rate-limited)
-- ============================================================================

CREATE POLICY "Users can view sponsors on their promises"
  ON sponsor_pledges FOR SELECT
  USING (
    promise_id IN (SELECT id FROM promises WHERE user_id = auth.uid())
  );

-- Note: Insert is handled by Edge Function with service role

-- ============================================================================
-- ROAST MESSAGES POLICIES
-- Users can view roast messages on their own promises
-- Creation is via Edge Functions (public, rate-limited)
-- ============================================================================

CREATE POLICY "Users can view roast messages on their promises"
  ON roast_messages FOR SELECT
  USING (
    promise_id IN (SELECT id FROM promises WHERE user_id = auth.uid())
  );

-- Note: Insert is handled by Edge Function with service role

-- ============================================================================
-- PAYMENTS POLICIES
-- Users can view their own payment history (read-only)
-- All payment creation is via Edge Functions/webhooks
-- ============================================================================

CREATE POLICY "Users can view their own payments"
  ON payments FOR SELECT
  USING (
    promise_id IN (SELECT id FROM promises WHERE user_id = auth.uid())
  );

-- Note: All payment inserts/updates are via Edge Function with service role

-- ============================================================================
-- SERVICE ROLE POLICIES
-- Edge Functions use service role key, bypassing RLS
-- These comments document what service role access is intended for:
-- 
-- profiles: Create on signup (trigger), update payment status
-- promises: Settlement cron updates, partner verification updates
-- share_links: Lookup by token_hash for public share pages
-- sponsor_pledges: Insert from public sponsor form
-- roast_messages: Insert from public roast form
-- payments: All inserts/updates from Stripe webhooks and settlement
-- ============================================================================

-- ============================================================================
-- REALTIME PUBLICATION
-- Enable realtime for tables that need live updates
-- ============================================================================

-- Only publish changes to promises table (user-scoped via RLS)
ALTER PUBLICATION supabase_realtime ADD TABLE promises;

-- Note: Other tables don't need realtime - changes are infrequent
-- and can be fetched on demand

-- ============================================================================
-- STORAGE BUCKETS (to be created via Supabase Dashboard or separate migration)
-- ============================================================================

-- verification-proofs: Photo verification uploads (private, user-scoped)
-- voice-notes: Voice commitment recordings (private, user-scoped)
-- 
-- RLS policies for storage are configured in Supabase Dashboard:
-- - Users can upload to their own folder: user_id/filename
-- - Users can read their own files
-- - Service role can read all (for partner verification display)


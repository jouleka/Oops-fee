-- ============================================================================
-- Fix Function Search Paths & RLS Performance
-- Migration: 003_fix_function_search_paths.sql
-- 
-- Addresses Supabase Security Advisor warnings:
-- 1. Function Search Path Mutable
-- 2. Auth RLS Initialization Plan (auth.uid() re-evaluated per row)
-- ============================================================================

-- ============================================================================
-- PART 1: Fix Function Search Paths
-- ============================================================================

-- Fix update_updated_at_column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Fix handle_new_user
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

-- Fix update_sponsor_totals
CREATE OR REPLACE FUNCTION update_sponsor_totals()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.promises
    SET sponsor_total = sponsor_total + NEW.amount,
        sponsor_count = sponsor_count + 1
    WHERE id = NEW.promise_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.promises
    SET sponsor_total = sponsor_total - OLD.amount,
        sponsor_count = sponsor_count - 1
    WHERE id = OLD.promise_id;
  END IF;
  RETURN NULL;
END;
$$;

-- Fix update_has_roast
CREATE OR REPLACE FUNCTION update_has_roast()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.promises SET has_roast = TRUE WHERE id = NEW.promise_id;
  ELSIF TG_OP = 'DELETE' THEN
    IF NOT EXISTS (SELECT 1 FROM public.roast_messages WHERE promise_id = OLD.promise_id) THEN
      UPDATE public.promises SET has_roast = FALSE WHERE id = OLD.promise_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

-- ============================================================================
-- PART 2: Fix RLS Policy Performance
-- Wrap auth.uid() in (select auth.uid()) to evaluate once instead of per-row
-- ============================================================================

-- PROFILES
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING ((select auth.uid()) = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

-- PROMISES
DROP POLICY IF EXISTS "Users can view their own promises" ON promises;
DROP POLICY IF EXISTS "Users can create their own promises" ON promises;
DROP POLICY IF EXISTS "Users can update their own promises" ON promises;
DROP POLICY IF EXISTS "Users can delete their own promises" ON promises;

CREATE POLICY "Users can view their own promises"
  ON promises FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can create their own promises"
  ON promises FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update their own promises"
  ON promises FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete their own promises"
  ON promises FOR DELETE
  USING ((select auth.uid()) = user_id);

-- SHARE_LINKS
DROP POLICY IF EXISTS "Users can view share links for their promises" ON share_links;
DROP POLICY IF EXISTS "Users can create share links for their promises" ON share_links;
DROP POLICY IF EXISTS "Users can revoke share links for their promises" ON share_links;

CREATE POLICY "Users can view share links for their promises"
  ON share_links FOR SELECT
  USING (
    promise_id IN (SELECT id FROM promises WHERE user_id = (select auth.uid()))
  );

CREATE POLICY "Users can create share links for their promises"
  ON share_links FOR INSERT
  WITH CHECK (
    promise_id IN (SELECT id FROM promises WHERE user_id = (select auth.uid()))
  );

CREATE POLICY "Users can revoke share links for their promises"
  ON share_links FOR UPDATE
  USING (
    promise_id IN (SELECT id FROM promises WHERE user_id = (select auth.uid()))
  )
  WITH CHECK (
    promise_id IN (SELECT id FROM promises WHERE user_id = (select auth.uid()))
  );

-- SPONSOR_PLEDGES
DROP POLICY IF EXISTS "Users can view sponsors on their promises" ON sponsor_pledges;

CREATE POLICY "Users can view sponsors on their promises"
  ON sponsor_pledges FOR SELECT
  USING (
    promise_id IN (SELECT id FROM promises WHERE user_id = (select auth.uid()))
  );

-- ROAST_MESSAGES
DROP POLICY IF EXISTS "Users can view roast messages on their promises" ON roast_messages;

CREATE POLICY "Users can view roast messages on their promises"
  ON roast_messages FOR SELECT
  USING (
    promise_id IN (SELECT id FROM promises WHERE user_id = (select auth.uid()))
  );

-- PAYMENTS
DROP POLICY IF EXISTS "Users can view their own payments" ON payments;

CREATE POLICY "Users can view their own payments"
  ON payments FOR SELECT
  USING (
    promise_id IN (SELECT id FROM promises WHERE user_id = (select auth.uid()))
  );

-- ============================================================================
-- MIGRATION 018: Auto-generate Username on Signup
-- ============================================================================
-- Fixes race condition where home screen redirects to username setup before
-- the client-side auto-generation completes.
-- 
-- Solution: Generate username in database trigger so it's set IMMEDIATELY
-- when the profile is created.
-- ============================================================================

-- ============================================================================
-- Helper function to generate a base username from email
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_username_base(email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  email_prefix TEXT;
  base_username TEXT;
BEGIN
  -- Extract email prefix (part before @)
  email_prefix := LOWER(SPLIT_PART(email, '@', 1));
  
  -- Remove invalid characters, keep only alphanumeric and underscores
  base_username := REGEXP_REPLACE(email_prefix, '[^a-z0-9_]', '', 'g');
  
  -- Remove leading numbers/underscores (username must start with letter)
  base_username := REGEXP_REPLACE(base_username, '^[0-9_]+', '');
  
  -- If too short after sanitization, use a random base
  IF LENGTH(base_username) < 3 THEN
    base_username := 'user';
  END IF;
  
  -- Truncate if too long (max 12 to leave room for random suffix)
  IF LENGTH(base_username) > 12 THEN
    base_username := LEFT(base_username, 12);
  END IF;
  
  RETURN base_username;
END;
$$;

COMMENT ON FUNCTION generate_username_base IS 'Generates a sanitized base username from email prefix';

-- ============================================================================
-- Update handle_new_user trigger to auto-generate username
-- Uses retry loop to handle unique constraint violations (race condition safe)
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  attempt INT := 0;
  max_attempts INT := 10;
BEGIN
  -- Generate base username from email
  base_username := generate_username_base(NEW.email);
  
  -- Try to insert with unique username (retry on conflict)
  LOOP
    IF attempt = 0 THEN
      final_username := base_username;
    ELSE
      -- Add random suffix to avoid collisions
      final_username := base_username || FLOOR(RANDOM() * 9999 + 1)::TEXT;
    END IF;
    
    BEGIN
      INSERT INTO public.profiles (id, display_name, avatar_url, username, username_set_at)
      VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
        NEW.raw_user_meta_data->>'avatar_url',
        final_username,
        NOW()
      );
      -- Success, exit loop
      EXIT;
    EXCEPTION
      WHEN unique_violation THEN
        -- Username taken, try again with suffix
        attempt := attempt + 1;
        IF attempt >= max_attempts THEN
          -- Final fallback: use UUID prefix
          INSERT INTO public.profiles (id, display_name, avatar_url, username, username_set_at)
          VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
            NEW.raw_user_meta_data->>'avatar_url',
            'user' || LEFT(REPLACE(NEW.id::TEXT, '-', ''), 8),
            NOW()
          );
          EXIT;
        END IF;
    END;
  END LOOP;
  
  RETURN NEW;
END;
$$;


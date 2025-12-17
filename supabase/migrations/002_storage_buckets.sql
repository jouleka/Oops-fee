-- ============================================================================
-- OopsFee Storage Buckets
-- Migration: 002_storage_buckets.sql
-- 
-- Sets up Supabase Storage buckets for user uploads
-- ============================================================================

-- Create bucket for verification photo proofs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'verification-proofs',
  'verification-proofs',
  FALSE,  -- Private: only accessible via signed URLs
  5242880,  -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- Create bucket for voice commitment recordings
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voice-notes',
  'voice-notes',
  FALSE,  -- Private
  10485760,  -- 10MB limit
  ARRAY['audio/mpeg', 'audio/mp4', 'audio/m4a', 'audio/wav', 'audio/webm']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Storage RLS Policies
-- ============================================================================

-- Verification Proofs: Users can upload to their own folder
CREATE POLICY "Users can upload verification proofs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'verification-proofs' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Verification Proofs: Users can view their own proofs
CREATE POLICY "Users can view their own verification proofs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'verification-proofs' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Verification Proofs: Users can delete their own proofs
CREATE POLICY "Users can delete their own verification proofs"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'verification-proofs' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Voice Notes: Users can upload to their own folder
CREATE POLICY "Users can upload voice notes"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'voice-notes' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Voice Notes: Users can view their own voice notes
CREATE POLICY "Users can view their own voice notes"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'voice-notes' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Voice Notes: Users can delete their own voice notes
CREATE POLICY "Users can delete their own voice notes"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'voice-notes' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Note: Service role (used by Edge Functions) bypasses RLS
-- and can access all files for partner verification display


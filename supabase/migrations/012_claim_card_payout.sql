-- ============================================================================
-- Claim Card Payout Support
-- Migration: 012_claim_card_payout.sql
--
-- Adds support for instant debit card payouts on friend claim pages.
-- Friends can now receive their payout instantly to a debit card.
--
-- RLS: friend_claims table already has RLS enabled (008_friend_claims.sql).
-- Adding columns doesn't require new policies - existing policies apply.
-- ============================================================================

-- ============================================================================
-- FRIEND_CLAIMS TABLE: Add card payout fields
-- ============================================================================

-- Drop and recreate the constraint to add 'card' as a valid payout method
ALTER TABLE friend_claims DROP CONSTRAINT IF EXISTS valid_payout_method;

ALTER TABLE friend_claims ADD CONSTRAINT valid_payout_method 
  CHECK (payout_method IS NULL OR payout_method IN ('stripe', 'paypal', 'wallet', 'card'));

-- Card payout specific fields
ALTER TABLE friend_claims ADD COLUMN IF NOT EXISTS card_payout_transfer_id TEXT;
ALTER TABLE friend_claims ADD COLUMN IF NOT EXISTS card_last4 TEXT;
ALTER TABLE friend_claims ADD COLUMN IF NOT EXISTS card_brand TEXT;

COMMENT ON COLUMN friend_claims.card_payout_transfer_id IS 
  'Stripe payout ID for instant card payouts.';

COMMENT ON COLUMN friend_claims.card_last4 IS 
  'Last 4 digits of the debit card used for payout.';

COMMENT ON COLUMN friend_claims.card_brand IS 
  'Brand of the debit card used for payout (visa, mastercard, etc).';

-- Index for finding claims by card payout transfer ID (for webhook/reconciliation)
CREATE INDEX IF NOT EXISTS idx_friend_claims_card_transfer ON friend_claims (card_payout_transfer_id)
  WHERE card_payout_transfer_id IS NOT NULL;

-- Update comment on payout_method column
COMMENT ON COLUMN friend_claims.payout_method IS 
  'Payout method: stripe (Stripe Connect), paypal (PayPal Payouts), wallet (in-app credit), or card (instant debit card). NULL if not yet chosen.';

-- ============================================================================
-- SERVICE ROLE ACCESS DOCUMENTATION
-- Edge Functions use service role key, bypassing RLS
-- ============================================================================

-- claim-payout-to-card edge function operations:
-- - Validates claim token and status (claim_status = 'notified')
-- - Sets payout_method = 'card'
-- - Creates temporary Stripe Connect account for card payout
-- - Sends instant payout to provided debit card
-- - Updates card_payout_transfer_id, card_last4, card_brand
-- - Sets claim_status = 'transferred'
--
-- get-claim-context edge function (updated):
-- - Now returns card_payout_transfer_id, card_last4, card_brand fields


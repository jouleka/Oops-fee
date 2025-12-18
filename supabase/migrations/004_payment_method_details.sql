-- ============================================================================
-- Payment Method Details Migration
-- Migration: 004_payment_method_details.sql
-- 
-- Adds columns to store payment method display info (brand, last4, type)
-- ============================================================================

-- Add payment method display columns to profiles (separate statements for safety)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS payment_method_brand TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS payment_method_last4 TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS payment_method_type TEXT;

-- Comments for documentation
COMMENT ON COLUMN public.profiles.payment_method_brand IS 'Brand of saved payment method (visa, mastercard, apple_pay, etc.)';
COMMENT ON COLUMN public.profiles.payment_method_last4 IS 'Last 4 digits of card number (if applicable)';
COMMENT ON COLUMN public.profiles.payment_method_type IS 'Type of payment method (card, wallet, link)';

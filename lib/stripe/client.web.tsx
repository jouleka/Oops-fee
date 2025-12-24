/**
 * Stripe Client Stub for Web
 *
 * Stripe React Native is not available on web.
 * This file provides stub implementations that gracefully fail.
 */

import React, { type ReactNode } from 'react';

// ─────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────

/**
 * Check if Stripe is properly configured - always false on web
 */
export function isStripeConfigured(): boolean {
  return false;
}

// ─────────────────────────────────────────────────────────────
// Stripe Provider (no-op on web)
// ─────────────────────────────────────────────────────────────

interface StripeProviderProps {
  children: ReactNode;
}

/**
 * No-op provider for web - just renders children
 */
export function StripeProvider({ children }: StripeProviderProps): React.ReactElement {
  return <>{children}</>;
}

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface SetupIntentResult {
  clientSecret: string;
  customerId: string;
  ephemeralKey: string;
}

export interface PaymentSheetResult {
  success: boolean;
  error?: string;
  cancelled?: boolean;
}

export interface RemovePaymentResult {
  success: boolean;
  error?: string;
}

export interface CardTokenResult {
  success: boolean;
  tokenId?: string;
  error?: string;
}

export interface PayoutCardResult {
  success: boolean;
  cancelled?: boolean;
  tokenId?: string;
  error?: string;
}

export interface CardParams {
  number: string;
  expMonth: number;
  expYear: number;
  cvc: string;
  name?: string;
}

// ─────────────────────────────────────────────────────────────
// API Functions (stubs for web)
// ─────────────────────────────────────────────────────────────

/**
 * Not available on web
 */
export async function createSetupIntent(): Promise<SetupIntentResult> {
  throw new Error('Stripe is not available on web. Please use the mobile app.');
}

/**
 * Not available on web
 */
export async function presentAddCardSheet(): Promise<PaymentSheetResult> {
  console.warn('[Stripe] presentAddCardSheet is not supported on web.');
  return { success: false, error: 'Stripe is not available on web. Please use the mobile app.' };
}

/**
 * Not available on web
 */
export async function presentPaymentForSCA(
  _paymentIntentClientSecret: string
): Promise<PaymentSheetResult> {
  console.warn('[Stripe] presentPaymentForSCA is not supported on web.');
  return { success: false, error: 'Stripe is not available on web. Please use the mobile app.' };
}

/**
 * Not available on web
 */
export async function presentTopUpSheet(
  _clientSecret: string,
  _customerId: string,
  _ephemeralKey: string
): Promise<PaymentSheetResult> {
  console.warn('[Stripe] presentTopUpSheet is not supported on web.');
  return { success: false, error: 'Stripe is not available on web. Please use the mobile app.' };
}

/**
 * Not available on web
 */
export async function removePaymentMethod(): Promise<RemovePaymentResult> {
  console.warn('[Stripe] removePaymentMethod is not supported on web.');
  return { success: false, error: 'Stripe is not available on web. Please use the mobile app.' };
}

/**
 * Not available on web
 */
export async function createCardToken(_card: CardParams): Promise<CardTokenResult> {
  console.warn('[Stripe] createCardToken is not supported on web.');
  return { success: false, error: 'Stripe is not available on web. Please use the mobile app.' };
}

/**
 * Not available on web
 */
export async function presentPayoutCardSheet(): Promise<PayoutCardResult> {
  console.warn('[Stripe] presentPayoutCardSheet is not supported on web.');
  return { success: false, error: 'Stripe is not available on web. Please use the mobile app.' };
}

/**
 * Not available on web
 */
export async function createCardTokenFromField(): Promise<CardTokenResult> {
  console.warn('[Stripe] createCardTokenFromField is not supported on web.');
  return { success: false, error: 'Stripe is not available on web. Please use the mobile app.' };
}

/**
 * CardField stub for web
 */
export const CardField = null;

/**
 * CardForm stub for web
 */
export const CardForm = null;

/**
 * useStripe stub for web
 */
export const useStripe = () => ({
  createToken: async () => ({ error: { message: 'Not available on web' } }),
});


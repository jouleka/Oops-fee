/**
 * Stripe Client Configuration for OopsFee (Native iOS/Android)
 *
 * This is the default implementation. Web uses client.web.tsx instead.
 *
 * NOTE: Stripe requires a development build. In Expo Go, this provides
 * stub implementations that gracefully fail.
 *
 * Provides:
 * - StripeProvider wrapper component
 * - Helper functions for SetupIntent and PaymentSheet
 * - Client-side Stripe operations
 */

import Constants from 'expo-constants';
import React, { type ReactNode } from 'react';
import { Platform } from 'react-native';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';

// ─────────────────────────────────────────────────────────────
// Expo Go Detection
// ─────────────────────────────────────────────────────────────

const isExpoGo = Constants.executionEnvironment === 'storeClient';

// Lazy-load Stripe native module only in dev builds
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let RNStripeProvider: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let initPaymentSheet: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let presentPaymentSheet: any = null;

if (!isExpoGo) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const stripe = require('@stripe/stripe-react-native');
    RNStripeProvider = stripe.StripeProvider;
    initPaymentSheet = stripe.initPaymentSheet;
    presentPaymentSheet = stripe.presentPaymentSheet;
  } catch (e) {
    console.warn('[Stripe] Native module not available:', e);
  }
}

// ─────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
const MERCHANT_IDENTIFIER = 'merchant.com.oopsfee.app';

if (!STRIPE_PUBLISHABLE_KEY && !isExpoGo) {
  console.warn(
    '[Stripe] Missing EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY. Payments will not work.'
  );
}

/**
 * Check if Stripe is properly configured and available
 */
export function isStripeConfigured(): boolean {
  if (isExpoGo) return false;
  return Boolean(STRIPE_PUBLISHABLE_KEY && RNStripeProvider);
}

// ─────────────────────────────────────────────────────────────
// Stripe Provider
// ─────────────────────────────────────────────────────────────

interface StripeProviderProps {
  children: ReactNode;
}

/**
 * Wrap your app with this provider to enable Stripe functionality
 */
export function StripeProvider({ children }: StripeProviderProps): React.ReactElement {
  // In Expo Go or if Stripe isn't available, just render children
  if (isExpoGo || !RNStripeProvider || !STRIPE_PUBLISHABLE_KEY) {
    if (isExpoGo) {
      console.warn('[Stripe] Running in Expo Go - Stripe requires a development build');
    }
    return <>{children}</>;
  }

  return (
    <RNStripeProvider
      publishableKey={STRIPE_PUBLISHABLE_KEY}
      merchantIdentifier={Platform.OS === 'ios' ? MERCHANT_IDENTIFIER : undefined}
      urlScheme="oopsfee"
    >
      <>{children}</>
    </RNStripeProvider>
  );
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

// ─────────────────────────────────────────────────────────────
// API Functions
// ─────────────────────────────────────────────────────────────

/**
 * Create a SetupIntent for saving a payment method
 * Calls the stripe-setup-intent edge function
 */
export async function createSetupIntent(): Promise<SetupIntentResult> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured');
  }

  const { data, error } = await supabase.functions.invoke<SetupIntentResult>(
    'stripe-setup-intent',
    { method: 'POST' }
  );

  if (error) {
    console.error('[Stripe] SetupIntent error:', error);
    throw new Error(error.message || 'Failed to create setup intent');
  }

  if (!data) {
    throw new Error('No data returned from setup intent');
  }

  return data;
}

/**
 * Initialize and present the PaymentSheet for adding a card
 *
 * Returns success if card was added, or error/cancelled status
 */
export async function presentAddCardSheet(): Promise<PaymentSheetResult> {
  if (isExpoGo) {
    return { 
      success: false, 
      error: 'Stripe requires a development build. Expo Go is not supported.' 
    };
  }

  if (!isStripeConfigured() || !initPaymentSheet || !presentPaymentSheet) {
    return { success: false, error: 'Stripe is not configured' };
  }

  try {
    // 1. Get SetupIntent from server
    const { clientSecret, customerId, ephemeralKey } = await createSetupIntent();

    // 2. Initialize the PaymentSheet
    const { error: initError } = await initPaymentSheet({
      customerId,
      customerEphemeralKeySecret: ephemeralKey,
      setupIntentClientSecret: clientSecret,
      merchantDisplayName: 'OopsFee',
      // Apple Pay configuration
      applePay: Platform.OS === 'ios' ? {
        merchantCountryCode: 'US',
      } : undefined,
      // Google Pay configuration
      googlePay: Platform.OS === 'android' ? {
        merchantCountryCode: 'US',
        testEnv: __DEV__,
      } : undefined,
      // Allow saving card for future use (which is the whole point)
      returnURL: 'oopsfee://payment-complete',
      // Style - Stripe requires hex colors, no rgba
      appearance: {
        colors: {
          primary: '#0B93F6',
          background: '#000000',
          componentBackground: '#1C1C1E',
          componentBorder: '#3A3A3C',
          componentDivider: '#3A3A3C',
          primaryText: '#FFFFFF',
          secondaryText: '#B3B3B3',
          componentText: '#FFFFFF',
          placeholderText: '#737373',
          icon: '#B3B3B3',
          error: '#FF453A',
        },
        shapes: {
          borderRadius: 12,
          borderWidth: 1,
        },
      },
    });

    if (initError) {
      console.error('[Stripe] Init error:', initError);
      return { success: false, error: initError.message };
    }

    // 3. Present the PaymentSheet
    const { error: presentError } = await presentPaymentSheet();

    if (presentError) {
      if (presentError.code === 'Canceled') {
        return { success: false, cancelled: true };
      }
      console.error('[Stripe] Present error:', presentError);
      return { success: false, error: presentError.message };
    }

    // Success! Call confirm endpoint to update profile (fallback for webhooks)
    try {
      await supabase.functions.invoke('stripe-confirm-setup', { method: 'POST' });
    } catch (confirmErr) {
      console.warn('[Stripe] Confirm setup call failed, relying on webhook:', confirmErr);
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Stripe] Error:', message);
    return { success: false, error: message };
  }
}

/**
 * Present PaymentSheet for completing an off-session payment that requires SCA
 *
 * Used when a failed promise charge requires additional authentication
 */
export async function presentPaymentForSCA(
  paymentIntentClientSecret: string
): Promise<PaymentSheetResult> {
  if (isExpoGo) {
    return { 
      success: false, 
      error: 'Stripe requires a development build. Expo Go is not supported.' 
    };
  }

  if (!isStripeConfigured() || !initPaymentSheet || !presentPaymentSheet) {
    return { success: false, error: 'Stripe is not configured' };
  }

  try {
    // Initialize with the existing PaymentIntent
    const { error: initError } = await initPaymentSheet({
      paymentIntentClientSecret,
      merchantDisplayName: 'OopsFee',
      returnURL: 'oopsfee://payment-complete',
      appearance: {
        colors: {
          primary: '#FF453A', // Danger color for failure charges
          background: '#000000',
          componentBackground: '#1C1C1E',
          componentBorder: '#3A3A3C',
          componentDivider: '#3A3A3C',
          primaryText: '#FFFFFF',
          secondaryText: '#B3B3B3',
          componentText: '#FFFFFF',
          placeholderText: '#737373',
          icon: '#B3B3B3',
          error: '#FF453A',
        },
        shapes: {
          borderRadius: 12,
          borderWidth: 1,
        },
      },
    });

    if (initError) {
      console.error('[Stripe] SCA Init error:', initError);
      return { success: false, error: initError.message };
    }

    const { error: presentError } = await presentPaymentSheet();

    if (presentError) {
      if (presentError.code === 'Canceled') {
        return { success: false, cancelled: true };
      }
      console.error('[Stripe] SCA Present error:', presentError);
      return { success: false, error: presentError.message };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Stripe] SCA Error:', message);
    return { success: false, error: message };
  }
}

/**
 * Present PaymentSheet for top-up with Apple Pay / Google Pay support
 *
 * Used for wallet top-ups where user can choose Apple Pay, Google Pay, or card
 */
export async function presentTopUpSheet(
  clientSecret: string,
  customerId: string,
  ephemeralKey: string
): Promise<PaymentSheetResult> {
  if (isExpoGo) {
    return { 
      success: false, 
      error: 'Stripe requires a development build. Expo Go is not supported.' 
    };
  }

  if (!isStripeConfigured() || !initPaymentSheet || !presentPaymentSheet) {
    return { success: false, error: 'Stripe is not configured' };
  }

  try {
    // Initialize PaymentSheet with Apple Pay / Google Pay support
    const { error: initError } = await initPaymentSheet({
      paymentIntentClientSecret: clientSecret,
      customerId,
      customerEphemeralKeySecret: ephemeralKey,
      merchantDisplayName: 'OopsFee',
      // Apple Pay configuration
      applePay: Platform.OS === 'ios' ? {
        merchantCountryCode: 'US',
      } : undefined,
      // Google Pay configuration
      googlePay: Platform.OS === 'android' ? {
        merchantCountryCode: 'US',
        testEnv: __DEV__,
      } : undefined,
      returnURL: 'oopsfee://payment-complete',
      // Style matching the app theme
      appearance: {
        colors: {
          primary: '#34C759', // Success green for top-ups
          background: '#000000',
          componentBackground: '#1C1C1E',
          componentBorder: '#3A3A3C',
          componentDivider: '#3A3A3C',
          primaryText: '#FFFFFF',
          secondaryText: '#B3B3B3',
          componentText: '#FFFFFF',
          placeholderText: '#737373',
          icon: '#B3B3B3',
          error: '#FF453A',
        },
        shapes: {
          borderRadius: 12,
          borderWidth: 1,
        },
      },
    });

    if (initError) {
      console.error('[Stripe] TopUp init error:', initError);
      return { success: false, error: initError.message };
    }

    // Present the PaymentSheet
    const { error: presentError } = await presentPaymentSheet();

    if (presentError) {
      if (presentError.code === 'Canceled') {
        return { success: false, cancelled: true };
      }
      console.error('[Stripe] TopUp present error:', presentError);
      return { success: false, error: presentError.message };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Stripe] TopUp error:', message);
    return { success: false, error: message };
  }
}

/**
 * Remove the user's saved payment method
 *
 * Calls the stripe-remove-payment-method edge function to detach the card
 * from Stripe and clear it from the user's profile.
 */
export async function removePaymentMethod(): Promise<RemovePaymentResult> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase is not configured' };
  }

  try {
    const { data, error } = await supabase.functions.invoke(
      'stripe-remove-payment-method',
      { method: 'POST' }
    );

    if (error) {
      console.error('[Stripe] Remove payment method error:', error);
      return { success: false, error: error.message || 'Failed to remove payment method' };
    }

    if (data?.error) {
      return { success: false, error: data.error };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Stripe] Remove error:', message);
    return { success: false, error: message };
  }
}

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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let createTokenNative: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let CardFieldComponent: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let CardFormComponent: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let useStripeHook: any = null;

if (!isExpoGo) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const stripe = require('@stripe/stripe-react-native');
    RNStripeProvider = stripe.StripeProvider;
    initPaymentSheet = stripe.initPaymentSheet;
    presentPaymentSheet = stripe.presentPaymentSheet;
    createTokenNative = stripe.createToken;
    CardFieldComponent = stripe.CardField;
    CardFormComponent = stripe.CardForm;
    useStripeHook = stripe.useStripe;
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
      // Don't collect billing address - card BIN is enough
      billingDetailsCollectionConfiguration: {
        address: 'never',
        phone: 'never',
        email: 'never',
        name: 'never',
      },
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
      billingDetailsCollectionConfiguration: {
        address: 'never',
        phone: 'never',
        email: 'never',
        name: 'never',
      },
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
      // Don't collect billing address
      billingDetailsCollectionConfiguration: {
        address: 'never',
        phone: 'never',
        email: 'never',
        name: 'never',
      },
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

// ─────────────────────────────────────────────────────────────
// Payout Card Collection (uses PaymentSheet UI)
// ─────────────────────────────────────────────────────────────

export interface PayoutCardResult {
  success: boolean;
  cancelled?: boolean;
  tokenId?: string;
  error?: string;
}

/**
 * Present PaymentSheet to collect a debit card for payouts.
 * Uses the same nice UI as payment method setup.
 * Returns a token that can be used for payout-to-card.
 */
export async function presentPayoutCardSheet(): Promise<PayoutCardResult> {
  if (isExpoGo) {
    return { 
      success: false, 
      error: 'Stripe requires a development build. Expo Go is not supported.' 
    };
  }

  if (!isStripeConfigured() || !initPaymentSheet || !presentPaymentSheet || !createTokenNative) {
    return { success: false, error: 'Stripe is not configured' };
  }

  try {
    // Get SetupIntent from server (same as payment method)
    const { clientSecret, customerId, ephemeralKey } = await createSetupIntent();

    // Initialize PaymentSheet
    const { error: initError } = await initPaymentSheet({
      customerId,
      customerEphemeralKeySecret: ephemeralKey,
      setupIntentClientSecret: clientSecret,
      merchantDisplayName: 'OopsFee - Payout Card',
      applePay: Platform.OS === 'ios' ? {
        merchantCountryCode: 'US',
      } : undefined,
      googlePay: Platform.OS === 'android' ? {
        merchantCountryCode: 'US',
        testEnv: __DEV__,
      } : undefined,
      billingDetailsCollectionConfiguration: {
        address: 'never',
        phone: 'never',
        email: 'never',
        name: 'never',
      },
      returnURL: 'oopsfee://payment-complete',
      appearance: {
        colors: {
          primary: '#FFD60A', // Yellow for payouts
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
      console.error('[Stripe] Payout card init error:', initError);
      return { success: false, error: initError.message };
    }

    // Present PaymentSheet
    const { error: presentError } = await presentPaymentSheet();

    if (presentError) {
      if (presentError.code === 'Canceled') {
        return { success: false, cancelled: true };
      }
      console.error('[Stripe] Payout card present error:', presentError);
      return { success: false, error: presentError.message };
    }

    // Card was added successfully. Now create a token from it.
    // The card is now attached to the customer, we can create a token.
    const { token, error: tokenError } = await createTokenNative({ type: 'Card' });

    if (tokenError || !token?.id) {
      // Card was saved but token creation failed
      // This is okay - we can still use the saved card via customer
      console.warn('[Stripe] Token creation after setup failed, but card was saved');
      return { success: true, tokenId: undefined };
    }

    return { success: true, tokenId: token.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Stripe] Payout card error:', message);
    return { success: false, error: message };
  }
}

// ─────────────────────────────────────────────────────────────
// Card Field Component & Tokenization (legacy)
// ─────────────────────────────────────────────────────────────

export interface CardTokenResult {
  success: boolean;
  tokenId?: string;
  error?: string;
}

// Re-export CardField component for use in withdraw modals
// Must be used with createCardTokenFromField()
export const CardField = CardFieldComponent;

// Re-export CardForm component (better multi-line layout)
export const CardForm = CardFormComponent;

// Re-export useStripe hook
export const useStripe = useStripeHook;

/**
 * Create a token from a rendered CardField/CardForm component.
 * 
 * The CardField/CardForm must be rendered in your component before calling this.
 * This function reads card details from the component and creates a token.
 * 
 * Usage:
 * 1. Render <CardField /> or <CardForm /> in your component
 * 2. When user fills in card and taps submit, call createCardTokenFromField()
 * 
 * @param currency - Currency code for Connect external account cards (default: 'usd')
 */
export async function createCardTokenFromField(currency = 'usd'): Promise<CardTokenResult> {
  if (isExpoGo) {
    return { 
      success: false, 
      error: 'Stripe requires a development build. Expo Go is not supported.' 
    };
  }

  if (!isStripeConfigured() || !createTokenNative) {
    return { success: false, error: 'Stripe is not configured' };
  }

  try {
    // createToken reads from the mounted CardField/CardForm component
    // currency is required when adding card as external account to Connect account
    const { token, error } = await createTokenNative({
      type: 'Card',
      currency,
    });

    if (error) {
      console.error('[Stripe] Token creation error:', error);
      return { success: false, error: error.message };
    }

    if (!token?.id) {
      return { success: false, error: 'No token returned' };
    }

    return { success: true, tokenId: token.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to tokenize card';
    console.error('[Stripe] Token error:', message);
    return { success: false, error: message };
  }
}

// Legacy type for backwards compatibility
export interface CardParams {
  number: string;
  expMonth: number;
  expYear: number;
  cvc: string;
  name?: string;
}

/**
 * @deprecated Use CardField component with createCardTokenFromField() instead.
 * Raw card params are not supported by Stripe React Native SDK.
 */
export async function createCardToken(_card: CardParams): Promise<CardTokenResult> {
  console.warn('[Stripe] createCardToken with raw params is deprecated. Use CardField + createCardTokenFromField()');
  return { 
    success: false, 
    error: 'Use CardField component with createCardTokenFromField() instead' 
  };
}

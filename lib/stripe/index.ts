/**
 * Stripe integration for OopsFee
 *
 * Uses platform-specific files:
 * - client.tsx for iOS/Android (default)
 * - client.web.tsx for web (stubs)
 *
 * Usage:
 * ```tsx
 * import { StripeProvider, presentAddCardSheet } from '@/lib/stripe';
 * ```
 */

export {
  createSetupIntent,
  isStripeConfigured,
  presentAddCardSheet,
  presentPaymentForSCA,
  removePaymentMethod,
  StripeProvider,
  type PaymentSheetResult,
  type RemovePaymentResult,
  type SetupIntentResult,
} from './client';

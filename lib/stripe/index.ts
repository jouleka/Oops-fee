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
  CardField,
  CardForm,
  createCardToken,
  createCardTokenFromField,
  createSetupIntent,
  isStripeConfigured,
  presentAddCardSheet,
  presentPaymentForSCA,
  presentPayoutCardSheet,
  presentTopUpSheet,
  removePaymentMethod,
  StripeProvider,
  useStripe,
  type CardParams,
  type CardTokenResult,
  type PaymentSheetResult,
  type PayoutCardResult,
  type RemovePaymentResult,
  type SetupIntentResult,
} from './client';

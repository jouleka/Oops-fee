/**
 * Friend Claim Page
 *
 * Public route for friends to view and claim funds:
 * - oopsfee.app/claim/{token}
 *
 * Two states:
 * 1. Preview mode (promise still active): Shows promise details, stake, deadline
 * 2. Claim mode (user failed): Shows claimable amount and Stripe Connect onboarding
 */

import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { getClaimContext, startClaimOnboarding, claimViaPayPal, claimViaDebitCard, type ClaimContext } from '@/lib/claims';

function hapticMedium() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

function hapticSuccess() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

function hapticError() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function formatCurrency(dollars: number): string {
  return `$${dollars.toFixed(Number.isInteger(dollars) ? 0 : 2)}`;
}

function formatDeadline(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getTimeRemaining(dateStr: string): string {
  const now = new Date();
  const target = new Date(dateStr);
  const diffMs = target.getTime() - now.getTime();

  if (diffMs <= 0) return 'Expired';

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) {
    return `${days} day${days !== 1 ? 's' : ''} ${hours}h left`;
  }
  if (hours > 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''} left`;
  }

  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${minutes} minute${minutes !== 1 ? 's' : ''} left`;
}

// ─────────────────────────────────────────────────────────────
// PREVIEW MODE (Promise Active)
// ─────────────────────────────────────────────────────────────

function PreviewState({ context }: { context: ClaimContext }) {
  const deadline = formatDeadline(context.deadline);
  const timeRemaining = getTimeRemaining(context.deadline);
  const stake = formatCurrency(context.stake);

  return (
    <View style={styles.stateContainer}>
      <View style={styles.header}>
        <Text style={styles.emoji}>👀</Text>
        <Text style={styles.title}>You're on the hook!</Text>
        <Text style={styles.subtitle}>
          {context.userName} bet {stake} they'll keep this promise.
          {'\n'}
          If they fail, the money's yours.
        </Text>
      </View>

      <View style={styles.promiseCard}>
        <Text style={styles.promiseLabel}>THE PROMISE</Text>
        <Text style={styles.promiseText}>"{context.promiseText}"</Text>

        <View style={styles.promiseStats}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>STAKE</Text>
            <Text style={styles.statValueMoney}>{stake}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statLabel}>DEADLINE</Text>
            <Text style={styles.statValue}>{deadline}</Text>
          </View>
        </View>
      </View>

      <Animated.View entering={FadeIn.delay(400).duration(300)} style={styles.countdown}>
        <Text style={styles.countdownIcon}>⏱️</Text>
        <Text style={styles.countdownText}>{timeRemaining}</Text>
      </Animated.View>

      <View style={styles.infoBox}>
        <Text style={styles.infoIcon}>📧</Text>
        <Text style={styles.infoText}>
          We'll email you at if {context.userName} fails and there's money to claim.
        </Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPLETED STATE (User Kept Promise)
// ─────────────────────────────────────────────────────────────

function CompletedState({ context }: { context: ClaimContext }) {
  const stake = formatCurrency(context.stake);

  return (
    <View style={styles.stateContainer}>
      <View style={styles.header}>
        <Text style={styles.emoji}>✅</Text>
        <Text style={styles.title}>They did it!</Text>
        <Text style={styles.subtitle}>
          {context.userName} kept their promise.{'\n'}
          No {stake} for you this time!
        </Text>
      </View>

      <View style={styles.promiseCard}>
        <Text style={styles.promiseLabel}>COMPLETED PROMISE</Text>
        <Text style={styles.promiseText}>"{context.promiseText}"</Text>
      </View>

      <View style={styles.successBadge}>
        <Text style={styles.successBadgeText}>Promise Kept 🎉</Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// CLAIM MODE (User Failed - Money Available)
// Shows payout method picker: PayPal (fast) or Stripe (bank account)
// ─────────────────────────────────────────────────────────────

type PayoutView = 'picker' | 'paypal' | 'stripe' | 'debit';

const DEBIT_FEE_PERCENT = 1.5; // 1.5% fee for instant card payouts

// Stripe.js types for web
declare global {
  interface Window {
    Stripe?: (key: string) => {
      elements: () => {
        create: (type: string, options?: Record<string, unknown>) => {
          mount: (el: HTMLElement | string) => void;
          on: (event: string, handler: (e: { complete?: boolean; error?: { message: string } }) => void) => void;
          unmount: () => void;
        };
      };
      createToken: (element: unknown, data?: Record<string, unknown>) => Promise<{
        token?: { id: string };
        error?: { message: string };
      }>;
    };
  }
}

function ClaimState({ context, token }: { context: ClaimContext; token: string }) {
  const [view, setView] = useState<PayoutView>('picker');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paypalEmail, setPaypalEmail] = useState('');
  
  // Stripe.js state (web only)
  const [stripeLoaded, setStripeLoaded] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const stripeRef = useRef<ReturnType<NonNullable<typeof window.Stripe>> | null>(null);
  const cardElementRef = useRef<ReturnType<ReturnType<NonNullable<typeof window.Stripe>>['elements']>['create']> | null>(null);
  const cardMountRef = useRef<HTMLDivElement | null>(null);
  
  // Cardholder name (still needed for token)
  const [cardholderName, setCardholderName] = useState('');
  const [successCardLast4, setSuccessCardLast4] = useState<string | null>(null);
  
  const amountCents = Math.round((context.amount || context.stake) * 100);
  const amount = formatCurrency(context.amount || context.stake);

  // Email validation
  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  
  // Validate card is complete (Stripe handles validation)
  const isValidCard = cardComplete && cardholderName.trim().length > 0;
  
  // Calculate fee for debit card payout
  const debitFeeAmount = Math.round(amountCents * (DEBIT_FEE_PERCENT / 100));
  const debitNetAmount = amountCents - debitFeeAmount;
  
  // Get Stripe publishable key from context
  const stripePublishableKey = context.stripePublishableKey ?? '';
  
  // Load Stripe.js when debit view is shown (web only)
  useEffect(() => {
    if (view !== 'debit' || Platform.OS !== 'web') return;
    if (!stripePublishableKey) {
      setError('Payment configuration not available. Please try again later.');
      return;
    }
    
    // Check if already loaded
    if (window.Stripe) {
      stripeRef.current = window.Stripe(stripePublishableKey);
      setStripeLoaded(true);
      return;
    }
    
    // Load Stripe.js script
    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/';
    script.async = true;
    script.onload = () => {
      if (window.Stripe) {
        stripeRef.current = window.Stripe(stripePublishableKey);
        setStripeLoaded(true);
      }
    };
    document.body.appendChild(script);
    
    return () => {
      // Cleanup card element on unmount
      if (cardElementRef.current) {
        try {
          cardElementRef.current.unmount();
        } catch {
          // Ignore unmount errors
        }
      }
    };
  }, [view, stripePublishableKey]);
  
  // Mount card element when Stripe is loaded
  useEffect(() => {
    if (!stripeLoaded || !stripeRef.current || !cardMountRef.current) return;
    if (cardElementRef.current) return; // Already mounted
    
    const elements = stripeRef.current.elements();
    const cardElement = elements.create('card', {
      style: {
        base: {
          color: '#ffffff',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: '16px',
          '::placeholder': {
            color: '#666666',
          },
        },
        invalid: {
          color: '#ff4444',
        },
      },
    });
    
    cardElement.mount(cardMountRef.current);
    cardElement.on('change', (event) => {
      setCardComplete(event.complete ?? false);
      setCardError(event.error?.message ?? null);
    });
    
    cardElementRef.current = cardElement;
  }, [stripeLoaded]);

  const handleStripeOnboarding = useCallback(async () => {
    if (loading) return;

    setLoading(true);
    setError(null);
    hapticMedium();

    try {
      const { onboardingUrl } = await startClaimOnboarding(token);

      // Open Stripe Connect onboarding in browser
      if (Platform.OS === 'web') {
        window.location.href = onboardingUrl;
      } else {
        await Linking.openURL(onboardingUrl);
      }

      hapticSuccess();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to start claim';
      setError(message);
      hapticError();
    } finally {
      setLoading(false);
    }
  }, [token, loading]);

  const handlePayPalSubmit = useCallback(async () => {
    if (loading || !isValidEmail(paypalEmail)) return;

    setLoading(true);
    setError(null);
    hapticMedium();

    try {
      const result = await claimViaPayPal(token, paypalEmail.trim());

      if (!result.success) {
        throw new Error(result.error || 'PayPal payout failed');
      }

      hapticSuccess();
      // Page will re-render with updated context showing PayPal pending state
      // Trigger a refetch by reloading the page
      if (Platform.OS === 'web') {
        window.location.reload();
      } else {
        router.replace(`/claim/${token}?refresh=${Date.now()}`);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to process PayPal payout';
      setError(message);
      hapticError();
    } finally {
      setLoading(false);
    }
  }, [token, paypalEmail, loading]);

  const handleDebitSubmit = useCallback(async () => {
    if (loading || !isValidCard) return;
    if (!stripeRef.current || !cardElementRef.current) {
      setError('Card input not ready. Please wait a moment and try again.');
      return;
    }

    setLoading(true);
    setError(null);
    hapticMedium();

    try {
      // Create token using Stripe.js
      const { token: stripeToken, error: tokenError } = await stripeRef.current.createToken(
        cardElementRef.current,
        { name: cardholderName.trim(), currency: 'usd' }
      );

      if (tokenError || !stripeToken) {
        throw new Error(tokenError?.message || 'Failed to tokenize card');
      }

      // Send token to server
      const result = await claimViaDebitCard(token, stripeToken.id, cardholderName.trim());

      if (!result.success) {
        throw new Error(result.error || 'Card payout failed');
      }

      hapticSuccess();
      setSuccessCardLast4(result.cardLast4 ?? null);
      
      // Reload to show transferred state
      if (Platform.OS === 'web') {
        window.location.reload();
      } else {
        router.replace(`/claim/${token}?refresh=${Date.now()}`);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to process card payout';
      setError(message);
      hapticError();
    } finally {
      setLoading(false);
    }
  }, [token, cardholderName, isValidCard, loading]);

  // PayPal email input view
  if (view === 'paypal') {
    return (
      <View style={styles.stateContainer}>
        <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
          <Text style={styles.emoji}>🅿️</Text>
          <Text style={styles.title}>Enter your PayPal email</Text>
          <Text style={styles.subtitle}>
            We'll send {amount} to this email instantly.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(100).duration(400)} style={styles.inputCard}>
          <Text style={styles.inputLabel}>PayPal Email Address</Text>
          <TextInput
            style={styles.textInput}
            placeholder="you@email.com"
            placeholderTextColor={Colors.textMuted}
            value={paypalEmail}
            onChangeText={setPaypalEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoFocus
          />
          <Text style={styles.inputHint}>
            Use the email connected to your PayPal account
          </Text>
        </Animated.View>

        {error && (
          <Animated.View entering={FadeIn.duration(200)} style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </Animated.View>
        )}

        <View style={styles.buttonRow}>
          <Pressable
            onPress={() => setView('picker')}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          >
            <Text style={styles.backBtnText}>← Back</Text>
          </Pressable>

          <Pressable
            disabled={loading || !isValidEmail(paypalEmail)}
            onPress={handlePayPalSubmit}
            style={({ pressed }) => [
              styles.submitBtn,
              pressed && styles.pressed,
              (loading || !isValidEmail(paypalEmail)) && styles.disabled,
            ]}
          >
            <LinearGradient
              colors={['#0070ba', '#003087']}
              style={styles.btnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {loading ? (
                <ActivityIndicator color={Colors.text} />
              ) : (
                <Text style={styles.claimBtnText}>Send to PayPal</Text>
              )}
            </LinearGradient>
          </Pressable>
        </View>

        <Text style={styles.disclaimer}>
          Funds usually arrive within minutes.{'\n'}
          Check your PayPal app or email for confirmation.
        </Text>
      </View>
    );
  }

  // Stripe flow (direct to onboarding)
  if (view === 'stripe') {
    return (
      <View style={styles.stateContainer}>
        <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
          <Text style={styles.emoji}>🏦</Text>
          <Text style={styles.title}>Set up bank transfer</Text>
          <Text style={styles.subtitle}>
            Connect your bank account to receive {amount}.
          </Text>
        </Animated.View>

        {error && (
          <Animated.View entering={FadeIn.duration(200)} style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </Animated.View>
        )}

        <View style={styles.buttonRow}>
          <Pressable
            onPress={() => setView('picker')}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          >
            <Text style={styles.backBtnText}>← Back</Text>
          </Pressable>

          <Pressable
            disabled={loading}
            onPress={handleStripeOnboarding}
            style={({ pressed }) => [styles.submitBtn, pressed && styles.pressed, loading && styles.disabled]}
          >
            <LinearGradient
              colors={['#635bff', '#4f46e5']}
              style={styles.btnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {loading ? (
                <ActivityIndicator color={Colors.text} />
              ) : (
                <Text style={styles.claimBtnText}>Continue to Stripe</Text>
              )}
            </LinearGradient>
          </Pressable>
        </View>

        <Text style={styles.disclaimer}>
          Stripe securely handles bank account verification.{'\n'}
          Transfers typically arrive in 2-3 business days.
        </Text>
      </View>
    );
  }

  // Debit card input view
  if (view === 'debit') {
    return (
      <View style={styles.stateContainer}>
        <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
          <Text style={styles.emoji}>💳</Text>
          <Text style={styles.title}>Enter your debit card</Text>
          <Text style={styles.subtitle}>
            We'll send ${(debitNetAmount / 100).toFixed(2)} instantly to your card.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(100).duration(400)} style={styles.inputCard}>
          <Text style={styles.inputLabel}>Debit Card Details</Text>
          
          {/* Stripe Card Element (web only) */}
          {Platform.OS === 'web' ? (
            <>
              {!stripeLoaded ? (
                <View style={styles.stripeLoadingContainer}>
                  <ActivityIndicator size="small" color={Colors.accent} />
                  <Text style={styles.stripeLoadingText}>Loading secure card input...</Text>
                </View>
              ) : (
                <View style={styles.stripeCardContainer}>
                  <div
                    ref={(el) => { cardMountRef.current = el; }}
                    style={{
                      backgroundColor: '#1a1a1a',
                      borderRadius: 8,
                      padding: 16,
                      border: cardError ? '1px solid #ff4444' : '1px solid #333',
                    }}
                  />
                  {cardError && (
                    <Text style={styles.cardErrorText}>{cardError}</Text>
                  )}
                </View>
              )}
            </>
          ) : (
            <Text style={styles.inputHint}>
              Debit card payouts are only available on web.
            </Text>
          )}
          
          {/* Cardholder Name */}
          <TextInput
            style={styles.textInput}
            placeholder="Name on card"
            placeholderTextColor={Colors.textMuted}
            value={cardholderName}
            onChangeText={setCardholderName}
            autoCapitalize="words"
            autoCorrect={false}
          />
          
          <Text style={styles.inputHint}>
            Only Visa/Mastercard debit cards eligible for instant payout
          </Text>
        </Animated.View>

        {/* Fee breakdown */}
        <Animated.View entering={FadeInUp.delay(150).duration(400)} style={styles.feeBreakdownCard}>
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>Claim amount</Text>
            <Text style={styles.feeValue}>{amount}</Text>
          </View>
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>Instant transfer fee (1.5%)</Text>
            <Text style={styles.feeValue}>-${(debitFeeAmount / 100).toFixed(2)}</Text>
          </View>
          <View style={[styles.feeRow, styles.feeRowTotal]}>
            <Text style={styles.feeLabelTotal}>You receive</Text>
            <Text style={styles.feeValueTotal}>${(debitNetAmount / 100).toFixed(2)}</Text>
          </View>
        </Animated.View>

        {error && (
          <Animated.View entering={FadeIn.duration(200)} style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </Animated.View>
        )}

        <View style={styles.buttonRow}>
          <Pressable
            onPress={() => setView('picker')}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          >
            <Text style={styles.backBtnText}>← Back</Text>
          </Pressable>

          <Pressable
            disabled={loading || !isValidCard}
            onPress={handleDebitSubmit}
            style={({ pressed }) => [
              styles.submitBtn,
              pressed && styles.pressed,
              (loading || !isValidCard) && styles.disabled,
            ]}
          >
            <LinearGradient
              colors={[Colors.accent, '#0A84FF']}
              style={styles.btnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {loading ? (
                <ActivityIndicator color={Colors.text} />
              ) : (
                <Text style={styles.claimBtnText}>Send Instantly</Text>
              )}
            </LinearGradient>
          </Pressable>
        </View>

        <Text style={styles.disclaimer}>
          ⚡ Funds arrive in seconds.{'\n'}
          1.5% instant transfer fee applies.
        </Text>
      </View>
    );
  }

  // Default: Payout method picker
  return (
    <View style={styles.stateContainer}>
      <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
        <Text style={styles.emoji}>💸</Text>
        <Text style={styles.title}>You've got {amount} waiting!</Text>
        <Text style={styles.subtitle}>
          {context.userName} didn't follow through.{'\n'}
          How would you like to receive it?
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(200).duration(400)} style={styles.amountCard}>
        <Text style={styles.amountLabel}>CLAIMABLE AMOUNT</Text>
        <Text style={styles.amountValue}>{amount}</Text>
        {context.daysUntilExpiry !== null && (
          <Text style={styles.expiryWarning}>
            ⚠️ Claim within {context.daysUntilExpiry} day{context.daysUntilExpiry !== 1 ? 's' : ''} or it expires
          </Text>
        )}
      </Animated.View>

      <View style={styles.promiseCard}>
        <Text style={styles.promiseLabel}>FAILED PROMISE</Text>
        <Text style={styles.promiseText}>"{context.promiseText}"</Text>
        <View style={styles.failedBadge}>
          <Text style={styles.failedBadgeText}>❌ Not completed</Text>
        </View>
      </View>

      {/* Payout method picker */}
      <Animated.View entering={FadeInUp.delay(300).duration(400)} style={styles.methodPickerContainer}>
        <Text style={styles.methodPickerLabel}>CHOOSE PAYOUT METHOD</Text>

        <Pressable
          onPress={() => { hapticMedium(); setView('debit'); }}
          style={({ pressed }) => [styles.methodOption, styles.methodOptionDebit, pressed && styles.pressed]}
        >
          <View style={styles.methodOptionContent}>
            <Text style={styles.methodIcon}>💳</Text>
            <View style={styles.methodTextContainer}>
              <Text style={styles.methodTitle}>Debit Card</Text>
              <Text style={styles.methodSubtitle}>Fastest – no account needed</Text>
            </View>
          </View>
          <View style={styles.methodBadgeInstant}>
            <Text style={styles.methodBadgeInstantText}>⚡ Instant</Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() => { hapticMedium(); setView('paypal'); }}
          style={({ pressed }) => [styles.methodOption, styles.methodOptionPayPal, pressed && styles.pressed]}
        >
          <View style={styles.methodOptionContent}>
            <Text style={styles.methodIcon}>🅿️</Text>
            <View style={styles.methodTextContainer}>
              <Text style={styles.methodTitle}>PayPal</Text>
              <Text style={styles.methodSubtitle}>Send to your PayPal email</Text>
            </View>
          </View>
          <View style={styles.methodBadge}>
            <Text style={styles.methodBadgeText}>Fast</Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() => { hapticMedium(); setView('stripe'); }}
          style={({ pressed }) => [styles.methodOption, styles.methodOptionStripe, pressed && styles.pressed]}
        >
          <View style={styles.methodOptionContent}>
            <Text style={styles.methodIcon}>🏦</Text>
            <View style={styles.methodTextContainer}>
              <Text style={styles.methodTitle}>Bank Account</Text>
              <Text style={styles.methodSubtitle}>Via Stripe – takes ~2 min setup</Text>
            </View>
          </View>
          <Text style={styles.methodChevron}>→</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// PAYPAL PENDING STATE (Payout sent, waiting for recipient)
// ─────────────────────────────────────────────────────────────

function PayPalPendingState({ context }: { context: ClaimContext }) {
  const amount = formatCurrency(context.amount || context.stake);

  return (
    <View style={styles.stateContainer}>
      <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
        <Text style={styles.emoji}>📧</Text>
        <Text style={styles.title}>Check your PayPal!</Text>
        <Text style={styles.subtitle}>
          We've sent {amount} to your PayPal account.
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(200).duration(400)} style={styles.paypalPendingCard}>
        <View style={styles.paypalEmailRow}>
          <Text style={styles.paypalEmailLabel}>Sent to:</Text>
          <Text style={styles.paypalEmailValue}>{context.paypalEmail}</Text>
        </View>
        <View style={styles.paypalStatusRow}>
          <ActivityIndicator size="small" color="#0070ba" />
          <Text style={styles.paypalStatusText}>Waiting for PayPal confirmation</Text>
        </View>
      </Animated.View>

      <View style={styles.infoBox}>
        <Text style={styles.infoIcon}>💡</Text>
        <Text style={styles.infoText}>
          If you have a PayPal account with this email, the money will be deposited automatically.{'\n\n'}
          If not, you'll receive an email from PayPal to claim it.
        </Text>
      </View>

      <View style={styles.promiseCard}>
        <Text style={styles.promiseLabel}>THE BROKEN PROMISE</Text>
        <Text style={styles.promiseText}>"{context.promiseText}"</Text>
        <Text style={styles.promiseNote}>
          {context.userName} didn't follow through. Their loss, your gain!
        </Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// PAYPAL UNCLAIMED STATE (PayPal payout expired after 30 days)
// ─────────────────────────────────────────────────────────────

function PayPalUnclaimedState({ context }: { context: ClaimContext }) {
  const amount = formatCurrency(context.amount || context.stake);

  return (
    <View style={styles.stateContainer}>
      <View style={styles.header}>
        <Text style={styles.emoji}>⏰</Text>
        <Text style={styles.title}>PayPal payout expired</Text>
        <Text style={styles.subtitle}>
          The PayPal payout of {amount} was not claimed within 30 days.
        </Text>
      </View>

      <View style={styles.expiredCard}>
        <Text style={styles.expiredIcon}>😔</Text>
        <Text style={styles.expiredText}>
          Unclaimed PayPal funds are returned to OopsFee.{'\n'}
          Make sure to claim future payouts promptly!
        </Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// ONBOARDING IN PROGRESS STATE
// ─────────────────────────────────────────────────────────────

function OnboardingState({ context, token }: { context: ClaimContext; token: string }) {
  const [resuming, setResuming] = useState(false);
  const amount = formatCurrency(context.amount || context.stake);

  const handleResume = useCallback(async () => {
    if (resuming) return;

    setResuming(true);
    hapticMedium();

    try {
      const { onboardingUrl } = await startClaimOnboarding(token);

      if (Platform.OS === 'web') {
        window.location.href = onboardingUrl;
      } else {
        await Linking.openURL(onboardingUrl);
      }
    } catch (e) {
      console.error('Failed to resume onboarding:', e);
      hapticError();
    } finally {
      setResuming(false);
    }
  }, [token, resuming]);

  return (
    <View style={styles.stateContainer}>
      <View style={styles.header}>
        <Text style={styles.emoji}>🔄</Text>
        <Text style={styles.title}>Almost there!</Text>
        <Text style={styles.subtitle}>
          Finish setting up your account to receive {amount}.
        </Text>
      </View>

      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <Text style={styles.statusIcon}>✅</Text>
          <Text style={styles.statusText}>Account created</Text>
        </View>
        <View style={styles.statusRow}>
          <ActivityIndicator size="small" color={Colors.warning} />
          <Text style={styles.statusText}>Verification in progress</Text>
        </View>
      </View>

      <Pressable
        disabled={resuming}
        onPress={handleResume}
        style={({ pressed }) => [styles.claimBtn, pressed && styles.pressed, resuming && styles.disabled]}
      >
        <LinearGradient
          colors={[Colors.accent, '#0A84FF']}
          style={styles.btnGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {resuming ? (
            <ActivityIndicator color={Colors.text} />
          ) : (
            <Text style={styles.claimBtnText}>Continue Setup</Text>
          )}
        </LinearGradient>
      </Pressable>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// TRANSFERRED STATE (Funds Sent)
// ─────────────────────────────────────────────────────────────

function TransferredState({ context }: { context: ClaimContext }) {
  const amount = formatCurrency(context.amount || context.stake);

  return (
    <View style={styles.stateContainer}>
      <View style={styles.header}>
        <Text style={styles.emoji}>🎉</Text>
        <Text style={styles.title}>Money's on the way!</Text>
        <Text style={styles.subtitle}>
          {amount} has been transferred to your account.
        </Text>
      </View>

      <View style={styles.successCard}>
        <Text style={styles.successIcon}>💰</Text>
        <Text style={styles.successAmount}>{amount}</Text>
        <Text style={styles.successNote}>
          Funds typically arrive within 2-3 business days.
        </Text>
      </View>

      <View style={styles.promiseCard}>
        <Text style={styles.promiseLabel}>THE BROKEN PROMISE</Text>
        <Text style={styles.promiseText}>"{context.promiseText}"</Text>
        <Text style={styles.promiseNote}>
          {context.userName} didn't follow through. Their loss, your gain!
        </Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// CARD TRANSFERRED STATE (Instant payout sent)
// ─────────────────────────────────────────────────────────────

function CardTransferredState({ context }: { context: ClaimContext }) {
  const amount = formatCurrency(context.amount || context.stake);
  const cardDisplay = context.cardBrand 
    ? `${context.cardBrand.toUpperCase()} •••• ${context.cardLast4}`
    : `•••• ${context.cardLast4}`;

  return (
    <View style={styles.stateContainer}>
      <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
        <Text style={styles.emoji}>⚡</Text>
        <Text style={styles.title}>Instant payout sent!</Text>
        <Text style={styles.subtitle}>
          {amount} has been sent to your debit card.
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(200).duration(400)} style={styles.cardSuccessCard}>
        <Text style={styles.successIcon}>💳</Text>
        <Text style={styles.successAmount}>{amount}</Text>
        <View style={styles.cardDetailsRow}>
          <Text style={styles.cardDetailsLabel}>Sent to:</Text>
          <Text style={styles.cardDetailsValue}>{cardDisplay}</Text>
        </View>
        <Text style={styles.cardSuccessNote}>
          Funds arrive within minutes!
        </Text>
      </Animated.View>

      <View style={styles.promiseCard}>
        <Text style={styles.promiseLabel}>THE BROKEN PROMISE</Text>
        <Text style={styles.promiseText}>"{context.promiseText}"</Text>
        <Text style={styles.promiseNote}>
          {context.userName} didn't follow through. Their loss, your gain!
        </Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// EXPIRED STATE
// ─────────────────────────────────────────────────────────────

function ExpiredState({ context }: { context: ClaimContext }) {
  const amount = formatCurrency(context.amount || context.stake);

  return (
    <View style={styles.stateContainer}>
      <View style={styles.header}>
        <Text style={styles.emoji}>⏰</Text>
        <Text style={styles.title}>Claim expired</Text>
        <Text style={styles.subtitle}>
          The 7-day window to claim {amount} has passed.
        </Text>
      </View>

      <View style={styles.expiredCard}>
        <Text style={styles.expiredIcon}>😔</Text>
        <Text style={styles.expiredText}>
          Unclaimed funds go to support OopsFee.
        </Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// LOADING STATE
// ─────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={Colors.accent} />
      <Text style={styles.loadingText}>Loading claim...</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// ERROR STATE
// ─────────────────────────────────────────────────────────────

function ErrorState({ message }: { message: string }) {
  const handleGoHome = () => {
    router.replace('/home');
  };

  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorEmoji}>😕</Text>
      <Text style={styles.errorTitle}>Oops</Text>
      <Text style={styles.errorSubtitle}>{message}</Text>
      <Pressable style={styles.homeBtn} onPress={handleGoHome}>
        <Text style={styles.homeBtnText}>Go to OopsFee</Text>
      </Pressable>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// SUCCESS REDIRECT (After Stripe Onboarding)
// ─────────────────────────────────────────────────────────────

function SuccessRedirect({ context }: { context: ClaimContext }) {
  const amount = formatCurrency(context.amount || context.stake);

  return (
    <View style={styles.stateContainer}>
      <View style={styles.header}>
        <Text style={styles.emoji}>✨</Text>
        <Text style={styles.title}>You're all set!</Text>
        <Text style={styles.subtitle}>
          Your account is being verified.{'\n'}
          We'll transfer {amount} once approved.
        </Text>
      </View>

      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <Text style={styles.statusIcon}>✅</Text>
          <Text style={styles.statusText}>Account setup complete</Text>
        </View>
        <View style={styles.statusRow}>
          <ActivityIndicator size="small" color={Colors.accent} />
          <Text style={styles.statusText}>Verification in progress</Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusIconPending}>⏳</Text>
          <Text style={styles.statusTextPending}>Transfer pending</Text>
        </View>
      </View>

      <Text style={styles.disclaimer}>
        You'll receive an email when the transfer is complete.{'\n'}
        Usually takes 1-2 business days.
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────

export default function ClaimPage() {
  const { token, success, refresh: _refresh } = useLocalSearchParams<{
    token: string;
    success?: string;
    refresh?: string;
  }>();
  const insets = useSafeAreaInsets();
  const [context, setContext] = useState<ClaimContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Invalid link');
      setLoading(false);
      return;
    }

    getClaimContext(token)
      .then(setContext)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [token]);

  // Render based on state
  const renderContent = () => {
    if (loading) {
      return <LoadingState />;
    }

    if (error || !context) {
      return <ErrorState message={error || 'Something went wrong'} />;
    }

    // If returning from successful Stripe onboarding
    if (success === 'true') {
      return <SuccessRedirect context={context} />;
    }

    // Based on claim status
    switch (context.claimStatus) {
      case 'pending':
        // Promise is still active - show preview
        if (context.promiseStatus === 'completed') {
          return <CompletedState context={context} />;
        }
        return <PreviewState context={context} />;

      case 'notified':
        // User failed, friend can claim
        if (context.isExpired) {
          return <ExpiredState context={context} />;
        }
        return <ClaimState context={context} token={token!} />;

      case 'claimed':
        // Friend started onboarding or payout process
        if (context.payoutMethod === 'paypal') {
          // PayPal payout was initiated - show pending state
          return <PayPalPendingState context={context} />;
        }
        // Stripe flow
        if (context.stripeAccountStatus === 'active') {
          // Account is ready, transfer should happen automatically
          return <SuccessRedirect context={context} />;
        }
        return <OnboardingState context={context} token={token!} />;

      case 'transferred':
        // Show card-specific transferred state if paid via card
        if (context.payoutMethod === 'card') {
          return <CardTransferredState context={context} />;
        }
        return <TransferredState context={context} />;

      case 'expired':
        // Check if this was a PayPal payout that went unclaimed
        if (context.payoutMethod === 'paypal' && context.paypalBatchId) {
          return <PayPalUnclaimedState context={context} />;
        }
        return <ExpiredState context={context} />;

      default:
        return <ErrorState message="Unknown claim status" />;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.logoHeader}>
          <Text style={styles.logo}>OopsFee</Text>
        </Animated.View>

        {/* Content */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.content}>
          {renderContent()}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxxl,
  },

  // Logo header
  logoHeader: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  logo: {
    ...Typography.h2,
    color: Colors.accent,
    fontFamily: Fonts.rounded,
    letterSpacing: -0.5,
  },

  // Content wrapper
  content: {
    flex: 1,
  },

  // State container
  stateContainer: {
    gap: Spacing.xl,
  },

  // Header section
  header: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  emoji: {
    fontSize: 56,
    marginBottom: Spacing.sm,
  },
  title: {
    ...Typography.h1,
    color: Colors.text,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },

  // Promise card
  promiseCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  promiseLabel: {
    ...Typography.label,
    color: Colors.textTertiary,
  },
  promiseText: {
    ...Typography.h3,
    color: Colors.text,
    fontStyle: 'italic',
    lineHeight: 28,
  },
  promiseNote: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: Spacing.sm,
  },
  promiseStats: {
    flexDirection: 'row',
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statLabel: {
    ...Typography.label,
    color: Colors.textTertiary,
  },
  statValue: {
    ...Typography.bodySemibold,
    color: Colors.text,
  },
  statValueMoney: {
    ...Typography.h2,
    color: Colors.money,
    fontFamily: Fonts.mono,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
  },

  // Amount card (for claim state)
  amountCard: {
    backgroundColor: Colors.moneyDim,
    borderRadius: Radius.xl,
    borderWidth: 2,
    borderColor: Colors.money,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  amountLabel: {
    ...Typography.label,
    color: Colors.money,
  },
  amountValue: {
    fontSize: 48,
    fontWeight: '800',
    color: Colors.money,
    fontFamily: Fonts.mono,
  },
  expiryWarning: {
    ...Typography.caption,
    color: Colors.warning,
    marginTop: Spacing.sm,
  },

  // Countdown
  countdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.warningDim,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  countdownIcon: {
    fontSize: 20,
  },
  countdownText: {
    ...Typography.bodySemibold,
    color: Colors.warning,
  },

  // Info box
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoIcon: {
    fontSize: 20,
  },
  infoText: {
    ...Typography.body,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 22,
  },

  // Status card
  statusCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  statusIcon: {
    fontSize: 20,
  },
  statusIconPending: {
    fontSize: 20,
    opacity: 0.5,
  },
  statusText: {
    ...Typography.body,
    color: Colors.text,
  },
  statusTextPending: {
    ...Typography.body,
    color: Colors.textTertiary,
  },

  // Badges
  successBadge: {
    backgroundColor: Colors.successDim,
    borderRadius: Radius.full,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    alignSelf: 'center',
  },
  successBadgeText: {
    ...Typography.bodySemibold,
    color: Colors.success,
  },
  failedBadge: {
    backgroundColor: Colors.dangerDim,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    alignSelf: 'flex-start',
  },
  failedBadgeText: {
    ...Typography.caption,
    color: Colors.danger,
  },

  // Success card (transferred state)
  successCard: {
    backgroundColor: Colors.moneyDim,
    borderRadius: Radius.xl,
    borderWidth: 2,
    borderColor: Colors.money,
    padding: Spacing.xxl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  successIcon: {
    fontSize: 48,
  },
  successAmount: {
    fontSize: 40,
    fontWeight: '800',
    color: Colors.money,
    fontFamily: Fonts.mono,
  },
  successNote: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  cardSuccessCard: {
    backgroundColor: Colors.accentDim,
    borderRadius: Radius.xl,
    borderWidth: 2,
    borderColor: Colors.accent,
    padding: Spacing.xxl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  cardDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  cardDetailsLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  cardDetailsValue: {
    ...Typography.bodySemibold,
    color: Colors.text,
  },
  cardSuccessNote: {
    ...Typography.caption,
    color: Colors.accent,
    fontWeight: '600',
    marginTop: Spacing.xs,
  },

  // Expired card
  expiredCard: {
    backgroundColor: Colors.dangerDim,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.danger,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  expiredIcon: {
    fontSize: 40,
  },
  expiredText: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // Payout method picker
  methodPickerContainer: {
    gap: Spacing.md,
  },
  methodPickerLabel: {
    ...Typography.label,
    color: Colors.textTertiary,
    marginBottom: Spacing.xs,
  },
  methodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 2,
    padding: Spacing.lg,
  },
  methodOptionDebit: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentDim,
  },
  methodOptionPayPal: {
    borderColor: '#0070ba',
  },
  methodOptionStripe: {
    borderColor: Colors.border,
  },
  methodOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  methodIcon: {
    fontSize: 28,
  },
  methodTextContainer: {
    flex: 1,
  },
  methodTitle: {
    ...Typography.bodySemibold,
    color: Colors.text,
  },
  methodSubtitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  methodBadge: {
    backgroundColor: '#0070ba',
    borderRadius: Radius.full,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  methodBadgeText: {
    ...Typography.caption,
    color: Colors.text,
    fontWeight: '600',
  },
  methodBadgeInstant: {
    backgroundColor: Colors.successDim,
    borderRadius: Radius.full,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  methodBadgeInstantText: {
    ...Typography.caption,
    color: Colors.success,
    fontWeight: '700',
  },
  methodChevron: {
    ...Typography.h3,
    color: Colors.textTertiary,
  },

  // Input card (for PayPal email)
  inputCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  inputLabel: {
    ...Typography.label,
    color: Colors.textTertiary,
  },
  textInput: {
    ...Typography.body,
    color: Colors.text,
    backgroundColor: Colors.bg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginTop: Spacing.xs,
  },
  inputHint: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  cardRowInputs: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  cardInputHalf: {
    flex: 1,
  },
  stripeLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  stripeLoadingText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  stripeCardContainer: {
    marginVertical: Spacing.sm,
  },
  cardErrorText: {
    ...Typography.caption,
    color: Colors.danger,
    marginTop: Spacing.xs,
  },
  feeBreakdownCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  feeRowTotal: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: Spacing.xs,
    paddingTop: Spacing.sm,
  },
  feeLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  feeValue: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  feeLabelTotal: {
    ...Typography.bodySemibold,
    color: Colors.text,
  },
  feeValueTotal: {
    ...Typography.bodySemibold,
    color: Colors.success,
  },

  // Button row
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  backBtn: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.bgCard,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
  },
  backBtnText: {
    ...Typography.bodySemibold,
    color: Colors.textSecondary,
  },
  submitBtn: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    ...Shadows.lg,
  },

  // PayPal pending state
  paypalPendingCard: {
    backgroundColor: 'rgba(0, 112, 186, 0.1)',
    borderRadius: Radius.xl,
    borderWidth: 2,
    borderColor: '#0070ba',
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  paypalEmailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  paypalEmailLabel: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  paypalEmailValue: {
    ...Typography.bodySemibold,
    color: Colors.text,
  },
  paypalStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  paypalStatusText: {
    ...Typography.body,
    color: '#0070ba',
  },

  // Claim button
  claimBtn: {
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  btnGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  claimBtnText: {
    ...Typography.h3,
    color: Colors.text,
    fontFamily: Fonts.rounded,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.6,
  },

  // Disclaimer
  disclaimer: {
    ...Typography.caption,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Error box
  errorBox: {
    backgroundColor: Colors.dangerDim,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  errorText: {
    ...Typography.caption,
    color: Colors.danger,
    textAlign: 'center',
  },

  // Loading state
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xxxl,
  },
  loadingText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },

  // Error state
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxxl,
  },
  errorEmoji: {
    fontSize: 48,
  },
  errorTitle: {
    ...Typography.h2,
    color: Colors.text,
    textAlign: 'center',
  },
  errorSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  homeBtn: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  homeBtnText: {
    ...Typography.bodySemibold,
    color: Colors.accent,
  },
});


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
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { getClaimContext, startClaimOnboarding, type ClaimContext } from '@/lib/claims';

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

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
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
  const stake = formatCurrency(context.stakeCents);

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
  const stake = formatCurrency(context.stakeCents);

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
// ─────────────────────────────────────────────────────────────

function ClaimState({ context, token }: { context: ClaimContext; token: string }) {
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amount = formatCurrency(context.amountCents || context.stakeCents);

  const handleClaim = useCallback(async () => {
    if (claiming) return;

    setClaiming(true);
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
      setClaiming(false);
    }
  }, [token, claiming]);

  return (
    <View style={styles.stateContainer}>
      <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
        <Text style={styles.emoji}>💸</Text>
        <Text style={styles.title}>You've got money waiting!</Text>
        <Text style={styles.subtitle}>
          {context.userName} didn't follow through.{'\n'}
          Claim your {amount} now.
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

      {error && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </Animated.View>
      )}

      <Pressable
        disabled={claiming}
        onPress={handleClaim}
        style={({ pressed }) => [styles.claimBtn, pressed && styles.pressed, claiming && styles.disabled]}
      >
        <LinearGradient
          colors={['#22c55e', '#16a34a']}
          style={styles.btnGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {claiming ? (
            <ActivityIndicator color={Colors.text} />
          ) : (
            <Text style={styles.claimBtnText}>Claim {amount}</Text>
          )}
        </LinearGradient>
      </Pressable>

      <Text style={styles.disclaimer}>
        You'll set up a free Stripe account to receive the money.{'\n'}
        Takes about 2 minutes.
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// ONBOARDING IN PROGRESS STATE
// ─────────────────────────────────────────────────────────────

function OnboardingState({ context, token }: { context: ClaimContext; token: string }) {
  const [resuming, setResuming] = useState(false);
  const amount = formatCurrency(context.amountCents || context.stakeCents);

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
  const amount = formatCurrency(context.amountCents || context.stakeCents);

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
// EXPIRED STATE
// ─────────────────────────────────────────────────────────────

function ExpiredState({ context }: { context: ClaimContext }) {
  const amount = formatCurrency(context.amountCents || context.stakeCents);

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
  const amount = formatCurrency(context.amountCents || context.stakeCents);

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
  const { token, success, refresh } = useLocalSearchParams<{
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
        // Friend started onboarding
        if (context.stripeAccountStatus === 'active') {
          // Account is ready, transfer should happen automatically
          return <SuccessRedirect context={context} />;
        }
        return <OnboardingState context={context} token={token!} />;

      case 'transferred':
        return <TransferredState context={context} />;

      case 'expired':
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


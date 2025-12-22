/**
 * Share Link Page
 *
 * Public route for handling deep links:
 * - oopsfee.app/s/{token}
 *
 * Renders different forms based on link type:
 * - friend: Combined form - pledge money AND/OR write roast message
 * - partner: Approve/reject completion
 */

import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import {
    getShareContext,
    submitPartnerDecision,
    submitRoast,
    submitSponsor,
    type ShareContext,
} from '@/lib/share';

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
// FRIEND FORM (Combined Sponsor + Roast)
// ─────────────────────────────────────────────────────────────

function FriendForm({ context, token }: { context: ShareContext; token: string }) {
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sponsorResult, setSponsorResult] = useState<{ newTotal: number; sponsorCount: number } | null>(null);
  const [roastSubmitted, setRoastSubmitted] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;

    const hasAmount = amount.trim() !== '';
    const hasMessage = message.trim() !== '';

    if (!hasAmount && !hasMessage) {
      setError('Add a pledge amount or write a message (or both!)');
      hapticError();
      return;
    }

    if (!name.trim()) {
      setError('Please enter your name');
      hapticError();
      return;
    }

    if (hasAmount) {
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum < 1 || amountNum > 1000) {
        setError('Amount must be between $1 and $1000');
        hapticError();
        return;
      }
    }

    setSubmitting(true);
    setError(null);
    hapticMedium();

    try {
      // Submit both in parallel if both are provided
      const promises: Promise<unknown>[] = [];

      if (hasAmount) {
        promises.push(
          submitSponsor(token, parseFloat(amount), name.trim()).then((res) => {
            setSponsorResult(res);
          })
        );
      }

      if (hasMessage) {
        promises.push(
          submitRoast(token, message.trim(), name.trim()).then(() => {
            setRoastSubmitted(true);
          })
        );
      }

      await Promise.all(promises);
      setSubmitted(true);
      hapticSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit');
      hapticError();
    } finally {
      setSubmitting(false);
    }
  }, [amount, message, name, token, submitting]);

  if (submitted) {
    return (
      <Animated.View entering={FadeIn.duration(300)} style={styles.successContainer}>
        <Text style={styles.successEmoji}>{sponsorResult && roastSubmitted ? '🔥💸' : sponsorResult ? '💸' : '🔥'}</Text>
        <Text style={styles.successTitle}>
          {sponsorResult && roastSubmitted
            ? 'Double whammy!'
            : sponsorResult
            ? 'Pledge locked in!'
            : 'Message saved!'}
        </Text>
        <Text style={styles.successSubtitle}>
          {sponsorResult
            ? `$${sponsorResult.newTotal.toFixed(0)} total at stake from ${sponsorResult.sponsorCount} sponsor${sponsorResult.sponsorCount !== 1 ? 's' : ''}.`
            : `If ${context.ownerFirstName} fails, your message will be revealed.`}
        </Text>
        {sponsorResult && roastSubmitted && (
          <Text style={styles.successNote}>
            Plus your roast message is locked and loaded.
          </Text>
        )}
        <Text style={styles.successNote}>
          {context.ownerFirstName} will feel the pressure now.
        </Text>
      </Animated.View>
    );
  }

  return (
    <View style={styles.formContainer}>
      <View style={styles.formHeader}>
        <Text style={styles.formEmoji}>🎯</Text>
        <Text style={styles.formTitle}>Hold them accountable</Text>
        <Text style={styles.formSubtitle}>
          Add to {context.ownerFirstName}&apos;s stake and/or leave a message they&apos;ll only see if they fail.
        </Text>
      </View>

      <View style={styles.promisePreview}>
        <Text style={styles.promiseLabel}>THE PROMISE</Text>
        <Text style={styles.promiseText}>&ldquo;{context.promiseText}&rdquo;</Text>
      </View>

      {context.currentSponsorTotal !== undefined && context.currentSponsorTotal > 0 && (
        <View style={styles.currentStake}>
          <Text style={styles.currentStakeLabel}>Current sponsor total</Text>
          <Text style={styles.currentStakeValue}>${context.currentSponsorTotal}</Text>
        </View>
      )}

      {/* Sponsor Section */}
      <View style={styles.sectionDivider}>
        <Text style={styles.sectionTitle}>💸 Add to their stake (optional)</Text>
      </View>

      <View style={styles.inputGroup}>
        <View style={styles.amountInputWrapper}>
          <Text style={styles.dollarSign}>$</Text>
          <TextInput
            style={styles.amountInput}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={Colors.textMuted}
            maxLength={4}
          />
        </View>
        <View style={styles.amountQuickPicks}>
          {[5, 10, 25, 50].map((val) => (
            <Pressable
              key={val}
              style={[styles.quickPick, amount === String(val) && styles.quickPickActive]}
              onPress={() => {
                setAmount(String(val));
                hapticMedium();
              }}
            >
              <Text style={[styles.quickPickText, amount === String(val) && styles.quickPickTextActive]}>
                ${val}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Roast Section */}
      <View style={styles.sectionDivider}>
        <Text style={styles.sectionTitle}>🔥 Leave a roast message (optional)</Text>
      </View>

      {context.hasRoast && (
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>
            ⚠️ Someone already left a message. Yours will replace it.
          </Text>
        </View>
      )}

      <View style={styles.inputGroup}>
        <TextInput
          style={[styles.textInput, styles.textArea]}
          value={message}
          onChangeText={setMessage}
          placeholder="I knew you couldn't do it..."
          placeholderTextColor={Colors.textMuted}
          maxLength={280}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
        <Text style={styles.charCount}>{message.length}/280</Text>
      </View>

      {/* Name (required) */}
      <View style={styles.sectionDivider}>
        <Text style={styles.sectionTitle}>👤 Your name</Text>
      </View>

      <View style={styles.inputGroup}>
        <TextInput
          style={styles.textInput}
          value={name}
          onChangeText={setName}
          placeholder="Who are you?"
          placeholderTextColor={Colors.textMuted}
          maxLength={50}
          autoCapitalize="words"
        />
      </View>

      {error && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </Animated.View>
      )}

      <Pressable
        disabled={submitting}
        onPress={handleSubmit}
        style={({ pressed }) => [styles.submitBtn, pressed && styles.pressed, submitting && styles.disabled]}
      >
        <LinearGradient colors={[Colors.accent, '#0A84FF']} style={styles.btnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Text style={styles.btnText}>
            {submitting
              ? 'Submitting...'
              : amount && message
              ? 'Submit pledge & roast'
              : amount
              ? 'Submit pledge'
              : message
              ? 'Submit roast'
              : 'Submit'}
          </Text>
        </LinearGradient>
      </Pressable>

      <Text style={styles.disclaimer}>
        This is a shame pledge, not real money. It adds social pressure.
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// PARTNER DECISION FORM
// ─────────────────────────────────────────────────────────────

function PartnerDecisionForm({ context, token }: { context: ShareContext; token: string }) {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<'completed' | 'failed' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDecision = useCallback(async (approved: boolean) => {
    if (submitting) return;

    setSubmitting(true);
    setError(null);
    hapticMedium();

    try {
      const res = await submitPartnerDecision(token, approved);
      setResult(res.status);
      setSubmitted(true);
      hapticSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit');
      hapticError();
    } finally {
      setSubmitting(false);
    }
  }, [token, submitting]);

  if (submitted && result) {
    return (
      <Animated.View entering={FadeIn.duration(300)} style={styles.successContainer}>
        <Text style={styles.successEmoji}>{result === 'completed' ? '✅' : '❌'}</Text>
        <Text style={styles.successTitle}>
          {result === 'completed' ? 'Promise completed!' : 'Promise failed'}
        </Text>
        <Text style={styles.successSubtitle}>
          {result === 'completed'
            ? `${context.ownerFirstName} kept their word. Nice!`
            : `${context.ownerFirstName} didn't come through.`}
        </Text>
        <Text style={styles.successNote}>
          Thanks for being an accountability partner.
        </Text>
      </Animated.View>
    );
  }

  if (context.partnerState === 'resolved') {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorEmoji}>⏳</Text>
        <Text style={styles.errorTitle}>Already decided</Text>
        <Text style={styles.errorSubtitle}>
          A decision has already been made for this promise.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.formContainer}>
      <View style={styles.formHeader}>
        <Text style={styles.formEmoji}>👀</Text>
        <Text style={styles.formTitle}>Did they do it?</Text>
        <Text style={styles.formSubtitle}>
          You&apos;re {context.ownerFirstName}&apos;s accountability partner. Verify their promise.
        </Text>
      </View>

      <View style={styles.promisePreview}>
        <Text style={styles.promiseLabel}>THE PROMISE</Text>
        <Text style={styles.promiseText}>&ldquo;{context.promiseText}&rdquo;</Text>
      </View>

      {error && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </Animated.View>
      )}

      <View style={styles.decisionButtons}>
        <Pressable
          disabled={submitting}
          onPress={() => handleDecision(true)}
          style={({ pressed }) => [styles.decisionBtn, styles.approveBtn, pressed && styles.pressed, submitting && styles.disabled]}
        >
          <Text style={styles.decisionEmoji}>✅</Text>
          <Text style={styles.decisionBtnText}>Yes, they did it</Text>
        </Pressable>

        <Pressable
          disabled={submitting}
          onPress={() => handleDecision(false)}
          style={({ pressed }) => [styles.decisionBtn, styles.rejectBtn, pressed && styles.pressed, submitting && styles.disabled]}
        >
          <Text style={styles.decisionEmoji}>❌</Text>
          <Text style={styles.decisionBtnText}>No, they didn&apos;t</Text>
        </Pressable>
      </View>

      {submitting && (
        <View style={styles.submittingOverlay}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      )}
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
      <Text style={styles.loadingText}>Loading...</Text>
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
// MAIN PAGE
// ─────────────────────────────────────────────────────────────

export default function SharePage() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const insets = useSafeAreaInsets();
  const [context, setContext] = useState<ShareContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Invalid link');
      setLoading(false);
      return;
    }

    getShareContext(token)
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

    if (context.status === 'resolved' && context.type !== 'partner') {
      return <ErrorState message="This promise has already been resolved." />;
    }

    if (context.deadlinePassed && context.type !== 'partner') {
      return <ErrorState message="The deadline for this promise has passed." />;
    }

    switch (context.type) {
      case 'friend':
        return <FriendForm context={context} token={token!} />;
      case 'partner':
        return <PartnerDecisionForm context={context} token={token!} />;
      default:
        return <ErrorState message="Unknown link type" />;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.header}>
            <Text style={styles.logo}>OopsFee</Text>
          </Animated.View>

          {/* Content */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.content}>
            {renderContent()}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxxl,
  },

  // Header
  header: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  logo: {
    ...Typography.h2,
    color: Colors.accent,
    fontFamily: Fonts.rounded,
    letterSpacing: -0.5,
  },

  // Content
  content: {
    flex: 1,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },

  // Error
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
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

  // Form
  formContainer: {
    gap: Spacing.lg,
  },
  formHeader: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  formEmoji: {
    fontSize: 48,
    marginBottom: Spacing.sm,
  },
  formTitle: {
    ...Typography.h2,
    color: Colors.text,
    textAlign: 'center',
  },
  formSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // Promise preview
  promisePreview: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  promiseLabel: {
    ...Typography.label,
    color: Colors.textTertiary,
  },
  promiseText: {
    ...Typography.body,
    color: Colors.text,
    fontStyle: 'italic',
  },

  // Current stake
  currentStake: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.warningDim,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  currentStakeLabel: {
    ...Typography.caption,
    color: Colors.warning,
  },
  currentStakeValue: {
    ...Typography.h3,
    color: Colors.warning,
    fontFamily: Fonts.mono,
  },

  // Section dividers for combined form
  sectionDivider: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.bodySemibold,
    color: Colors.textSecondary,
  },

  // Input
  inputGroup: {
    gap: Spacing.xs,
  },
  inputLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginLeft: Spacing.xs,
  },
  textInput: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    ...Typography.body,
    color: Colors.text,
  },
  textArea: {
    minHeight: 100,
    paddingTop: Spacing.md,
  },
  charCount: {
    ...Typography.caption,
    color: Colors.textMuted,
    textAlign: 'right',
    marginTop: Spacing.xs,
  },

  // Amount input
  amountInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  dollarSign: {
    ...Typography.h2,
    color: Colors.textSecondary,
    marginRight: Spacing.xs,
  },
  amountInput: {
    ...Typography.h2,
    color: Colors.text,
    flex: 1,
  },
  amountQuickPicks: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  quickPick: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
  },
  quickPickActive: {
    backgroundColor: Colors.accentDim,
    borderColor: Colors.accent,
  },
  quickPickText: {
    ...Typography.bodySemibold,
    color: Colors.textSecondary,
  },
  quickPickTextActive: {
    color: Colors.accent,
  },

  // Warning/Error boxes
  warningBox: {
    backgroundColor: Colors.warningDim,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  warningText: {
    ...Typography.caption,
    color: Colors.warning,
    textAlign: 'center',
  },
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

  // Submit button
  submitBtn: {
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  btnGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    ...Typography.bodySemibold,
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
  },

  // Success state
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  successEmoji: {
    fontSize: 64,
    marginBottom: Spacing.md,
  },
  successTitle: {
    ...Typography.h2,
    color: Colors.text,
    textAlign: 'center',
  },
  successSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  successNote: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.md,
  },

  // Partner decision buttons
  decisionButtons: {
    gap: Spacing.md,
  },
  decisionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 2,
  },
  approveBtn: {
    backgroundColor: Colors.successDim,
    borderColor: Colors.success,
  },
  rejectBtn: {
    backgroundColor: Colors.dangerDim,
    borderColor: Colors.danger,
  },
  decisionEmoji: {
    fontSize: 28,
  },
  decisionBtnText: {
    ...Typography.bodySemibold,
    color: Colors.text,
  },
  submittingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.lg,
  },
});


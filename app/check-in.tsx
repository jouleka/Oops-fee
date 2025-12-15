import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LoadingState } from '@/components/ui/loading-state';
import { CHECKIN_COPY } from '@/constants/content';
import { Colors, Fonts, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { usePromiseStore } from '@/context/promise-store';
import {
  hasCheckedInToday,
  recordCheckIn,
  computeStats,
  getTodaysCheckIn,
} from '@/lib/stats/store';
import type { UserStats, CheckInRecord } from '@/lib/promises/types';

function hapticLight() {
  Haptics.selectionAsync().catch(() => {});
}

function hapticMedium() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

function hapticSuccess() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

// ─────────────────────────────────────────────────────────────
// PROMISE CARD FOR CHECK-IN
// ─────────────────────────────────────────────────────────────

function PromisePreview({
  text,
  stake,
  index,
}: {
  text: string;
  stake: number;
  index: number;
}) {
  return (
    <Animated.View
      entering={FadeInDown.delay(100 + index * 50).duration(250)}
      style={styles.promisePreview}
    >
      <Text style={styles.promiseText} numberOfLines={2}>
        {text}
      </Text>
      <View style={styles.promiseStake}>
        <Text style={styles.promiseStakeText}>${stake}</Text>
      </View>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────
// STREAK DISPLAY
// ─────────────────────────────────────────────────────────────

function StreakBadge({ streak }: { streak: number }) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (streak > 0) {
      scale.value = withRepeat(
        withSequence(
          withSpring(1.05, { damping: 8 }),
          withSpring(1, { damping: 8 })
        ),
        -1,
        true
      );
    }
  }, [streak, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (streak === 0) return null;

  return (
    <Animated.View
      entering={FadeIn.delay(200).duration(300)}
      style={[styles.streakBadge, animStyle]}
    >
      <Text style={styles.streakEmoji}>🔥</Text>
      <Text style={styles.streakText}>
        {CHECKIN_COPY.streakPrefix} {streak} {CHECKIN_COPY.streakSuffix}
      </Text>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────
// CONFIRMATION STATE
// ─────────────────────────────────────────────────────────────

function CheckInConfirmation({
  committed,
  streak,
  onClose,
}: {
  committed: boolean;
  streak: number;
  onClose: () => void;
}) {
  return (
    <View style={styles.confirmationContainer}>
      <Animated.View entering={FadeInUp.duration(400)} style={styles.confirmationContent}>
        <Text style={styles.confirmationEmoji}>{committed ? '✓' : '💀'}</Text>
        <Text style={styles.confirmationTitle}>
          {committed ? 'Checked in!' : 'Noted.'}
        </Text>
        <Text style={styles.confirmationSubtitle}>
          {committed ? CHECKIN_COPY.confirmed : CHECKIN_COPY.failed}
        </Text>

        {committed && streak > 0 && (
          <Animated.View entering={FadeIn.delay(200).duration(300)} style={styles.confirmationStreak}>
            <Text style={styles.confirmationStreakText}>
              🔥 {streak}-day check-in streak
            </Text>
          </Animated.View>
        )}

        <Pressable
          onPress={() => {
            hapticLight();
            onClose();
          }}
          style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
        >
          <Text style={styles.closeButtonText}>Continue</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// ALREADY CHECKED IN STATE
// ─────────────────────────────────────────────────────────────

function AlreadyCheckedIn({
  checkIn,
  stats,
  onClose,
}: {
  checkIn: CheckInRecord;
  stats: UserStats | null;
  onClose: () => void;
}) {
  return (
    <View style={styles.alreadyContainer}>
      <Animated.View entering={FadeIn.duration(300)} style={styles.alreadyContent}>
        <Text style={styles.alreadyEmoji}>✓</Text>
        <Text style={styles.alreadyTitle}>Already checked in today</Text>
        <Text style={styles.alreadySubtitle}>
          {checkIn.committed
            ? "You confirmed you're on track. Now go prove it."
            : "You said you failed. The honesty is noted."}
        </Text>

        {stats && stats.checkInStreak > 0 && (
          <View style={styles.alreadyStreak}>
            <Text style={styles.alreadyStreakText}>
              🔥 {stats.checkInStreak}-day streak
            </Text>
          </View>
        )}

        <Pressable
          onPress={() => {
            hapticLight();
            onClose();
          }}
          style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
        >
          <Text style={styles.closeButtonText}>Got it</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────

export default function CheckInScreen() {
  const insets = useSafeAreaInsets();
  const { promises, isHydrated, setPromiseStatus } = usePromiseStore();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);
  const [todaysCheckIn, setTodaysCheckIn] = useState<CheckInRecord | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [lastCommitted, setLastCommitted] = useState(false);
  const [working, setWorking] = useState(false);

  // Keep promises in a ref to avoid stale closures in callbacks
  const promisesRef = useRef(promises);
  useEffect(() => { promisesRef.current = promises; }, [promises]);

  // Get active promises
  const activePromises = useMemo(
    () => promises.filter((p) => p.status === 'active' && p.deadlineAt > Date.now()),
    [promises]
  );

  const totalAtStake = useMemo(
    () => activePromises.reduce((sum, p) => sum + p.stake, 0),
    [activePromises]
  );

  // Load initial state
  useEffect(() => {
    if (!isHydrated) return;

    const loadState = async () => {
      const [checked, existing, computed] = await Promise.all([
        hasCheckedInToday(),
        getTodaysCheckIn(),
        computeStats(promises),
      ]);

      setAlreadyCheckedIn(checked);
      setTodaysCheckIn(existing);
      setStats(computed);
      setLoading(false);
    };

    loadState();
  }, [isHydrated, promises]);

  const handleCommit = useCallback(async (committed: boolean) => {
    if (working) return;
    setWorking(true);
    hapticMedium();

    // Use ref to get latest promises and avoid stale closure
    const currentActive = promisesRef.current.filter((p) => p.status === 'active' && p.deadlineAt > Date.now());
    const activeIds = currentActive.map((p) => p.id);
    await recordCheckIn(committed, activeIds);

    // If user says they failed and there's only one active promise, mark it failed
    if (!committed && currentActive.length === 1) {
      await setPromiseStatus(currentActive[0].id, 'failed');
    }

    // Refresh stats with latest promises from ref
    const newStats = await computeStats(promisesRef.current);
    setStats(newStats);

    setLastCommitted(committed);
    setShowConfirmation(true);
    setWorking(false);

    if (committed) {
      hapticSuccess();
    }
  }, [working, setPromiseStatus]);

  const handleClose = useCallback(() => {
    hapticLight();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/home');
    }
  }, []);

  // Loading state
  if (!isHydrated || loading) {
    return <LoadingState title="Loading check-in…" subtitle="Preparing your daily moment of truth." />;
  }

  // Already checked in today
  if (alreadyCheckedIn && todaysCheckIn && !showConfirmation) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <AlreadyCheckedIn checkIn={todaysCheckIn} stats={stats} onClose={handleClose} />
      </View>
    );
  }

  // Confirmation screen after check-in
  if (showConfirmation) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <CheckInConfirmation
          committed={lastCommitted}
          streak={stats?.checkInStreak ?? 0}
          onClose={handleClose}
        />
      </View>
    );
  }

  // No active promises
  if (activePromises.length === 0) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.emptyContainer}>
          <Animated.View entering={FadeIn.duration(300)} style={styles.emptyContent}>
            <Text style={styles.emptyEmoji}>😴</Text>
            <Text style={styles.emptyTitle}>Nothing to check in on</Text>
            <Text style={styles.emptySubtitle}>
              No active promises. Either you're crushing it, or you haven't started.
            </Text>
            <Pressable
              onPress={handleClose}
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
            >
              <Text style={styles.closeButtonText}>Back to home</Text>
            </Pressable>
          </Animated.View>
        </View>
      </View>
    );
  }

  // Main check-in UI
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
          <Text style={styles.title}>{CHECKIN_COPY.title}</Text>
          <Text style={styles.subtitle}>{CHECKIN_COPY.subtitle}</Text>
        </Animated.View>

        {/* Streak badge */}
        {stats && <StreakBadge streak={stats.checkInStreak} />}

        {/* Total at stake */}
        <Animated.View entering={FadeInDown.delay(100).duration(280)} style={styles.stakeCard}>
          <Text style={styles.stakeLabel}>AT STAKE</Text>
          <Text style={styles.stakeAmount}>${totalAtStake}</Text>
          <Text style={styles.stakeHint}>
            {activePromises.length} active promise{activePromises.length > 1 ? 's' : ''}
          </Text>
        </Animated.View>

        {/* Promise list */}
        <View style={styles.promiseList}>
          {activePromises.slice(0, 3).map((p, i) => (
            <PromisePreview key={p.id} text={p.text} stake={p.stake} index={i} />
          ))}
          {activePromises.length > 3 && (
            <Animated.View entering={FadeIn.delay(250).duration(200)} style={styles.morePromises}>
              <Text style={styles.morePromisesText}>
                +{activePromises.length - 3} more
              </Text>
            </Animated.View>
          )}
        </View>

        {/* Missed check-in warning */}
        {stats && stats.missedCheckIns > 0 && (
          <Animated.View entering={FadeIn.delay(300).duration(280)} style={styles.warningCard}>
            <Text style={styles.warningIcon}>⚠️</Text>
            <View style={styles.warningContent}>
              <Text style={styles.warningText}>
                {stats.missedCheckIns === 1
                  ? CHECKIN_COPY.missedYesterday
                  : CHECKIN_COPY.missedMultiple.replace('{n}', String(stats.missedCheckIns))}
              </Text>
              <Text style={styles.warningHint}>{CHECKIN_COPY.autoFailWarning}</Text>
            </View>
          </Animated.View>
        )}

        {/* Action buttons */}
        <Animated.View entering={FadeInDown.delay(350).duration(280)} style={styles.actions}>
          <Pressable
            disabled={working}
            onPress={() => handleCommit(true)}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.primaryButtonPressed,
              working && styles.buttonDisabled,
            ]}
          >
            <LinearGradient
              colors={[Colors.success, '#2EC44F']}
              style={styles.buttonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.buttonText}>{CHECKIN_COPY.yesButton}</Text>
            </LinearGradient>
          </Pressable>

          <Pressable
            disabled={working}
            onPress={() => handleCommit(false)}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.secondaryButtonPressed,
              working && styles.buttonDisabled,
            ]}
          >
            <Text style={styles.secondaryButtonText}>{CHECKIN_COPY.noButton}</Text>
          </Pressable>
        </Animated.View>

        {/* Footer hint */}
        <Animated.View entering={FadeIn.delay(450).duration(300)} style={styles.footer}>
          <Text style={styles.footerText}>
            Tap honestly. The app remembers.
          </Text>
        </Animated.View>
      </ScrollView>

      {/* Close button */}
      <Pressable
        onPress={handleClose}
        style={({ pressed }) => [
          styles.closeIcon,
          { top: insets.top + Spacing.lg },
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.closeIconText}>✕</Text>
      </Pressable>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xxxl,
    gap: Spacing.xl,
  },

  // Header
  header: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.xl,
  },
  title: {
    ...Typography.h1,
    color: Colors.text,
    fontFamily: Fonts.rounded,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textTertiary,
    textAlign: 'center',
  },

  // Streak badge
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.warningDim,
    borderWidth: 1,
    borderColor: Colors.warning + '44',
    borderRadius: Radius.full,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    alignSelf: 'center',
  },
  streakEmoji: {
    fontSize: 18,
  },
  streakText: {
    ...Typography.bodySemibold,
    color: Colors.warning,
  },

  // Stake card
  stakeCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  stakeLabel: {
    ...Typography.label,
    color: Colors.textMuted,
  },
  stakeAmount: {
    ...Typography.displayMedium,
    color: Colors.danger,
    fontFamily: Fonts.rounded,
  },
  stakeHint: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },

  // Promise list
  promiseList: {
    gap: Spacing.sm,
  },
  promisePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  promiseText: {
    flex: 1,
    ...Typography.bodyMedium,
    color: Colors.text,
  },
  promiseStake: {
    backgroundColor: Colors.dangerDim,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: Radius.sm,
  },
  promiseStakeText: {
    ...Typography.caption,
    color: Colors.danger,
    fontFamily: Fonts.mono,
    fontWeight: '600',
  },
  morePromises: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  morePromisesText: {
    ...Typography.caption,
    color: Colors.textMuted,
  },

  // Warning card
  warningCard: {
    flexDirection: 'row',
    gap: Spacing.md,
    backgroundColor: Colors.dangerDim,
    borderWidth: 1,
    borderColor: Colors.danger + '33',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  warningIcon: {
    fontSize: 20,
  },
  warningContent: {
    flex: 1,
    gap: 4,
  },
  warningText: {
    ...Typography.bodyMedium,
    color: Colors.danger,
  },
  warningHint: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },

  // Actions
  actions: {
    gap: Spacing.md,
    paddingTop: Spacing.md,
  },
  primaryButton: {
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  primaryButtonPressed: {
    transform: [{ scale: 0.98 }],
  },
  buttonGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    ...Typography.bodySemibold,
    color: Colors.text,
    fontFamily: Fonts.rounded,
  },
  secondaryButton: {
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonPressed: {
    backgroundColor: Colors.bgCardHover,
  },
  secondaryButtonText: {
    ...Typography.bodySemibold,
    color: Colors.textSecondary,
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingTop: Spacing.md,
  },
  footerText: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },

  // Close button
  closeIcon: {
    position: 'absolute',
    right: Spacing.xl,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIconText: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  pressed: { opacity: 0.8 },

  // Confirmation state
  confirmationContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  confirmationContent: {
    alignItems: 'center',
    gap: Spacing.lg,
  },
  confirmationEmoji: {
    fontSize: 64,
    marginBottom: Spacing.md,
  },
  confirmationTitle: {
    ...Typography.h1,
    color: Colors.text,
    fontFamily: Fonts.rounded,
  },
  confirmationSubtitle: {
    ...Typography.body,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  confirmationStreak: {
    backgroundColor: Colors.warningDim,
    borderWidth: 1,
    borderColor: Colors.warning + '44',
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  confirmationStreakText: {
    ...Typography.bodySemibold,
    color: Colors.warning,
  },
  closeButton: {
    marginTop: Spacing.xl,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxl,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  closeButtonText: {
    ...Typography.bodySemibold,
    color: Colors.text,
  },

  // Already checked in
  alreadyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  alreadyContent: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  alreadyEmoji: {
    fontSize: 48,
    color: Colors.success,
    marginBottom: Spacing.sm,
  },
  alreadyTitle: {
    ...Typography.h2,
    color: Colors.text,
    fontFamily: Fonts.rounded,
  },
  alreadySubtitle: {
    ...Typography.body,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  alreadyStreak: {
    marginTop: Spacing.sm,
  },
  alreadyStreakText: {
    ...Typography.bodySemibold,
    color: Colors.warning,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyContent: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    ...Typography.h2,
    color: Colors.text,
    fontFamily: Fonts.rounded,
  },
  emptySubtitle: {
    ...Typography.body,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
});


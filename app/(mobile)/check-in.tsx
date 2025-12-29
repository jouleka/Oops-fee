import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LoadingState } from '@/components/ui/loading-state';
import { CHECKIN_COPY } from '@/constants/content';
import { usePromiseStore } from '@/context/promise-store';
import type { CheckInRecord, UserStats } from '@/lib/promises/types';
import {
  computeStats,
  getTodaysCheckIn,
  hasCheckedInToday,
  recordCheckIn,
} from '@/lib/stats/store';

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
      className="flex-row items-center justify-between bg-card rounded-lg border border-border p-lg gap-md"
    >
      <Text className="flex-1 text-body-medium text-white" numberOfLines={2}>
        {text}
      </Text>
      <View className="bg-danger-dim py-1 px-2.5 rounded-sm">
        <Text className="text-caption text-danger font-mono font-semibold">${stake}</Text>
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
        withSequence(withSpring(1.05, { damping: 8 }), withSpring(1, { damping: 8 })),
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
      style={animStyle}
      className="flex-row items-center justify-center gap-sm bg-warning-dim border border-warning/[0.27] rounded-full py-sm px-lg self-center"
    >
      <Text className="text-lg">🔥</Text>
      <Text className="text-body-semibold text-warning">
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
    <View className="flex-1 items-center justify-center px-xl">
      <Animated.View entering={FadeInUp.duration(400)} className="items-center gap-lg">
        <Text className="text-[64px] mb-md">{committed ? '✓' : '💀'}</Text>
        <Text className="text-h1 text-white font-rounded">{committed ? 'Checked in!' : 'Noted.'}</Text>
        <Text className="text-body text-text-tertiary text-center">
          {committed ? CHECKIN_COPY.confirmed : CHECKIN_COPY.failed}
        </Text>

        {committed && streak > 0 && (
          <Animated.View
            entering={FadeIn.delay(200).duration(300)}
            className="bg-warning-dim border border-warning/[0.27] rounded-lg py-md px-xl"
          >
            <Text className="text-body-semibold text-warning">🔥 {streak}-day check-in streak</Text>
          </Animated.View>
        )}

        <Pressable
          onPress={() => {
            hapticLight();
            onClose();
          }}
          className="mt-xl py-md px-xxl rounded-full bg-card border border-border active:opacity-80"
        >
          <Text className="text-body-semibold text-white">Continue</Text>
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
    <View className="flex-1 items-center justify-center px-xl">
      <Animated.View entering={FadeIn.duration(300)} className="items-center gap-md">
        <Text className="text-[48px] text-success mb-sm">✓</Text>
        <Text className="text-h2 text-white font-rounded">Already checked in today</Text>
        <Text className="text-body text-text-tertiary text-center">
          {checkIn.committed
            ? "You confirmed you're on track. Now go prove it."
            : 'You said you failed. The honesty is noted.'}
        </Text>

        {stats && stats.checkInStreak > 0 && (
          <View className="mt-sm">
            <Text className="text-body-semibold text-warning">🔥 {stats.checkInStreak}-day streak</Text>
          </View>
        )}

        <Pressable
          onPress={() => {
            hapticLight();
            onClose();
          }}
          className="mt-xl py-md px-xxl rounded-full bg-card border border-border active:opacity-80"
        >
          <Text className="text-body-semibold text-white">Got it</Text>
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
  useEffect(() => {
    promisesRef.current = promises;
  }, [promises]);

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

  const handleCommit = useCallback(
    async (committed: boolean) => {
      if (working) return;
      setWorking(true);
      hapticMedium();

      // Use ref to get latest promises and avoid stale closure
      const currentActive = promisesRef.current.filter(
        (p) => p.status === 'active' && p.deadlineAt > Date.now()
      );
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
    },
    [working, setPromiseStatus]
  );

  const handleClose = useCallback(() => {
    hapticLight();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(mobile)/home');
    }
  }, []);

  // Loading state
  if (!isHydrated || loading) {
    return <LoadingState title="Loading check-in…" subtitle="Preparing your daily moment of truth." />;
  }

  // Already checked in today
  if (alreadyCheckedIn && todaysCheckIn && !showConfirmation) {
    return (
      <View className="flex-1 bg-black" style={{ paddingTop: insets.top }}>
        <AlreadyCheckedIn checkIn={todaysCheckIn} stats={stats} onClose={handleClose} />
      </View>
    );
  }

  // Confirmation screen after check-in
  if (showConfirmation) {
    return (
      <View className="flex-1 bg-black" style={{ paddingTop: insets.top }}>
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
      <View className="flex-1 bg-black" style={{ paddingTop: insets.top }}>
        <View className="flex-1 items-center justify-center px-xl">
          <Animated.View entering={FadeIn.duration(300)} className="items-center gap-md">
            <Text className="text-[48px] mb-sm">😴</Text>
            <Text className="text-h2 text-white font-rounded">Nothing to check in on</Text>
            <Text className="text-body text-text-tertiary text-center">
              No active promises. Either you&apos;re crushing it, or you haven&apos;t started.
            </Text>
            <Pressable
              onPress={handleClose}
              className="mt-xl py-md px-xxl rounded-full bg-card border border-border active:opacity-80"
            >
              <Text className="text-body-semibold text-white">Back to home</Text>
            </Pressable>
          </Animated.View>
        </View>
      </View>
    );
  }

  // Main check-in UI
  return (
    <View className="flex-1 bg-black" style={{ paddingTop: insets.top }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 48, gap: 24, paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeIn.duration(300)} className="items-center gap-sm pt-xl">
          <Text className="text-h1 text-white font-rounded text-center">{CHECKIN_COPY.title}</Text>
          <Text className="text-body text-text-tertiary text-center">{CHECKIN_COPY.subtitle}</Text>
        </Animated.View>

        {/* Streak badge */}
        {stats && <StreakBadge streak={stats.checkInStreak} />}

        {/* Total at stake */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(280)}
          className="bg-card rounded-xl border border-border p-xl items-center gap-sm"
        >
          <Text className="text-label text-text-muted">AT STAKE</Text>
          <Text className="text-display-md text-danger font-rounded">${totalAtStake}</Text>
          <Text className="text-caption text-text-tertiary">
            {activePromises.length} active promise{activePromises.length > 1 ? 's' : ''}
          </Text>
        </Animated.View>

        {/* Promise list */}
        <View className="gap-sm">
          {activePromises.slice(0, 3).map((p, i) => (
            <PromisePreview key={p.id} text={p.text} stake={p.stake} index={i} />
          ))}
          {activePromises.length > 3 && (
            <Animated.View entering={FadeIn.delay(250).duration(200)} className="items-center py-sm">
              <Text className="text-caption text-text-muted">+{activePromises.length - 3} more</Text>
            </Animated.View>
          )}
        </View>

        {/* Missed check-in warning */}
        {stats && stats.missedCheckIns > 0 && (
          <Animated.View
            entering={FadeIn.delay(300).duration(280)}
            className="flex-row gap-md bg-danger-dim border border-danger/20 rounded-lg p-lg"
          >
            <Text className="text-xl">⚠️</Text>
            <View className="flex-1 gap-1">
              <Text className="text-body-medium text-danger">
                {stats.missedCheckIns === 1
                  ? CHECKIN_COPY.missedYesterday
                  : CHECKIN_COPY.missedMultiple.replace('{n}', String(stats.missedCheckIns))}
              </Text>
              <Text className="text-caption text-text-tertiary">{CHECKIN_COPY.autoFailWarning}</Text>
            </View>
          </Animated.View>
        )}

        {/* Action buttons */}
        <Animated.View entering={FadeInDown.delay(350).duration(280)} className="gap-md pt-md">
          <Pressable
            disabled={working}
            onPress={() => handleCommit(true)}
            className={`h-14 rounded-[28px] overflow-hidden shadow-lg active:scale-[0.98] ${
              working ? 'opacity-60' : ''
            }`}
          >
            <LinearGradient
              colors={['#34C759', '#2EC44F']}
              className="flex-1 items-center justify-center"
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text className="text-body-semibold text-white font-rounded">{CHECKIN_COPY.yesButton}</Text>
            </LinearGradient>
          </Pressable>

          <Pressable
            disabled={working}
            onPress={() => handleCommit(false)}
            className={`h-14 rounded-[28px] bg-card border border-border items-center justify-center active:bg-card-hover ${
              working ? 'opacity-60' : ''
            }`}
          >
            <Text className="text-body-semibold text-text-secondary">{CHECKIN_COPY.noButton}</Text>
          </Pressable>
        </Animated.View>

        {/* Footer hint */}
        <Animated.View entering={FadeIn.delay(450).duration(300)} className="items-center pt-md">
          <Text className="text-caption text-text-muted italic">Tap honestly. The app remembers.</Text>
        </Animated.View>
      </ScrollView>

      {/* Close button */}
      <Pressable
        onPress={handleClose}
        style={{ top: insets.top + 16 }}
        className="absolute right-xl w-9 h-9 rounded-[18px] bg-card border border-border items-center justify-center active:opacity-80"
      >
        <Text className="text-text-secondary text-base font-semibold">✕</Text>
      </Pressable>
    </View>
  );
}

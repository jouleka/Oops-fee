/**
 * HomeScreen - Main dashboard for OopsFee
 * Shows active promises, stats, and quick actions
 */

import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  CheckInBanner,
  EmptyState,
  FAB,
  FABWrapper,
  GlowingStake,
  PromiseCard,
  StreakBadge,
} from '@/components/home';
import { BlockedBanner, PaymentBanner } from '@/components/payment';
import { LoadingState } from '@/components/ui/loading-state';
import { COPY, type PromiseTemplate } from '@/constants/content';
import { useAuth } from '@/context/auth';
import { usePromiseStore } from '@/context/promise-store';
import { hapticLight, hapticSuccess } from '@/lib/haptics';
import { scheduleWeeklyMomentum } from '@/lib/notifications/scheduler';
import type { UserStats } from '@/lib/promises/types';
import { computeStats, hasCheckedInToday, recordCheckIn } from '@/lib/stats/store';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { promises, isHydrated, setPromiseStatus, updatePromise } = usePromiseStore();
  const { isAuthenticated, profile, user, paymentState } = useAuth();
  const [now, setNow] = useState(() => Date.now());

  const [showCheckInBanner, setShowCheckInBanner] = useState(false);
  const [stats, setStats] = useState<UserStats | null>(null);
  const hasCheckedRef = useRef(false);

  const promisesRef = useRef(promises);
  useEffect(() => {
    promisesRef.current = promises;
  }, [promises]);

  // Update time every 30s
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Redirect to username setup if user is authenticated but has no username
  // Cast to access username column (added in migration 014)
  const extendedProfile = profile as typeof profile & { username?: string | null };
  const hasCheckedUsernameRef = useRef(false);
  
  useEffect(() => {
    // Only check once per session, and only when profile is loaded
    if (!isAuthenticated || !profile || hasCheckedUsernameRef.current) return;
    hasCheckedUsernameRef.current = true;

    // If user already has a username, nothing to do
    if (extendedProfile?.username) return;

    // Redirect to username setup - the screen will determine if skip is allowed
    // based on presence of pending invite token
    router.replace('/(mobile)/setup-username');
  }, [isAuthenticated, profile, extendedProfile?.username]);

  // Load stats and check-in status on mount
  useEffect(() => {
    if (!isHydrated || hasCheckedRef.current) return;
    hasCheckedRef.current = true;

    const loadStatsAndCheckIn = async () => {
      // Always compute stats for streak display
      const computed = await computeStats(promises);
      setStats(computed);

      // Schedule weekly momentum notification with latest stats
      scheduleWeeklyMomentum(computed).catch(console.error);

      // Only show check-in banner if has active promises and hasn't checked in today
      const activePromises = promises.filter(
        (p) => p.status === 'active' && p.deadlineAt > Date.now()
      );
      if (activePromises.length === 0) return;

      const alreadyCheckedIn = await hasCheckedInToday();
      if (!alreadyCheckedIn) {
        setShowCheckInBanner(true);
      }
    };

    loadStatsAndCheckIn();
  }, [isHydrated, promises]);

  // Computed lists
  const overdue = useMemo(
    () =>
      promises
        .filter((p) => p.status === 'expired' || (p.status === 'active' && p.deadlineAt <= now))
        .sort((a, b) => a.deadlineAt - b.deadlineAt),
    [now, promises]
  );

  const active = useMemo(
    () =>
      promises
        .filter((p) => p.status === 'active' && p.deadlineAt > now)
        .sort((a, b) => a.deadlineAt - b.deadlineAt),
    [now, promises]
  );

  const atRiskStake = useMemo(
    () =>
      promises.reduce(
        (sum, p) => (p.status === 'active' || p.status === 'expired' ? sum + p.stake : sum),
        0
      ),
    [promises]
  );

  // Find promises that require SCA resolution (payment authentication needed)
  const promisesRequiringSCA = useMemo(
    () => promises.filter((p) => p.paymentStatus === 'requires_action' && p.paymentClientSecret),
    [promises]
  );

  // Handlers
  const handleAddPromise = useCallback((template?: PromiseTemplate) => {
    router.push(
      template
        ? { pathname: '/(mobile)/promise/new', params: { templateId: template.id } }
        : { pathname: '/(mobile)/promise/new' }
    );
  }, []);

  const handleCheckInCommit = useCallback(
    async (committed: boolean) => {
      const currentActive = promisesRef.current.filter(
        (p) => p.status === 'active' && p.deadlineAt > Date.now()
      );
      const activeIds = currentActive.map((p) => p.id);
      await recordCheckIn(committed, activeIds);

      if (!committed && currentActive.length === 1) {
        await setPromiseStatus(currentActive[0].id, 'failed');
      }

      setShowCheckInBanner(false);

      // Refresh stats after check-in
      const computed = await computeStats(promisesRef.current);
      setStats(computed);

      // Reschedule weekly momentum with updated stats
      scheduleWeeklyMomentum(computed).catch(console.error);

      if (committed) {
        hapticSuccess();
      }
    },
    [setPromiseStatus]
  );

  const handleProfilePress = useCallback(() => {
    hapticLight();
    router.push('/(mobile)/profile' as never);
  }, []);

  // Handle SCA payment completion - refresh promises to get updated status
  const handlePaymentComplete = useCallback(
    (promiseId: string) => {
      // Update local state immediately for optimistic UI
      // The actual status will be confirmed via realtime subscription or next sync
      updatePromise(promiseId, {
        paymentStatus: 'succeeded',
        paymentClientSecret: undefined,
      }).catch(console.error);
    },
    [updatePromise]
  );

  // Loading state
  if (!isHydrated) {
    return <LoadingState title="Loading promises…" subtitle="Fetching your consequences." />;
  }

  const hasPromises = active.length > 0 || overdue.length > 0;
  const streak = stats?.checkInStreak ?? 0;

  return (
    <View className="flex-1 bg-black" style={{ paddingTop: insets.top }}>
      {/* Header with Streak */}
      <Animated.View
        entering={FadeInDown.duration(350)}
        className="flex-row items-center justify-between px-6 pt-4 pb-3"
      >
        <View className="flex-1">
          <Text className="text-[28px] leading-[34px] font-bold tracking-tight text-white font-rounded">
            {COPY.headerTitle}
          </Text>
          <Text className="text-[13px] leading-[18px] font-medium text-white/45 mt-0.5">
            {COPY.headerSubtitle}
          </Text>
        </View>

        <View className="flex-row items-center gap-3">
          {/* Streak - Prominent like Duolingo, taps to check-in view */}
          <Pressable
            onPress={() => {
              hapticLight();
              router.push('/(mobile)/check-in');
            }}
            className="active:opacity-80 active:scale-95"
          >
            <StreakBadge streak={streak} size="normal" alwaysShow />
          </Pressable>

          {/* Profile */}
          <Pressable
            onPress={handleProfilePress}
            className={`w-11 h-11 rounded-full border items-center justify-center active:scale-95 active:bg-white/[0.06] ${
              isAuthenticated
                ? 'bg-success/15 border-success/25'
                : 'bg-white/[0.04] border-white/[0.08]'
            }`}
          >
            {isAuthenticated ? (
              <Text className="text-lg font-bold text-success font-rounded">
                {profile?.display_name?.charAt(0)?.toUpperCase() ||
                  user?.email?.charAt(0)?.toUpperCase() ||
                  '?'}
              </Text>
            ) : (
              <Text className="text-lg opacity-50">👤</Text>
            )}
          </Pressable>
        </View>
      </Animated.View>

      {/* Content */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Payment Blocked Banner - Must resolve before creating new stakes */}
        {paymentState.paymentBlocked && (
          <View className="mb-3">
            <BlockedBanner
              failedPaymentCount={paymentState.failedPaymentCount}
            />
          </View>
        )}

        {/* SCA Resolution Banners - Each promise requiring payment auth */}
        {promisesRequiringSCA.map((p) => (
          <View key={`sca-${p.id}`} className="mb-3">
            <PaymentBanner
              clientSecret={p.paymentClientSecret!}
              promiseText={p.text}
              stakeAmount={p.stake} // in dollars
              onPaymentComplete={() => handlePaymentComplete(p.id)}
            />
          </View>
        ))}

        {/* Check-in Banner - Only shows when needed */}
        {showCheckInBanner && active.length > 0 && (
          <CheckInBanner
            totalAtStake={atRiskStake}
            streak={streak}
            onCommit={handleCheckInCommit}
          />
        )}

        <GlowingStake amount={atRiskStake} />

        {/* Quick Stats - Just numbers, no streak */}
        <QuickStatsBar
          activeCount={active.length}
          overdueCount={overdue.length}
          atRisk={atRiskStake}
        />

        {!hasPromises ? (
          <EmptyState onSelectTemplate={handleAddPromise} />
        ) : (
          <View className="gap-6">
            {/* Overdue section - shows first for urgency */}
            {overdue.length > 0 && (
              <View className="gap-3">
                <View className="flex-row items-center gap-2 mb-2">
                  <View className="w-2 h-2 rounded-full bg-danger" />
                  <Text className="text-[11px] leading-[14px] font-semibold tracking-wider uppercase text-danger flex-1">
                    OVERDUE
                  </Text>
                  <Text className="text-[13px] leading-[18px] font-semibold text-danger font-mono">
                    {overdue.length}
                  </Text>
                </View>
                {overdue.map((p, i) => (
                  <PromiseCard key={p.id} promise={p} index={i} now={now} />
                ))}
              </View>
            )}

            {/* Active section */}
            {active.length > 0 && (
              <View className="gap-3">
                <Text className="text-[11px] leading-[14px] font-semibold tracking-wider uppercase text-white/30 mb-2 ml-1">
                  ACTIVE
                </Text>
                {active.map((p, i) => (
                  <PromiseCard key={p.id} promise={p} index={overdue.length + i} now={now} />
                ))}
              </View>
            )}
          </View>
        )}

        {/* Quick Actions - Stats, Leaderboard, Graveyard */}
        {hasPromises && (
          <Animated.View entering={FadeIn.delay(400).duration(300)} className="flex-row gap-3 mt-8 mb-4">
            <QuickAction
              icon="📊"
              label="Stats"
              onPress={() => router.push('/(mobile)/stats')}
            />
            <QuickAction
              icon="🏆"
              label="Leaderboard"
              onPress={() => router.push('/(mobile)/leaderboard')}
            />
            <QuickAction
              icon="⚰️"
              label="Graveyard"
              onPress={() => router.push('/(mobile)/graveyard')}
            />
          </Animated.View>
        )}

        {/* Footer */}
        <View className="items-center pt-12 pb-4">
          <Text className="text-[13px] leading-[18px] font-medium text-white/30">
            {COPY.version} · {COPY.tagline}
          </Text>
        </View>
      </ScrollView>

      {/* FAB */}
      <FABWrapper bottom={insets.bottom}>
        <FAB onPress={() => handleAddPromise()} />
      </FABWrapper>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// INLINE COMPONENTS
// ─────────────────────────────────────────────────────────────

function QuickStatsBar({
  activeCount,
  overdueCount,
  atRisk,
}: {
  activeCount: number;
  overdueCount: number;
  atRisk: number;
}) {
  if (activeCount === 0 && overdueCount === 0) return null;

  return (
    <Animated.View
      entering={FadeIn.delay(80).duration(280)}
      className="flex-row bg-white/[0.04] rounded-lg border border-white/[0.08] py-3 px-4 mb-6 items-center"
    >
      <View className="flex-1 items-center gap-0.5">
        <Text className="text-[22px] leading-[28px] font-semibold tracking-tight text-white font-rounded">
          {activeCount}
        </Text>
        <Text className="text-[13px] leading-[18px] font-medium text-white/30">Active</Text>
      </View>

      {overdueCount > 0 && (
        <>
          <View className="w-px h-7 bg-white/[0.08] mx-2" />
          <View className="flex-1 items-center gap-0.5">
            <Text className="text-[22px] leading-[28px] font-semibold tracking-tight text-danger font-rounded">
              {overdueCount}
            </Text>
            <Text className="text-[13px] leading-[18px] font-medium text-white/30">Overdue</Text>
          </View>
        </>
      )}

      <View className="w-px h-7 bg-white/[0.08] mx-2" />
      <View className="flex-1 items-center gap-0.5">
        <Text
          className={`text-[22px] leading-[28px] font-semibold tracking-tight font-rounded ${
            atRisk > 0 ? 'text-danger' : 'text-white'
          }`}
        >
          ${atRisk}
        </Text>
        <Text className="text-[13px] leading-[18px] font-medium text-white/30">At risk</Text>
      </View>
    </Animated.View>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        hapticLight();
        onPress();
      }}
      className="flex-1 bg-white/[0.04] rounded-lg border border-white/[0.08] py-3 items-center gap-1 active:bg-white/[0.06] active:border-white/15"
    >
      <Text className="text-xl">{icon}</Text>
      <Text className="text-[13px] leading-[18px] font-medium text-white/70">{label}</Text>
    </Pressable>
  );
}

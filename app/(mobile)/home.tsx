/**
 * HomeScreen - Main dashboard for OopsFee
 * Shows active promises, stats, and quick actions
 */

import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { Colors, Fonts, Radius, Spacing, Typography } from '@/constants/theme';
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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header with Streak */}
      <Animated.View entering={FadeInDown.duration(350)} style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>{COPY.headerTitle}</Text>
          <Text style={styles.headerSubtitle}>{COPY.headerSubtitle}</Text>
        </View>

        <View style={styles.headerRight}>
          {/* Streak - Prominent like Duolingo, taps to check-in view */}
          <Pressable
            onPress={() => {
              hapticLight();
              router.push('/(mobile)/check-in');
            }}
            style={({ pressed }) => [pressed && styles.pressed]}
          >
            <StreakBadge streak={streak} size="normal" alwaysShow />
          </Pressable>

          {/* Profile */}
          <Pressable
            onPress={handleProfilePress}
            style={({ pressed }) => [
              styles.profileButton,
              isAuthenticated && styles.profileButtonAuth,
              pressed && styles.profileButtonPressed,
            ]}
          >
            {isAuthenticated ? (
              <Text style={styles.profileInitial}>
                {profile?.display_name?.charAt(0)?.toUpperCase() ||
                  user?.email?.charAt(0)?.toUpperCase() ||
                  '?'}
              </Text>
            ) : (
              <Text style={styles.profileGuest}>👤</Text>
            )}
          </Pressable>
        </View>
      </Animated.View>

      {/* Content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Payment Blocked Banner - Must resolve before creating new stakes */}
        {paymentState.paymentBlocked && (
          <View style={styles.paymentBannerContainer}>
            <BlockedBanner
              failedPaymentCount={paymentState.failedPaymentCount}
            />
          </View>
        )}

        {/* SCA Resolution Banners - Each promise requiring payment auth */}
        {promisesRequiringSCA.map((p) => (
          <View key={`sca-${p.id}`} style={styles.paymentBannerContainer}>
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
          <View style={styles.promisesList}>
            {/* Overdue section - shows first for urgency */}
            {overdue.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.overdueDot} />
                  <Text style={styles.overdueTitle}>OVERDUE</Text>
                  <Text style={styles.overdueCount}>{overdue.length}</Text>
                </View>
                {overdue.map((p, i) => (
                  <PromiseCard key={p.id} promise={p} index={i} now={now} />
                ))}
              </View>
            )}

            {/* Active section */}
            {active.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>ACTIVE</Text>
                {active.map((p, i) => (
                  <PromiseCard key={p.id} promise={p} index={overdue.length + i} now={now} />
                ))}
              </View>
            )}
          </View>
        )}

        {/* Quick Actions - Stats, Leaderboard, Graveyard */}
        {hasPromises && (
          <Animated.View entering={FadeIn.delay(400).duration(300)} style={styles.quickActions}>
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
        <View style={styles.footer}>
          <Text style={styles.footerText}>
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
    <Animated.View entering={FadeIn.delay(80).duration(280)} style={styles.statsBar}>
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{activeCount}</Text>
        <Text style={styles.statLabel}>Active</Text>
      </View>

      {overdueCount > 0 && (
        <>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, styles.statDanger]}>{overdueCount}</Text>
            <Text style={styles.statLabel}>Overdue</Text>
          </View>
        </>
      )}

      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={[styles.statValue, atRisk > 0 && styles.statDanger]}>${atRisk}</Text>
        <Text style={styles.statLabel}>At risk</Text>
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
      style={({ pressed }) => [styles.quickAction, pressed && styles.quickActionPressed]}
    >
      <Text style={styles.quickActionIcon}>{icon}</Text>
      <Text style={styles.quickActionText}>{label}</Text>
    </Pressable>
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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  headerTitle: {
    ...Typography.h1,
    color: Colors.text,
    fontFamily: Fonts.rounded,
  },
  headerSubtitle: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 2,
  },

  // Profile Button
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileButtonAuth: {
    backgroundColor: Colors.successDim,
    borderColor: Colors.success + '44',
  },
  profileButtonPressed: {
    transform: [{ scale: 0.95 }],
    backgroundColor: Colors.bgCardHover,
  },
  profileInitial: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.success,
    fontFamily: Fonts.rounded,
  },
  profileGuest: {
    fontSize: 18,
    opacity: 0.5,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
  },

  // Payment Banners
  paymentBannerContainer: {
    marginBottom: Spacing.md,
  },

  // Stats Bar
  statsBar: {
    flexDirection: 'row',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    ...Typography.h2,
    color: Colors.text,
    fontFamily: Fonts.rounded,
  },
  statDanger: {
    color: Colors.danger,
  },
  statLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.sm,
  },

  // Promises list
  promisesList: {
    gap: Spacing.xl,
  },
  section: {
    gap: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.label,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  overdueDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.danger,
  },
  overdueTitle: {
    ...Typography.label,
    color: Colors.danger,
    flex: 1,
  },
  overdueCount: {
    ...Typography.caption,
    color: Colors.danger,
    fontFamily: Fonts.mono,
    fontWeight: '600',
  },

  // Quick Actions
  quickActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xxl,
    marginBottom: Spacing.lg,
  },
  quickAction: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  quickActionPressed: {
    backgroundColor: Colors.bgCardHover,
    borderColor: Colors.borderFocus,
  },
  quickActionIcon: {
    fontSize: 20,
  },
  quickActionText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '500',
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingTop: Spacing.xxxl,
    paddingBottom: Spacing.lg,
  },
  footerText: {
    ...Typography.caption,
    color: Colors.textMuted,
  },

  // Utilities
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  },
});

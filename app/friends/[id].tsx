/**
 * Friend Profile Screen
 *
 * View a friend's profile, active promises, stats, and recent history.
 */

import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts, Radius, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import {
  getFriendProfile,
  getInitials,
  type FriendHistoryItem,
  type FriendPromise,
  type FriendStats,
  type GetFriendProfileResponse,
} from '@/lib/friends';
import { getTimeRemaining as getTimeRemainingShared, type Urgency } from '@/lib/promises/time';

const URGENCY_COLORS: Record<Urgency, string> = {
  low: Colors.urgencyLow,
  medium: Colors.urgencyMedium,
  high: Colors.urgencyCritical,
  critical: Colors.urgencyCritical,
};

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function hapticLight() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}


function formatDate(dateString: string | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getSuccessRateColor(rate: number): string {
  if (rate >= 80) return Colors.success;
  if (rate >= 50) return Colors.warning;
  if (rate > 0) return Colors.danger;
  return Colors.textMuted;
}

function getStreakEmoji(count: number): string {
  if (count >= 100) return '👑';
  if (count >= 30) return '⚡';
  if (count >= 7) return '🔥';
  if (count >= 3) return '✨';
  return '';
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

export default function FriendProfileScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isAuthenticated } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GetFriendProfileResponse | null>(null);

  // Fetch friend profile
  const fetchData = useCallback(async () => {
    if (!id) return;

    try {
      const response = await getFriendProfile(id);
      setData(response);
      setError(null);
    } catch (err) {
      console.error('[FriendProfile] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    }
  }, [id]);

  // Initial load
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      await fetchData();
      setIsLoading(false);
    };
    load();
  }, [fetchData]);

  // Pull to refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  };

  const handleBack = () => {
    hapticLight();
    router.back();
  };

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Header onBack={handleBack} />
        <View style={styles.centerContent}>
          <Text style={styles.errorEmoji}>🔒</Text>
          <Text style={styles.errorTitle}>Sign in required</Text>
          <Text style={styles.errorSubtitle}>Sign in to view friend profiles</Text>
        </View>
      </View>
    );
  }

  // Loading
  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Header onBack={handleBack} />
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  // Error
  if (error || !data) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Header onBack={handleBack} />
        <View style={styles.centerContent}>
          <Text style={styles.errorEmoji}>😕</Text>
          <Text style={styles.errorTitle}>Couldn&apos;t load profile</Text>
          <Text style={styles.errorSubtitle}>{error || 'Something went wrong'}</Text>
          <Pressable
            onPress={() => {
              hapticLight();
              fetchData();
            }}
            style={({ pressed }) => [styles.retryButton, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const { profile, activePromises, stats, recentHistory } = data;
  const displayName = profile.display_name || profile.username || 'User';
  const initial = getInitials(profile);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Header onBack={handleBack} title={displayName} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xxl }]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.textMuted}
          />
        }
      >
        {/* Profile Card */}
        <Animated.View entering={FadeInDown.duration(300)} style={styles.profileCard}>
          <LinearGradient
            colors={[Colors.accent, '#0A7FD4']}
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>{initial}</Text>
          </LinearGradient>

          <View style={styles.profileInfo}>
            <Text style={styles.displayName}>{displayName}</Text>
            {profile.username && (
              <Text style={styles.username}>@{profile.username}</Text>
            )}
          </View>
        </Animated.View>

        {/* Stats Overview */}
        <StatsSection stats={stats} />

        {/* Active Promises */}
        <ActivePromisesSection promises={activePromises} friendName={displayName} />

        {/* Recent History */}
        <HistorySection history={recentHistory} />

        {/* Footer */}
        <Animated.View entering={FadeIn.delay(600).duration(400)} style={styles.footer}>
          <Text style={styles.footerText}>
            Friends hold each other accountable. 💪
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// HEADER
// ─────────────────────────────────────────────────────────────

function Header({ onBack, title }: { onBack: () => void; title?: string }) {
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack}
        style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.backIcon}>←</Text>
      </Pressable>

      <Text style={styles.headerTitle} numberOfLines={1}>
        {title || 'Profile'}
      </Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// STATS SECTION
// ─────────────────────────────────────────────────────────────

function StatsSection({ stats }: { stats: FriendStats }) {
  const shouldGlow = stats.currentStreak >= 7;
  const glow = useSharedValue(0);

  useEffect(() => {
    if (!shouldGlow) return;
    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000 }),
        withTiming(0, { duration: 2000 })
      ),
      -1,
      true
    );
  }, [glow, shouldGlow]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glow.value, [0, 1], [0.3, 0.6]),
    transform: [{ scale: interpolate(glow.value, [0, 1], [0.9, 1.1]) }],
  }));

  return (
    <Animated.View entering={FadeInDown.delay(100).duration(300)} style={styles.section}>
      <Text style={styles.sectionTitle}>STATS</Text>

      {/* Streak Hero */}
      <View style={styles.streakCard}>
        {shouldGlow && (
          <Animated.View style={[styles.streakGlow, glowStyle]}>
            <View style={styles.streakGlowCircle} />
          </Animated.View>
        )}
        <View style={styles.streakContent}>
          <Text style={styles.streakLabel}>CURRENT STREAK</Text>
          <View style={styles.streakNumberRow}>
            <Text style={[styles.streakNumber, stats.currentStreak > 0 && styles.streakNumberActive]}>
              {stats.currentStreak}
            </Text>
            {stats.currentStreak > 0 && (
              <Text style={styles.streakEmoji}>{getStreakEmoji(stats.currentStreak)}</Text>
            )}
          </View>
        </View>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>SUCCESS RATE</Text>
          <Text style={[styles.statValue, { color: getSuccessRateColor(stats.successRate) }]}>
            {stats.successRate}%
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>LONGEST STREAK</Text>
          <Text style={[styles.statValue, stats.longestStreak > 0 && { color: Colors.accent }]}>
            {stats.longestStreak}
          </Text>
        </View>
      </View>

      {/* Money Stats */}
      <View style={styles.moneyGrid}>
        <View style={styles.moneyCard}>
          <Text style={styles.moneyLabel}>SAVED</Text>
          <Text style={[styles.moneyValue, styles.moneyValueGreen]}>${stats.totalSaved}</Text>
        </View>
        <View style={styles.moneyCard}>
          <Text style={styles.moneyLabel}>LOST</Text>
          <Text style={[styles.moneyValue, styles.moneyValueRed]}>${stats.totalLost}</Text>
        </View>
        <View style={styles.moneyCard}>
          <Text style={styles.moneyLabel}>TOTAL</Text>
          <Text style={styles.moneyValue}>{stats.totalPromises}</Text>
        </View>
      </View>

      {/* Promise Breakdown */}
      <View style={styles.breakdownRow}>
        <View style={styles.breakdownItem}>
          <Text style={[styles.breakdownValue, { color: Colors.success }]}>{stats.completed}</Text>
          <Text style={styles.breakdownLabel}>Kept</Text>
        </View>
        <View style={styles.breakdownDivider} />
        <View style={styles.breakdownItem}>
          <Text style={[styles.breakdownValue, { color: Colors.danger }]}>{stats.failed}</Text>
          <Text style={styles.breakdownLabel}>Broken</Text>
        </View>
      </View>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────
// ACTIVE PROMISES SECTION
// ─────────────────────────────────────────────────────────────

function ActivePromisesSection({ promises, friendName }: { promises: FriendPromise[]; friendName: string }) {
  if (promises.length === 0) {
    return (
      <Animated.View entering={FadeInDown.delay(200).duration(300)} style={styles.section}>
        <Text style={styles.sectionTitle}>ACTIVE PROMISES</Text>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>🎯</Text>
          <Text style={styles.emptyText}>No active promises right now</Text>
          <Text style={styles.emptyHint}>{friendName} is taking a break</Text>
        </View>
      </Animated.View>
    );
  }

  // Sort by deadline - most urgent first
  const sorted = [...promises].sort(
    (a, b) => new Date(a.deadline_at).getTime() - new Date(b.deadline_at).getTime()
  );

  return (
    <Animated.View entering={FadeInDown.delay(200).duration(300)} style={styles.section}>
      <Text style={styles.sectionTitle}>ACTIVE PROMISES ({promises.length})</Text>
      <View style={styles.promisesList}>
        {sorted.map((promise, index) => (
          <PromiseCard key={promise.id} promise={promise} index={index} />
        ))}
      </View>
    </Animated.View>
  );
}

function PromiseCard({ promise, index }: { promise: FriendPromise; index: number }) {
  const deadlineMs = new Date(promise.deadline_at).getTime();
  const { label, urgency } = getTimeRemainingShared(deadlineMs);
  const color = URGENCY_COLORS[urgency];

  return (
    <Animated.View
      entering={FadeInDown.delay(250 + index * 50).duration(250)}
      style={styles.promiseCard}
    >
      <View style={[styles.promiseAccent, { backgroundColor: color }]} />
      <View style={styles.promiseBody}>
        <Text style={styles.promiseText} numberOfLines={2}>
          {promise.text}
        </Text>
        <View style={styles.promiseMeta}>
          <View style={styles.promiseStakeRow}>
            <Text style={styles.promiseStake}>${promise.stake}</Text>
            {promise.sponsor_count > 0 && (
              <View style={styles.sponsorBadge}>
                <Text style={styles.sponsorText}>+${(promise.sponsor_total / 100).toFixed(0)}</Text>
              </View>
            )}
            {promise.has_roast && <Text style={styles.roastEmoji}>🔥</Text>}
          </View>
          <View style={[styles.timeBadge, { backgroundColor: color + '18' }]}>
            <Text style={[styles.timeText, { color }]}>{label}</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────
// HISTORY SECTION
// ─────────────────────────────────────────────────────────────

function HistorySection({ history }: { history: FriendHistoryItem[] }) {
  if (history.length === 0) {
    return null;
  }

  return (
    <Animated.View entering={FadeInDown.delay(350).duration(300)} style={styles.section}>
      <Text style={styles.sectionTitle}>RECENT HISTORY</Text>
      <View style={styles.historyList}>
        {history.map((item, index) => (
          <HistoryCard key={item.id} item={item} index={index} />
        ))}
      </View>
    </Animated.View>
  );
}

function HistoryCard({ item, index }: { item: FriendHistoryItem; index: number }) {
  const isSuccess = item.status === 'completed';
  const icon = isSuccess ? '✓' : '✕';
  const color = isSuccess ? Colors.success : Colors.danger;
  const date = formatDate(item.completed_at || item.failed_at);

  return (
    <Animated.View
      entering={FadeInDown.delay(400 + index * 40).duration(200)}
      style={styles.historyCard}
    >
      <View style={[styles.historyIcon, { backgroundColor: color + '20' }]}>
        <Text style={[styles.historyIconText, { color }]}>{icon}</Text>
      </View>
      <View style={styles.historyContent}>
        <Text style={styles.historyText} numberOfLines={1}>{item.text}</Text>
        <View style={styles.historyMeta}>
          <Text style={styles.historyStake}>${item.stake}</Text>
          {date && <Text style={styles.historyDate}>{date}</Text>}
        </View>
      </View>
    </Animated.View>
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
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 20,
    color: Colors.text,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.text,
    fontFamily: Fonts.rounded,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: Spacing.md,
  },
  headerSpacer: {
    width: 40,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.xl,
  },

  // Center content (loading/error)
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  loadingText: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: Spacing.sm,
  },
  errorEmoji: {
    fontSize: 48,
    marginBottom: Spacing.sm,
  },
  errorTitle: {
    ...Typography.h3,
    color: Colors.text,
    textAlign: 'center',
  },
  errorSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },
  retryButton: {
    marginTop: Spacing.md,
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
  },
  retryButtonText: {
    ...Typography.bodySemibold,
    color: Colors.text,
  },

  // Profile Card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
  },
  profileInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  displayName: {
    ...Typography.h2,
    color: Colors.text,
    fontFamily: Fonts.rounded,
  },
  username: {
    ...Typography.caption,
    color: Colors.accent,
    fontFamily: Fonts.mono,
  },

  // Section
  section: {
    gap: Spacing.md,
  },
  sectionTitle: {
    ...Typography.label,
    color: Colors.textMuted,
    marginLeft: Spacing.xs,
  },

  // Streak Card
  streakCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  streakGlow: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakGlowCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.warning,
  },
  streakContent: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  streakLabel: {
    ...Typography.label,
    color: Colors.textMuted,
  },
  streakNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  streakNumber: {
    ...Typography.displayMedium,
    color: Colors.textTertiary,
    fontFamily: Fonts.rounded,
  },
  streakNumberActive: {
    color: Colors.warning,
  },
  streakEmoji: {
    fontSize: 32,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statLabel: {
    ...Typography.label,
    color: Colors.textMuted,
    fontSize: 9,
  },
  statValue: {
    ...Typography.h2,
    color: Colors.text,
    fontFamily: Fonts.rounded,
  },

  // Money Grid
  moneyGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  moneyCard: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  moneyLabel: {
    ...Typography.label,
    color: Colors.textMuted,
    fontSize: 9,
  },
  moneyValue: {
    ...Typography.h3,
    color: Colors.text,
    fontFamily: Fonts.mono,
  },
  moneyValueGreen: {
    color: Colors.success,
  },
  moneyValueRed: {
    color: Colors.danger,
  },

  // Breakdown Row
  breakdownRow: {
    flexDirection: 'row',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
  },
  breakdownItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  breakdownValue: {
    ...Typography.h2,
    color: Colors.text,
    fontFamily: Fonts.rounded,
  },
  breakdownLabel: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  breakdownDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },

  // Empty Card
  emptyCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyEmoji: {
    fontSize: 36,
  },
  emptyText: {
    ...Typography.body,
    color: Colors.text,
    textAlign: 'center',
  },
  emptyHint: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Promises List
  promisesList: {
    gap: Spacing.sm,
  },
  promiseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  promiseAccent: {
    width: 4,
    alignSelf: 'stretch',
  },
  promiseBody: {
    flex: 1,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  promiseText: {
    ...Typography.bodyMedium,
    color: Colors.text,
  },
  promiseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  promiseStakeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  promiseStake: {
    ...Typography.bodySemibold,
    color: Colors.danger,
    fontFamily: Fonts.mono,
  },
  sponsorBadge: {
    backgroundColor: Colors.successDim,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  sponsorText: {
    ...Typography.caption,
    color: Colors.success,
    fontFamily: Fonts.mono,
    fontSize: 11,
  },
  roastEmoji: {
    fontSize: 14,
  },
  timeBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: Radius.sm,
  },
  timeText: {
    ...Typography.caption,
    fontWeight: '600',
  },

  // History List
  historyList: {
    gap: Spacing.sm,
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  historyIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyIconText: {
    fontSize: 14,
    fontWeight: '700',
  },
  historyContent: {
    flex: 1,
    gap: 2,
  },
  historyText: {
    ...Typography.body,
    color: Colors.text,
  },
  historyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  historyStake: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontFamily: Fonts.mono,
  },
  historyDate: {
    ...Typography.caption,
    color: Colors.textMuted,
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  footerText: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});

import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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

import { LoadingState } from '@/components/ui/loading-state';
import { STATS_COPY, STREAK_BADGES } from '@/constants/content';
import { Colors, Fonts, Radius, Spacing, Typography } from '@/constants/theme';
import { usePromiseStore } from '@/context/promise-store';
import type { UserStats } from '@/lib/promises/types';
import { computeStats } from '@/lib/stats/store';

function hapticLight() {
  Haptics.selectionAsync().catch(() => {});
}

// ─────────────────────────────────────────────────────────────
// ANIMATED COMPONENTS
// ─────────────────────────────────────────────────────────────

function GlowingStreak({ count }: { count: number }) {
  const glow = useSharedValue(0);
  const shouldGlow = count >= 7;

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
    opacity: interpolate(glow.value, [0, 1], [0.3, 0.7]),
    transform: [{ scale: interpolate(glow.value, [0, 1], [0.9, 1.15]) }],
  }));

  const getStreakEmoji = () => {
    if (count >= 100) return '👑';
    if (count >= 30) return '⚡';
    if (count >= 7) return '🔥';
    if (count >= 3) return '✨';
    return '';
  };

  return (
    <View style={styles.streakContainer}>
      {shouldGlow && (
        <Animated.View style={[styles.streakGlow, glowStyle]}>
          <View style={styles.streakGlowCircle} />
        </Animated.View>
      )}
      <View style={styles.streakContent}>
        <Text style={styles.streakLabel}>{STATS_COPY.streakTitle}</Text>
        <View style={styles.streakNumberRow}>
          <Text style={[styles.streakNumber, count > 0 && styles.streakNumberActive]}>
            {count}
          </Text>
          {count > 0 && <Text style={styles.streakEmoji}>{getStreakEmoji()}</Text>}
        </View>
        <Text style={styles.streakHint}>
          {count === 0 ? STATS_COPY.streakEmpty : STATS_COPY.streakActive}
        </Text>
      </View>
    </View>
  );
}

function StatCard({
  label,
  value,
  suffix,
  color,
  delay = 0,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  color?: string;
  delay?: number;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(280)} style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color ? { color } : null]}>
        {value}
        {suffix && <Text style={styles.statSuffix}>{suffix}</Text>}
      </Text>
    </Animated.View>
  );
}

function StreakBadge({
  emoji,
  label,
  description,
  lockedHint,
  unlocked,
  delay = 0,
}: {
  emoji: string;
  label: string;
  description: string;
  lockedHint: string;
  unlocked: boolean;
  delay?: number;
}) {
  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(280)}
      style={[styles.badgeCard, !unlocked && styles.badgeCardLocked]}
    >
      <Text style={[styles.badgeEmoji, !unlocked && styles.badgeEmojiLocked]}>{emoji}</Text>
      <View style={styles.badgeContent}>
        <Text style={[styles.badgeLabel, !unlocked && styles.badgeLabelLocked]}>{label}</Text>
        <Text style={[styles.badgeDesc, !unlocked && styles.badgeDescLocked]}>
          {unlocked ? description : lockedHint}
        </Text>
      </View>
      {unlocked && <Text style={styles.badgeCheck}>✓</Text>}
    </Animated.View>
  );
}

function MultiplierCard({ stats }: { stats: UserStats }) {
  const actualMultiplier = stats.failureMultiplier;
  const completionsNeeded = Math.max(0, 3 - stats.consecutiveCompletions);

  if (actualMultiplier <= 1) {
    return (
      <Animated.View entering={FadeInDown.delay(350).duration(280)} style={styles.multiplierCard}>
        <View style={styles.multiplierHeader}>
          <Text style={styles.multiplierLabel}>{STATS_COPY.multiplierTitle}</Text>
          <Text style={styles.multiplierValue}>1×</Text>
        </View>
        <Text style={styles.multiplierHint}>{STATS_COPY.multiplier1x}</Text>
      </Animated.View>
    );
  }

  const getMessage = () => {
    if (actualMultiplier >= 8) return STATS_COPY.multiplier8x;
    if (actualMultiplier >= 4) return STATS_COPY.multiplier4x;
    return STATS_COPY.multiplier2x;
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(350).duration(280)}
      style={[styles.multiplierCard, styles.multiplierCardDanger]}
    >
      <View style={styles.multiplierHeader}>
        <Text style={styles.multiplierLabel}>{STATS_COPY.multiplierTitle}</Text>
        <Text style={[styles.multiplierValue, styles.multiplierValueDanger]}>
          {actualMultiplier}×
        </Text>
      </View>
      <Text style={[styles.multiplierHint, styles.multiplierHintDanger]}>{getMessage()}</Text>
      {completionsNeeded > 0 && (
        <View style={styles.multiplierProgress}>
          <Text style={styles.multiplierProgressText}>
            Complete {completionsNeeded} more to reset
          </Text>
          <View style={styles.multiplierProgressBar}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={[
                  styles.multiplierProgressDot,
                  i < stats.consecutiveCompletions && styles.multiplierProgressDotFilled,
                ]}
              />
            ))}
          </View>
        </View>
      )}
    </Animated.View>
  );
}

function CheckInStreakCard({ streak, missed }: { streak: number; missed: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(400).duration(280)} style={styles.checkInCard}>
      <View style={styles.checkInHeader}>
        <Text style={styles.checkInLabel}>{STATS_COPY.checkInTitle}</Text>
        <View style={styles.checkInValueRow}>
          <Text style={[styles.checkInValue, streak > 0 && styles.checkInValueActive]}>
            {streak}
          </Text>
          <Text style={styles.checkInDays}>days</Text>
        </View>
      </View>
      <Text style={styles.checkInHint}>
        {streak === 0 ? STATS_COPY.checkInEmpty : STATS_COPY.checkInActive}
      </Text>
      {missed > 0 && (
        <View style={styles.missedWarning}>
          <Text style={styles.missedWarningIcon}>⚠️</Text>
          <Text style={styles.missedWarningText}>
            {missed} missed check-in{missed > 1 ? 's' : ''}
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const { promises, isHydrated } = usePromiseStore();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isHydrated) return;

    const loadStats = async () => {
      const computed = await computeStats(promises);
      setStats(computed);
      setLoading(false);
    };

    loadStats();
  }, [isHydrated, promises]);

  const handleBack = useCallback(() => {
    hapticLight();
    router.back();
  }, []);

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 80) return Colors.success;
    if (rate >= 50) return Colors.warning;
    if (rate > 0) return Colors.danger;
    return Colors.textMuted;
  };

  const getSuccessMessage = (rate: number) => {
    if (rate >= 80) return STATS_COPY.successHigh;
    if (rate >= 50) return STATS_COPY.successMedium;
    if (rate > 0) return STATS_COPY.successLow;
    return STATS_COPY.successNone;
  };

  const unlockedBadges = useMemo(() => {
    if (!stats) return new Set<number>();
    return new Set(
      STREAK_BADGES.filter((b) => stats.longestStreak >= b.level).map((b) => b.level)
    );
  }, [stats]);

  if (!isHydrated || loading) {
    return <LoadingState title="Crunching numbers…" subtitle="Quantifying your commitment." />;
  }

  if (!stats || stats.totalPromises === 0) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <Text style={styles.backButtonText}>‹</Text>
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{STATS_COPY.title}</Text>
            <Text style={styles.headerSubtitle}>{STATS_COPY.subtitle}</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📊</Text>
          <Text style={styles.emptyTitle}>{STATS_COPY.emptyTitle}</Text>
          <Text style={styles.emptySubtitle}>{STATS_COPY.emptySubtitle}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <Text style={styles.backButtonText}>‹</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{STATS_COPY.title}</Text>
          <Text style={styles.headerSubtitle}>{STATS_COPY.subtitle}</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Streak Hero */}
        <Animated.View entering={FadeIn.duration(400)}>
          <GlowingStreak count={stats.currentStreak} />
        </Animated.View>

        {/* Core Stats Row */}
        <View style={styles.statsRow}>
          <StatCard
            label="SUCCESS RATE"
            value={stats.successRate}
            suffix="%"
            color={getSuccessRateColor(stats.successRate)}
            delay={100}
          />
          <StatCard
            label="LONGEST STREAK"
            value={stats.longestStreak}
            color={stats.longestStreak > 0 ? Colors.accent : undefined}
            delay={150}
          />
        </View>

        {/* Success message */}
        <Animated.View entering={FadeInDown.delay(200).duration(280)} style={styles.messageCard}>
          <Text style={styles.messageText}>{getSuccessMessage(stats.successRate)}</Text>
        </Animated.View>

        {/* Money Stats */}
        <Animated.View entering={FadeInDown.delay(250).duration(280)} style={styles.moneySection}>
          <Text style={styles.sectionLabel}>THE MONEY</Text>
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
              <Text style={styles.moneyLabel}>TOTAL BET</Text>
              <Text style={styles.moneyValue}>${stats.totalAtRisk}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Promise Breakdown */}
        <Animated.View entering={FadeInDown.delay(300).duration(280)} style={styles.breakdownSection}>
          <Text style={styles.sectionLabel}>PROMISES</Text>
          <View style={styles.breakdownRow}>
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownValue}>{stats.totalPromises}</Text>
              <Text style={styles.breakdownLabel}>Total</Text>
            </View>
            <View style={styles.breakdownDivider} />
            <View style={styles.breakdownItem}>
              <Text style={[styles.breakdownValue, { color: Colors.success }]}>{stats.completed}</Text>
              <Text style={styles.breakdownLabel}>Kept</Text>
            </View>
            <View style={styles.breakdownDivider} />
            <View style={styles.breakdownItem}>
              <Text style={[styles.breakdownValue, { color: Colors.danger }]}>{stats.failed + stats.expired}</Text>
              <Text style={styles.breakdownLabel}>Broken</Text>
            </View>
          </View>
        </Animated.View>

        {/* Failure Multiplier */}
        <MultiplierCard stats={stats} />

        {/* Check-in Streak */}
        <CheckInStreakCard streak={stats.checkInStreak} missed={stats.missedCheckIns} />

        {/* Badges */}
        <View style={styles.badgesSection}>
          <Text style={styles.sectionLabel}>{STATS_COPY.badgesTitle}</Text>
          <Text style={styles.sectionSubtitle}>{STATS_COPY.badgesSubtitle}</Text>

          {STREAK_BADGES.map((badge, i) => (
            <StreakBadge
              key={badge.level}
              emoji={badge.emoji}
              label={badge.label}
              description={badge.description}
              lockedHint={badge.lockedHint}
              unlocked={unlockedBadges.has(badge.level)}
              delay={450 + i * 50}
            />
          ))}
        </View>

        {/* Leaderboard CTA */}
        <Animated.View entering={FadeInDown.delay(550).duration(280)}>
          <Pressable
            onPress={() => {
              hapticLight();
              router.push('/(mobile)/leaderboard');
            }}
            style={({ pressed }) => [styles.leaderboardCard, pressed && styles.leaderboardCardPressed]}
          >
            <View style={styles.leaderboardContent}>
              <Text style={styles.leaderboardEmoji}>🏆</Text>
              <View style={styles.leaderboardInfo}>
                <Text style={styles.leaderboardTitle}>Leaderboard</Text>
                <Text style={styles.leaderboardSubtitle}>See how you stack up against friends</Text>
              </View>
            </View>
            <Text style={styles.leaderboardChevron}>›</Text>
          </Pressable>
        </Animated.View>

        {/* Footer */}
        <Animated.View entering={FadeIn.delay(600).duration(400)} style={styles.footer}>
          <Text style={styles.footerText}>
            Numbers don&apos;t lie. But they do judge silently.
          </Text>
        </Animated.View>
      </ScrollView>
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

  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  headerCenter: { flex: 1, gap: 2 },
  headerTitle: { ...Typography.h2, color: Colors.text, fontFamily: Fonts.rounded },
  headerSubtitle: { ...Typography.caption, color: Colors.textTertiary },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 28,
    lineHeight: 28,
    color: Colors.textSecondary,
    marginTop: -2,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    gap: Spacing.xl,
  },

  // Streak hero
  streakContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    position: 'relative',
  },
  streakGlow: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakGlowCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: Colors.warning,
  },
  streakContent: {
    alignItems: 'center',
  },
  streakLabel: {
    ...Typography.label,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
  },
  streakNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  streakNumber: {
    ...Typography.displayLarge,
    color: Colors.textTertiary,
  },
  streakNumberActive: {
    color: Colors.warning,
  },
  streakEmoji: {
    fontSize: 40,
  },
  streakHint: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: Spacing.sm,
    fontStyle: 'italic',
  },

  // Stats row
  statsRow: {
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
  },
  statValue: {
    ...Typography.displaySmall,
    color: Colors.text,
    fontFamily: Fonts.rounded,
  },
  statSuffix: {
    fontSize: 20,
    color: Colors.textSecondary,
  },

  // Message card
  messageCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  messageText: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
  },

  // Money section
  moneySection: {
    gap: Spacing.md,
  },
  sectionLabel: {
    ...Typography.label,
    color: Colors.textMuted,
    marginLeft: Spacing.xs,
  },
  sectionSubtitle: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginLeft: Spacing.xs,
    marginTop: -4,
  },
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

  // Breakdown section
  breakdownSection: {
    gap: Spacing.md,
  },
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

  // Multiplier card
  multiplierCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  multiplierCardDanger: {
    backgroundColor: Colors.dangerDim,
    borderColor: Colors.danger + '44',
  },
  multiplierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  multiplierLabel: {
    ...Typography.label,
    color: Colors.textMuted,
  },
  multiplierValue: {
    ...Typography.h2,
    color: Colors.text,
    fontFamily: Fonts.mono,
  },
  multiplierValueDanger: {
    color: Colors.danger,
  },
  multiplierHint: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },
  multiplierHintDanger: {
    color: Colors.danger,
  },
  multiplierProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  multiplierProgressText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  multiplierProgressBar: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  multiplierProgressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.systemGray4,
    borderWidth: 1,
    borderColor: Colors.systemGray3,
  },
  multiplierProgressDotFilled: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },

  // Check-in card
  checkInCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  checkInHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  checkInLabel: {
    ...Typography.label,
    color: Colors.textMuted,
  },
  checkInValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.xs,
  },
  checkInValue: {
    ...Typography.h2,
    color: Colors.textTertiary,
    fontFamily: Fonts.rounded,
  },
  checkInValueActive: {
    color: Colors.accent,
  },
  checkInDays: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  checkInHint: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },
  missedWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.warningDim,
    borderWidth: 1,
    borderColor: Colors.warning + '44',
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginTop: Spacing.xs,
  },
  missedWarningIcon: {
    fontSize: 14,
  },
  missedWarningText: {
    ...Typography.caption,
    color: Colors.warning,
    fontWeight: '600',
  },

  // Badges section
  badgesSection: {
    gap: Spacing.md,
  },
  badgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
  },
  badgeCardLocked: {
    opacity: 0.5,
  },
  badgeEmoji: {
    fontSize: 32,
  },
  badgeEmojiLocked: {
    opacity: 0.4,
  },
  badgeContent: {
    flex: 1,
    gap: 2,
  },
  badgeLabel: {
    ...Typography.bodySemibold,
    color: Colors.text,
    fontFamily: Fonts.rounded,
  },
  badgeLabelLocked: {
    color: Colors.textSecondary,
  },
  badgeDesc: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  badgeDescLocked: {
    fontStyle: 'italic',
  },
  badgeCheck: {
    color: Colors.success,
    fontSize: 18,
    fontWeight: '700',
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: Spacing.md,
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

  // Leaderboard CTA
  leaderboardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.accent + '44',
    padding: Spacing.lg,
  },
  leaderboardCardPressed: {
    backgroundColor: Colors.bgCardHover,
    borderColor: Colors.accent,
  },
  leaderboardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  leaderboardEmoji: {
    fontSize: 28,
  },
  leaderboardInfo: {
    flex: 1,
    gap: 2,
  },
  leaderboardTitle: {
    ...Typography.bodySemibold,
    color: Colors.text,
    fontFamily: Fonts.rounded,
  },
  leaderboardSubtitle: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  leaderboardChevron: {
    fontSize: 22,
    color: Colors.accent,
    fontWeight: '300',
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  footerText: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});


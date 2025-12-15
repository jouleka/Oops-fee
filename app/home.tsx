import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LoadingState } from '@/components/ui/loading-state';
import {
  CHECKIN_COPY,
  COPY,
  getLiveBettorCount,
  GRAVEYARD_ENTRIES,
  PROMISE_TEMPLATES,
  type PromiseTemplate,
  ROTATING_QUOTES,
} from '@/constants/content';
import {
  Animation,
  Colors,
  Fonts,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from '@/constants/theme';
import { usePromiseStore } from '@/context/promise-store';
import { getTimeRemaining, type Urgency } from '@/lib/promises/time';
import type { UserPromise, UserStats } from '@/lib/promises/types';
import { computeStats, hasCheckedInToday, recordCheckIn } from '@/lib/stats/store';

const URGENCY_COLORS: Record<Urgency, string> = {
  low: Colors.urgencyLow,
  medium: Colors.urgencyMedium,
  // <24h should feel like a red alert.
  high: Colors.urgencyCritical,
  critical: Colors.urgencyCritical,
};

function hapticLight() {
  Haptics.selectionAsync().catch(() => {});
}

function hapticMedium() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

function destinationEmoji(promise: UserPromise): string {
  switch (promise.moneyDestination) {
    case 'charity':
      return '💛';
    case 'anti_charity':
      return '🧨';
    case 'friend':
      return '🤝';
    default:
      return '☕️';
  }
}

// ─────────────────────────────────────────────────────────────
// ANIMATED COMPONENTS
// ─────────────────────────────────────────────────────────────

function PulsingDot({ color = Colors.success }: { color?: string }) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 1200 }),
        withTiming(1, { duration: 1200 })
      ),
      -1,
      true
    );
  }, [opacity]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: interpolate(opacity.value, [0.3, 1], [0.85, 1]) }],
  }));

  return <Animated.View style={[styles.pulsingDot, { backgroundColor: color }, style]} />;
}

function GlowingStake({ amount }: { amount: number }) {
  const glow = useSharedValue(0);
  const hasStake = amount > 0;

  useEffect(() => {
    if (!hasStake) return;
    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2500 }),
        withTiming(0, { duration: 2500 })
      ),
      -1,
      true
    );
  }, [glow, hasStake]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glow.value, [0, 1], [0.2, 0.5]),
    transform: [{ scale: interpolate(glow.value, [0, 1], [0.95, 1.1]) }],
  }));

  return (
    <View style={styles.stakeContainer}>
      {hasStake && (
        <Animated.View style={[styles.stakeGlow, glowStyle]}>
          <LinearGradient
            colors={[Colors.dangerGlow, 'transparent']}
            style={styles.stakeGlowGradient}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          />
        </Animated.View>
      )}
      <View style={styles.stakeContent}>
        <Text style={styles.stakeLabel}>{COPY.stakeLabel}</Text>
        <Text style={[styles.stakeAmount, hasStake && styles.stakeAmountActive]}>
          ${amount}
        </Text>
        <Text style={styles.stakeSubtext}>
          {hasStake ? COPY.stakeActive : COPY.stakeEmpty}
        </Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// CONTENT COMPONENTS
// ─────────────────────────────────────────────────────────────

function RotatingQuote() {
  const [index, setIndex] = useState(() =>
    Math.floor(Math.random() * ROTATING_QUOTES.length)
  );

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % ROTATING_QUOTES.length);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const quote = ROTATING_QUOTES[index];

  return (
    <Animated.View key={index} entering={FadeIn.duration(500)} style={styles.quoteContainer}>
      <Text style={styles.quoteIcon}>{quote.icon}</Text>
      <Text style={styles.quoteText}>{quote.text}</Text>
    </Animated.View>
  );
}

function SocialProof() {
  const count = useMemo(() => getLiveBettorCount(), []);

  return (
    <Animated.View entering={FadeIn.delay(100).duration(400)} style={styles.socialProof}>
      <PulsingDot />
      <Text style={styles.socialProofText}>
        <Text style={styles.socialProofNumber}>{count.toLocaleString()}</Text>{' '}
        {COPY.socialProofSuffix}
      </Text>
    </Animated.View>
  );
}

function TemplateCard({
  template,
  index,
  onPress,
}: {
  template: PromiseTemplate;
  index: number;
  onPress: () => void;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(180 + index * 50).duration(280)}>
      <Pressable
        onPress={() => {
          hapticLight();
          onPress();
        }}
        style={({ pressed }) => [
          styles.templateCard,
          pressed && styles.templateCardPressed,
        ]}
      >
        <Text style={styles.templateEmoji}>{template.emoji}</Text>
        <Text style={styles.templateText} numberOfLines={2}>
          {template.text}
        </Text>
        <View style={styles.templateStake}>
          <Text style={styles.templateStakeText}>${template.stake}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function GraveyardPreview() {
  const entry = useMemo(
    () => GRAVEYARD_ENTRIES[Math.floor(Math.random() * GRAVEYARD_ENTRIES.length)],
    []
  );

  return (
    <Animated.View entering={FadeInDown.delay(450).duration(400)} style={styles.graveyardSection}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionIcon}>⚰️</Text>
        <Text style={styles.sectionTitle}>{COPY.graveyardTitle}</Text>
      </View>

      <View style={styles.graveyardCard}>
        <View style={styles.graveyardContent}>
          <Text style={styles.graveyardRip}>RIP</Text>
          <Text style={styles.graveyardText}>&ldquo;{entry.text}&rdquo;</Text>
          <Text style={styles.graveyardMeta}>
            Lasted {entry.lasted} &middot; Lost ${entry.lost}
          </Text>
        </View>
        <Text style={styles.graveyardSkull}>💀</Text>
      </View>

      <Text style={styles.graveyardWarning}>{COPY.graveyardWarning}</Text>
    </Animated.View>
  );
}

function EmptyState({ onSelectTemplate }: { onSelectTemplate: (t: PromiseTemplate) => void }) {
  return (
    <View style={styles.emptyState}>
      <RotatingQuote />
      <SocialProof />

      {/* Templates */}
      <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.templatesSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{COPY.templatesTitle}</Text>
        </View>
        <Text style={styles.sectionSubtitle}>{COPY.templatesSubtitle}</Text>

        <View style={styles.templatesGrid}>
          {PROMISE_TEMPLATES.map((template, i) => (
            <TemplateCard
              key={template.id}
              template={template}
              index={i}
              onPress={() => onSelectTemplate(template)}
            />
          ))}
        </View>
      </Animated.View>

      <GraveyardPreview />

      {/* Footer nudge */}
      <Animated.View entering={FadeIn.delay(600).duration(400)} style={styles.footerNudge}>
        <Text style={styles.footerText}>{COPY.footerPrimary}</Text>
        <Text style={styles.footerSubtext}>{COPY.footerSecondary}</Text>
      </Animated.View>
    </View>
  );
}

function PromiseCard({ promise, index, now }: { promise: UserPromise; index: number; now: number }) {
  const { label, urgency, msRemaining } = getTimeRemaining(promise.deadlineAt, now);
  const color = URGENCY_COLORS[urgency];
  const shouldGlow = msRemaining > 0 && msRemaining < 24 * 60 * 60 * 1000;
  const shouldPulse = msRemaining > 0 && msRemaining < 6 * 60 * 60 * 1000;

  const pulse = useSharedValue(1);

  useEffect(() => {
    if (!shouldPulse) return;
    pulse.value = withRepeat(
      withSequence(
        withSpring(1.015, Animation.springBouncy),
        withSpring(1, Animation.springBouncy)
      ),
      -1,
      true
    );
  }, [shouldPulse, pulse]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <Animated.View
      entering={FadeInUp.delay(80 + index * 60).duration(320).springify()}
      style={animStyle}
    >
      <Pressable
        onPress={() => {
          hapticLight();
          router.push({ pathname: '/promise/[id]', params: { id: promise.id } });
        }}
        style={({ pressed }) => [
          styles.promiseCard,
          pressed && styles.promiseCardPressed,
          shouldGlow && [styles.promiseCardUrgent, Shadows.glow(Colors.danger)],
          shouldGlow && { borderColor: Colors.danger + '55' },
        ]}
      >
        <View style={[styles.urgencyDot, { backgroundColor: color }]} />

        <View style={styles.promiseCardBody}>
          <Text style={styles.promiseText} numberOfLines={2}>
            {promise.text}
          </Text>
          <View style={styles.promiseFooter}>
            <View style={styles.promiseStakeRow}>
              <Text style={styles.promiseStake}>${promise.stake}</Text>
              <Text style={styles.promiseDestEmoji}>{destinationEmoji(promise)}</Text>
            </View>
            <View style={[styles.promiseTimeBadge, { backgroundColor: color + '18' }]}>
              <Text style={[styles.promiseTimeText, { color }]}>{label}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.chevron}>›</Text>
      </Pressable>
    </Animated.View>
  );
}

function StatsBar({
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
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={[styles.statValue, overdueCount > 0 && styles.statValueDanger]}>{overdueCount}</Text>
        <Text style={styles.statLabel}>Overdue</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={[styles.statValue, styles.statValueDanger]}>${atRisk}</Text>
        <Text style={styles.statLabel}>On the line</Text>
      </View>
    </Animated.View>
  );
}

function FAB({ onPress }: { onPress: () => void }) {
  const scale = useSharedValue(1);

  const handlePress = useCallback(() => {
    scale.value = withSequence(
      withSpring(0.88, { damping: 12 }),
      withSpring(1, Animation.spring)
    );
    hapticMedium();
    onPress();
  }, [onPress, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.fab, animStyle, Shadows.lg]}>
      <Pressable onPress={handlePress} style={styles.fabTouchable}>
        <LinearGradient
          colors={[Colors.accent, '#0A7FD4']}
          style={styles.fabGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.fabIcon}>+</Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────
// DAILY CHECK-IN MODAL
// ─────────────────────────────────────────────────────────────

function DailyCheckInModal({
  visible,
  totalAtStake,
  activeCount,
  streak,
  onCommit,
  onDismiss,
}: {
  visible: boolean;
  totalAtStake: number;
  activeCount: number;
  streak: number;
  onCommit: (committed: boolean) => void;
  onDismiss: () => void;
}) {
  const [working, setWorking] = useState(false);

  const handleCommit = async (committed: boolean) => {
    if (working) return;
    setWorking(true);
    hapticMedium();
    await onCommit(committed);
    setWorking(false);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.checkInBackdrop}>
        <Animated.View entering={FadeInUp.duration(350).springify()} style={styles.checkInCard}>
          {/* Header emoji */}
          <View style={styles.checkInEmojiContainer}>
            <Text style={styles.checkInEmoji}>👋</Text>
          </View>

          {/* Title */}
          <Text style={styles.checkInTitle}>{CHECKIN_COPY.title}</Text>
          <Text style={styles.checkInSubtitle}>{CHECKIN_COPY.subtitle}</Text>

          {/* Stats row */}
          <View style={styles.checkInStatsRow}>
            <View style={styles.checkInStat}>
              <Text style={styles.checkInStatValue}>${totalAtStake}</Text>
              <Text style={styles.checkInStatLabel}>at stake</Text>
            </View>
            <View style={styles.checkInStatDivider} />
            <View style={styles.checkInStat}>
              <Text style={styles.checkInStatValue}>{activeCount}</Text>
              <Text style={styles.checkInStatLabel}>active</Text>
            </View>
            {streak > 0 && (
              <>
                <View style={styles.checkInStatDivider} />
                <View style={styles.checkInStat}>
                  <Text style={[styles.checkInStatValue, { color: Colors.warning }]}>🔥 {streak}</Text>
                  <Text style={styles.checkInStatLabel}>streak</Text>
                </View>
              </>
            )}
          </View>

          {/* Action buttons */}
          <View style={styles.checkInActions}>
            <Pressable
              disabled={working}
              onPress={() => handleCommit(true)}
              style={({ pressed }) => [
                styles.checkInPrimaryBtn,
                pressed && styles.pressed,
                working && styles.buttonDisabled,
              ]}
            >
              <LinearGradient
                colors={[Colors.success, '#2EC44F']}
                style={styles.checkInBtnGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.checkInBtnText}>{CHECKIN_COPY.yesButton}</Text>
              </LinearGradient>
            </Pressable>

            <Pressable
              disabled={working}
              onPress={() => handleCommit(false)}
              style={({ pressed }) => [
                styles.checkInSecondaryBtn,
                pressed && styles.checkInSecondaryBtnPressed,
                working && styles.buttonDisabled,
              ]}
            >
              <Text style={styles.checkInSecondaryBtnText}>{CHECKIN_COPY.noButton}</Text>
            </Pressable>
          </View>

          {/* Skip link */}
          <Pressable onPress={onDismiss} style={({ pressed }) => [pressed && styles.pressed]}>
            <Text style={styles.checkInSkip}>Skip for now</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { promises, isHydrated, setPromiseStatus } = usePromiseStore();
  const [now, setNow] = useState(() => Date.now());
  
  // Check-in modal state
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [stats, setStats] = useState<UserStats | null>(null);
  const hasCheckedRef = useRef(false);
  
  // Keep promises in a ref to avoid stale closures in callbacks
  const promisesRef = useRef(promises);
  useEffect(() => { promisesRef.current = promises; }, [promises]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Check if we should show check-in modal on mount
  useEffect(() => {
    if (!isHydrated || hasCheckedRef.current) return;
    hasCheckedRef.current = true;

    const checkForDailyCheckIn = async () => {
      // Only show if user has active promises
      const activePromises = promises.filter((p) => p.status === 'active' && p.deadlineAt > Date.now());
      if (activePromises.length === 0) return;

      const alreadyCheckedIn = await hasCheckedInToday();
      if (!alreadyCheckedIn) {
        // Load stats for streak display
        const computed = await computeStats(promises);
        setStats(computed);
        // Small delay for better UX after screen loads
        setTimeout(() => setShowCheckInModal(true), 500);
      }
    };

    checkForDailyCheckIn();
  }, [isHydrated, promises]);

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
    () => promises.reduce((sum, p) => (p.status === 'active' || p.status === 'expired' ? sum + p.stake : sum), 0),
    [promises]
  );

  const handleAddPromise = useCallback((template?: PromiseTemplate) => {
    router.push(
      template
        ? { pathname: '/promise/new', params: { templateId: template.id } }
        : { pathname: '/promise/new' }
    );
  }, []);

  const handleStatsPress = useCallback(() => {
    hapticLight();
    router.push('/stats');
  }, []);

  const handleCheckInPress = useCallback(() => {
    hapticLight();
    router.push('/check-in');
  }, []);

  const handleCheckInCommit = useCallback(async (committed: boolean) => {
    // Use ref to get latest promises and avoid stale closure
    const currentActive = promisesRef.current.filter((p) => p.status === 'active' && p.deadlineAt > Date.now());
    const activeIds = currentActive.map((p) => p.id);
    await recordCheckIn(committed, activeIds);

    // If user says they failed and there's only one active promise, mark it failed
    if (!committed && currentActive.length === 1) {
      await setPromiseStatus(currentActive[0].id, 'failed');
    }

    setShowCheckInModal(false);

    if (committed) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, [setPromiseStatus]);

  if (!isHydrated) {
    return <LoadingState title="Loading promises…" subtitle="Fetching your consequences." />;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Daily Check-In Modal */}
      <DailyCheckInModal
        visible={showCheckInModal}
        totalAtStake={atRiskStake}
        activeCount={active.length}
        streak={stats?.checkInStreak ?? 0}
        onCommit={handleCheckInCommit}
        onDismiss={() => setShowCheckInModal(false)}
      />

      {/* Header */}
      <Animated.View entering={FadeInDown.duration(350)} style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{COPY.headerTitle}</Text>
          <Text style={styles.headerSubtitle}>{COPY.headerSubtitle}</Text>
        </View>
        <View style={styles.headerButtons}>
          <Pressable
            onPress={handleCheckInPress}
            style={({ pressed }) => [styles.headerButton, pressed && styles.headerButtonPressed]}
          >
            <View style={styles.headerButtonInner}>
              <Text style={styles.headerCheckIcon}>✓</Text>
            </View>
          </Pressable>
          <Pressable
            onPress={handleStatsPress}
            style={({ pressed }) => [styles.headerButton, pressed && styles.headerButtonPressed]}
          >
            <View style={styles.headerButtonInner}>
              <View style={styles.statsIconBars}>
                <View style={[styles.statsIconBar, { height: 8, backgroundColor: Colors.success }]} />
                <View style={[styles.statsIconBar, { height: 12, backgroundColor: Colors.accent }]} />
                <View style={[styles.statsIconBar, { height: 16, backgroundColor: Colors.warning }]} />
              </View>
            </View>
          </Pressable>
        </View>
      </Animated.View>

      {/* Content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <GlowingStake amount={atRiskStake} />
        <StatsBar activeCount={active.length} overdueCount={overdue.length} atRisk={atRiskStake} />

        {active.length === 0 && overdue.length === 0 ? (
          <EmptyState onSelectTemplate={handleAddPromise} />
        ) : (
          <View style={styles.promisesList}>
            <Text style={styles.listTitle}>ACTIVE</Text>
            {active.map((p, i) => (
              <PromiseCard key={p.id} promise={p} index={i} now={now} />
            ))}

            {overdue.length > 0 && (
              <View style={{ marginTop: Spacing.xl, gap: Spacing.md }}>
                <Text style={[styles.listTitle, { color: Colors.danger }]}>OVERDUE</Text>
                {overdue.map((p, i) => (
                  <PromiseCard key={p.id} promise={p} index={active.length + i} now={now} />
                ))}
              </View>
            )}
          </View>
        )}

        {/* Dev footer */}
        <View style={styles.devFooter}>
          <Text style={styles.devText}>
            {COPY.version} · {COPY.tagline}
          </Text>
        </View>
      </ScrollView>

      {/* FAB */}
      <View style={[styles.fabWrapper, { bottom: insets.bottom + Spacing.xl }]}>
        <FAB onPress={() => handleAddPromise()} />
      </View>
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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
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
  headerButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonPressed: {
    backgroundColor: Colors.bgCardHover,
    borderColor: Colors.borderFocus,
  },
  headerButtonInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCheckIcon: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.success,
  },
  statsIconBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 16,
  },
  statsIconBar: {
    width: 4,
    borderRadius: 2,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
  },

  // Stake
  stakeContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    position: 'relative',
  },
  stakeGlow: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stakeGlowGradient: {
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  stakeContent: {
    alignItems: 'center',
  },
  stakeLabel: {
    ...Typography.label,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
  },
  stakeAmount: {
    ...Typography.displayLarge,
    color: Colors.textTertiary,
  },
  stakeAmountActive: {
    color: Colors.danger,
  },
  stakeSubtext: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: Spacing.sm,
    fontStyle: 'italic',
  },

  // Stats
  statsBar: {
    flexDirection: 'row',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    ...Typography.h2,
    color: Colors.text,
    fontFamily: Fonts.rounded,
  },
  statValueGreen: {
    color: Colors.success,
  },
  statValueDanger: {
    color: Colors.danger,
  },
  statLabel: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },

  // Empty state wrapper
  emptyState: {
    paddingTop: Spacing.sm,
  },

  // Quote
  quoteContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    minHeight: 90,
  },
  quoteIcon: {
    fontSize: 28,
    marginBottom: Spacing.xs,
  },
  quoteText: {
    ...Typography.h3,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Social proof
  socialProof: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  socialProofText: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  socialProofNumber: {
    color: Colors.text,
    fontWeight: '600',
    fontFamily: Fonts.mono,
  },

  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 4,
  },
  sectionIcon: {
    fontSize: 16,
  },
  sectionTitle: {
    ...Typography.label,
    color: Colors.textMuted,
  },
  sectionSubtitle: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginBottom: Spacing.lg,
  },

  // Templates
  templatesSection: {
    marginBottom: Spacing.xxl,
  },
  templatesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  templateCard: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  templateCardPressed: {
    backgroundColor: Colors.bgCardHover,
    borderColor: Colors.borderFocus,
  },
  templateEmoji: {
    fontSize: 22,
  },
  templateText: {
    ...Typography.caption,
    color: Colors.text,
    lineHeight: 18,
    minHeight: 36,
  },
  templateStake: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.dangerDim,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: Radius.sm,
    marginTop: Spacing.xs,
  },
  templateStakeText: {
    ...Typography.caption,
    color: Colors.danger,
    fontFamily: Fonts.mono,
    fontWeight: '600',
  },

  // Graveyard
  graveyardSection: {
    marginBottom: Spacing.xxl,
  },
  graveyardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 69, 58, 0.05)',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.12)',
    padding: Spacing.lg,
    marginTop: Spacing.sm,
  },
  graveyardContent: {
    flex: 1,
    gap: 3,
  },
  graveyardRip: {
    ...Typography.label,
    color: Colors.danger,
    fontSize: 10,
  },
  graveyardText: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  graveyardMeta: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  graveyardSkull: {
    fontSize: 26,
    opacity: 0.6,
  },
  graveyardWarning: {
    ...Typography.caption,
    color: Colors.danger,
    textAlign: 'center',
    marginTop: Spacing.md,
    fontWeight: '500',
  },

  // Footer nudge
  footerNudge: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  footerText: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  footerSubtext: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontStyle: 'italic',
    marginTop: 2,
  },

  // Promise list
  promisesList: {
    gap: Spacing.md,
  },
  listTitle: {
    ...Typography.label,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },

  // Promise card
  promiseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  promiseCardUrgent: {},
  promiseCardPressed: {
    backgroundColor: Colors.bgCardHover,
  },
  urgencyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  promiseCardBody: {
    flex: 1,
    gap: Spacing.sm,
  },
  promiseText: {
    ...Typography.bodyMedium,
    color: Colors.text,
  },
  promiseFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  promiseStakeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  promiseStake: {
    ...Typography.bodySemibold,
    color: Colors.danger,
    fontFamily: Fonts.mono,
  },
  promiseDestEmoji: {
    fontSize: 14,
    opacity: 0.85,
  },
  promiseTimeBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: Radius.sm,
  },
  promiseTimeText: {
    ...Typography.caption,
    fontWeight: '600',
  },
  chevron: {
    fontSize: 22,
    color: Colors.textMuted,
    fontWeight: '300',
  },

  // FAB
  fabWrapper: {
    position: 'absolute',
    right: Spacing.xl,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  fabTouchable: {
    flex: 1,
    borderRadius: 28,
    overflow: 'hidden',
  },
  fabGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabIcon: {
    fontSize: 30,
    color: Colors.text,
    fontWeight: '300',
    marginTop: -1,
  },

  // Dev footer
  devFooter: {
    alignItems: 'center',
    paddingTop: Spacing.xxxl,
    paddingBottom: Spacing.lg,
  },
  devText: {
    ...Typography.caption,
    color: Colors.textMuted,
  },

  // Check-in modal
  checkInBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  checkInCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.xxl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  checkInEmojiContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  checkInEmoji: {
    fontSize: 32,
  },
  checkInTitle: {
    ...Typography.h2,
    color: Colors.text,
    fontFamily: Fonts.rounded,
    textAlign: 'center',
  },
  checkInSubtitle: {
    ...Typography.body,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  checkInStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    width: '100%',
  },
  checkInStat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  checkInStatValue: {
    ...Typography.h3,
    color: Colors.text,
    fontFamily: Fonts.rounded,
  },
  checkInStatLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  checkInStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.sm,
  },
  checkInActions: {
    width: '100%',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  checkInPrimaryBtn: {
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    ...Shadows.md,
  },
  checkInBtnGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkInBtnText: {
    ...Typography.bodySemibold,
    color: Colors.text,
    fontFamily: Fonts.rounded,
  },
  checkInSecondaryBtn: {
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkInSecondaryBtnPressed: {
    backgroundColor: Colors.bgCardHover,
  },
  checkInSecondaryBtnText: {
    ...Typography.bodySemibold,
    color: Colors.textSecondary,
  },
  checkInSkip: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

/**
 * The Graveyard
 * Where broken promises come to rest in eternal shame.
 */

import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useMemo } from 'react';
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
import { GRAVEYARD_COPY } from '@/constants/content';
import { Colors, Fonts, Radius, Spacing, Typography } from '@/constants/theme';
import { usePromiseStore } from '@/context/promise-store';
import { formatShortDateTime } from '@/lib/promises/time';
import type { UserPromise } from '@/lib/promises/types';

function hapticLight() {
  Haptics.selectionAsync().catch(() => {});
}

// ─────────────────────────────────────────────────────────────
// TOMBSTONE CARD
// ─────────────────────────────────────────────────────────────

function calculateDuration(promise: UserPromise): string {
  const endTime = promise.failedAt ?? promise.expiredAt ?? promise.updatedAt;
  const startTime = promise.createdAt;
  const durationMs = endTime - startTime;

  const hours = Math.floor(durationMs / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days >= 7) {
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? '1 week' : `${weeks} weeks`;
  }
  if (days > 0) {
    return days === 1 ? '1 day' : `${days} days`;
  }
  if (hours > 0) {
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }
  return 'moments';
}

function TombstoneCard({ promise, index }: { promise: UserPromise; index: number }) {
  const duration = useMemo(() => calculateDuration(promise), [promise]);
  const endDate = useMemo(() => {
    const timestamp = promise.failedAt ?? promise.expiredAt ?? promise.updatedAt;
    return formatShortDateTime(timestamp);
  }, [promise]);

  return (
    <Animated.View
      entering={FadeInDown.delay(100 + index * 60).duration(280)}
      style={styles.tombstone}
    >
      {/* Cross decoration */}
      <View style={styles.tombstoneCross}>
        <View style={styles.crossVertical} />
        <View style={styles.crossHorizontal} />
      </View>

      {/* RIP header */}
      <Text style={styles.ripText}>{GRAVEYARD_COPY.ripLabel}</Text>

      {/* Promise text */}
      <Text style={styles.tombstoneText} numberOfLines={3}>
        "{promise.text}"
      </Text>

      {/* Epitaph: duration and loss */}
      <View style={styles.epitaph}>
        <View style={styles.epitaphRow}>
          <Text style={styles.epitaphLabel}>{GRAVEYARD_COPY.lastedLabel}</Text>
          <Text style={styles.epitaphValue}>{duration}</Text>
        </View>
        <View style={styles.epitaphDivider} />
        <View style={styles.epitaphRow}>
          <Text style={styles.epitaphLabel}>{GRAVEYARD_COPY.lostLabel}</Text>
          <Text style={[styles.epitaphValue, styles.epitaphLost]}>
            ${promise.stake + (promise.sponsorAmount ?? 0)}
          </Text>
        </View>
      </View>

      {/* Date of death */}
      <Text style={styles.deathDate}>{endDate}</Text>

      {/* Skull accent */}
      <Text style={styles.skullAccent}>💀</Text>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────
// TOTAL LOST HERO
// ─────────────────────────────────────────────────────────────

function TotalLostHero({ amount, count }: { amount: number; count: number }) {
  const flicker = useSharedValue(1);

  // Subtle flicker animation like a dying candle
  flicker.value = withRepeat(
    withSequence(
      withTiming(0.7, { duration: 2000 }),
      withTiming(1, { duration: 1500 }),
      withTiming(0.85, { duration: 1800 }),
      withTiming(1, { duration: 1200 })
    ),
    -1,
    true
  );

  const flickerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flicker.value, [0.7, 1], [0.6, 1]),
  }));

  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.heroContainer}>
      <Animated.View style={[styles.heroGlow, flickerStyle]} />
      <View style={styles.heroContent}>
        <Text style={styles.heroLabel}>{GRAVEYARD_COPY.totalLostLabel}</Text>
        <Text style={styles.heroAmount}>${amount}</Text>
        <Text style={styles.heroSubtext}>
          {count} promise{count === 1 ? '' : 's'} broken
        </Text>
      </View>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────

function EmptyGraveyard() {
  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.emptyContainer}>
      <Text style={styles.emptyEmoji}>⚰️</Text>
      <Text style={styles.emptyTitle}>{GRAVEYARD_COPY.emptyTitle}</Text>
      <Text style={styles.emptySubtitle}>{GRAVEYARD_COPY.emptySubtitle}</Text>
      <Text style={styles.emptyHint}>{GRAVEYARD_COPY.emptyHint}</Text>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────

export default function GraveyardScreen() {
  const insets = useSafeAreaInsets();
  const { promises, isHydrated } = usePromiseStore();

  // Get failed and expired promises, sorted by failure date (most recent first)
  const deadPromises = useMemo(() => {
    return promises
      .filter((p) => p.status === 'failed' || p.status === 'expired')
      .sort((a, b) => {
        const aTime = a.failedAt ?? a.expiredAt ?? a.updatedAt;
        const bTime = b.failedAt ?? b.expiredAt ?? b.updatedAt;
        return bTime - aTime;
      });
  }, [promises]);

  const totalLost = useMemo(() => {
    return deadPromises.reduce(
      (sum, p) => sum + p.stake + (p.sponsorAmount ?? 0),
      0
    );
  }, [deadPromises]);

  const handleBack = useCallback(() => {
    hapticLight();
    router.back();
  }, []);

  if (!isHydrated) {
    return (
      <LoadingState
        title="Opening the crypt..."
        subtitle="Gathering the remains of your ambition."
      />
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Text style={styles.backButtonText}>‹</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{GRAVEYARD_COPY.title}</Text>
          <Text style={styles.headerSubtitle}>{GRAVEYARD_COPY.subtitle}</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {deadPromises.length === 0 ? (
          <EmptyGraveyard />
        ) : (
          <>
            {/* Total lost hero */}
            <TotalLostHero amount={totalLost} count={deadPromises.length} />

            {/* Tombstones */}
            <View style={styles.tombstoneGrid}>
              {deadPromises.map((promise, i) => (
                <TombstoneCard key={promise.id} promise={promise} index={i} />
              ))}
            </View>

            {/* Footer */}
            <Animated.View
              entering={FadeIn.delay(400 + deadPromises.length * 60).duration(300)}
              style={styles.footer}
            >
              <Text style={styles.footerText}>{GRAVEYARD_COPY.footerText}</Text>
            </Animated.View>
          </>
        )}
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

  // Header
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
  headerCenter: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.text,
    fontFamily: Fonts.rounded,
  },
  headerSubtitle: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
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
  pressed: {
    opacity: 0.8,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    gap: Spacing.xxl,
  },

  // Hero - Total Lost
  heroContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    position: 'relative',
  },
  heroGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: Colors.danger,
    opacity: 0.15,
  },
  heroContent: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  heroLabel: {
    ...Typography.label,
    color: Colors.textMuted,
  },
  heroAmount: {
    ...Typography.displayLarge,
    color: Colors.danger,
    fontFamily: Fonts.rounded,
  },
  heroSubtext: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },

  // Tombstone grid
  tombstoneGrid: {
    gap: Spacing.lg,
  },

  // Tombstone card
  tombstone: {
    backgroundColor: 'rgba(255, 69, 58, 0.04)',
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.12)',
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
    position: 'relative',
    overflow: 'hidden',
  },
  tombstoneCross: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    width: 16,
    height: 20,
  },
  crossVertical: {
    position: 'absolute',
    left: 6,
    top: 0,
    width: 4,
    height: 20,
    backgroundColor: Colors.danger,
    opacity: 0.25,
    borderRadius: 1,
  },
  crossHorizontal: {
    position: 'absolute',
    left: 0,
    top: 4,
    width: 16,
    height: 4,
    backgroundColor: Colors.danger,
    opacity: 0.25,
    borderRadius: 1,
  },
  ripText: {
    ...Typography.label,
    color: Colors.danger,
    fontSize: 12,
    letterSpacing: 3,
    marginTop: Spacing.sm,
  },
  tombstoneText: {
    ...Typography.h3,
    color: Colors.text,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 24,
  },
  epitaph: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    marginTop: Spacing.sm,
  },
  epitaphRow: {
    alignItems: 'center',
    gap: 2,
  },
  epitaphLabel: {
    ...Typography.label,
    color: Colors.textMuted,
    fontSize: 9,
  },
  epitaphValue: {
    ...Typography.bodySemibold,
    color: Colors.textSecondary,
    fontFamily: Fonts.mono,
  },
  epitaphLost: {
    color: Colors.danger,
  },
  epitaphDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.border,
  },
  deathDate: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  skullAccent: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    fontSize: 18,
    opacity: 0.4,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxxl * 2,
    gap: Spacing.md,
  },
  emptyEmoji: {
    fontSize: 64,
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
    maxWidth: 280,
  },
  emptyHint: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontStyle: 'italic',
    marginTop: Spacing.md,
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingTop: Spacing.lg,
  },
  footerText: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});


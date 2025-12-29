/**
 * The Graveyard
 * Where broken promises come to rest in eternal shame.
 */

import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
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
      className="bg-danger/[0.04] rounded-xl border border-danger/[0.12] p-xl items-center gap-md relative overflow-hidden"
    >
      {/* Cross decoration */}
      <View className="absolute top-md left-md w-4 h-5">
        <View className="absolute left-1.5 top-0 w-1 h-5 bg-danger opacity-25 rounded-sm" />
        <View className="absolute left-0 top-1 w-4 h-1 bg-danger opacity-25 rounded-sm" />
      </View>

      {/* RIP header */}
      <Text className="text-label text-danger text-xs tracking-[3px] mt-sm">
        {GRAVEYARD_COPY.ripLabel}
      </Text>

      {/* Promise text */}
      <Text className="text-h3 text-white text-center italic leading-6" numberOfLines={3}>
        &quot;{promise.text}&quot;
      </Text>

      {/* Epitaph: duration and loss */}
      <View className="flex-row items-center gap-lg mt-sm">
        <View className="items-center gap-0.5">
          <Text className="text-label text-text-muted text-[9px]">{GRAVEYARD_COPY.lastedLabel}</Text>
          <Text className="text-body-semibold text-text-secondary font-mono">{duration}</Text>
        </View>
        <View className="w-px h-6 bg-border" />
        <View className="items-center gap-0.5">
          <Text className="text-label text-text-muted text-[9px]">{GRAVEYARD_COPY.lostLabel}</Text>
          <Text className="text-body-semibold text-danger font-mono">
            ${promise.stake + (promise.sponsorAmount ?? 0)}
          </Text>
        </View>
      </View>

      {/* Date of death */}
      <Text className="text-caption text-text-muted mt-xs">{endDate}</Text>

      {/* Skull accent */}
      <Text className="absolute top-md right-md text-lg opacity-40">💀</Text>
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
    <Animated.View entering={FadeIn.duration(400)} className="items-center py-xxl relative">
      <Animated.View
        style={flickerStyle}
        className="absolute w-[200px] h-[200px] rounded-full bg-danger opacity-15"
      />
      <View className="items-center gap-sm">
        <Text className="text-label text-text-muted">{GRAVEYARD_COPY.totalLostLabel}</Text>
        <Text className="text-display-lg text-danger font-rounded">${amount}</Text>
        <Text className="text-caption text-text-tertiary italic">
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
    <Animated.View entering={FadeIn.duration(400)} className="flex-1 items-center justify-center py-[96px] gap-md">
      <Text className="text-[64px] mb-md">⚰️</Text>
      <Text className="text-h2 text-white font-rounded">{GRAVEYARD_COPY.emptyTitle}</Text>
      <Text className="text-body text-text-tertiary text-center max-w-[280px]">
        {GRAVEYARD_COPY.emptySubtitle}
      </Text>
      <Text className="text-caption text-text-muted italic mt-md">{GRAVEYARD_COPY.emptyHint}</Text>
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
    return deadPromises.reduce((sum, p) => sum + p.stake + (p.sponsorAmount ?? 0), 0);
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
    <View className="flex-1 bg-black" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="px-xl pt-lg pb-lg flex-row items-center gap-md border-b border-border-subtle">
        <Pressable
          onPress={handleBack}
          className="w-9 h-9 rounded-full bg-card border border-border items-center justify-center active:opacity-80"
        >
          <Text className="text-[28px] leading-7 text-text-secondary -mt-0.5">‹</Text>
        </Pressable>
        <View className="flex-1 gap-0.5">
          <Text className="text-h2 text-white font-rounded">{GRAVEYARD_COPY.title}</Text>
          <Text className="text-caption text-text-tertiary">{GRAVEYARD_COPY.subtitle}</Text>
        </View>
        <View className="w-9" />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, gap: 32, paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        {deadPromises.length === 0 ? (
          <EmptyGraveyard />
        ) : (
          <>
            {/* Total lost hero */}
            <TotalLostHero amount={totalLost} count={deadPromises.length} />

            {/* Tombstones */}
            <View className="gap-lg">
              {deadPromises.map((promise, i) => (
                <TombstoneCard key={promise.id} promise={promise} index={i} />
              ))}
            </View>

            {/* Footer */}
            <Animated.View
              entering={FadeIn.delay(400 + deadPromises.length * 60).duration(300)}
              className="items-center pt-lg"
            >
              <Text className="text-caption text-text-muted italic text-center">
                {GRAVEYARD_COPY.footerText}
              </Text>
            </Animated.View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

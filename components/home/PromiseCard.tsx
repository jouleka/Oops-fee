/**
 * PromiseCard - Displays a single promise with urgency styling
 */

import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
} from 'react-native-reanimated';

import { Animation, Colors, Fonts, Radius, Spacing, Typography } from '@/constants/theme';
import { hapticLight } from '@/lib/haptics';
import { getTimeRemaining, type Urgency } from '@/lib/promises/time';
import type { UserPromise } from '@/lib/promises/types';

const URGENCY_COLORS: Record<Urgency, string> = {
  low: Colors.urgencyLow,
  medium: Colors.urgencyMedium,
  high: Colors.urgencyCritical,
  critical: Colors.urgencyCritical,
};

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

interface PromiseCardProps {
  promise: UserPromise;
  index: number;
  now: number;
}

export function PromiseCard({ promise, index, now }: PromiseCardProps) {
  const { label, urgency, msRemaining } = getTimeRemaining(promise.deadlineAt, now);
  const color = URGENCY_COLORS[urgency];
  const isExpired = msRemaining <= 0;
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
          styles.card,
          pressed && styles.cardPressed,
          isExpired && styles.cardExpired,
        ]}
      >
        <View style={[styles.accent, { backgroundColor: color }]} />

        <View style={styles.body}>
          <Text style={styles.text} numberOfLines={2}>
            {promise.text}
          </Text>

          <View style={styles.meta}>
            <View style={styles.stakeRow}>
              <Text style={styles.stake}>${promise.stake}</Text>
              <Text style={styles.destEmoji}>{destinationEmoji(promise)}</Text>
            </View>

            <View
              style={[
                styles.timeBadge,
                { backgroundColor: color + '18' },
                isExpired && styles.timeBadgeExpired,
              ]}
            >
              <Text style={[styles.timeText, { color }]}>
                {isExpired ? 'EXPIRED' : label}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.chevron}>›</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  cardPressed: {
    backgroundColor: Colors.bgCardHover,
  },
  cardExpired: {
    borderColor: Colors.danger + '40',
    backgroundColor: Colors.dangerDim,
  },
  accent: {
    width: 4,
    alignSelf: 'stretch',
  },
  body: {
    flex: 1,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  text: {
    ...Typography.bodyMedium,
    color: Colors.text,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  stakeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stake: {
    ...Typography.bodySemibold,
    color: Colors.danger,
    fontFamily: Fonts.mono,
  },
  destEmoji: {
    fontSize: 14,
    opacity: 0.85,
  },
  timeBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: Radius.sm,
  },
  timeBadgeExpired: {
    backgroundColor: Colors.dangerDim,
  },
  timeText: {
    ...Typography.caption,
    fontWeight: '600',
  },
  chevron: {
    fontSize: 22,
    color: Colors.textMuted,
    fontWeight: '300',
    paddingRight: Spacing.lg,
  },
});


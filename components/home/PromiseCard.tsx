/**
 * PromiseCard - Displays a single promise with urgency styling
 */

import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
} from 'react-native-reanimated';

import { Animation, Fonts } from '@/constants/theme';
import { hapticLight } from '@/lib/haptics';
import { getTimeRemaining, type Urgency } from '@/lib/promises/time';
import type { UserPromise } from '@/lib/promises/types';

const URGENCY_COLORS: Record<Urgency, string> = {
  low: '#34C759',
  medium: '#FF9F0A',
  high: '#FF453A',
  critical: '#FF453A',
};

const URGENCY_CLASSES: Record<Urgency, string> = {
  low: 'bg-urgency-low',
  medium: 'bg-urgency-medium',
  high: 'bg-urgency-critical',
  critical: 'bg-urgency-critical',
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
          router.push({ pathname: '/(mobile)/promise/[id]', params: { id: promise.id } });
        }}
        className={`flex-row items-center bg-card rounded-xl border border-border overflow-hidden ${
          isExpired ? 'border-danger/40 bg-danger-dim' : ''
        } active:bg-card-hover`}
      >
        <View className={`w-1 self-stretch ${URGENCY_CLASSES[urgency]}`} />

        <View className="flex-1 p-4 gap-2">
          <Text className="text-white font-medium text-base leading-[22px]" numberOfLines={2}>
            {promise.text}
          </Text>

          <View className="flex-row items-center gap-3">
            <View className="flex-row items-center gap-1.5">
              <Text
                className="text-danger font-semibold text-base"
                style={{ fontFamily: Fonts.mono }}
              >
                ${promise.stake}
              </Text>
              <Text className="text-sm opacity-85">{destinationEmoji(promise)}</Text>
            </View>

            <View
              className={`py-1 px-2 rounded-sm ${isExpired ? 'bg-danger-dim' : ''}`}
              style={!isExpired ? { backgroundColor: color + '18' } : undefined}
            >
              <Text
                className="text-[13px] leading-[18px] font-semibold"
                style={{ color }}
              >
                {isExpired ? 'EXPIRED' : label}
              </Text>
            </View>
          </View>
        </View>

        <Text className="text-[22px] text-text-muted font-light pr-4">›</Text>
      </Pressable>
    </Animated.View>
  );
}

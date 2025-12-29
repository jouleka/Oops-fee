/**
 * GlowingStake - Hero display of total money at stake
 */

import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { COPY } from '@/constants/content';
import { Fonts } from '@/constants/theme';

interface GlowingStakeProps {
  amount: number;
}

export function GlowingStake({ amount }: GlowingStakeProps) {
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
    <View className="items-center py-8 relative">
      {hasStake && (
        <Animated.View style={glowStyle} className="absolute inset-0 items-center justify-center">
          <LinearGradient
            colors={['rgba(255, 69, 58, 0.35)', 'transparent']}
            className="w-[200px] h-[200px] rounded-full"
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          />
        </Animated.View>
      )}
      <View className="items-center">
        <Text className="text-label text-text-muted uppercase tracking-wide mb-2">
          {COPY.stakeLabel}
        </Text>
        <Text
          className={`text-display-lg ${hasStake ? 'text-danger' : 'text-text-tertiary'}`}
          style={{ fontFamily: Fonts.rounded }}
        >
          ${amount}
        </Text>
        <Text className="text-caption text-text-tertiary mt-2 italic">
          {hasStake ? COPY.stakeActive : COPY.stakeEmpty}
        </Text>
      </View>
    </View>
  );
}

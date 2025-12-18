/**
 * GlowingStake - Hero display of total money at stake
 */

import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { COPY } from '@/constants/content';
import { Colors, Spacing, Typography } from '@/constants/theme';

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
    <View style={styles.container}>
      {hasStake && (
        <Animated.View style={[styles.glow, glowStyle]}>
          <LinearGradient
            colors={[Colors.dangerGlow, 'transparent']}
            style={styles.glowGradient}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          />
        </Animated.View>
      )}
      <View style={styles.content}>
        <Text style={styles.label}>{COPY.stakeLabel}</Text>
        <Text style={[styles.amount, hasStake && styles.amountActive]}>
          ${amount}
        </Text>
        <Text style={styles.subtext}>
          {hasStake ? COPY.stakeActive : COPY.stakeEmpty}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    position: 'relative',
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowGradient: {
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  content: {
    alignItems: 'center',
  },
  label: {
    ...Typography.label,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
  },
  amount: {
    ...Typography.displayLarge,
    color: Colors.textTertiary,
  },
  amountActive: {
    color: Colors.danger,
  },
  subtext: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: Spacing.sm,
    fontStyle: 'italic',
  },
});


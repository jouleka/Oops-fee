/**
 * PulsingDot - Animated dot for "live" indicators
 */

import { useEffect } from 'react';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

interface PulsingDotProps {
  color?: string;
}

export function PulsingDot({ color = '#34C759' }: PulsingDotProps) {
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

  return (
    <Animated.View
      className="w-2 h-2 rounded-full"
      style={[{ backgroundColor: color }, style]}
    />
  );
}

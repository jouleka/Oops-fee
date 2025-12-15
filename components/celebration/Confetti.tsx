/**
 * Confetti Animation Component
 * Minimal, performant confetti effect for success celebrations.
 */

import { useEffect, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';

import { Colors } from '@/constants/theme';

interface ConfettiPieceProps {
  index: number;
  color: string;
  startX: number;
  delay: number;
  duration: number;
  rotation: number;
  size: number;
  screenHeight: number;
}

const CONFETTI_COLORS = [
  Colors.success,
  Colors.accent,
  Colors.warning,
  '#FF6B35',
  '#9B59B6',
  '#E91E63',
  '#00BCD4',
];

function ConfettiPiece({
  color,
  startX,
  delay,
  duration,
  rotation,
  size,
  screenHeight,
}: ConfettiPieceProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, {
        duration,
        easing: Easing.out(Easing.quad),
      })
    );
  }, [delay, duration, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(progress.value, [0, 1], [-50, screenHeight + 100]);
    const translateX = interpolate(
      progress.value,
      [0, 0.5, 1],
      [0, Math.sin(rotation) * 40, Math.sin(rotation) * 80]
    );
    const rotate = interpolate(progress.value, [0, 1], [0, rotation * 720]);
    const opacity = interpolate(progress.value, [0, 0.1, 0.8, 1], [0, 1, 1, 0]);
    const scale = interpolate(progress.value, [0, 0.2, 1], [0, 1, 0.6]);

    return {
      transform: [
        { translateX },
        { translateY },
        { rotate: `${rotate}deg` },
        { scale },
      ],
      opacity,
    };
  });

  return (
    <Animated.View
      style={[
        styles.piece,
        {
          left: startX,
          width: size,
          height: size * 0.6,
          backgroundColor: color,
          borderRadius: size * 0.15,
        },
        animatedStyle,
      ]}
    />
  );
}

interface ConfettiProps {
  count?: number;
  duration?: number;
  onComplete?: () => void;
}

export function Confetti({ count = 50, duration = 2500, onComplete }: ConfettiProps) {
  const { width, height } = useWindowDimensions();

  const pieces = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      startX: Math.random() * width,
      delay: Math.random() * 400,
      duration: duration + Math.random() * 500,
      rotation: (Math.random() - 0.5) * 6,
      size: 8 + Math.random() * 6,
    }));
  }, [count, duration, width]);

  useEffect(() => {
    if (onComplete) {
      const timeout = setTimeout(() => {
        onComplete();
      }, duration + 500);
      return () => clearTimeout(timeout);
    }
  }, [duration, onComplete]);

  return (
    <View style={styles.container} pointerEvents="none">
      {pieces.map((piece) => (
        <ConfettiPiece
          key={piece.id}
          index={piece.id}
          color={piece.color}
          startX={piece.startX}
          delay={piece.delay}
          duration={piece.duration}
          rotation={piece.rotation}
          size={piece.size}
          screenHeight={height}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  piece: {
    position: 'absolute',
    top: 0,
  },
});


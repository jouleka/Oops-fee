/**
 * StreakBadge - Whoop-inspired animated streak display
 * Features a lively animated flame with dancing/flickering effects
 */

import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Colors, Fonts } from '@/constants/theme';

type BadgeSize = 'small' | 'normal' | 'large';

interface StreakBadgeProps {
  streak: number;
  isBroken?: boolean;
  size?: BadgeSize;
  /** Show even when streak is 0 (for header placement) */
  alwaysShow?: boolean;
}

// Flame colors for different streak levels
const FLAME_COLORS = {
  cold: '#8E8E93', // No streak
  warm: '#FF9F0A', // 1-2 days
  hot: '#FF6B35', // 3-6 days  
  fire: '#FF453A', // 7+ days - on fire!
  legendary: '#FFD700', // 30+ days - golden
};

const SIZE_CONFIG = {
  small: {
    container: 'px-2 py-1 gap-1 rounded-md min-w-[44px]',
    icon: 14,
    text: 'text-sm font-bold',
  },
  normal: {
    container: 'px-3 py-2 gap-1.5 rounded-full min-w-[56px]',
    icon: 18,
    text: 'text-[17px] font-bold',
  },
  large: {
    container: 'px-5 py-3 gap-2 rounded-full min-w-[80px]',
    icon: 26,
    text: 'text-2xl font-extrabold',
  },
};

export function StreakBadge({
  streak,
  isBroken = false,
  size = 'normal',
  alwaysShow = false,
}: StreakBadgeProps) {
  // Animation values for the flame
  const flameScale = useSharedValue(1);
  const flameRotate = useSharedValue(0);
  const flameY = useSharedValue(0);
  const innerFlameScale = useSharedValue(1);

  const isActive = streak > 0 && !isBroken;
  const isLegendary = streak >= 30 && !isBroken;
  const isEmpty = streak === 0 && !isBroken;

  useEffect(() => {
    if (isActive) {
      // Main flame dance - gentle sway
      flameRotate.value = withRepeat(
        withSequence(
          withTiming(-3, { duration: 400, easing: Easing.inOut(Easing.sin) }),
          withTiming(3, { duration: 400, easing: Easing.inOut(Easing.sin) }),
          withTiming(-2, { duration: 300, easing: Easing.inOut(Easing.sin) }),
          withTiming(2, { duration: 300, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      );

      // Flame breathing - subtle scale pulse
      flameScale.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.95, { duration: 500, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.02, { duration: 400, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );

      // Flame float - up and down
      flameY.value = withRepeat(
        withSequence(
          withTiming(-2, { duration: 700, easing: Easing.inOut(Easing.sin) }),
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        true
      );

      // Inner flame flicker
      innerFlameScale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 200, easing: Easing.out(Easing.ease) }),
          withTiming(0.9, { duration: 150, easing: Easing.in(Easing.ease) }),
          withTiming(1.05, { duration: 180, easing: Easing.out(Easing.ease) }),
          withTiming(0.95, { duration: 170, easing: Easing.in(Easing.ease) })
        ),
        -1,
        false
      );
    }

    return () => {
      // Reset on cleanup
      flameScale.value = 1;
      flameRotate.value = 0;
      flameY.value = 0;
      innerFlameScale.value = 1;
    };
  }, [isActive, flameScale, flameRotate, flameY, innerFlameScale]);

  // Animated styles
  const flameContainerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: flameY.value },
      { scale: flameScale.value },
      { rotate: `${flameRotate.value}deg` },
    ],
  }));

  const innerFlameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: innerFlameScale.value }],
  }));

  const config = SIZE_CONFIG[size];

  if (isEmpty && !alwaysShow) return null;

  const icon = getIcon(streak, isBroken);
  const displayColor = getColor(streak, isBroken);

  return (
    <Animated.View
      entering={FadeIn.springify().damping(14).stiffness(120)}
      className="items-center justify-center"
    >
      <View
        className={`flex-row items-center justify-center border-[1.5px] overflow-hidden relative ${config.container} ${isEmpty ? 'opacity-60' : ''}`}
        style={{
          borderColor: isEmpty ? Colors.border : displayColor + '40',
          backgroundColor: isEmpty ? Colors.bgCard : displayColor + '15',
        }}
      >
        {/* Inner glow - static for Expo Go compatibility */}
        {isActive && (
          <View
            className="absolute inset-0"
            style={{ backgroundColor: displayColor, opacity: 0.15 }}
          />
        )}

        {/* Flame container with animations */}
        <Animated.View className="items-center justify-center" style={flameContainerStyle}>
          {/* Inner animated flame */}
          <Animated.View style={innerFlameStyle}>
            <Text
              className={`text-center ${isEmpty ? 'opacity-40' : ''}`}
              style={{ fontSize: config.icon }}
            >
              {icon}
            </Text>
          </Animated.View>
        </Animated.View>

        {/* Streak number */}
        <Text
          className={`text-center ${config.text} ${isEmpty ? 'opacity-60' : ''}`}
          style={{
            fontFamily: Fonts.rounded,
            color: isEmpty ? Colors.textMuted : displayColor,
            ...(isLegendary && {
              textShadowColor: '#FFD700',
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 8,
            }),
          }}
        >
          {streak}
        </Text>
      </View>
    </Animated.View>
  );
}

function getIcon(streak: number, isBroken: boolean): string {
  if (isBroken) return '💀';
  if (streak >= 30) return '🔥'; // Could use 👑 or keep fire
  if (streak >= 7) return '🔥';
  if (streak >= 3) return '🔥';
  return '🔥';
}

function getColor(streak: number, isBroken: boolean): string {
  if (isBroken) return Colors.danger;
  if (streak === 0) return FLAME_COLORS.cold;
  if (streak >= 30) return FLAME_COLORS.legendary;
  if (streak >= 7) return FLAME_COLORS.fire;
  if (streak >= 3) return FLAME_COLORS.hot;
  return FLAME_COLORS.warm;
}

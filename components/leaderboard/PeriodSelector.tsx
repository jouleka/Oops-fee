/**
 * PeriodSelector - Week/Month/All-Time segmented control
 *
 * Pill-style selector for time period filtering
 */

import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { hapticLight } from '@/lib/haptics';
import { type Period, getPeriodLabel } from '@/lib/leaderboard/api';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

interface PeriodSelectorProps {
  value: Period;
  onChange: (period: Period) => void;
  isShameMode?: boolean;
}

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

const PERIODS: Period[] = ['week', 'month', 'all_time'];

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────

export function PeriodSelector({ value, onChange, isShameMode = false }: PeriodSelectorProps) {
  const activeIndex = PERIODS.indexOf(value);
  const pillWidth = 100 / PERIODS.length;

  const animatedIndicatorStyle = useAnimatedStyle(() => ({
    left: withSpring(`${activeIndex * pillWidth}%`, { damping: 18, stiffness: 200 }),
    width: `${pillWidth}%`,
  }));

  const handleSelect = (period: Period) => {
    if (period !== value) {
      hapticLight();
      onChange(period);
    }
  };

  return (
    <View
      className={`relative flex-row p-1 rounded-lg border ${
        isShameMode
          ? 'bg-danger-dim border-danger/30'
          : 'bg-card border-border'
      }`}
    >
      {/* Animated sliding indicator */}
      <Animated.View
        className={`absolute top-1 bottom-1 rounded-md shadow-md ${
          isShameMode ? 'bg-danger/25' : 'bg-abyss-800'
        }`}
        style={animatedIndicatorStyle}
      />

      {/* Period options */}
      {PERIODS.map((period) => (
        <Pressable
          key={period}
          onPress={() => handleSelect(period)}
          className="flex-1 items-center justify-center py-2.5 z-[1]"
        >
          <Text
            className={`text-caption font-semibold ${
              value === period
                ? isShameMode
                  ? 'text-danger'
                  : 'text-white'
                : 'text-text-tertiary'
            }`}
          >
            {getPeriodLabel(period)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

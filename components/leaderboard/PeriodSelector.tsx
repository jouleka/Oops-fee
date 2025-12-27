/**
 * PeriodSelector - Week/Month/All-Time segmented control
 *
 * Pill-style selector for time period filtering
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
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
    <View style={[styles.container, isShameMode && styles.containerShame]}>
      {/* Animated sliding indicator */}
      <Animated.View
        style={[
          styles.indicator,
          isShameMode && styles.indicatorShame,
          animatedIndicatorStyle,
        ]}
      />

      {/* Period options */}
      {PERIODS.map((period) => (
        <Pressable
          key={period}
          onPress={() => handleSelect(period)}
          style={styles.option}
        >
          <Text
            style={[
              styles.optionText,
              value === period && styles.optionTextActive,
              value === period && isShameMode && styles.optionTextShame,
            ]}
          >
            {getPeriodLabel(period)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 4,
    position: 'relative',
  },
  containerShame: {
    borderColor: Colors.danger + '30',
    backgroundColor: Colors.dangerDim,
  },
  indicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  indicatorShame: {
    backgroundColor: Colors.danger + '25',
  },
  option: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm + 2,
    zIndex: 1,
  },
  optionText: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontWeight: '600',
  },
  optionTextActive: {
    color: Colors.text,
  },
  optionTextShame: {
    color: Colors.danger,
  },
});


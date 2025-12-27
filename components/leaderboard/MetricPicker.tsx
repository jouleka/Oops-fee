/**
 * MetricPicker - Dropdown for selecting leaderboard ranking metric
 *
 * Shows current selection and opens a modal/bottom sheet with options
 */

import { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import {
  type GloryMetric,
  type ShameMetric,
  type GlobalMetric,
  getMetricLabel,
} from '@/lib/leaderboard/api';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

type AnyMetric = GloryMetric | ShameMetric | GlobalMetric;

interface MetricOption {
  value: AnyMetric;
  label: string;
  emoji: string;
  description?: string;
}

interface MetricPickerProps {
  value: AnyMetric;
  onChange: (metric: AnyMetric) => void;
  scope: 'friends' | 'global';
  isShameMode?: boolean;
}

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

const GLORY_METRICS: MetricOption[] = [
  { value: 'success_rate', label: 'Success Rate', emoji: '📈', description: 'Min 5 promises required' },
  { value: 'current_streak', label: 'Current Streak', emoji: '🔥', description: 'Consecutive wins' },
  { value: 'longest_streak', label: 'Longest Streak', emoji: '🏆', description: 'Best streak ever' },
  { value: 'money_saved', label: 'Money Saved', emoji: '💰', description: 'Total $ kept' },
  { value: 'completed', label: 'Promises Kept', emoji: '✅', description: 'Total completions' },
];

const SHAME_METRICS: MetricOption[] = [
  { value: 'money_lost', label: 'Money Lost', emoji: '💸', description: 'The Big Losers' },
  { value: 'failed', label: 'Promises Broken', emoji: '🤡', description: 'Most Unreliable' },
  { value: 'worst_success_rate', label: 'Lowest Success Rate', emoji: '📉', description: 'Least Likely to Succeed' },
  { value: 'current_losing_streak', label: 'Losing Streak', emoji: '☠️', description: 'On a Roll... Downhill' },
];

// Global leaderboard has limited metrics (no streaks - computed in edge function only for friends)
const GLOBAL_GLORY_METRICS: MetricOption[] = [
  { value: 'success_rate', label: 'Success Rate', emoji: '📈', description: 'Min 5 promises required' },
  { value: 'money_saved', label: 'Money Saved', emoji: '💰', description: 'Total $ kept' },
  { value: 'completed', label: 'Promises Kept', emoji: '✅', description: 'Total completions' },
];

const GLOBAL_SHAME_METRICS: MetricOption[] = [
  { value: 'money_lost', label: 'Money Lost', emoji: '💸', description: 'The Big Losers' },
  { value: 'failed', label: 'Promises Broken', emoji: '🤡', description: 'Most Unreliable' },
];

function getEmoji(metric: AnyMetric): string {
  const all = [...GLORY_METRICS, ...SHAME_METRICS];
  return all.find((m) => m.value === metric)?.emoji ?? '📊';
}

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────

export function MetricPicker({ value, onChange, scope, isShameMode = false }: MetricPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const insets = useSafeAreaInsets();

  const getMetrics = useCallback((): MetricOption[] => {
    if (scope === 'global') {
      return isShameMode ? GLOBAL_SHAME_METRICS : GLOBAL_GLORY_METRICS;
    }
    return isShameMode ? SHAME_METRICS : GLORY_METRICS;
  }, [scope, isShameMode]);

  const metrics = getMetrics();

  const handleOpen = () => {
    hapticLight();
    setIsOpen(true);
  };

  const handleClose = () => {
    hapticLight();
    setIsOpen(false);
  };

  const handleSelect = (metric: AnyMetric) => {
    hapticMedium();
    onChange(metric);
    setIsOpen(false);
  };

  return (
    <>
      {/* Trigger Button */}
      <Pressable
        onPress={handleOpen}
        style={({ pressed }) => [
          styles.trigger,
          pressed && styles.triggerPressed,
          isShameMode && styles.triggerShame,
        ]}
      >
        <Text style={styles.triggerEmoji}>{getEmoji(value)}</Text>
        <Text style={[styles.triggerText, isShameMode && styles.triggerTextShame]}>
          {getMetricLabel(value)}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      {/* Modal */}
      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
        statusBarTranslucent
      >
        <View style={styles.overlay}>
          <Pressable style={styles.overlayTouchable} onPress={handleClose} />
          <Animated.View
            entering={FadeInDown.duration(200).damping(20)}
            style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.xl) }]}
          >
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>
              {isShameMode ? '💀 Sort Wall of Shame' : '📊 Sort Leaderboard'}
            </Text>
            <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false}>
              {metrics.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => handleSelect(option.value)}
                  style={({ pressed }) => [
                    styles.option,
                    option.value === value && styles.optionSelected,
                    pressed && styles.optionPressed,
                  ]}
                >
                  <Text style={styles.optionEmoji}>{option.emoji}</Text>
                  <View style={styles.optionInfo}>
                    <Text style={[styles.optionLabel, option.value === value && styles.optionLabelSelected]}>
                      {option.label}
                    </Text>
                    {option.description && (
                      <Text style={styles.optionDescription}>{option.description}</Text>
                    )}
                  </View>
                  {option.value === value && <Text style={styles.checkmark}>✓</Text>}
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Trigger
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  triggerPressed: {
    backgroundColor: Colors.bgCardHover,
  },
  triggerShame: {
    borderColor: Colors.danger + '40',
    backgroundColor: Colors.dangerDim,
  },
  triggerEmoji: {
    fontSize: 16,
  },
  triggerText: {
    ...Typography.bodySemibold,
    color: Colors.text,
    flex: 1,
  },
  triggerTextShame: {
    color: Colors.danger,
  },
  chevron: {
    fontSize: 12,
    color: Colors.textMuted,
  },

  // Modal
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  overlayTouchable: {
    flex: 1,
  },
  sheet: {
    backgroundColor: Colors.bgElevated,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    maxHeight: '60%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.systemGray4,
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  sheetTitle: {
    ...Typography.h3,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  optionsList: {
    flexGrow: 0,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    marginBottom: Spacing.sm,
  },
  optionSelected: {
    backgroundColor: Colors.accentDim,
  },
  optionPressed: {
    backgroundColor: Colors.bgCardHover,
  },
  optionEmoji: {
    fontSize: 24,
    width: 32,
    textAlign: 'center',
  },
  optionInfo: {
    flex: 1,
    gap: 2,
  },
  optionLabel: {
    ...Typography.bodySemibold,
    color: Colors.text,
  },
  optionLabelSelected: {
    color: Colors.accent,
  },
  optionDescription: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  checkmark: {
    fontSize: 18,
    color: Colors.accent,
    fontWeight: '600',
  },
});


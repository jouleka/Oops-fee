/**
 * MetricPicker - Dropdown for selecting leaderboard ranking metric
 *
 * Shows current selection and opens a modal/bottom sheet with options
 */

import { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
        className={`flex-row items-center gap-2 rounded-lg border py-3 px-4 ${
          isShameMode
            ? 'bg-danger-dim border-danger/40'
            : 'bg-card border-border active:bg-card-hover'
        }`}
      >
        <Text className="text-base">{getEmoji(value)}</Text>
        <Text className={`flex-1 text-body-semibold ${isShameMode ? 'text-danger' : 'text-white'}`}>
          {getMetricLabel(value)}
        </Text>
        <Text className="text-xs text-text-muted">▾</Text>
      </Pressable>

      {/* Modal */}
      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
        statusBarTranslucent
      >
        <View className="flex-1 bg-black/60 justify-end">
          <Pressable className="flex-1" onPress={handleClose} />
          <Animated.View
            entering={FadeInDown.duration(200).damping(20)}
            className="bg-abyss-800 rounded-t-xxl pt-3 px-4 max-h-[60%]"
            style={{ paddingBottom: Math.max(insets.bottom, 24) }}
          >
            <View className="w-9 h-1 rounded-full bg-system-gray-4 self-center mb-4" />
            <Text className="text-h3 text-white text-center mb-4">
              {isShameMode ? '💀 Sort Wall of Shame' : '📊 Sort Leaderboard'}
            </Text>
            <ScrollView className="flex-grow-0" showsVerticalScrollIndicator={false}>
              {metrics.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => handleSelect(option.value)}
                  className={`flex-row items-center gap-3 py-3 px-3 rounded-lg mb-2 ${
                    option.value === value
                      ? 'bg-imessage-dim'
                      : 'active:bg-card-hover'
                  }`}
                >
                  <Text className="text-2xl w-8 text-center">{option.emoji}</Text>
                  <View className="flex-1 gap-0.5">
                    <Text
                      className={`text-body-semibold ${
                        option.value === value ? 'text-imessage' : 'text-white'
                      }`}
                    >
                      {option.label}
                    </Text>
                    {option.description && (
                      <Text className="text-caption text-text-tertiary">{option.description}</Text>
                    )}
                  </View>
                  {option.value === value && (
                    <Text className="text-lg text-imessage font-semibold">✓</Text>
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

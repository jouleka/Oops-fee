/**
 * ShameCard - Card for Wall of Shame section with themed styling
 *
 * Shows a category of shame with icon, title, subtitle, and top entries
 * Used in the Wall of Shame tab to display different shame metrics
 */

import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Colors } from '@/constants/theme';
import { hapticLight } from '@/lib/haptics';
import { type ShameMetric, formatMetricValue } from '@/lib/leaderboard/api';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface ShameEntry {
  rank: number;
  username: string;
  display_name: string | null;
  value: number;
  is_current_user: boolean;
}

interface ShameCardProps {
  title: string;
  subtitle: string;
  emoji: string;
  metric: ShameMetric;
  entries: ShameEntry[];
  index?: number;
  onPress?: () => void;
  onEntryPress?: (username: string) => void;
}

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

const SHAME_CONFIGS: Record<
  ShameMetric,
  {
    gradient: [string, string];
    accentColor: string;
    valueLabel: string;
  }
> = {
  money_lost: {
    gradient: ['#1a0505', '#0a0505'],
    accentColor: Colors.danger,
    valueLabel: 'lost',
  },
  failed: {
    gradient: ['#0a0a1a', '#050510'],
    accentColor: '#8B5CF6', // Purple
    valueLabel: 'broken',
  },
  worst_success_rate: {
    gradient: ['#0a1a0a', '#050a05'],
    accentColor: Colors.warning,
    valueLabel: 'rate',
  },
  current_losing_streak: {
    gradient: ['#1a1005', '#0a0805'],
    accentColor: '#F59E0B', // Amber
    valueLabel: 'in a row',
  },
};

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────

export function ShameCard({
  title,
  subtitle,
  emoji,
  metric,
  entries,
  index = 0,
  onPress,
  onEntryPress,
}: ShameCardProps) {
  const scale = useSharedValue(1);
  const config = SHAME_CONFIGS[metric];

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15 });
  };

  const handlePress = () => {
    hapticLight();
    onPress?.();
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(100 + index * 80).duration(350).springify()}
      style={animStyle}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={!onPress}
      >
        <LinearGradient
          colors={config.gradient}
          className="rounded-xl border overflow-hidden p-4"
          style={{ borderColor: config.accentColor + '30' }}
        >
          {/* Header */}
          <View className="flex-row items-center gap-3 mb-4">
            <Text className="text-[32px]">{emoji}</Text>
            <View className="flex-1 gap-0.5">
              <Text
                className="text-sm font-extrabold uppercase tracking-wider"
                style={{ color: config.accentColor }}
              >
                {title}
              </Text>
              <Text className="text-caption text-text-tertiary italic">{subtitle}</Text>
            </View>
            {onPress && <Text className="text-2xl text-text-muted font-light">›</Text>}
          </View>

          {/* Entries */}
          {entries.length > 0 && (
            <View className="gap-2">
              {entries.slice(0, 3).map((entry, i) => (
                <ShameEntryRow
                  key={entry.username}
                  entry={entry}
                  metric={metric}
                  config={config}
                  index={i}
                  onPress={onEntryPress ? () => onEntryPress(entry.username) : undefined}
                />
              ))}
            </View>
          )}

          {entries.length === 0 && (
            <View className="items-center py-4 gap-1">
              <Text className="text-body-semibold text-text-tertiary">No data yet</Text>
              <Text className="text-caption text-text-muted italic">
                Be the first... or don&apos;t
              </Text>
            </View>
          )}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────
// ENTRY ROW
// ─────────────────────────────────────────────────────────────

interface ShameEntryRowProps {
  entry: ShameEntry;
  metric: ShameMetric;
  config: (typeof SHAME_CONFIGS)[ShameMetric];
  index: number;
  onPress?: () => void;
}

function ShameEntryRow({ entry, metric, config, index, onPress }: ShameEntryRowProps) {
  const rankEmojis = ['💀', '☠️', '🪦'];
  const rankEmoji = rankEmojis[index] ?? '#' + entry.rank;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className={`flex-row items-center gap-2 py-2 px-2 rounded-md ${
        entry.is_current_user
          ? 'bg-danger/10'
          : 'bg-white/[0.03] active:bg-white/[0.06]'
      }`}
    >
      <Text className="text-base w-6 text-center">{rankEmoji}</Text>
      <Text
        className={`flex-1 text-sm font-semibold ${
          entry.is_current_user ? 'text-danger' : 'text-white'
        }`}
        numberOfLines={1}
      >
        @{entry.username}
      </Text>
      <Text className="text-sm font-semibold font-mono" style={{ color: config.accentColor }}>
        {formatMetricValue(entry.value, metric)}
      </Text>
      <Text className="text-[11px] text-text-muted">{config.valueLabel}</Text>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────
// PRE-CONFIGURED CARDS
// ─────────────────────────────────────────────────────────────

interface ShameCardPresetProps {
  entries: ShameEntry[];
  index?: number;
  onPress?: () => void;
  onEntryPress?: (username: string) => void;
}

export function MoneyLostCard(props: ShameCardPresetProps) {
  return (
    <ShameCard
      title="THE BIG LOSERS"
      subtitle="Who's burned the most money?"
      emoji="💸"
      metric="money_lost"
      {...props}
    />
  );
}

export function PromisesBrokenCard(props: ShameCardPresetProps) {
  return (
    <ShameCard
      title="MOST UNRELIABLE"
      subtitle="Promises? More like suggestions"
      emoji="🤡"
      metric="failed"
      {...props}
    />
  );
}

export function WorstSuccessRateCard(props: ShameCardPresetProps) {
  return (
    <ShameCard
      title="LEAST LIKELY TO SUCCEED"
      subtitle="The stats don't lie"
      emoji="📉"
      metric="worst_success_rate"
      {...props}
    />
  );
}

export function LosingStreakCard(props: ShameCardPresetProps) {
  return (
    <ShameCard
      title="ON A ROLL... DOWNHILL"
      subtitle="Consecutive failures"
      emoji="☠️"
      metric="current_losing_streak"
      {...props}
    />
  );
}

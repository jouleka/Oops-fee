/**
 * ShameCard - Card for Wall of Shame section with themed styling
 *
 * Shows a category of shame with icon, title, subtitle, and top entries
 * Used in the Wall of Shame tab to display different shame metrics
 */

import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Colors, Fonts, Radius, Spacing, Typography } from '@/constants/theme';
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
          style={[styles.card, { borderColor: config.accentColor + '30' }]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.emoji}>{emoji}</Text>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: config.accentColor }]}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
            {onPress && <Text style={styles.chevron}>›</Text>}
          </View>

          {/* Entries */}
          {entries.length > 0 && (
            <View style={styles.entriesList}>
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
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No data yet</Text>
              <Text style={styles.emptySubtext}>Be the first... or don&apos;t</Text>
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
      style={({ pressed }) => [
        styles.entryRow,
        entry.is_current_user && styles.entryRowCurrentUser,
        pressed && styles.entryRowPressed,
      ]}
    >
      <Text style={styles.entryRank}>{rankEmoji}</Text>
      <Text
        style={[styles.entryUsername, entry.is_current_user && styles.entryUsernameCurrentUser]}
        numberOfLines={1}
      >
        @{entry.username}
      </Text>
      <Text style={[styles.entryValue, { color: config.accentColor }]}>
        {formatMetricValue(entry.value, metric)}
      </Text>
      <Text style={styles.entryLabel}>{config.valueLabel}</Text>
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

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    padding: Spacing.lg,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  emoji: {
    fontSize: 32,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...Typography.h3,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontSize: 14,
    fontWeight: '800',
  },
  subtitle: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },
  chevron: {
    fontSize: 24,
    color: Colors.textMuted,
    fontWeight: '300',
  },

  // Entries
  entriesList: {
    gap: Spacing.sm,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  entryRowCurrentUser: {
    backgroundColor: 'rgba(255, 69, 58, 0.1)',
  },
  entryRowPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  entryRank: {
    fontSize: 16,
    width: 24,
    textAlign: 'center',
  },
  entryUsername: {
    ...Typography.bodySemibold,
    color: Colors.text,
    flex: 1,
    fontSize: 14,
  },
  entryUsernameCurrentUser: {
    color: Colors.danger,
  },
  entryValue: {
    ...Typography.bodySemibold,
    fontFamily: Fonts.mono,
    fontSize: 14,
  },
  entryLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontSize: 11,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    gap: 4,
  },
  emptyText: {
    ...Typography.bodySemibold,
    color: Colors.textTertiary,
  },
  emptySubtext: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
});


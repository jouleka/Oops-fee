/**
 * LeaderboardEntry - Single row in a leaderboard ranking list
 *
 * Shows: rank, avatar with initials, username, metric value, position change indicator
 * Special styling for current user and top 3 positions
 */

import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Colors } from '@/constants/theme';
import { type GloryMetric, type ShameMetric, type GlobalMetric, formatMetricValue, formatRankChange } from '@/lib/leaderboard/api';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface LeaderboardEntryData {
  rank: number;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  value: number;
  change: number | null;
  is_current_user: boolean;
}

interface LeaderboardEntryProps {
  entry: LeaderboardEntryData;
  metric: GloryMetric | ShameMetric | GlobalMetric;
  isShameMode?: boolean;
  index?: number;
  onPress?: (userId: string) => void;
}

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

const RANK_MEDALS: Record<number, string> = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
};

const SHAME_MEDALS: Record<number, string> = {
  1: '💀',
  2: '☠️',
  3: '🪦',
};

const PODIUM_GRADIENTS: Record<number, [string, string]> = {
  1: ['#FFD700', '#B8860B'], // Gold
  2: ['#C0C0C0', '#808080'], // Silver
  3: ['#CD7F32', '#8B4513'], // Bronze
};

const SHAME_GRADIENTS: Record<number, [string, string]> = {
  1: [Colors.danger, '#8B0000'], // Dark red
  2: ['#DC143C', '#8B0000'],
  3: ['#B22222', '#800000'],
};

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function getInitials(displayName: string | null, username: string): string {
  const name = displayName || username;
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────

export function LeaderboardEntry({
  entry,
  metric,
  isShameMode = false,
  index = 0,
  onPress,
}: LeaderboardEntryProps) {
  const scale = useSharedValue(1);

  const isPodium = entry.rank <= 3;
  const medals = isShameMode ? SHAME_MEDALS : RANK_MEDALS;
  const gradients = isShameMode ? SHAME_GRADIENTS : PODIUM_GRADIENTS;

  const changeInfo = formatRankChange(entry.change);
  const formattedValue = formatMetricValue(entry.value, metric);

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
    onPress?.(entry.user_id);
  };

  return (
    <Animated.View
      entering={FadeInUp.delay(50 + index * 40).duration(280).springify()}
      style={animStyle}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={!onPress}
        className={`flex-row items-center gap-3 py-3 px-4 rounded-lg border ${
          entry.is_current_user
            ? 'bg-imessage-dim border-imessage/40'
            : isPodium
              ? 'bg-card border-border-focus'
              : 'bg-card border-border active:bg-card-hover'
        }`}
      >
        {/* Rank */}
        <View className={`items-center justify-center ${isPodium ? 'w-9' : 'w-10'}`}>
          {isPodium ? (
            <Text className="text-[22px] text-center">{medals[entry.rank]}</Text>
          ) : (
            <Text
              className={`text-body-semibold font-mono ${
                entry.is_current_user ? 'text-imessage' : 'text-text-tertiary'
              }`}
            >
              #{entry.rank}
            </Text>
          )}
        </View>

        {/* Avatar */}
        {isPodium ? (
          <LinearGradient colors={gradients[entry.rank]} className="w-10 h-10 rounded-full items-center justify-center">
            <Text className="text-sm font-bold text-white tracking-wide">
              {getInitials(entry.display_name, entry.username)}
            </Text>
          </LinearGradient>
        ) : (
          <View
            className={`w-10 h-10 rounded-full items-center justify-center ${
              entry.is_current_user ? 'bg-imessage' : 'bg-system-gray-4'
            }`}
          >
            <Text className="text-sm font-bold text-white tracking-wide">
              {getInitials(entry.display_name, entry.username)}
            </Text>
          </View>
        )}

        {/* User Info */}
        <View className="flex-1 gap-0.5 min-w-0">
          <View className="flex-row items-center gap-2">
            <Text
              className={`text-body-semibold shrink ${
                entry.is_current_user ? 'text-imessage' : 'text-white'
              }`}
              numberOfLines={1}
            >
              @{entry.username}
            </Text>
            {entry.is_current_user && (
              <Text className="text-[10px] font-bold text-imessage bg-imessage-dim px-1.5 py-0.5 rounded-sm uppercase tracking-wide overflow-hidden">
                You
              </Text>
            )}
          </View>
          {entry.display_name && entry.display_name !== entry.username && (
            <Text className="text-caption text-text-tertiary" numberOfLines={1}>
              {entry.display_name}
            </Text>
          )}
        </View>

        {/* Value */}
        <View className="items-end gap-0.5">
          <Text
            className={`text-body-semibold font-mono ${
              isShameMode
                ? 'text-danger'
                : entry.is_current_user
                  ? 'text-imessage'
                  : 'text-success'
            }`}
          >
            {formattedValue}
          </Text>
          <Text
            className={`text-[11px] ${
              changeInfo.color === 'green'
                ? 'text-success'
                : changeInfo.color === 'red'
                  ? 'text-danger'
                  : 'text-text-muted'
            }`}
          >
            {changeInfo.text}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

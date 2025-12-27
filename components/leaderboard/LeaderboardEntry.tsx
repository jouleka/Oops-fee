/**
 * LeaderboardEntry - Single row in a leaderboard ranking list
 *
 * Shows: rank, avatar with initials, username, metric value, position change indicator
 * Special styling for current user and top 3 positions
 */

import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Colors, Fonts, Radius, Spacing, Typography } from '@/constants/theme';
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
        style={({ pressed }) => [
          styles.container,
          isPodium && styles.containerPodium,
          entry.is_current_user && styles.containerCurrentUser,
          pressed && styles.containerPressed,
        ]}
      >
        {/* Rank */}
        <View style={[styles.rankContainer, isPodium && styles.rankContainerPodium]}>
          {isPodium ? (
            <Text style={styles.rankMedal}>{medals[entry.rank]}</Text>
          ) : (
            <Text style={[styles.rankNumber, entry.is_current_user && styles.rankNumberCurrentUser]}>
              #{entry.rank}
            </Text>
          )}
        </View>

        {/* Avatar */}
        {isPodium ? (
          <LinearGradient colors={gradients[entry.rank]} style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(entry.display_name, entry.username)}</Text>
          </LinearGradient>
        ) : (
          <View style={[styles.avatar, styles.avatarDefault, entry.is_current_user && styles.avatarCurrentUser]}>
            <Text style={styles.avatarText}>{getInitials(entry.display_name, entry.username)}</Text>
          </View>
        )}

        {/* User Info */}
        <View style={styles.userInfo}>
          <View style={styles.nameRow}>
            <Text
              style={[
                styles.username,
                entry.is_current_user && styles.usernameCurrentUser,
              ]}
              numberOfLines={1}
            >
              @{entry.username}
            </Text>
            {entry.is_current_user && <Text style={styles.youBadge}>You</Text>}
          </View>
          {entry.display_name && entry.display_name !== entry.username && (
            <Text style={styles.displayName} numberOfLines={1}>
              {entry.display_name}
            </Text>
          )}
        </View>

        {/* Value */}
        <View style={styles.valueContainer}>
          <Text
            style={[
              styles.value,
              isShameMode && styles.valueShame,
              entry.is_current_user && !isShameMode && styles.valueCurrentUser,
            ]}
          >
            {formattedValue}
          </Text>
          <Text
            style={[
              styles.change,
              changeInfo.color === 'green' && styles.changeGreen,
              changeInfo.color === 'red' && styles.changeRed,
            ]}
          >
            {changeInfo.text}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  containerPodium: {
    borderColor: Colors.borderFocus,
  },
  containerCurrentUser: {
    backgroundColor: Colors.accentDim,
    borderColor: Colors.accent + '66',
  },
  containerPressed: {
    backgroundColor: Colors.bgCardHover,
  },

  // Rank
  rankContainer: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankContainerPodium: {
    width: 36,
  },
  rankNumber: {
    ...Typography.bodySemibold,
    color: Colors.textTertiary,
    fontFamily: Fonts.mono,
  },
  rankNumberCurrentUser: {
    color: Colors.accent,
  },
  rankMedal: {
    fontSize: 22,
    textAlign: 'center',
  },

  // Avatar
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarDefault: {
    backgroundColor: Colors.systemGray4,
  },
  avatarCurrentUser: {
    backgroundColor: Colors.accent,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: 0.5,
  },

  // User Info
  userInfo: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  username: {
    ...Typography.bodySemibold,
    color: Colors.text,
    flexShrink: 1,
  },
  usernameCurrentUser: {
    color: Colors.accent,
  },
  youBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.accent,
    backgroundColor: Colors.accentDim,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  displayName: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },

  // Value
  valueContainer: {
    alignItems: 'flex-end',
    gap: 2,
  },
  value: {
    ...Typography.bodySemibold,
    color: Colors.success,
    fontFamily: Fonts.mono,
  },
  valueShame: {
    color: Colors.danger,
  },
  valueCurrentUser: {
    color: Colors.accent,
  },
  change: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontSize: 11,
  },
  changeGreen: {
    color: Colors.success,
  },
  changeRed: {
    color: Colors.danger,
  },
});


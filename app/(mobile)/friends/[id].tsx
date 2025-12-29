/**
 * Friend Profile Screen
 *
 * View a friend's profile, active promises, stats, and recent history.
 */

import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import {
  getFriendProfile,
  getInitials,
  type FriendHistoryItem,
  type FriendPromise,
  type FriendStats,
  type GetFriendProfileResponse,
} from '@/lib/friends';
import { getTimeRemaining as getTimeRemainingShared, type Urgency } from '@/lib/promises/time';

const URGENCY_COLORS: Record<Urgency, string> = {
  low: '#34C759',
  medium: '#FF9F0A',
  high: '#FF6B35',
  critical: '#FF453A',
};

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function hapticLight() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}


function formatDate(dateString: string | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getSuccessRateColor(rate: number): string {
  if (rate >= 80) return 'text-success';
  if (rate >= 50) return 'text-warning';
  if (rate > 0) return 'text-danger';
  return 'text-text-muted';
}

function getStreakEmoji(count: number): string {
  if (count >= 100) return '👑';
  if (count >= 30) return '⚡';
  if (count >= 7) return '🔥';
  if (count >= 3) return '✨';
  return '';
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

export default function FriendProfileScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isAuthenticated } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GetFriendProfileResponse | null>(null);

  // Fetch friend profile
  const fetchData = useCallback(async () => {
    if (!id) return;

    try {
      const response = await getFriendProfile(id);
      setData(response);
      setError(null);
    } catch (err) {
      console.error('[FriendProfile] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    }
  }, [id]);

  // Initial load
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      await fetchData();
      setIsLoading(false);
    };
    load();
  }, [fetchData]);

  // Pull to refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  };

  const handleBack = () => {
    hapticLight();
    router.back();
  };

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <View className="flex-1 bg-black" style={{ paddingTop: insets.top }}>
        <Header onBack={handleBack} />
        <View className="flex-1 items-center justify-center px-xl gap-md">
          <Text className="text-[48px] mb-sm">🔒</Text>
          <Text className="text-h3 text-white text-center">Sign in required</Text>
          <Text className="text-body text-text-secondary text-center max-w-[280px]">
            Sign in to view friend profiles
          </Text>
        </View>
      </View>
    );
  }

  // Loading
  if (isLoading) {
    return (
      <View className="flex-1 bg-black" style={{ paddingTop: insets.top }}>
        <Header onBack={handleBack} />
        <View className="flex-1 items-center justify-center px-xl gap-md">
          <ActivityIndicator size="large" color="#0B93F6" />
          <Text className="text-caption text-text-tertiary mt-sm">Loading profile...</Text>
        </View>
      </View>
    );
  }

  // Error
  if (error || !data) {
    return (
      <View className="flex-1 bg-black" style={{ paddingTop: insets.top }}>
        <Header onBack={handleBack} />
        <View className="flex-1 items-center justify-center px-xl gap-md">
          <Text className="text-[48px] mb-sm">😕</Text>
          <Text className="text-h3 text-white text-center">Couldn&apos;t load profile</Text>
          <Text className="text-body text-text-secondary text-center max-w-[280px]">
            {error || 'Something went wrong'}
          </Text>
          <Pressable
            onPress={() => {
              hapticLight();
              fetchData();
            }}
            className="mt-md bg-imessage px-xl py-md rounded-lg active:opacity-80"
          >
            <Text className="text-body-semibold text-white">Try Again</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const { profile, activePromises, stats, recentHistory } = data;
  const displayName = profile.display_name || profile.username || 'User';
  const initial = getInitials(profile);

  return (
    <View className="flex-1 bg-black" style={{ paddingTop: insets.top }}>
      <Header onBack={handleBack} title={displayName} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, gap: 24, paddingBottom: insets.bottom + 32 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="rgba(255,255,255,0.3)"
          />
        }
      >
        {/* Profile Card */}
        <Animated.View
          entering={FadeInDown.duration(300)}
          className="flex-row items-center gap-lg bg-card rounded-xl border border-border p-lg"
        >
          <LinearGradient
            colors={['#0B93F6', '#0A7FD4']}
            className="w-16 h-16 rounded-full items-center justify-center"
          >
            <Text className="text-[28px] font-bold text-white">{initial}</Text>
          </LinearGradient>

          <View className="flex-1 gap-xs">
            <Text className="text-h2 text-white font-rounded">{displayName}</Text>
            {profile.username && (
              <Text className="text-caption text-imessage font-mono">@{profile.username}</Text>
            )}
          </View>
        </Animated.View>

        {/* Stats Overview */}
        <StatsSection stats={stats} />

        {/* Active Promises */}
        <ActivePromisesSection promises={activePromises} friendName={displayName} />

        {/* Recent History */}
        <HistorySection history={recentHistory} />

        {/* Footer */}
        <Animated.View entering={FadeIn.delay(600).duration(400)} className="items-center pt-lg pb-md">
          <Text className="text-caption text-text-muted italic text-center">
            Friends hold each other accountable. 💪
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// HEADER
// ─────────────────────────────────────────────────────────────

function Header({ onBack, title }: { onBack: () => void; title?: string }) {
  return (
    <View className="flex-row items-center justify-between px-lg py-md">
      <Pressable
        onPress={onBack}
        className="w-10 h-10 rounded-full bg-card border border-border items-center justify-center active:opacity-70"
      >
        <Text className="text-[20px] text-white">←</Text>
      </Pressable>

      <Text className="text-h2 text-white font-rounded flex-1 text-center mx-md" numberOfLines={1}>
        {title || 'Profile'}
      </Text>
      <View className="w-10" />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// STATS SECTION
// ─────────────────────────────────────────────────────────────

function StatsSection({ stats }: { stats: FriendStats }) {
  const shouldGlow = stats.currentStreak >= 7;
  const glow = useSharedValue(0);

  useEffect(() => {
    if (!shouldGlow) return;
    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000 }),
        withTiming(0, { duration: 2000 })
      ),
      -1,
      true
    );
  }, [glow, shouldGlow]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glow.value, [0, 1], [0.3, 0.6]),
    transform: [{ scale: interpolate(glow.value, [0, 1], [0.9, 1.1]) }],
  }));

  return (
    <Animated.View entering={FadeInDown.delay(100).duration(300)} className="gap-md">
      <Text className="text-label text-text-muted ml-xs uppercase tracking-wide">STATS</Text>

      {/* Streak Hero */}
      <View className="bg-card rounded-lg border border-border p-xl items-center relative overflow-hidden">
        {shouldGlow && (
          <Animated.View
            style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }, glowStyle]}
          >
            <View className="w-[120px] h-[120px] rounded-full bg-warning" />
          </Animated.View>
        )}
        <View className="items-center gap-xs">
          <Text className="text-label text-text-muted uppercase tracking-wide">CURRENT STREAK</Text>
          <View className="flex-row items-center gap-sm">
            <Text className={`text-display-md font-rounded ${stats.currentStreak > 0 ? 'text-warning' : 'text-text-tertiary'}`}>
              {stats.currentStreak}
            </Text>
            {stats.currentStreak > 0 && (
              <Text className="text-[32px]">{getStreakEmoji(stats.currentStreak)}</Text>
            )}
          </View>
        </View>
      </View>

      {/* Stats Grid */}
      <View className="flex-row gap-md">
        <View className="flex-1 bg-card rounded-lg border border-border p-lg items-center gap-xs">
          <Text className="text-label text-text-muted text-[9px] uppercase tracking-wide">SUCCESS RATE</Text>
          <Text className={`text-h2 font-rounded ${getSuccessRateColor(stats.successRate)}`}>
            {stats.successRate}%
          </Text>
        </View>
        <View className="flex-1 bg-card rounded-lg border border-border p-lg items-center gap-xs">
          <Text className="text-label text-text-muted text-[9px] uppercase tracking-wide">LONGEST STREAK</Text>
          <Text className={`text-h2 font-rounded ${stats.longestStreak > 0 ? 'text-imessage' : 'text-white'}`}>
            {stats.longestStreak}
          </Text>
        </View>
      </View>

      {/* Money Stats */}
      <View className="flex-row gap-sm">
        <View className="flex-1 bg-card rounded-lg border border-border p-md items-center gap-1">
          <Text className="text-label text-text-muted text-[9px] uppercase tracking-wide">SAVED</Text>
          <Text className="text-h3 font-mono text-success">${stats.totalSaved}</Text>
        </View>
        <View className="flex-1 bg-card rounded-lg border border-border p-md items-center gap-1">
          <Text className="text-label text-text-muted text-[9px] uppercase tracking-wide">LOST</Text>
          <Text className="text-h3 font-mono text-danger">${stats.totalLost}</Text>
        </View>
        <View className="flex-1 bg-card rounded-lg border border-border p-md items-center gap-1">
          <Text className="text-label text-text-muted text-[9px] uppercase tracking-wide">TOTAL</Text>
          <Text className="text-h3 font-mono text-white">{stats.totalPromises}</Text>
        </View>
      </View>

      {/* Promise Breakdown */}
      <View className="flex-row bg-card rounded-lg border border-border p-lg">
        <View className="flex-1 items-center gap-1">
          <Text className="text-h2 font-rounded text-success">{stats.completed}</Text>
          <Text className="text-caption text-text-tertiary">Kept</Text>
        </View>
        <View className="w-px bg-border my-1" />
        <View className="flex-1 items-center gap-1">
          <Text className="text-h2 font-rounded text-danger">{stats.failed}</Text>
          <Text className="text-caption text-text-tertiary">Broken</Text>
        </View>
      </View>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────
// ACTIVE PROMISES SECTION
// ─────────────────────────────────────────────────────────────

function ActivePromisesSection({ promises, friendName }: { promises: FriendPromise[]; friendName: string }) {
  if (promises.length === 0) {
    return (
      <Animated.View entering={FadeInDown.delay(200).duration(300)} className="gap-md">
        <Text className="text-label text-text-muted ml-xs uppercase tracking-wide">ACTIVE PROMISES</Text>
        <View className="bg-card rounded-lg border border-border p-xl items-center gap-sm">
          <Text className="text-[36px]">🎯</Text>
          <Text className="text-body text-white text-center">No active promises right now</Text>
          <Text className="text-caption text-text-tertiary text-center italic">{friendName} is taking a break</Text>
        </View>
      </Animated.View>
    );
  }

  // Sort by deadline - most urgent first
  const sorted = [...promises].sort(
    (a, b) => new Date(a.deadline_at).getTime() - new Date(b.deadline_at).getTime()
  );

  return (
    <Animated.View entering={FadeInDown.delay(200).duration(300)} className="gap-md">
      <Text className="text-label text-text-muted ml-xs uppercase tracking-wide">ACTIVE PROMISES ({promises.length})</Text>
      <View className="gap-sm">
        {sorted.map((promise, index) => (
          <PromiseCard key={promise.id} promise={promise} index={index} />
        ))}
      </View>
    </Animated.View>
  );
}

function PromiseCard({ promise, index }: { promise: FriendPromise; index: number }) {
  const deadlineMs = new Date(promise.deadline_at).getTime();
  const { label, urgency } = getTimeRemainingShared(deadlineMs);
  const color = URGENCY_COLORS[urgency];

  return (
    <Animated.View
      entering={FadeInDown.delay(250 + index * 50).duration(250)}
      className="flex-row items-center bg-card rounded-lg border border-border overflow-hidden"
    >
      <View className="w-1 self-stretch" style={{ backgroundColor: color }} />
      <View className="flex-1 p-lg gap-sm">
        <Text className="text-body-medium text-white" numberOfLines={2}>
          {promise.text}
        </Text>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-sm">
            <Text className="text-body-semibold text-danger font-mono">${promise.stake}</Text>
            {promise.sponsor_count > 0 && (
              <View className="bg-success-dim px-xs py-0.5 rounded-sm">
                <Text className="text-caption text-success font-mono text-[11px]">
                  +${(promise.sponsor_total / 100).toFixed(0)}
                </Text>
              </View>
            )}
            {promise.has_roast && <Text className="text-[14px]">🔥</Text>}
          </View>
          <View className="py-1 px-2 rounded-sm" style={{ backgroundColor: color + '18' }}>
            <Text className="text-caption font-semibold" style={{ color }}>{label}</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────
// HISTORY SECTION
// ─────────────────────────────────────────────────────────────

function HistorySection({ history }: { history: FriendHistoryItem[] }) {
  if (history.length === 0) {
    return null;
  }

  return (
    <Animated.View entering={FadeInDown.delay(350).duration(300)} className="gap-md">
      <Text className="text-label text-text-muted ml-xs uppercase tracking-wide">RECENT HISTORY</Text>
      <View className="gap-sm">
        {history.map((item, index) => (
          <HistoryCard key={item.id} item={item} index={index} />
        ))}
      </View>
    </Animated.View>
  );
}

function HistoryCard({ item, index }: { item: FriendHistoryItem; index: number }) {
  const isSuccess = item.status === 'completed';
  const icon = isSuccess ? '✓' : '✕';
  const color = isSuccess ? Colors.success : Colors.danger;
  const date = formatDate(item.completed_at || item.failed_at);

  return (
    <Animated.View
      entering={FadeInDown.delay(400 + index * 40).duration(200)}
      className="flex-row items-center bg-card rounded-lg border border-border p-md gap-md"
    >
      <View
        className="w-8 h-8 rounded-full items-center justify-center"
        style={{ backgroundColor: color + '20' }}
      >
        <Text className="text-[14px] font-bold" style={{ color }}>{icon}</Text>
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-body text-white" numberOfLines={1}>{item.text}</Text>
        <View className="flex-row items-center gap-sm">
          <Text className="text-caption text-text-secondary font-mono">${item.stake}</Text>
          {date && <Text className="text-caption text-text-muted">{date}</Text>}
        </View>
      </View>
    </Animated.View>
  );
}

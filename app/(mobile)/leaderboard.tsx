/**
 * Leaderboard Screen
 *
 * Tab-based leaderboard with Friends, Global, and Wall of Shame views.
 * Shows rankings based on various metrics and time periods.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  SlideInRight,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  LeaderboardEntry,
  MetricPicker,
  PeriodSelector,
  type LeaderboardEntryData,
} from '@/components/leaderboard';
import { LoadingState } from '@/components/ui/loading-state';
import { Colors } from '@/constants/theme';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import {
  fetchFriendsLeaderboard,
  fetchGlobalLeaderboard,
  type FriendsLeaderboardResponse,
  type GlobalLeaderboardResponse,
  type GlobalMetric,
  type GloryMetric,
  type Period,
  type ShameMetric,
} from '@/lib/leaderboard/api';

// Shame metrics available on global leaderboard
type GlobalShameMetric = 'money_lost' | 'failed';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

type TabId = 'friends' | 'global' | 'shame';

interface Tab {
  id: TabId;
  label: string;
  emoji: string;
}

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

const TABS: Tab[] = [
  { id: 'friends', label: 'Friends', emoji: '👥' },
  { id: 'global', label: 'Global', emoji: '🌍' },
  { id: 'shame', label: 'Shame', emoji: '💀' },
];

const SHAME_TAGLINES = [
  "Where promises go to die",
  "Hall of broken dreams",
  "The Museum of Regret",
  "Accountability's graveyard",
  "No refunds on lost dignity",
];

// ─────────────────────────────────────────────────────────────
// TAB SELECTOR COMPONENT
// ─────────────────────────────────────────────────────────────

interface TabSelectorProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

function TabSelector({ activeTab, onTabChange }: TabSelectorProps) {
  const activeIndex = TABS.findIndex((t) => t.id === activeTab);
  const pillWidth = 100 / TABS.length;

  const animatedIndicatorStyle = useAnimatedStyle(() => ({
    left: withSpring(`${activeIndex * pillWidth}%`, { damping: 18, stiffness: 200 }),
    width: `${pillWidth}%`,
  }));

  const handleSelect = (tabId: TabId) => {
    if (tabId !== activeTab) {
      hapticLight();
      onTabChange(tabId);
    }
  };

  return (
    <View className="relative flex-row bg-card rounded-lg border border-border p-1">
      <Animated.View
        className={`absolute top-1 bottom-1 rounded-md shadow-md ${
          activeTab === 'shame' ? 'bg-danger-dim' : 'bg-abyss-800'
        }`}
        style={animatedIndicatorStyle}
      />
      {TABS.map((tab) => (
        <Pressable
          key={tab.id}
          onPress={() => handleSelect(tab.id)}
          className="flex-1 items-center justify-center py-2.5 z-[1]"
        >
          <Text
            numberOfLines={1}
            className={`text-caption font-semibold ${
              activeTab === tab.id
                ? tab.id === 'shame'
                  ? 'text-danger'
                  : 'text-white'
                : 'text-text-tertiary'
            }`}
          >
            {tab.emoji} {tab.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────

interface EmptyStateProps {
  tabId: TabId;
}

function EmptyState({ tabId }: EmptyStateProps) {
  const content = useMemo(() => {
    switch (tabId) {
      case 'friends':
        return {
          emoji: '👥',
          title: 'No friends yet',
          subtitle: 'Add some friends to compete with them on the leaderboard.',
        };
      case 'global':
        return {
          emoji: '🌍',
          title: 'No global rankings yet',
          subtitle: 'Complete some promises to appear on the global leaderboard.',
        };
      case 'shame':
        return {
          emoji: '😇',
          title: 'Wall of Shame is empty',
          subtitle: "Everyone's keeping their promises. For now...",
        };
    }
  }, [tabId]);

  return (
    <Animated.View entering={FadeInDown.duration(300)} className="items-center py-12 gap-3">
      <Text className="text-5xl">{content.emoji}</Text>
      <Text className="text-h3 text-white font-rounded">{content.title}</Text>
      <Text className="text-body text-text-tertiary text-center px-6">{content.subtitle}</Text>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────
// RANKINGS LIST
// ─────────────────────────────────────────────────────────────

interface RankingsListProps {
  rankings: LeaderboardEntryData[];
  metric: GloryMetric | ShameMetric | GlobalMetric;
  isShameMode: boolean;
  onUserPress?: (userId: string) => void;
}

function RankingsList({ rankings, metric, isShameMode, onUserPress }: RankingsListProps) {
  if (rankings.length === 0) {
    return null;
  }

  return (
    <View className="gap-3">
      {rankings.map((entry, index) => (
        <LeaderboardEntry
          key={entry.user_id}
          entry={entry}
          metric={metric}
          isShameMode={isShameMode}
          index={index}
          onPress={onUserPress}
        />
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// YOUR RANK CARD
// ─────────────────────────────────────────────────────────────

interface YourRankCardProps {
  rank: number;
  total: number;
  isShameMode?: boolean;
}

function YourRankCard({ rank, total, isShameMode }: YourRankCardProps) {
  const percentile = Math.round((1 - rank / total) * 100);

  const message = useMemo(() => {
    if (rank === 0) return '';
    if (isShameMode) {
      if (rank === 1) return "You're the biggest loser. Congrats?";
      if (rank <= 3) return "You're on the podium of shame 🏆";
      return "At least you're not #1 here...";
    }

    if (rank === 1) return "You're crushing it! 👑";
    if (percentile >= 90) return 'Top 10%! Keep going!';
    if (percentile >= 75) return 'Solid performance!';
    if (percentile >= 50) return 'Room for improvement';
    return "Time to step up your game";
  }, [rank, percentile, isShameMode]);

  if (rank === 0) return null;

  return (
    <Animated.View
      entering={SlideInRight.delay(200).duration(300)}
      className={`flex-row items-center justify-between rounded-lg border p-4 ${
        isShameMode
          ? 'bg-danger-dim border-danger/40'
          : 'bg-imessage-dim border-imessage/40'
      }`}
    >
      <View className="gap-1">
        <Text className={`text-label ${isShameMode ? 'text-danger' : 'text-imessage'}`}>
          YOUR RANK
        </Text>
        <Text
          className={`text-caption italic ${
            isShameMode ? 'text-danger/80' : 'text-text-secondary'
          }`}
        >
          {message}
        </Text>
      </View>
      <View className="items-end">
        <Text
          className={`text-display-sm font-rounded ${
            isShameMode ? 'text-danger' : 'text-imessage'
          }`}
        >
          #{rank}
        </Text>
        <Text className="text-caption text-text-muted">of {total}</Text>
      </View>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────

export default function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const { isAuthenticated, isLoading: authLoading } = useRequireAuth();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabId>('friends');

  // Filter state
  const [period, setPeriod] = useState<Period>('all_time');
  const [friendsMetric, setFriendsMetric] = useState<GloryMetric>('success_rate');
  const [globalMetric, setGlobalMetric] = useState<GlobalMetric>('success_rate');
  const [shameMetric, setShameMetric] = useState<GlobalShameMetric>('money_lost');

  // Data state
  const [friendsData, setFriendsData] = useState<FriendsLeaderboardResponse | null>(null);
  const [globalData, setGlobalData] = useState<GlobalLeaderboardResponse | null>(null);
  const [shameData, setShameData] = useState<GlobalLeaderboardResponse | null>(null);

  // Loading & error state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─────────────────────────────────────────────────────────────
  // DATA FETCHING
  // ─────────────────────────────────────────────────────────────

  const loadFriendsData = useCallback(async () => {
    try {
      const data = await fetchFriendsLeaderboard({
        metric: friendsMetric,
        period,
        shame_mode: false,
      });
      setFriendsData(data);
    } catch (err) {
      console.error('Failed to load friends leaderboard:', err);
      setError('Failed to load friends leaderboard');
    }
  }, [friendsMetric, period]);

  const loadGlobalData = useCallback(async () => {
    try {
      const data = await fetchGlobalLeaderboard({
        metric: globalMetric,
        period,
        limit: 50,
      });
      setGlobalData(data);
    } catch (err) {
      console.error('Failed to load global leaderboard:', err);
      setError('Failed to load global leaderboard');
    }
  }, [globalMetric, period]);

  const loadShameData = useCallback(async () => {
    try {
      // Use global leaderboard with shame metrics
      const data = await fetchGlobalLeaderboard({
        metric: shameMetric,
        period,
        limit: 50,
      });
      setShameData(data);
    } catch (err) {
      console.error('Failed to load shame data:', err);
      setError('Failed to load wall of shame');
    }
  }, [shameMetric, period]);

  const loadData = useCallback(async () => {
    setError(null);
    setLoading(true);

    try {
      switch (activeTab) {
        case 'friends':
          await loadFriendsData();
          break;
        case 'global':
          await loadGlobalData();
          break;
        case 'shame':
          await loadShameData();
          break;
      }
    } finally {
      setLoading(false);
    }
  }, [activeTab, loadFriendsData, loadGlobalData, loadShameData]);

  const handleRefresh = useCallback(async () => {
    hapticLight();
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // Load data on mount and when tab/filters change
  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─────────────────────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────────────────────

  const handleBack = useCallback(() => {
    hapticLight();
    router.back();
  }, []);

  const handleTabChange = useCallback((tab: TabId) => {
    hapticMedium();
    setActiveTab(tab);
  }, []);

  const handleUserPress = useCallback((userId: string) => {
    hapticLight();
    // TODO: Navigate to user profile
    console.log('Navigate to user:', userId);
  }, []);

  const handleShameMetricChange = useCallback((metric: GlobalShameMetric) => {
    hapticMedium();
    setShameMetric(metric);
  }, []);

  // ─────────────────────────────────────────────────────────────
  // COMPUTED
  // ─────────────────────────────────────────────────────────────

  const isShameMode = activeTab === 'shame';

  const currentMetric = useMemo(() => {
    if (activeTab === 'friends') return friendsMetric;
    if (activeTab === 'global') return globalMetric;
    return shameMetric;
  }, [activeTab, friendsMetric, globalMetric, shameMetric]);

  const currentRankings = useMemo((): LeaderboardEntryData[] => {
    if (activeTab === 'friends' && friendsData) {
      return friendsData.rankings;
    }
    if (activeTab === 'global' && globalData) {
      return globalData.rankings;
    }
    if (activeTab === 'shame' && shameData) {
      return shameData.rankings;
    }
    return [];
  }, [activeTab, friendsData, globalData, shameData]);

  const currentUserRank = useMemo(() => {
    if (activeTab === 'friends' && friendsData) {
      // +1 because total_friends excludes the current user
      return { rank: friendsData.current_user_rank, total: friendsData.total_friends + 1 };
    }
    if (activeTab === 'global' && globalData) {
      return { rank: globalData.current_user_rank, total: globalData.total_users };
    }
    if (activeTab === 'shame' && shameData) {
      return { rank: shameData.current_user_rank, total: shameData.total_users };
    }
    return { rank: 0, total: 0 };
  }, [activeTab, friendsData, globalData, shameData]);

  const hasData = useMemo(() => {
    if (activeTab === 'friends') return friendsData && friendsData.rankings.length > 0;
    if (activeTab === 'global') return globalData && globalData.rankings.length > 0;
    if (activeTab === 'shame') return shameData && shameData.rankings.length > 0;
    return false;
  }, [activeTab, friendsData, globalData, shameData]);

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────

  if (authLoading || !isAuthenticated) {
    return <LoadingState title="Loading..." subtitle="Checking authentication" />;
  }

  return (
    <View className="flex-1 bg-black" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row items-center gap-3 px-6 pt-4 pb-4 border-b border-border-subtle">
        <Pressable
          onPress={handleBack}
          className="w-9 h-9 rounded-full bg-card border border-border items-center justify-center active:opacity-90 active:scale-[0.98]"
        >
          <Text className="text-[28px] leading-7 text-text-secondary -mt-0.5">‹</Text>
        </Pressable>
        <View className="flex-1 gap-0.5">
          <Text className="text-h2 text-white font-rounded">Leaderboard</Text>
          <Text className="text-caption text-text-tertiary">See how you stack up</Text>
        </View>
        <View className="w-9" />
      </View>

      {/* Tab Selector */}
      <View className="px-6 py-4 border-b border-border-subtle">
        <TabSelector activeTab={activeTab} onTabChange={handleTabChange} />
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: insets.bottom + 32, gap: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={isShameMode ? Colors.danger : Colors.accent}
          />
        }
      >
        {/* Shame Header */}
        {activeTab === 'shame' && (
          <Animated.View entering={FadeIn.duration(400)} className="items-center">
            <LinearGradient
              colors={['rgba(255, 69, 58, 0.15)', 'rgba(255, 69, 58, 0)']}
              className="w-full items-center py-4 rounded-xl"
            >
              <Text className="text-display-sm text-danger font-extrabold tracking-widest uppercase">
                WALL OF SHAME
              </Text>
              <Text className="text-caption text-text-tertiary italic mt-1">
                &ldquo;{SHAME_TAGLINES[Math.floor(Date.now() / 60000) % SHAME_TAGLINES.length]}&rdquo;
              </Text>
            </LinearGradient>
          </Animated.View>
        )}

        {/* Filters Section */}
        <Animated.View entering={FadeIn.duration(200)} className="gap-3">
          <PeriodSelector value={period} onChange={setPeriod} isShameMode={isShameMode} />
          {activeTab === 'friends' && (
            <MetricPicker
              value={friendsMetric}
              onChange={(m) => setFriendsMetric(m as GloryMetric)}
              scope="friends"
              isShameMode={false}
            />
          )}
          {activeTab === 'global' && (
            <MetricPicker
              value={globalMetric}
              onChange={(m) => setGlobalMetric(m as GlobalMetric)}
              scope="global"
              isShameMode={false}
            />
          )}
          {activeTab === 'shame' && (
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => handleShameMetricChange('money_lost')}
                className={`flex-1 flex-row items-center justify-center gap-2 rounded-lg border py-3 px-4 ${
                  shameMetric === 'money_lost'
                    ? 'bg-danger-dim border-danger/60'
                    : 'bg-card border-border'
                }`}
              >
                <Text className="text-base">💸</Text>
                <Text
                  className={`text-body-semibold ${
                    shameMetric === 'money_lost' ? 'text-danger' : 'text-text-secondary'
                  }`}
                >
                  Money Lost
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleShameMetricChange('failed')}
                className={`flex-1 flex-row items-center justify-center gap-2 rounded-lg border py-3 px-4 ${
                  shameMetric === 'failed'
                    ? 'bg-danger-dim border-danger/60'
                    : 'bg-card border-border'
                }`}
              >
                <Text className="text-base">🤡</Text>
                <Text
                  className={`text-body-semibold ${
                    shameMetric === 'failed' ? 'text-danger' : 'text-text-secondary'
                  }`}
                >
                  Broken
                </Text>
              </Pressable>
            </View>
          )}
        </Animated.View>

        {/* Loading State */}
        {loading && !refreshing && (
          <View className="items-center py-12">
            <Text className="text-body text-text-tertiary">Loading rankings...</Text>
          </View>
        )}

        {/* Error State */}
        {error && !loading && (
          <View className="items-center py-12 gap-3">
            <Text className="text-5xl">😵</Text>
            <Text className="text-h3 text-white">Something went wrong</Text>
            <Text className="text-body text-text-tertiary text-center">{error}</Text>
            <Pressable
              onPress={handleRefresh}
              className="bg-imessage px-6 py-3 rounded-lg mt-3 active:opacity-90 active:scale-[0.98]"
            >
              <Text className="text-body-semibold text-white">Try Again</Text>
            </Pressable>
          </View>
        )}

        {/* Empty State */}
        {!loading && !error && !hasData && <EmptyState tabId={activeTab} />}

        {/* Rankings Content */}
        {!loading && !error && hasData && (
          <>
            {/* Your Rank Card */}
            <YourRankCard
              rank={currentUserRank.rank}
              total={currentUserRank.total}
              isShameMode={isShameMode}
            />

            {/* Rankings List */}
            <RankingsList
              rankings={currentRankings}
              metric={currentMetric}
              isShameMode={isShameMode}
              onUserPress={handleUserPress}
            />
          </>
        )}

        {/* Footer */}
        <Animated.View entering={FadeIn.delay(400).duration(300)} className="items-center pt-6 pb-3">
          <Text className="text-caption text-text-muted italic text-center">
            {isShameMode
              ? "Accountability is brutal. That's the point."
              : 'Rankings update every 15 minutes'}
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

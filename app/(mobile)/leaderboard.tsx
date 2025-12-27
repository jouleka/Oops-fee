/**
 * Leaderboard Screen
 *
 * Tab-based leaderboard with Friends, Global, and Wall of Shame views.
 * Shows rankings based on various metrics and time periods.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { Colors, Fonts, Radius, Spacing, Typography } from '@/constants/theme';
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
    <View style={styles.tabContainer}>
      <Animated.View
        style={[
          styles.tabIndicator,
          activeTab === 'shame' && styles.tabIndicatorShame,
          animatedIndicatorStyle,
        ]}
      />
      {TABS.map((tab) => (
        <Pressable key={tab.id} onPress={() => handleSelect(tab.id)} style={styles.tabButton}>
          <Text
            numberOfLines={1}
            style={[
              styles.tabText,
              activeTab === tab.id && styles.tabTextActive,
              activeTab === tab.id && tab.id === 'shame' && styles.tabTextShame,
            ]}
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
    <Animated.View entering={FadeInDown.duration(300)} style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>{content.emoji}</Text>
      <Text style={styles.emptyTitle}>{content.title}</Text>
      <Text style={styles.emptySubtitle}>{content.subtitle}</Text>
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
    <View style={styles.rankingsList}>
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
      style={[styles.yourRankCard, isShameMode && styles.yourRankCardShame]}
    >
      <View style={styles.yourRankLeft}>
        <Text style={[styles.yourRankLabel, isShameMode && styles.yourRankLabelShame]}>
          YOUR RANK
        </Text>
        <Text style={[styles.yourRankMessage, isShameMode && styles.yourRankMessageShame]}>
          {message}
        </Text>
      </View>
      <View style={styles.yourRankRight}>
        <Text style={[styles.yourRankNumber, isShameMode && styles.yourRankNumberShame]}>
          #{rank}
        </Text>
        <Text style={styles.yourRankTotal}>of {total}</Text>
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
      return { rank: friendsData.current_user_rank, total: friendsData.total_friends };
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
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Text style={styles.backButtonText}>‹</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Leaderboard</Text>
          <Text style={styles.headerSubtitle}>See how you stack up</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Tab Selector */}
      <View style={styles.tabSection}>
        <TabSelector activeTab={activeTab} onTabChange={handleTabChange} />
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
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
          <Animated.View entering={FadeIn.duration(400)} style={styles.shameHeader}>
            <LinearGradient
              colors={['rgba(255, 69, 58, 0.15)', 'rgba(255, 69, 58, 0)']}
              style={styles.shameHeaderGradient}
            >
              <Text style={styles.shameTitle}>WALL OF SHAME</Text>
              <Text style={styles.shameTagline}>
                &ldquo;{SHAME_TAGLINES[Math.floor(Date.now() / 60000) % SHAME_TAGLINES.length]}&rdquo;
              </Text>
            </LinearGradient>
          </Animated.View>
        )}

        {/* Filters Section */}
        <Animated.View entering={FadeIn.duration(200)} style={styles.filtersSection}>
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
            <View style={styles.shameMetricPicker}>
              <Pressable
                onPress={() => handleShameMetricChange('money_lost')}
                style={[
                  styles.shameMetricButton,
                  shameMetric === 'money_lost' && styles.shameMetricButtonActive,
                ]}
              >
                <Text style={styles.shameMetricEmoji}>💸</Text>
                <Text
                  style={[
                    styles.shameMetricText,
                    shameMetric === 'money_lost' && styles.shameMetricTextActive,
                  ]}
                >
                  Money Lost
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleShameMetricChange('failed')}
                style={[
                  styles.shameMetricButton,
                  shameMetric === 'failed' && styles.shameMetricButtonActive,
                ]}
              >
                <Text style={styles.shameMetricEmoji}>🤡</Text>
                <Text
                  style={[
                    styles.shameMetricText,
                    shameMetric === 'failed' && styles.shameMetricTextActive,
                  ]}
                >
                  Broken
                </Text>
              </Pressable>
            </View>
          )}
        </Animated.View>

        {/* Loading State */}
        {loading && !refreshing && (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading rankings...</Text>
          </View>
        )}

        {/* Error State */}
        {error && !loading && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorEmoji}>😵</Text>
            <Text style={styles.errorTitle}>Something went wrong</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            <Pressable
              onPress={handleRefresh}
              style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
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
        <Animated.View entering={FadeIn.delay(400).duration(300)} style={styles.footer}>
          <Text style={styles.footerText}>
            {isShameMode
              ? "Accountability is brutal. That's the point."
              : 'Rankings update every 15 minutes'}
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg,
  },

  // Header
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  headerCenter: { flex: 1, gap: 2 },
  headerTitle: { ...Typography.h2, color: Colors.text, fontFamily: Fonts.rounded },
  headerSubtitle: { ...Typography.caption, color: Colors.textTertiary },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 28,
    lineHeight: 28,
    color: Colors.textSecondary,
    marginTop: -2,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },

  // Tab Section
  tabSection: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 4,
    position: 'relative',
  },
  tabIndicator: {
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
  tabIndicatorShame: {
    backgroundColor: Colors.dangerDim,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm + 2,
    zIndex: 1,
  },
  tabText: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontWeight: '600',
  },
  tabTextActive: {
    color: Colors.text,
  },
  tabTextShame: {
    color: Colors.danger,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    gap: Spacing.lg,
  },

  // Filters
  filtersSection: {
    gap: Spacing.md,
  },

  // Loading
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
  },
  loadingText: {
    ...Typography.body,
    color: Colors.textTertiary,
  },

  // Error
  errorContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    gap: Spacing.md,
  },
  errorEmoji: {
    fontSize: 48,
  },
  errorTitle: {
    ...Typography.h3,
    color: Colors.text,
  },
  errorMessage: {
    ...Typography.body,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    marginTop: Spacing.md,
  },
  retryButtonText: {
    ...Typography.bodySemibold,
    color: Colors.text,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    gap: Spacing.md,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyTitle: {
    ...Typography.h3,
    color: Colors.text,
    fontFamily: Fonts.rounded,
  },
  emptySubtitle: {
    ...Typography.body,
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },

  // Rankings List
  rankingsList: {
    gap: Spacing.md,
  },

  // Your Rank Card
  yourRankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.accentDim,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.accent + '40',
    padding: Spacing.lg,
  },
  yourRankCardShame: {
    backgroundColor: Colors.dangerDim,
    borderColor: Colors.danger + '40',
  },
  yourRankLeft: {
    gap: 4,
  },
  yourRankLabel: {
    ...Typography.label,
    color: Colors.accent,
  },
  yourRankLabelShame: {
    color: Colors.danger,
  },
  yourRankMessage: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  yourRankMessageShame: {
    color: Colors.danger + 'CC',
  },
  yourRankRight: {
    alignItems: 'flex-end',
  },
  yourRankNumber: {
    ...Typography.displaySmall,
    color: Colors.accent,
    fontFamily: Fonts.rounded,
  },
  yourRankNumberShame: {
    color: Colors.danger,
  },
  yourRankTotal: {
    ...Typography.caption,
    color: Colors.textMuted,
  },

  // Shame Header
  shameHeader: {
    alignItems: 'center',
  },
  shameHeaderGradient: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    borderRadius: Radius.xl,
  },
  shameTitle: {
    ...Typography.displaySmall,
    color: Colors.danger,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  shameTagline: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontStyle: 'italic',
    marginTop: Spacing.xs,
  },

  // Shame Metric Picker
  shameMetricPicker: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  shameMetricButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  shameMetricButtonActive: {
    backgroundColor: Colors.dangerDim,
    borderColor: Colors.danger + '60',
  },
  shameMetricEmoji: {
    fontSize: 16,
  },
  shameMetricText: {
    ...Typography.bodySemibold,
    color: Colors.textSecondary,
  },
  shameMetricTextActive: {
    color: Colors.danger,
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  footerText: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});


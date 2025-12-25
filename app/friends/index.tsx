/**
 * Friends List Screen
 *
 * Shows accepted friends and pending requests with tabs.
 */

import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts, Radius, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import {
  type FriendProfile,
  type FriendRequest,
  getFriendDisplayName,
  getFriends,
  getInitials,
  respondFriendRequest,
} from '@/lib/friends';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

type Tab = 'friends' | 'requests';

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function hapticLight() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

function hapticMedium() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

function hapticSuccess() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

export default function FriendsListScreen() {
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>('friends');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [pendingReceived, setPendingReceived] = useState<FriendRequest[]>([]);
  const [pendingSent, setPendingSent] = useState<FriendRequest[]>([]);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);

  const pendingCount = pendingReceived.length + pendingSent.length;

  // Fetch friends data
  const fetchData = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const data = await getFriends();
      setFriends(data.friends);
      setPendingReceived(data.pendingReceived);
      setPendingSent(data.pendingSent);
    } catch (error) {
      console.error('[FriendsList] Failed to fetch friends:', error);
    }
  }, [isAuthenticated]);

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

  // Handle accepting a request
  const handleAccept = async (friendshipId: string) => {
    hapticLight();
    setRespondingTo(friendshipId);
    try {
      await respondFriendRequest(friendshipId, 'accept');
      hapticSuccess();
      // Refresh data
      await fetchData();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to accept request';
      Alert.alert('Error', msg);
    } finally {
      setRespondingTo(null);
    }
  };

  // Handle rejecting a request
  const handleReject = async (friendshipId: string) => {
    hapticMedium();
    Alert.alert('Decline Request', 'Are you sure you want to decline this friend request?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Decline',
        style: 'destructive',
        onPress: async () => {
          setRespondingTo(friendshipId);
          try {
            await respondFriendRequest(friendshipId, 'reject');
            hapticLight();
            await fetchData();
          } catch (error) {
            const msg = error instanceof Error ? error.message : 'Failed to decline request';
            Alert.alert('Error', msg);
          } finally {
            setRespondingTo(null);
          }
        },
      },
    ]);
  };

  // Navigate to search
  const handleSearch = () => {
    hapticLight();
    router.push('/friends/search' as never);
  };

  // Navigate to invite
  const handleInvite = () => {
    hapticLight();
    router.push('/friends/invite' as never);
  };

  // Navigate to friend profile
  const handleFriendPress = (friend: FriendProfile) => {
    hapticLight();
    router.push({ pathname: '/friends/[id]' as never, params: { id: friend.id } });
  };

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Header onBack={() => router.back()} />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🔒</Text>
          <Text style={styles.emptyTitle}>Sign in required</Text>
          <Text style={styles.emptySubtitle}>Sign in to connect with friends</Text>
          <Pressable
            onPress={() => {
              hapticMedium();
              router.push('/auth/sign-in');
            }}
            style={({ pressed }) => [styles.primaryButton, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.primaryButtonText}>Sign In</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <Header onBack={() => router.back()} onSearch={handleSearch} />

      {/* Tabs */}
      <Animated.View entering={FadeInDown.delay(50).duration(200)} style={styles.tabContainer}>
        <Pressable
          onPress={() => {
            hapticLight();
            setActiveTab('friends');
          }}
          style={[styles.tab, activeTab === 'friends' && styles.tabActive]}
        >
          <Text style={[styles.tabText, activeTab === 'friends' && styles.tabTextActive]}>
            Friends
          </Text>
          {friends.length > 0 && (
            <View style={[styles.tabBadge, activeTab === 'friends' && styles.tabBadgeActive]}>
              <Text style={[styles.tabBadgeText, activeTab === 'friends' && styles.tabBadgeTextActive]}>
                {friends.length}
              </Text>
            </View>
          )}
        </Pressable>

        <Pressable
          onPress={() => {
            hapticLight();
            setActiveTab('requests');
          }}
          style={[styles.tab, activeTab === 'requests' && styles.tabActive]}
        >
          <Text style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}>
            Requests
          </Text>
          {pendingCount > 0 && (
            <View
              style={[
                styles.tabBadge,
                styles.tabBadgeHighlight,
                activeTab === 'requests' && styles.tabBadgeActive,
              ]}
            >
              <Text style={[styles.tabBadgeText, styles.tabBadgeTextHighlight]}>
                {pendingCount}
              </Text>
            </View>
          )}
        </Pressable>
      </Animated.View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xxl }]}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.textMuted}
            />
          }
        >
          {activeTab === 'friends' ? (
            <FriendsTab friends={friends} onFriendPress={handleFriendPress} onSearch={handleSearch} onInvite={handleInvite} />
          ) : (
            <RequestsTab
              pendingReceived={pendingReceived}
              pendingSent={pendingSent}
              respondingTo={respondingTo}
              onAccept={handleAccept}
              onReject={handleReject}
              onSearch={handleSearch}
              onInvite={handleInvite}
            />
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// HEADER
// ─────────────────────────────────────────────────────────────

function Header({ onBack, onSearch }: { onBack: () => void; onSearch?: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable
        onPress={() => {
          hapticLight();
          onBack();
        }}
        style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.backIcon}>←</Text>
      </Pressable>

      <Text style={styles.headerTitle}>Friends</Text>

      {onSearch ? (
        <Pressable
          onPress={onSearch}
          style={({ pressed }) => [styles.searchButton, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.searchIcon}>🔍</Text>
        </Pressable>
      ) : (
        <View style={styles.headerSpacer} />
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// FRIENDS TAB
// ─────────────────────────────────────────────────────────────

function FriendsTab({
  friends,
  onFriendPress,
  onSearch,
  onInvite,
}: {
  friends: FriendProfile[];
  onFriendPress: (friend: FriendProfile) => void;
  onSearch: () => void;
  onInvite: () => void;
}) {
  if (friends.length === 0) {
    return (
      <Animated.View entering={FadeIn.duration(300)} style={styles.emptyContainer}>
        <Text style={styles.emptyEmoji}>👥</Text>
        <Text style={styles.emptyTitle}>No friends yet</Text>
        <Text style={styles.emptySubtitle}>
          Find people to keep you accountable on your commitments
        </Text>
        <Pressable
          onPress={onSearch}
          style={({ pressed }) => [styles.primaryButton, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.primaryButtonText}>Find Friends</Text>
        </Pressable>
        <Pressable
          onPress={onInvite}
          style={({ pressed }) => [styles.secondaryButton, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.secondaryButtonText}>📨 Invite Someone New</Text>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View layout={LinearTransition.springify()} style={styles.listContainer}>
      {friends.map((friend, index) => (
        <Animated.View
          key={friend.id}
          entering={FadeInDown.delay(index * 50).duration(250)}
        >
          <FriendCard friend={friend} onPress={() => onFriendPress(friend)} />
        </Animated.View>
      ))}
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────
// REQUESTS TAB
// ─────────────────────────────────────────────────────────────

function RequestsTab({
  pendingReceived,
  pendingSent,
  respondingTo,
  onAccept,
  onReject,
  onSearch,
  onInvite,
}: {
  pendingReceived: FriendRequest[];
  pendingSent: FriendRequest[];
  respondingTo: string | null;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onSearch: () => void;
  onInvite: () => void;
}) {
  const hasAny = pendingReceived.length > 0 || pendingSent.length > 0;

  if (!hasAny) {
    return (
      <Animated.View entering={FadeIn.duration(300)} style={styles.emptyContainer}>
        <Text style={styles.emptyEmoji}>📬</Text>
        <Text style={styles.emptyTitle}>No pending requests</Text>
        <Text style={styles.emptySubtitle}>
          Search for users to send friend requests
        </Text>
        <Pressable
          onPress={onSearch}
          style={({ pressed }) => [styles.primaryButton, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.primaryButtonText}>Find Friends</Text>
        </Pressable>
        <Pressable
          onPress={onInvite}
          style={({ pressed }) => [styles.secondaryButton, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.secondaryButtonText}>📨 Invite Someone New</Text>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View layout={LinearTransition.springify()} style={styles.listContainer}>
      {/* Received Requests */}
      {pendingReceived.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>RECEIVED</Text>
          {pendingReceived.map((request, index) => (
            <Animated.View
              key={request.friendship_id}
              entering={FadeInDown.delay(index * 50).duration(250)}
              exiting={FadeOut.duration(200)}
            >
              <RequestCard
                request={request}
                type="received"
                isLoading={respondingTo === request.friendship_id}
                onAccept={() => onAccept(request.friendship_id)}
                onReject={() => onReject(request.friendship_id)}
              />
            </Animated.View>
          ))}
        </>
      )}

      {/* Sent Requests */}
      {pendingSent.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, pendingReceived.length > 0 && { marginTop: Spacing.xl }]}>
            SENT
          </Text>
          {pendingSent.map((request, index) => (
            <Animated.View
              key={request.friendship_id}
              entering={FadeInDown.delay((pendingReceived.length + index) * 50).duration(250)}
            >
              <RequestCard request={request} type="sent" isLoading={false} />
            </Animated.View>
          ))}
        </>
      )}
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────
// FRIEND CARD
// ─────────────────────────────────────────────────────────────

function FriendCard({
  friend,
  onPress,
}: {
  friend: FriendProfile;
  onPress: () => void;
}) {
  const displayName = friend.display_name || friend.username || 'User';
  const initial = getInitials(friend);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.friendCard, pressed && { opacity: 0.8 }]}
    >
      <LinearGradient
        colors={[Colors.accent, '#0A7FD4']}
        style={styles.avatar}
      >
        <Text style={styles.avatarText}>{initial}</Text>
      </LinearGradient>

      <View style={styles.friendInfo}>
        <Text style={styles.friendName} numberOfLines={1}>
          {displayName}
        </Text>
        {friend.username && (
          <Text style={styles.friendUsername} numberOfLines={1}>
            @{friend.username}
          </Text>
        )}
      </View>

      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────
// REQUEST CARD
// ─────────────────────────────────────────────────────────────

function RequestCard({
  request,
  type,
  isLoading,
  onAccept,
  onReject,
}: {
  request: FriendRequest;
  type: 'received' | 'sent';
  isLoading: boolean;
  onAccept?: () => void;
  onReject?: () => void;
}) {
  const user = request.user;
  const displayName = getFriendDisplayName(user);
  const initial = getInitials(user);

  return (
    <View style={styles.requestCard}>
      <LinearGradient
        colors={type === 'received' ? [Colors.success, Colors.successDim] : [Colors.systemGray3, Colors.systemGray4]}
        style={styles.avatar}
      >
        <Text style={styles.avatarText}>{initial}</Text>
      </LinearGradient>

      <View style={styles.requestInfo}>
        <Text style={styles.requestName} numberOfLines={1}>
          {displayName}
        </Text>
        <Text style={styles.requestStatus}>
          {type === 'received' ? 'Wants to connect' : 'Awaiting response'}
        </Text>
      </View>

      {type === 'received' && (
        <View style={styles.requestActions}>
          {isLoading ? (
            <ActivityIndicator size="small" color={Colors.accent} />
          ) : (
            <>
              <Pressable
                onPress={onReject}
                style={({ pressed }) => [styles.rejectButton, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.rejectButtonText}>✕</Text>
              </Pressable>
              <Pressable
                onPress={onAccept}
                style={({ pressed }) => [styles.acceptButton, pressed && { opacity: 0.8 }]}
              >
                <Text style={styles.acceptButtonText}>✓</Text>
              </Pressable>
            </>
          )}
        </View>
      )}

      {type === 'sent' && (
        <View style={styles.pendingBadge}>
          <Text style={styles.pendingBadgeText}>Pending</Text>
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 20,
    color: Colors.text,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.text,
    fontFamily: Fonts.rounded,
  },
  headerSpacer: {
    width: 40,
  },
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: Colors.accentDim,
    borderWidth: 1,
    borderColor: Colors.accent + '40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchIcon: {
    fontSize: 18,
  },

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xs,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
  },
  tabActive: {
    backgroundColor: Colors.bgCardHover,
  },
  tabText: {
    ...Typography.bodySemibold,
    color: Colors.textTertiary,
  },
  tabTextActive: {
    color: Colors.text,
  },
  tabBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: Spacing.xs,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCardHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeActive: {
    backgroundColor: Colors.accentDim,
  },
  tabBadgeHighlight: {
    backgroundColor: Colors.accent,
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  tabBadgeTextActive: {
    color: Colors.accent,
  },
  tabBadgeTextHighlight: {
    color: Colors.text,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },

  // List
  listContainer: {
    gap: Spacing.sm,
  },

  // Section Title
  sectionTitle: {
    ...Typography.label,
    color: Colors.textMuted,
    marginLeft: Spacing.xs,
    marginBottom: Spacing.xs,
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxxl,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    ...Typography.h3,
    color: Colors.text,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },
  primaryButton: {
    marginTop: Spacing.md,
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
  },
  primaryButtonText: {
    ...Typography.bodySemibold,
    color: Colors.text,
  },
  secondaryButton: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryButtonText: {
    ...Typography.bodySemibold,
    color: Colors.textSecondary,
  },

  // Friend Card
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  friendInfo: {
    flex: 1,
    gap: 2,
  },
  friendName: {
    ...Typography.bodySemibold,
    color: Colors.text,
  },
  friendUsername: {
    ...Typography.caption,
    color: Colors.accent,
    fontFamily: Fonts.mono,
  },
  chevron: {
    fontSize: 22,
    color: Colors.textMuted,
    fontWeight: '300',
  },

  // Request Card
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  requestInfo: {
    flex: 1,
    gap: 2,
  },
  requestName: {
    ...Typography.bodySemibold,
    color: Colors.text,
  },
  requestStatus: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  requestActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  rejectButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.dangerDim,
    borderWidth: 1,
    borderColor: Colors.danger + '40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.danger,
  },
  acceptButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.successDim,
    borderWidth: 1,
    borderColor: Colors.success + '40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.success,
  },
  pendingBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCardHover,
  },
  pendingBadgeText: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
});


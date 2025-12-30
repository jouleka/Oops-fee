/**
 * Friends List Screen
 *
 * Shows accepted friends and pending requests with tabs.
 */

import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/auth";
import {
  type FriendProfile,
  type FriendRequest,
  getFriendDisplayName,
  getFriends,
  getInitials,
  respondFriendRequest,
} from "@/lib/friends";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

type Tab = "friends" | "requests";

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
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
    () => {},
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

export default function FriendsListScreen() {
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>("friends");
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
      console.error("[FriendsList] Failed to fetch friends:", error);
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
      await respondFriendRequest(friendshipId, "accept");
      hapticSuccess();
      // Refresh data
      await fetchData();
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Failed to accept request";
      Alert.alert("Error", msg);
    } finally {
      setRespondingTo(null);
    }
  };

  // Handle rejecting a request
  const handleReject = async (friendshipId: string) => {
    hapticMedium();
    Alert.alert(
      "Decline Request",
      "Are you sure you want to decline this friend request?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Decline",
          style: "destructive",
          onPress: async () => {
            setRespondingTo(friendshipId);
            try {
              await respondFriendRequest(friendshipId, "reject");
              hapticLight();
              await fetchData();
            } catch (error) {
              const msg =
                error instanceof Error
                  ? error.message
                  : "Failed to decline request";
              Alert.alert("Error", msg);
            } finally {
              setRespondingTo(null);
            }
          },
        },
      ],
    );
  };

  // Navigate to search
  const handleSearch = () => {
    hapticLight();
    router.push("/(mobile)/friends/search" as never);
  };

  // Navigate to invite
  const handleInvite = () => {
    hapticLight();
    router.push("/(mobile)/friends/invite" as never);
  };

  // Navigate to friend profile
  const handleFriendPress = (friend: FriendProfile) => {
    hapticLight();
    router.push({
      pathname: "/(mobile)/friends/[id]" as never,
      params: { id: friend.id },
    });
  };

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <View className="flex-1 bg-black" style={{ paddingTop: insets.top }}>
        <Header onBack={() => router.back()} />
        <View className="flex-1 items-center justify-center py-xxxl px-xl gap-md">
          <Text className="text-[48px] mb-sm">🔒</Text>
          <Text className="text-h3 text-white text-center">
            Sign in required
          </Text>
          <Text className="text-body text-text-secondary text-center max-w-[280px]">
            Sign in to connect with friends
          </Text>
          <Pressable
            onPress={() => {
              hapticMedium();
              router.push("/auth/sign-in");
            }}
            className="mt-md bg-white px-8 py-4 rounded-lg active:opacity-90 active:scale-[0.98]"
          >
            <Text className="text-base font-semibold text-black">Sign In</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <Header onBack={() => router.back()} onSearch={handleSearch} />

      {/* Tabs */}
      <Animated.View
        entering={FadeInDown.delay(50).duration(200)}
        className="flex-row mx-lg mb-lg bg-card rounded-lg border border-border p-xs"
      >
        <Pressable
          onPress={() => {
            hapticLight();
            setActiveTab("friends");
          }}
          className={`flex-1 flex-row items-center justify-center gap-xs py-md rounded-md ${
            activeTab === "friends" ? "bg-card-hover" : ""
          }`}
        >
          <Text
            className={`text-body-semibold ${
              activeTab === "friends" ? "text-white" : "text-text-tertiary"
            }`}
          >
            Friends
          </Text>
          {friends.length > 0 && (
            <View
              className={`min-w-5 h-5 px-xs rounded-full items-center justify-center ${
                activeTab === "friends" ? "bg-imessage-dim" : "bg-card-hover"
              }`}
            >
              <Text
                className={`text-[11px] font-bold ${
                  activeTab === "friends" ? "text-imessage" : "text-text-muted"
                }`}
              >
                {friends.length}
              </Text>
            </View>
          )}
        </Pressable>

        <Pressable
          onPress={() => {
            hapticLight();
            setActiveTab("requests");
          }}
          className={`flex-1 flex-row items-center justify-center gap-xs py-md rounded-md ${
            activeTab === "requests" ? "bg-card-hover" : ""
          }`}
        >
          <Text
            className={`text-body-semibold ${
              activeTab === "requests" ? "text-white" : "text-text-tertiary"
            }`}
          >
            Requests
          </Text>
          {pendingCount > 0 && (
            <View
              className={`min-w-5 h-5 px-xs rounded-full items-center justify-center ${
                activeTab === "requests" ? "bg-imessage-dim" : "bg-imessage"
              }`}
            >
              <Text
                className={`text-[11px] font-bold ${
                  activeTab === "requests" ? "text-imessage" : "text-white"
                }`}
              >
                {pendingCount}
              </Text>
            </View>
          )}
        </Pressable>
      </Animated.View>

      {/* Content */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#0B93F6" />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: insets.bottom + 32,
          }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="rgba(255,255,255,0.3)"
            />
          }
        >
          {activeTab === "friends" ? (
            <FriendsTab
              friends={friends}
              onFriendPress={handleFriendPress}
              onSearch={handleSearch}
              onInvite={handleInvite}
            />
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

function Header({
  onBack,
  onSearch,
}: {
  onBack: () => void;
  onSearch?: () => void;
}) {
  return (
    <View className="flex-row items-center justify-between px-lg py-md">
      <Pressable
        onPress={() => {
          hapticLight();
          onBack();
        }}
        className="w-10 h-10 rounded-full bg-card border border-border items-center justify-center active:opacity-70"
      >
        <Text className="text-[20px] text-white">←</Text>
      </Pressable>

      <Text className="text-h2 text-white font-rounded">Friends</Text>

      {onSearch ? (
        <Pressable
          onPress={onSearch}
          className="w-10 h-10 rounded-full bg-imessage-dim border border-imessage/40 items-center justify-center active:opacity-70"
        >
          <Text className="text-[18px]">🔍</Text>
        </Pressable>
      ) : (
        <View className="w-10" />
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
      <Animated.View
        entering={FadeIn.duration(300)}
        className="flex-1 items-center justify-center py-xxxl px-xl gap-md"
      >
        <Text className="text-[48px] mb-sm">👥</Text>
        <Text className="text-h3 text-white text-center">No friends yet</Text>
        <Text className="text-body text-text-secondary text-center max-w-[280px]">
          Find people to keep you accountable on your commitments
        </Text>
        <Pressable
          onPress={onSearch}
          className="mt-md bg-imessage px-xl py-md rounded-lg active:opacity-80"
        >
          <Text className="text-body-semibold text-white">Find Friends</Text>
        </Pressable>
        <Pressable
          onPress={onInvite}
          className="mt-sm px-xl py-md rounded-lg bg-card border border-border active:opacity-80"
        >
          <Text className="text-body-semibold text-text-secondary">
            📨 Invite Someone New
          </Text>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View layout={LinearTransition.springify()} className="gap-sm">
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
      <Animated.View
        entering={FadeIn.duration(300)}
        className="flex-1 items-center justify-center py-xxxl px-xl gap-md"
      >
        <Text className="text-[48px] mb-sm">📬</Text>
        <Text className="text-h3 text-white text-center">
          No pending requests
        </Text>
        <Text className="text-body text-text-secondary text-center max-w-[280px]">
          Search for users to send friend requests
        </Text>
        <Pressable
          onPress={onSearch}
          className="mt-md bg-imessage px-xl py-md rounded-lg active:opacity-80"
        >
          <Text className="text-body-semibold text-white">Find Friends</Text>
        </Pressable>
        <Pressable
          onPress={onInvite}
          className="mt-sm px-xl py-md rounded-lg bg-card border border-border active:opacity-80"
        >
          <Text className="text-body-semibold text-text-secondary">
            📨 Invite Someone New
          </Text>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View layout={LinearTransition.springify()} className="gap-sm">
      {/* Received Requests */}
      {pendingReceived.length > 0 && (
        <>
          <Text className="text-label text-text-muted ml-xs mb-xs uppercase tracking-wide">
            RECEIVED
          </Text>
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
          <Text
            className={`text-label text-text-muted ml-xs mb-xs uppercase tracking-wide ${pendingReceived.length > 0 ? "mt-xl" : ""}`}
          >
            SENT
          </Text>
          {pendingSent.map((request, index) => (
            <Animated.View
              key={request.friendship_id}
              entering={FadeInDown.delay(
                (pendingReceived.length + index) * 50,
              ).duration(250)}
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
  const displayName = friend.display_name || friend.username || "User";
  const initial = getInitials(friend);

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center bg-card rounded-lg border border-border p-md gap-md active:opacity-80"
    >
      <LinearGradient
        colors={["#0B93F6", "#0A7FD4"]}
        className="w-11 h-11 rounded-full items-center justify-center"
      >
        <Text className="text-[18px] font-bold text-white">{initial}</Text>
      </LinearGradient>

      <View className="flex-1 gap-0.5">
        <Text className="text-body-semibold text-white" numberOfLines={1}>
          {displayName}
        </Text>
        {friend.username && (
          <Text
            className="text-caption text-imessage font-mono"
            numberOfLines={1}
          >
            @{friend.username}
          </Text>
        )}
      </View>

      <Text className="text-[22px] text-text-muted font-light">›</Text>
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
  type: "received" | "sent";
  isLoading: boolean;
  onAccept?: () => void;
  onReject?: () => void;
}) {
  const user = request.user;
  const displayName = getFriendDisplayName(user);
  const initial = getInitials(user);

  return (
    <View className="flex-row items-center bg-card rounded-lg border border-border p-md gap-md">
      <LinearGradient
        colors={
          type === "received"
            ? ["#34C759", "rgba(52, 199, 89, 0.7)"]
            : ["#48484A", "#3A3A3C"]
        }
        className="w-11 h-11 rounded-full items-center justify-center"
      >
        <Text className="text-[18px] font-bold text-white">{initial}</Text>
      </LinearGradient>

      <View className="flex-1 gap-0.5">
        <Text className="text-body-semibold text-white" numberOfLines={1}>
          {displayName}
        </Text>
        <Text className="text-caption text-text-tertiary">
          {type === "received" ? "Wants to connect" : "Awaiting response"}
        </Text>
      </View>

      {type === "received" && (
        <View className="flex-row gap-sm">
          {isLoading ? (
            <ActivityIndicator size="small" color="#0B93F6" />
          ) : (
            <>
              <Pressable
                onPress={onReject}
                className="w-9 h-9 rounded-full bg-danger-dim border border-danger/40 items-center justify-center active:opacity-70"
              >
                <Text className="text-[14px] font-semibold text-danger">✕</Text>
              </Pressable>
              <Pressable
                onPress={onAccept}
                className="w-9 h-9 rounded-full bg-success-dim border border-success/40 items-center justify-center active:opacity-80"
              >
                <Text className="text-[14px] font-semibold text-success">
                  ✓
                </Text>
              </Pressable>
            </>
          )}
        </View>
      )}

      {type === "sent" && (
        <View className="px-sm py-xs rounded-full bg-card-hover">
          <Text className="text-caption text-text-muted">Pending</Text>
        </View>
      )}
    </View>
  );
}

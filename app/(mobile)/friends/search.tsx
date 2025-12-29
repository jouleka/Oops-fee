/**
 * Friend Search Screen
 *
 * Search for users by username to send friend requests.
 */

import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/auth';
import {
  getInitials,
  searchUsers,
  sendFriendRequest,
  type SearchUserResult,
} from '@/lib/friends';

function hapticLight() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

function hapticSuccess() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export default function FriendSearchScreen() {
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchUserResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }

    Keyboard.dismiss();
    setIsSearching(true);
    setHasSearched(true);

    try {
      const users = await searchUsers(trimmed);
      setResults(users);
    } catch (error) {
      console.error('[FriendSearch] Search error:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [query]);

  const handleSendRequest = async (user: SearchUserResult) => {
    hapticLight();
    setSendingTo(user.id);

    try {
      const response = await sendFriendRequest(user.id);
      hapticSuccess();

      if (response.auto_accepted) {
        Alert.alert('🎉 Connected!', `You're now friends with @${user.username}!`);
      } else {
        Alert.alert('Request Sent!', `Friend request sent to @${user.username}`);
      }

      setSentTo((prev) => new Set([...prev, user.id]));
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to send request';
      Alert.alert('Error', msg);
    } finally {
      setSendingTo(null);
    }
  };

  if (!isAuthenticated) {
    return (
      <View className="flex-1 bg-black" style={{ paddingTop: insets.top }}>
        <Header />
        <View className="items-center py-xxxl gap-sm">
          <Text className="text-body text-text-secondary text-center">
            Sign in to search for friends
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black" style={{ paddingTop: insets.top }}>
      <Header />

      {/* Search Input */}
      <Animated.View entering={FadeInDown.delay(50).duration(200)} className="flex-row gap-sm px-lg mb-lg">
        <TextInput
          className="flex-1 h-12 bg-card rounded-lg border border-border px-lg text-body text-white"
          placeholder="Search by username..."
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        <Pressable
          onPress={handleSearch}
          disabled={query.trim().length < 2 || isSearching}
          className={`h-12 px-lg rounded-lg items-center justify-center ${
            query.trim().length < 2 || isSearching ? 'bg-system-gray-4' : 'bg-imessage'
          } active:opacity-80`}
        >
          {isSearching ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text className="text-body-semibold text-white">Search</Text>
          )}
        </Pressable>
      </Animated.View>

      {/* Results */}
      <Animated.ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: insets.bottom + 32 }}
        layout={LinearTransition.springify()}
        keyboardShouldPersistTaps="handled"
      >
        {hasSearched && results.length === 0 && !isSearching && (
          <Animated.View entering={FadeInDown.duration(200)} className="items-center py-xxxl gap-sm">
            <Text className="text-[40px]">🔍</Text>
            <Text className="text-body text-text-secondary text-center">
              No users found for &quot;{query}&quot;
            </Text>
            <Text className="text-caption text-text-muted">Try a different username</Text>
          </Animated.View>
        )}

        {results.map((user, index) => (
          <Animated.View
            key={user.id}
            entering={FadeInDown.delay(index * 50).duration(200)}
            exiting={FadeOut.duration(150)}
          >
            <UserResultCard
              user={user}
              isSending={sendingTo === user.id}
              isSent={sentTo.has(user.id)}
              onSend={() => handleSendRequest(user)}
            />
          </Animated.View>
        ))}
      </Animated.ScrollView>
    </View>
  );
}

function Header() {
  return (
    <View className="flex-row items-center justify-between px-lg py-md">
      <Pressable
        onPress={() => {
          hapticLight();
          router.back();
        }}
        className="w-10 h-10 rounded-full bg-card border border-border items-center justify-center active:opacity-70"
      >
        <Text className="text-[20px] text-white">←</Text>
      </Pressable>

      <Text className="text-h2 text-white font-rounded">Find Friends</Text>
      <View className="w-10" />
    </View>
  );
}

function UserResultCard({
  user,
  isSending,
  isSent,
  onSend,
}: {
  user: SearchUserResult;
  isSending: boolean;
  isSent: boolean;
  onSend: () => void;
}) {
  const initial = getInitials(user);

  return (
    <View className="flex-row items-center bg-card rounded-lg border border-border p-md gap-md">
      <LinearGradient
        colors={['#0B93F6', '#0A7FD4']}
        className="w-11 h-11 rounded-full items-center justify-center"
      >
        <Text className="text-[18px] font-bold text-white">{initial}</Text>
      </LinearGradient>

      <View className="flex-1 gap-0.5">
        <Text className="text-body-semibold text-imessage font-mono">@{user.username}</Text>
        {user.display_name && (
          <Text className="text-caption text-text-secondary" numberOfLines={1}>
            {user.display_name}
          </Text>
        )}
      </View>

      {isSent ? (
        <View className="px-md py-sm bg-success-dim rounded-md">
          <Text className="text-caption text-success font-semibold">Sent ✓</Text>
        </View>
      ) : (
        <Pressable
          onPress={onSend}
          disabled={isSending}
          className={`px-lg py-sm bg-imessage rounded-md min-w-[64px] items-center ${
            isSending ? 'opacity-60' : ''
          } active:opacity-80`}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text className="text-caption text-white font-bold">Add</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

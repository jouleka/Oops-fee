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
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts, Radius, Spacing, Typography } from '@/constants/theme';
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
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Header />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Sign in to search for friends</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Header />

      {/* Search Input */}
      <Animated.View entering={FadeInDown.delay(50).duration(200)} style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by username..."
          placeholderTextColor={Colors.textMuted}
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
          style={({ pressed }) => [
            styles.searchButton,
            (query.trim().length < 2 || isSearching) && styles.searchButtonDisabled,
            pressed && { opacity: 0.8 },
          ]}
        >
          {isSearching ? (
            <ActivityIndicator size="small" color={Colors.text} />
          ) : (
            <Text style={styles.searchButtonText}>Search</Text>
          )}
        </Pressable>
      </Animated.View>

      {/* Results */}
      <Animated.ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xxl }]}
        layout={LinearTransition.springify()}
        keyboardShouldPersistTaps="handled"
      >
        {hasSearched && results.length === 0 && !isSearching && (
          <Animated.View entering={FadeInDown.duration(200)} style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🔍</Text>
            <Text style={styles.emptyText}>No users found for &quot;{query}&quot;</Text>
            <Text style={styles.emptyHint}>Try a different username</Text>
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
    <View style={styles.header}>
      <Pressable
        onPress={() => {
          hapticLight();
          router.back();
        }}
        style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.backIcon}>←</Text>
      </Pressable>

      <Text style={styles.headerTitle}>Find Friends</Text>
      <View style={styles.headerSpacer} />
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
    <View style={styles.userCard}>
      <LinearGradient
        colors={[Colors.accent, '#0A7FD4']}
        style={styles.avatar}
      >
        <Text style={styles.avatarText}>{initial}</Text>
      </LinearGradient>

      <View style={styles.userInfo}>
        <Text style={styles.username}>@{user.username}</Text>
        {user.display_name && (
          <Text style={styles.displayName} numberOfLines={1}>
            {user.display_name}
          </Text>
        )}
      </View>

      {isSent ? (
        <View style={styles.sentBadge}>
          <Text style={styles.sentBadgeText}>Sent ✓</Text>
        </View>
      ) : (
        <Pressable
          onPress={onSend}
          disabled={isSending}
          style={({ pressed }) => [
            styles.addButton,
            pressed && { opacity: 0.8 },
            isSending && { opacity: 0.6 },
          ]}
        >
          {isSending ? (
            <ActivityIndicator size="small" color={Colors.text} />
          ) : (
            <Text style={styles.addButtonText}>Add</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
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
  searchContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  searchInput: {
    flex: 1,
    height: 48,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    ...Typography.body,
    color: Colors.text,
  },
  searchButton: {
    height: 48,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.accent,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButtonDisabled: {
    backgroundColor: Colors.systemGray4,
  },
  searchButtonText: {
    ...Typography.bodySemibold,
    color: Colors.text,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    gap: Spacing.sm,
  },
  emptyEmoji: {
    fontSize: 40,
  },
  emptyText: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  emptyHint: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  userCard: {
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
  userInfo: {
    flex: 1,
    gap: 2,
  },
  username: {
    ...Typography.bodySemibold,
    color: Colors.accent,
    fontFamily: Fonts.mono,
  },
  displayName: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  addButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    minWidth: 64,
    alignItems: 'center',
  },
  addButtonText: {
    ...Typography.caption,
    color: Colors.text,
    fontWeight: '700',
  },
  sentBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.successDim,
    borderRadius: Radius.md,
  },
  sentBadgeText: {
    ...Typography.caption,
    color: Colors.success,
    fontWeight: '600',
  },
});


/**
 * FriendPicker - Inline Component
 *
 * Shows friends inline with minimal friction:
 * - First N friends shown as quick-select cards
 * - Search/see all for more friends
 * - External contact fallback inline
 * - No modal = no keyboard issues
 */

import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import Animated, {
    FadeIn,
    FadeInDown,
    Layout,
} from 'react-native-reanimated';

import { Colors, Fonts, Radius, Spacing, Typography } from '@/constants/theme';
import { type FriendProfile, getFriends, getInitials } from '@/lib/friends';

const MAX_VISIBLE_FRIENDS = 6;

function hapticLight() {
  Haptics.selectionAsync().catch(() => {});
}

function hapticMedium() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

interface InlineFriendPickerProps {
  selectedFriend: FriendProfile | null;
  useExternal: boolean;
  friendName: string;
  friendEmail: string;
  onSelectFriend: (friend: FriendProfile | null) => void;
  onExternalChange: (useExternal: boolean) => void;
  onFriendNameChange: (name: string) => void;
  onFriendEmailChange: (email: string) => void;
}

export function InlineFriendPicker({
  selectedFriend,
  useExternal,
  friendName,
  friendEmail,
  onSelectFriend,
  onExternalChange,
  onFriendNameChange,
  onFriendEmailChange,
}: InlineFriendPickerProps) {
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch friends on mount
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const data = await getFriends();
        setFriends(data.friends);
      } catch (error) {
        console.error('[FriendPicker] Failed to fetch friends:', error);
        setLoadError(error instanceof Error ? error.message : 'Failed to load');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filtered friends based on search
  const filteredFriends = useMemo(() => {
    if (!searchQuery.trim()) return friends;
    const query = searchQuery.toLowerCase().trim();
    return friends.filter((friend) => {
      const username = friend.username?.toLowerCase() ?? '';
      const displayName = friend.display_name?.toLowerCase() ?? '';
      return username.includes(query) || displayName.includes(query);
    });
  }, [friends, searchQuery]);

  // Visible friends (limited unless showAll)
  const visibleFriends = useMemo(() => {
    if (showAll || searchQuery.trim()) return filteredFriends;
    return filteredFriends.slice(0, MAX_VISIBLE_FRIENDS);
  }, [filteredFriends, showAll, searchQuery]);

  const hasMoreFriends = friends.length > MAX_VISIBLE_FRIENDS && !showAll && !searchQuery.trim();
  const hasFriends = !isLoading && friends.length > 0;
  const hasNoFriends = !isLoading && friends.length === 0;

  const handleSelectFriend = useCallback(
    (friend: FriendProfile) => {
      hapticMedium();
      onSelectFriend(friend);
      onExternalChange(false);
    },
    [onSelectFriend, onExternalChange]
  );

  const handleDeselectFriend = useCallback(() => {
    hapticLight();
    onSelectFriend(null);
  }, [onSelectFriend]);

  const handleUseExternal = useCallback(() => {
    hapticLight();
    onSelectFriend(null);
    onExternalChange(true);
  }, [onSelectFriend, onExternalChange]);

  const handleCancelExternal = useCallback(() => {
    hapticLight();
    onExternalChange(false);
    onFriendNameChange('');
    onFriendEmailChange('');
  }, [onExternalChange, onFriendNameChange, onFriendEmailChange]);

  const handleInviteFriends = useCallback(() => {
    hapticMedium();
    router.push('/(mobile)/friends/invite' as never);
  }, []);

  const handleFindFriends = useCallback(() => {
    hapticMedium();
    router.push('/(mobile)/friends/search' as never);
  }, []);

  // If friend is selected, show compact selected state
  if (selectedFriend && !useExternal) {
    return (
      <Animated.View entering={FadeIn.duration(150)} style={styles.container}>
        <Text style={styles.label}>BENEFICIARY</Text>
        <View style={styles.selectedCard}>
          <LinearGradient
            colors={[Colors.success, Colors.successDim]}
            style={styles.selectedAvatar}
          >
            <Text style={styles.selectedAvatarText}>
              {getInitials(selectedFriend)}
            </Text>
          </LinearGradient>
          <View style={styles.selectedInfo}>
            <Text style={styles.selectedName}>
              {selectedFriend.display_name || selectedFriend.username || 'Friend'}
            </Text>
            {selectedFriend.username && (
              <Text style={styles.selectedUsername}>@{selectedFriend.username}</Text>
            )}
          </View>
          <Pressable
            onPress={handleDeselectFriend}
            style={({ pressed }) => [styles.changeButton, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.changeButtonText}>Change</Text>
          </Pressable>
        </View>
        <Text style={styles.helper}>
          They&apos;ll get paid instantly if you fail. No claim page needed.
        </Text>
      </Animated.View>
    );
  }

  // If using external contact, show the form
  if (useExternal) {
    return (
      <Animated.View entering={FadeIn.duration(150)} layout={Layout.springify()} style={styles.container}>
        <View style={styles.externalHeader}>
          <Text style={styles.label}>EXTERNAL FRIEND</Text>
          {hasFriends && (
            <Pressable
              onPress={handleCancelExternal}
              style={({ pressed }) => [styles.switchButton, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.switchButtonText}>Pick in-app friend</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>NAME</Text>
          <TextInput
            value={friendName}
            onChangeText={onFriendNameChange}
            placeholder="Their name or @handle"
            placeholderTextColor={Colors.textMuted}
            maxLength={32}
            style={styles.textInput}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>EMAIL</Text>
          <View style={styles.emailInputWrap}>
            <Text style={styles.emailIcon}>📧</Text>
            <TextInput
              value={friendEmail}
              onChangeText={onFriendEmailChange}
              placeholder="friend@email.com"
              placeholderTextColor={Colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={64}
              style={styles.emailInput}
            />
          </View>
        </View>

        <Text
          style={[
            styles.helper,
            (!friendName.trim() || !friendEmail.trim()) && styles.helperDanger,
          ]}
        >
          {!friendName.trim()
            ? "Name them. Otherwise it's imaginary accountability."
            : !friendEmail.trim()
              ? "Add their email so we can notify them if you fail."
              : 'They have 7 days to claim. After that, it becomes our coffee fund :)'}
        </Text>
      </Animated.View>
    );
  }

  // Default state: show friend list or empty state
  return (
    <Animated.View entering={FadeIn.duration(150)} style={styles.container}>
      <Text style={styles.label}>WHO GETS THE MONEY?</Text>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.accent} />
          <Text style={styles.loadingText}>Loading friends...</Text>
        </View>
      ) : loadError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Couldn&apos;t load friends</Text>
          <Pressable
            onPress={() => {
              setIsLoading(true);
              setLoadError(null);
              getFriends()
                .then((data) => setFriends(data.friends))
                .catch((err) => setLoadError(err.message))
                .finally(() => setIsLoading(false));
            }}
            style={({ pressed }) => [styles.retryButton, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.retryButtonText}>Try again</Text>
          </Pressable>
        </View>
      ) : hasNoFriends ? (
        // No friends - show empty state with external option
        <View style={styles.emptyState}>
          <View style={styles.emptyHeader}>
            <Text style={styles.emptyEmoji}>👥</Text>
            <Text style={styles.emptyText}>No friends yet</Text>
          </View>
          <View style={styles.emptyActions}>
            <Pressable
              onPress={handleFindFriends}
              style={({ pressed }) => [styles.emptyAction, styles.emptyActionPrimary, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.emptyActionPrimaryText}>Find Friends</Text>
            </Pressable>
            <Pressable
              onPress={handleInviteFriends}
              style={({ pressed }) => [styles.emptyAction, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.emptyActionText}>📨 Invite</Text>
            </Pressable>
          </View>
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>
          <Pressable
            onPress={handleUseExternal}
            style={({ pressed }) => [styles.externalOption, pressed && styles.externalOptionPressed]}
          >
            <Text style={styles.externalIcon}>📧</Text>
            <View style={styles.externalBody}>
              <Text style={styles.externalTitle}>Use email instead</Text>
              <Text style={styles.externalSubtitle}>Enter their email to send claim link</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </View>
      ) : (
        // Has friends - show list
        <View style={styles.friendsSection}>
          {/* Search bar for many friends */}
          {friends.length > MAX_VISIBLE_FRIENDS && (
            <View style={styles.searchContainer}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search friends..."
                placeholderTextColor={Colors.textMuted}
                style={styles.searchInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <Pressable
                  onPress={() => setSearchQuery('')}
                  style={({ pressed }) => [styles.clearButton, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.clearButtonText}>✕</Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Friend chips */}
          <View style={styles.friendsGrid}>
            {visibleFriends.map((friend, index) => (
              <Animated.View
                key={friend.id}
                entering={FadeInDown.delay(index * 40).duration(180)}
              >
                <FriendChip
                  friend={friend}
                  onPress={() => handleSelectFriend(friend)}
                />
              </Animated.View>
            ))}
          </View>

          {/* Show more button */}
          {hasMoreFriends && (
            <Pressable
              onPress={() => {
                hapticLight();
                setShowAll(true);
              }}
              style={({ pressed }) => [styles.showMoreButton, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.showMoreText}>
                See all {friends.length} friends
              </Text>
            </Pressable>
          )}

          {/* No search results */}
          {searchQuery.trim() && filteredFriends.length === 0 && (
            <Text style={styles.noResults}>No friends match &ldquo;{searchQuery}&rdquo;</Text>
          )}

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* External option */}
          <Pressable
            onPress={handleUseExternal}
            style={({ pressed }) => [styles.externalOption, pressed && styles.externalOptionPressed]}
          >
            <Text style={styles.externalIcon}>📧</Text>
            <View style={styles.externalBody}>
              <Text style={styles.externalTitle}>Someone not on OopsFee</Text>
              <Text style={styles.externalSubtitle}>Enter their email to send claim link</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </View>
      )}
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────
// FRIEND CHIP
// ─────────────────────────────────────────────────────────────

function FriendChip({
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
      style={({ pressed }) => [
        styles.friendChip,
        pressed && styles.friendChipPressed,
      ]}
    >
      <LinearGradient
        colors={[Colors.accent, '#0A7FD4']}
        style={styles.chipAvatar}
      >
        <Text style={styles.chipAvatarText}>{initial}</Text>
      </LinearGradient>
      <View style={styles.chipInfo}>
        <Text style={styles.chipName} numberOfLines={1}>
          {displayName}
        </Text>
        {friend.username && (
          <Text style={styles.chipUsername} numberOfLines={1}>
            @{friend.username}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────
// LEGACY MODAL EXPORT (for backwards compatibility if needed)
// ─────────────────────────────────────────────────────────────

interface FriendPickerProps {
  visible: boolean;
  selectedFriend: FriendProfile | null;
  onSelectFriend: (friend: FriendProfile) => void;
  onUseExternal: () => void;
  onClose: () => void;
}

/**
 * @deprecated Use InlineFriendPicker instead for better UX
 */
export function FriendPicker({
  visible,
  selectedFriend: _selectedFriend,
  onSelectFriend: _onSelectFriend,
  onUseExternal,
  onClose,
}: FriendPickerProps) {
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;
    
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const data = await getFriends();
        setFriends(data.friends);
        
        // Auto-close and show external if no friends
        if (data.friends.length === 0) {
          onUseExternal();
          onClose();
        }
      } catch {
        onUseExternal();
        onClose();
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [visible, onUseExternal, onClose]);

  // If not visible, don't render
  if (!visible) return null;

  // Show loading briefly then auto-select if only one friend
  if (isLoading) {
    return (
      <View style={styles.legacyOverlay}>
        <View style={styles.legacyLoader}>
          <ActivityIndicator size="small" color={Colors.accent} />
        </View>
      </View>
    );
  }

  // If we have friends, pick the first one and close (quick selection)
  // This makes the old modal behavior more streamlined
  if (friends.length > 0) {
    // For legacy usage, just close - the new inline picker handles this better
    onClose();
    return null;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },
  label: {
    ...Typography.label,
    color: Colors.textMuted,
    marginLeft: Spacing.xs,
  },

  // Selected friend
  selectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.successDim,
    borderWidth: 1,
    borderColor: Colors.success + '44',
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  selectedAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  selectedInfo: {
    flex: 1,
    gap: 2,
  },
  selectedName: {
    ...Typography.bodySemibold,
    color: Colors.text,
  },
  selectedUsername: {
    ...Typography.caption,
    color: Colors.success,
    fontFamily: Fonts.mono,
  },
  changeButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  changeButtonText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  helper: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontStyle: 'italic',
    marginLeft: Spacing.xs,
  },
  helperDanger: {
    color: Colors.danger,
    fontWeight: '600',
    fontStyle: 'normal',
  },

  // External form
  externalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    backgroundColor: Colors.accentDim,
  },
  switchButtonText: {
    ...Typography.caption,
    color: Colors.accent,
    fontWeight: '600',
  },
  inputGroup: {
    gap: Spacing.xs,
  },
  inputLabel: {
    ...Typography.label,
    color: Colors.textMuted,
    marginLeft: Spacing.xs,
    fontSize: 10,
  },
  textInput: {
    ...Typography.bodyMedium,
    color: Colors.text,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderRadius: Radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  emailInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderRadius: Radius.lg,
    paddingHorizontal: 14,
  },
  emailIcon: {
    fontSize: 14,
    marginRight: Spacing.sm,
  },
  emailInput: {
    flex: 1,
    ...Typography.bodyMedium,
    color: Colors.text,
    paddingVertical: 12,
  },

  // Loading
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  loadingText: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },

  // Error
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.dangerDim,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  errorText: {
    ...Typography.caption,
    color: Colors.danger,
  },
  retryButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
  },
  retryButtonText: {
    ...Typography.caption,
    color: Colors.accent,
    fontWeight: '600',
  },

  // Empty state
  emptyState: {
    gap: Spacing.md,
  },
  emptyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  emptyEmoji: {
    fontSize: 24,
  },
  emptyText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  emptyActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  emptyAction: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  emptyActionPrimary: {
    backgroundColor: Colors.accentDim,
    borderColor: Colors.accent,
  },
  emptyActionText: {
    ...Typography.bodySemibold,
    color: Colors.textSecondary,
  },
  emptyActionPrimaryText: {
    ...Typography.bodySemibold,
    color: Colors.accent,
  },

  // Friends section
  friendsSection: {
    gap: Spacing.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  searchIcon: {
    fontSize: 12,
  },
  searchInput: {
    flex: 1,
    ...Typography.caption,
    color: Colors.text,
    paddingVertical: 0,
  },
  clearButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.bgCardHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButtonText: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '600',
  },

  // Friend grid
  friendsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  friendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
    paddingRight: Spacing.md,
  },
  friendChipPressed: {
    backgroundColor: Colors.bgCardHover,
    borderColor: Colors.accent,
  },
  chipAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipAvatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  chipInfo: {
    gap: 1,
  },
  chipName: {
    ...Typography.caption,
    color: Colors.text,
    fontWeight: '600',
    maxWidth: 100,
  },
  chipUsername: {
    fontSize: 10,
    color: Colors.accent,
    fontFamily: Fonts.mono,
    maxWidth: 100,
  },

  // Show more
  showMoreButton: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.accentDim,
  },
  showMoreText: {
    ...Typography.caption,
    color: Colors.accent,
    fontWeight: '600',
  },

  // No results
  noResults: {
    ...Typography.caption,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: Spacing.sm,
  },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginVertical: Spacing.xs,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.borderSubtle,
  },
  dividerText: {
    ...Typography.caption,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    fontSize: 10,
  },

  // External option
  externalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    padding: Spacing.md,
  },
  externalOptionPressed: {
    backgroundColor: Colors.bgCardHover,
    borderColor: Colors.border,
  },
  externalIcon: {
    fontSize: 20,
  },
  externalBody: {
    flex: 1,
    gap: 2,
  },
  externalTitle: {
    ...Typography.bodySemibold,
    color: Colors.text,
    fontSize: 14,
  },
  externalSubtitle: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontSize: 11,
  },
  chevron: {
    fontSize: 20,
    color: Colors.textMuted,
    fontWeight: '300',
  },

  // Legacy modal overlay (minimal)
  legacyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  legacyLoader: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
  },
});

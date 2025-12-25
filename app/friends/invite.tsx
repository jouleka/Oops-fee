/**
 * Friend Invite Screen
 *
 * Generate and share invite links with non-users.
 * When they sign up via the link, they automatically become friends.
 */

import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { createFriendInvite, type CreateFriendInviteResponse } from '@/lib/friends';

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

function hapticError() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}

function formatExpiryDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

export default function FriendInviteScreen() {
  const insets = useSafeAreaInsets();
  const { isAuthenticated, profile } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [invite, setInvite] = useState<CreateFriendInviteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  // Check if user has a username (required for invite system)
  const hasUsername = Boolean(profile?.username);

  // Generate invite on mount if authed and has username
  useEffect(() => {
    if (isAuthenticated && hasUsername && !invite && !isLoading && !error) {
      generateInvite();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, hasUsername]);

  const generateInvite = useCallback(async () => {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await createFriendInvite();
      setInvite(result);
      hapticSuccess();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create invite';
      setError(msg);
      hapticError();
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  const handleCopyLink = useCallback(async () => {
    if (!invite?.invite_url) return;

    hapticMedium();
    await Clipboard.setStringAsync(invite.invite_url);
    setCopied(true);
    hapticSuccess();

    setTimeout(() => setCopied(false), 2500);
  }, [invite?.invite_url]);

  const handleShare = useCallback(async () => {
    if (!invite?.invite_url) return;

    hapticMedium();

    const displayName = profile?.display_name || profile?.username || 'I';
    const message = `${displayName === 'I' ? 'I want' : `${displayName} wants`} you as an accountability partner on OopsFee! When you sign up, we'll automatically be connected.\n\n${invite.invite_url}`;

    try {
      const result = await Share.share({
        message,
        url: invite.invite_url,
      });

      if (result.action === Share.sharedAction) {
        setShared(true);
        hapticSuccess();
      }
    } catch (e) {
      console.error('[Invite] Share failed:', e);
    }
  }, [invite?.invite_url, profile]);

  const handleBack = () => {
    hapticLight();
    router.back();
  };

  const handleSetupUsername = () => {
    hapticMedium();
    router.push('/setup-username');
  };

  // ─────────────────────────────────────────────────────────────
  // NOT AUTHENTICATED
  // ─────────────────────────────────────────────────────────────

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Header onBack={handleBack} />
        <View style={styles.centerContent}>
          <Text style={styles.emptyEmoji}>🔒</Text>
          <Text style={styles.emptyTitle}>Sign in required</Text>
          <Text style={styles.emptySubtitle}>
            Sign in to invite friends to OopsFee
          </Text>
          <Pressable
            onPress={() => {
              hapticMedium();
              router.push('/auth/sign-in');
            }}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.primaryButtonText}>Sign In</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // NO USERNAME SET
  // ─────────────────────────────────────────────────────────────

  if (!hasUsername) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Header onBack={handleBack} />
        <View style={styles.centerContent}>
          <Text style={styles.emptyEmoji}>👤</Text>
          <Text style={styles.emptyTitle}>Set up your username first</Text>
          <Text style={styles.emptySubtitle}>
            You need a username so friends can find you when they join.
          </Text>
          <Pressable
            onPress={handleSetupUsername}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.primaryButtonText}>Set Username</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // LOADING
  // ─────────────────────────────────────────────────────────────

  if (isLoading && !invite) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Header onBack={handleBack} />
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Creating invite link...</Text>
        </View>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // ERROR
  // ─────────────────────────────────────────────────────────────

  if (error && !invite) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Header onBack={handleBack} />
        <View style={styles.centerContent}>
          <Text style={styles.emptyEmoji}>😕</Text>
          <Text style={styles.emptyTitle}>Something went wrong</Text>
          <Text style={styles.emptySubtitle}>{error}</Text>
          <Pressable
            onPress={generateInvite}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.primaryButtonText}>Try Again</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // INVITE READY
  // ─────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Header onBack={handleBack} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <Animated.View entering={FadeInDown.duration(300)} style={styles.heroSection}>
          <Text style={styles.heroEmoji}>🎉</Text>
          <Text style={styles.heroTitle}>Invite a friend</Text>
          <Text style={styles.heroSubtitle}>
            Share this link with anyone you want as an accountability partner.
            When they sign up, you&apos;ll automatically be connected!
          </Text>
        </Animated.View>

        {/* Link Card */}
        <Animated.View entering={FadeInUp.delay(100).duration(300)} style={styles.linkCard}>
          <View style={styles.linkHeader}>
            <Text style={styles.linkLabel}>YOUR INVITE LINK</Text>
            {invite?.expires_at && (
              <Text style={styles.expiresText}>
                Expires {formatExpiryDate(invite.expires_at)}
              </Text>
            )}
          </View>

          <View style={styles.linkBox}>
            <Text style={styles.linkText} numberOfLines={1} ellipsizeMode="middle">
              {invite?.invite_url}
            </Text>
          </View>

          {/* Actions */}
          <View style={styles.actionRow}>
            <Pressable
              onPress={handleCopyLink}
              style={({ pressed }) => [
                styles.actionButton,
                copied && styles.actionButtonSuccess,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.actionButtonEmoji}>{copied ? '✓' : '📋'}</Text>
              <Text style={[styles.actionButtonText, copied && styles.actionButtonTextSuccess]}>
                {copied ? 'Copied!' : 'Copy'}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleShare}
              style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}
            >
              <LinearGradient
                colors={[Colors.accent, '#0A84FF']}
                style={styles.shareButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.shareButtonEmoji}>📤</Text>
                <Text style={styles.shareButtonText}>Share</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </Animated.View>

        {/* Success feedback */}
        {shared && (
          <Animated.View entering={FadeIn.duration(200)} style={styles.successBanner}>
            <Text style={styles.successBannerEmoji}>🚀</Text>
            <Text style={styles.successBannerText}>Invite shared! They&apos;ll be your friend when they join.</Text>
          </Animated.View>
        )}

        {/* How it works */}
        <Animated.View entering={FadeInUp.delay(200).duration(300)} style={styles.howItWorksCard}>
          <Text style={styles.sectionTitle}>How it works</Text>

          <View style={styles.stepList}>
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Share your link</Text>
                <Text style={styles.stepDescription}>
                  Send to anyone via text, email, or social media
                </Text>
              </View>
            </View>

            <View style={styles.stepDivider} />

            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>They sign up</Text>
                <Text style={styles.stepDescription}>
                  They open the link and create an account
                </Text>
              </View>
            </View>

            <View style={styles.stepDivider} />

            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Instant connection</Text>
                <Text style={styles.stepDescription}>
                  You become friends automatically—no extra steps
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Regenerate */}
        <Animated.View entering={FadeInUp.delay(300).duration(300)}>
          <Pressable
            onPress={generateInvite}
            disabled={isLoading}
            style={({ pressed }) => [
              styles.regenerateButton,
              pressed && styles.pressed,
              isLoading && styles.disabled,
            ]}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={Colors.textSecondary} />
            ) : (
              <Text style={styles.regenerateButtonText}>🔄 Generate new link</Text>
            )}
          </Pressable>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// HEADER
// ─────────────────────────────────────────────────────────────

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack}
        style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.backIcon}>←</Text>
      </Pressable>

      <Text style={styles.headerTitle}>Invite</Text>

      <View style={styles.headerSpacer} />
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

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xl,
  },

  // Center content (for loading/error/empty states)
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },

  // Empty/Error states
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
  loadingText: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },

  // Hero
  heroSection: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  heroEmoji: {
    fontSize: 56,
  },
  heroTitle: {
    ...Typography.h1,
    color: Colors.text,
    textAlign: 'center',
  },
  heroSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 24,
  },

  // Link Card
  linkCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  linkHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  linkLabel: {
    ...Typography.label,
    color: Colors.textTertiary,
  },
  expiresText: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  linkBox: {
    backgroundColor: Colors.bg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  linkText: {
    ...Typography.body,
    color: Colors.accent,
    fontFamily: Fonts.mono,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.bgCardHover,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionButtonSuccess: {
    backgroundColor: Colors.successDim,
    borderColor: Colors.success,
  },
  actionButtonEmoji: {
    fontSize: 18,
  },
  actionButtonText: {
    ...Typography.bodySemibold,
    color: Colors.text,
  },
  actionButtonTextSuccess: {
    color: Colors.success,
  },
  shareButton: {
    flex: 2,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    ...Shadows.md,
  },
  shareButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  shareButtonEmoji: {
    fontSize: 18,
  },
  shareButtonText: {
    ...Typography.bodySemibold,
    color: Colors.text,
  },

  // Success banner
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.successDim,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.success,
    padding: Spacing.lg,
  },
  successBannerEmoji: {
    fontSize: 24,
  },
  successBannerText: {
    ...Typography.body,
    color: Colors.success,
    flex: 1,
  },

  // How it works
  howItWorksCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.text,
  },
  stepList: {
    gap: Spacing.md,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    backgroundColor: Colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    ...Typography.bodySemibold,
    color: Colors.accent,
    fontSize: 14,
  },
  stepContent: {
    flex: 1,
    gap: 2,
  },
  stepTitle: {
    ...Typography.bodySemibold,
    color: Colors.text,
  },
  stepDescription: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  stepDivider: {
    width: 2,
    height: 12,
    backgroundColor: Colors.border,
    marginLeft: 13,
  },

  // Regenerate button
  regenerateButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
  },
  regenerateButtonText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },

  // Common
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.6,
  },
});


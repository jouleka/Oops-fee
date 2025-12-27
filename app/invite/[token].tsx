/**
 * Invite Deep Link Handler
 *
 * Handles invite links: oopsfee.app/invite/{token}
 *
 * Flow (native):
 * 1. If logged in → claim invite immediately, navigate to friends
 * 2. If not logged in → store token in AsyncStorage, redirect to signup
 * 3. After signup → auth context checks for stored token and claims it
 *
 * Flow (web):
 * 1. Show app store redirect page
 * 2. Store token in localStorage for deferred deep linking
 * 3. Redirect to appropriate store based on user agent
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { APP_STORE_URL, PLAY_STORE_URL } from '@/constants/app-stores';
import { Colors, Fonts, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { claimFriendInvite, type ClaimFriendInviteResponse } from '@/lib/friends';

// Storage key for pending invite token
export const PENDING_INVITE_TOKEN_KEY = 'oopsfee_pending_invite_token';

// Web localStorage key for deferred deep linking
const WEB_PENDING_INVITE_KEY = 'oopsfee_pending_invite';

const isWeb = Platform.OS === 'web';

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Detect mobile OS from user agent (for web only)
 */
function detectMobileOS(): 'ios' | 'android' | 'unknown' {
  if (!isWeb || typeof navigator === 'undefined') return 'unknown';

  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'unknown';
}

/**
 * Store invite token in localStorage for deferred deep linking (web only)
 */
function storeInviteTokenForWeb(token: string) {
  if (isWeb && typeof localStorage !== 'undefined') {
    localStorage.setItem(WEB_PENDING_INVITE_KEY, token);
  }
}

/**
 * Get the appropriate app store URL based on detected OS
 */
function getAppStoreUrl(): string {
  const os = detectMobileOS();
  if (os === 'ios') return APP_STORE_URL;
  if (os === 'android') return PLAY_STORE_URL;
  // Default to iOS for desktop/unknown (users can choose)
  return APP_STORE_URL;
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

// ─────────────────────────────────────────────────────────────
// WEB INVITE PAGE - App Store Redirect
// ─────────────────────────────────────────────────────────────

function WebInvitePage({ token }: { token: string }) {
  const insets = useSafeAreaInsets();
  const mobileOS = detectMobileOS();

  // Store token for deferred deep linking on mount
  useEffect(() => {
    if (token) {
      storeInviteTokenForWeb(token);
    }
  }, [token]);

  const handleDownload = useCallback(() => {
    const url = getAppStoreUrl();
    Linking.openURL(url);
  }, []);

  const handleAppStore = useCallback(() => {
    Linking.openURL(APP_STORE_URL);
  }, []);

  const handlePlayStore = useCallback(() => {
    Linking.openURL(PLAY_STORE_URL);
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <LogoHeader />

        <Animated.View entering={FadeInDown.duration(300)} style={styles.inviteCard}>
          <Text style={styles.inviteEmoji}>🎟️</Text>
          <Text style={styles.inviteTitle}>You&apos;re invited!</Text>
          <Text style={styles.inviteSubtitle}>
            Someone wants you as their accountability partner.
            Download the app to accept this invite!
          </Text>
        </Animated.View>

        {/* Free pass reward banner */}
        <Animated.View entering={FadeIn.delay(100).duration(300)} style={styles.rewardBanner}>
          <Text style={styles.rewardEmoji}>🎁</Text>
          <View style={styles.rewardContent}>
            <Text style={styles.rewardTitle}>Free pass included</Text>
            <Text style={styles.rewardSubtitle}>Skip one failure charge—no questions asked</Text>
          </View>
        </Animated.View>

        {/* Benefits */}
        <Animated.View entering={FadeIn.delay(200).duration(300)} style={styles.benefitsCard}>
          <Text style={styles.benefitsTitle}>What is OopsFee?</Text>

          <View style={styles.benefitsList}>
            <View style={styles.benefit}>
              <Text style={styles.benefitEmoji}>💰</Text>
              <View style={styles.benefitContent}>
                <Text style={styles.benefitTitle}>Money-backed promises</Text>
                <Text style={styles.benefitDescription}>
                  Put real stakes on your commitments
                </Text>
              </View>
            </View>

            <View style={styles.benefit}>
              <Text style={styles.benefitEmoji}>👥</Text>
              <View style={styles.benefitContent}>
                <Text style={styles.benefitTitle}>Accountability partners</Text>
                <Text style={styles.benefitDescription}>
                  Friends can see your promises and cheer you on
                </Text>
              </View>
            </View>

            <View style={styles.benefit}>
              <Text style={styles.benefitEmoji}>🔥</Text>
              <View style={styles.benefitContent}>
                <Text style={styles.benefitTitle}>Social pressure works</Text>
                <Text style={styles.benefitDescription}>
                  90% of users keep their promises
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* App Store CTAs */}
        <Animated.View entering={FadeIn.delay(300).duration(300)} style={styles.ctaSection}>
          {/* Primary CTA - smart redirect based on detected OS */}
          <Pressable
            onPress={handleDownload}
            style={({ pressed }) => [styles.ctaButton, pressed && styles.pressed]}
          >
            <LinearGradient
              colors={[Colors.accent, '#0A84FF']}
              style={styles.ctaButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.ctaButtonText}>
                {mobileOS === 'ios'
                  ? '📱 Download on App Store'
                  : mobileOS === 'android'
                  ? '📱 Get it on Google Play'
                  : '📱 Download the App'}
              </Text>
            </LinearGradient>
          </Pressable>

          {/* Show both store options for desktop/unknown */}
          {mobileOS === 'unknown' && (
            <View style={styles.storeButtons}>
              <Pressable
                onPress={handleAppStore}
                style={({ pressed }) => [styles.storeButton, pressed && styles.pressed]}
              >
                <Text style={styles.storeButtonText}>🍎 App Store</Text>
              </Pressable>
              <Pressable
                onPress={handlePlayStore}
                style={({ pressed }) => [styles.storeButton, pressed && styles.pressed]}
              >
                <Text style={styles.storeButtonText}>🤖 Google Play</Text>
              </Pressable>
            </View>
          )}
        </Animated.View>

        <Text style={styles.disclaimer}>
          After installing the app, your invite will be ready to claim!
        </Text>
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT (Native)
// ─────────────────────────────────────────────────────────────

export default function InviteTokenPage() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState<ClaimFriendInviteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Store token in AsyncStorage for claiming after signup
  const storeTokenForLater = useCallback(async () => {
    try {
      await AsyncStorage.setItem(PENDING_INVITE_TOKEN_KEY, token!);
      setIsLoading(false);
    } catch (e) {
      console.error('[Invite] Failed to store token:', e);
      setError('Failed to process invite');
      setIsLoading(false);
    }
  }, [token]);

  // Claim the invite
  const claimInvite = useCallback(async () => {
    if (!token || isClaiming) return;

    setIsClaiming(true);
    setError(null);

    try {
      const result = await claimFriendInvite(token);
      setClaimResult(result);
      hapticSuccess();

      // Clear any stored token since we've claimed it
      await AsyncStorage.removeItem(PENDING_INVITE_TOKEN_KEY);
      setIsLoading(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to claim invite';

      // 401/unauthorized = stale session, treat as not logged in
      // Show signup prompt instead of error
      if (msg.includes('401') || msg.includes('Unauthorized') || msg.includes('non-2xx')) {
        console.log('[Invite] Stale session detected, showing signup');
        await AsyncStorage.setItem(PENDING_INVITE_TOKEN_KEY, token);
        setIsLoading(false);
        setIsClaiming(false);
        return; // Will show "not logged in" UI since claimResult is null
      }

      setError(msg);
      hapticError();
      setIsLoading(false);
    } finally {
      setIsClaiming(false);
    }
  }, [token, isClaiming]);

  // Navigate to signup
  const handleSignUp = useCallback(() => {
    hapticMedium();
    router.push('/auth/sign-in');
  }, []);

  // Navigate to friends list
  const handleViewFriends = useCallback(() => {
    hapticMedium();
    router.replace('/(mobile)/friends');
  }, []);

  // Navigate home
  const handleGoHome = useCallback(() => {
    hapticMedium();
    router.replace('/(mobile)/home');
  }, []);

  // Process invite based on auth state (native only)
  useEffect(() => {
    if (isWeb) return; // Skip on web
    if (authLoading) return; // Wait for auth to load

    if (!token) {
      setError('Invalid invite link');
      setIsLoading(false);
      return;
    }

    const processInvite = async () => {
      if (isAuthenticated) {
        // User is logged in - try to claim immediately
        await claimInvite();
      } else {
        // User is not logged in - store token for later
        await storeTokenForLater();
      }
    };

    processInvite();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isAuthenticated, authLoading]);

  // On web, render the app store redirect page
  if (isWeb) {
    return <WebInvitePage token={token || ''} />;
  }

  // ─────────────────────────────────────────────────────────────
  // LOADING STATE
  // ─────────────────────────────────────────────────────────────

  if (isLoading || authLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Processing invite...</Text>
        </View>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // ERROR STATE
  // ─────────────────────────────────────────────────────────────

  if (error && !claimResult) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <LogoHeader />

          <Animated.View entering={FadeInDown.duration(300)} style={styles.errorCard}>
            <Text style={styles.errorEmoji}>😕</Text>
            <Text style={styles.errorTitle}>Invite Error</Text>
            <Text style={styles.errorText}>{error}</Text>

            <Pressable
              onPress={handleGoHome}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryButtonText}>Go to OopsFee</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // SUCCESS - INVITE CLAIMED
  // ─────────────────────────────────────────────────────────────

  if (claimResult?.success) {
    const inviterName = claimResult.inviter.username
      ? `@${claimResult.inviter.username}`
      : claimResult.inviter.display_name || 'Your friend';

    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <LogoHeader />

          <Animated.View entering={FadeInDown.duration(300)} style={styles.successCard}>
            <Text style={styles.successEmoji}>🎉</Text>
            <Text style={styles.successTitle}>
              {claimResult.already_friends
                ? `Already friends with ${inviterName}!`
                : claimResult.already_claimed
                ? 'Invite already used'
                : `You're now friends with ${inviterName}!`}
            </Text>
            <Text style={styles.successSubtitle}>
              {claimResult.already_friends
                ? "You were already connected. Great minds think alike!"
                : claimResult.already_claimed
                ? "You've already claimed this invite."
                : "You can now see each other's promises and hold each other accountable."}
            </Text>

            <Pressable
              onPress={handleViewFriends}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              <LinearGradient
                colors={[Colors.accent, '#0A84FF']}
                style={styles.primaryButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.primaryButtonText}>View Friends</Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // NOT LOGGED IN - PROMPT TO SIGN UP
  // ─────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <LogoHeader />

        <Animated.View entering={FadeInDown.duration(300)} style={styles.inviteCard}>
          <Text style={styles.inviteEmoji}>🎟️</Text>
          <Text style={styles.inviteTitle}>You&apos;re invited!</Text>
          <Text style={styles.inviteSubtitle}>
            Someone wants you as their accountability partner.
            Sign up and you&apos;ll both earn a free pass!
          </Text>
        </Animated.View>

        {/* Free pass reward banner */}
        <Animated.View entering={FadeIn.delay(100).duration(300)} style={styles.rewardBanner}>
          <Text style={styles.rewardEmoji}>🎁</Text>
          <View style={styles.rewardContent}>
            <Text style={styles.rewardTitle}>Free pass included</Text>
            <Text style={styles.rewardSubtitle}>Skip one failure charge—no questions asked</Text>
          </View>
        </Animated.View>

        {/* Benefits */}
        <Animated.View entering={FadeIn.delay(200).duration(300)} style={styles.benefitsCard}>
          <Text style={styles.benefitsTitle}>What is OopsFee?</Text>

          <View style={styles.benefitsList}>
            <View style={styles.benefit}>
              <Text style={styles.benefitEmoji}>💰</Text>
              <View style={styles.benefitContent}>
                <Text style={styles.benefitTitle}>Money-backed promises</Text>
                <Text style={styles.benefitDescription}>
                  Put real stakes on your commitments
                </Text>
              </View>
            </View>

            <View style={styles.benefit}>
              <Text style={styles.benefitEmoji}>👥</Text>
              <View style={styles.benefitContent}>
                <Text style={styles.benefitTitle}>Accountability partners</Text>
                <Text style={styles.benefitDescription}>
                  Friends can see your promises and cheer you on
                </Text>
              </View>
            </View>

            <View style={styles.benefit}>
              <Text style={styles.benefitEmoji}>🔥</Text>
              <View style={styles.benefitContent}>
                <Text style={styles.benefitTitle}>Social pressure works</Text>
                <Text style={styles.benefitDescription}>
                  90% of users keep their promises
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* CTA */}
        <Animated.View entering={FadeIn.delay(300).duration(300)} style={styles.ctaSection}>
          <Pressable
            onPress={handleSignUp}
            style={({ pressed }) => [styles.ctaButton, pressed && styles.pressed]}
          >
            <LinearGradient
              colors={[Colors.accent, '#0A84FF']}
              style={styles.ctaButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.ctaButtonText}>Sign Up & Connect</Text>
            </LinearGradient>
          </Pressable>

          <Pressable
            onPress={handleGoHome}
            style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}
          >
            <Text style={styles.skipButtonText}>Already have an account? Sign in</Text>
          </Pressable>
        </Animated.View>

        <Text style={styles.disclaimer}>
          The invite will be claimed automatically after you sign up.
        </Text>
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// LOGO HEADER
// ─────────────────────────────────────────────────────────────

function LogoHeader() {
  return (
    <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.logoHeader}>
      <Text style={styles.logo}>OopsFee</Text>
    </Animated.View>
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.xl,
  },

  // Center content
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },

  // Logo header
  logoHeader: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  logo: {
    ...Typography.h2,
    color: Colors.accent,
    fontFamily: Fonts.rounded,
    letterSpacing: -0.5,
  },

  // Invite card
  inviteCard: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.lg,
  },
  inviteEmoji: {
    fontSize: 64,
  },
  inviteTitle: {
    ...Typography.h1,
    color: Colors.text,
    textAlign: 'center',
  },
  inviteSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
  },

  // Reward banner
  rewardBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.successDim,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.success + '44',
    padding: Spacing.lg,
  },
  rewardEmoji: {
    fontSize: 28,
  },
  rewardContent: {
    flex: 1,
    gap: 2,
  },
  rewardTitle: {
    ...Typography.bodySemibold,
    color: Colors.success,
  },
  rewardSubtitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },

  // Benefits card
  benefitsCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  benefitsTitle: {
    ...Typography.h3,
    color: Colors.text,
  },
  benefitsList: {
    gap: Spacing.lg,
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  benefitEmoji: {
    fontSize: 24,
    marginTop: 2,
  },
  benefitContent: {
    flex: 1,
    gap: 2,
  },
  benefitTitle: {
    ...Typography.bodySemibold,
    color: Colors.text,
  },
  benefitDescription: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },

  // CTA section
  ctaSection: {
    gap: Spacing.md,
  },
  ctaButton: {
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  ctaButtonGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonText: {
    ...Typography.h3,
    color: Colors.text,
    fontFamily: Fonts.rounded,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  skipButtonText: {
    ...Typography.body,
    color: Colors.accent,
  },
  storeButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  storeButton: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  storeButtonText: {
    ...Typography.bodySemibold,
    color: Colors.text,
  },

  // Success card
  successCard: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xxl,
  },
  successEmoji: {
    fontSize: 64,
  },
  successTitle: {
    ...Typography.h2,
    color: Colors.text,
    textAlign: 'center',
  },
  successSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
  },

  // Error card
  errorCard: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xxl,
  },
  errorEmoji: {
    fontSize: 48,
  },
  errorTitle: {
    ...Typography.h3,
    color: Colors.text,
    textAlign: 'center',
  },
  errorText: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },

  // Buttons
  primaryButton: {
    width: '100%',
    maxWidth: 280,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    marginTop: Spacing.lg,
    ...Shadows.md,
  },
  primaryButtonGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    ...Typography.bodySemibold,
    color: Colors.text,
    fontFamily: Fonts.rounded,
  },
  secondaryButton: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryButtonText: {
    ...Typography.bodySemibold,
    color: Colors.accent,
  },

  // Disclaimer
  disclaimer: {
    ...Typography.caption,
    color: Colors.textMuted,
    textAlign: 'center',
  },

  // Common
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
});


import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ViewShot from 'react-native-view-shot';

import { Confetti } from '@/components/celebration';
import { LoadingState } from '@/components/ui/loading-state';
import { SUCCESS_COPY, VERIFICATION_COPY } from '@/constants/content';
import { Colors, Fonts, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { usePromiseStore } from '@/context/promise-store';
import { computeStats } from '@/lib/stats/store';
import type { UserStats, UserPromise } from '@/lib/promises/types';

function hapticSuccess() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

function hapticLight() {
  Haptics.selectionAsync().catch(() => {});
}

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─────────────────────────────────────────────────────────────
// SHARE CARD COMPONENT
// ─────────────────────────────────────────────────────────────

interface ShareCardProps {
  promise: UserPromise;
  streak: number;
}

function ShareCard({ promise, streak }: ShareCardProps) {
  return (
    <View style={styles.shareCard}>
      <LinearGradient
        colors={['#1a1a2e', '#16213e']}
        style={styles.shareCardGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.shareCardContent}>
          <Text style={styles.shareCardLabel}>I BET</Text>
          <Text style={styles.shareCardAmount}>${promise.stake}</Text>
          <Text style={styles.shareCardPromise}>I&apos;d &quot;{promise.text}&quot;</Text>
          <View style={styles.shareCardDivider} />
          <Text style={styles.shareCardResult}>AND I DID IT 💪</Text>
          {streak > 1 && (
            <View style={styles.shareCardStreak}>
              <Text style={styles.shareCardStreakText}>
                🔥 {streak} in a row
              </Text>
            </View>
          )}
          <Text style={styles.shareCardBrand}>OopsFee</Text>
        </View>
      </LinearGradient>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// ANIMATED COMPONENTS
// ─────────────────────────────────────────────────────────────

function PulsingEmoji({ emoji }: { emoji: string }) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withSpring(1.1, { damping: 4 }),
        withSpring(1, { damping: 4 })
      ),
      -1,
      true
    );
  }, [scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.Text style={[styles.heroEmoji, animStyle]}>
      {emoji}
    </Animated.Text>
  );
}

function GlowingBadge({ saved }: { saved: number }) {
  const glow = useSharedValue(0);

  useEffect(() => {
    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500 }),
        withTiming(0, { duration: 1500 })
      ),
      -1,
      true
    );
  }, [glow]);

  const glowStyle = useAnimatedStyle(() => ({
    shadowOpacity: glow.value * 0.6 + 0.2,
    transform: [{ scale: 1 + glow.value * 0.02 }],
  }));

  return (
    <Animated.View style={[styles.savedBadge, glowStyle]}>
      <Text style={styles.savedEmoji}>💪</Text>
      <Text style={styles.savedAmount}>${saved} SAVED</Text>
      <Text style={styles.savedEmoji}>💪</Text>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────

export default function SuccessScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ promiseId?: string }>();
  const { promises, isHydrated } = usePromiseStore();

  const promiseId = useMemo(() => {
    const raw = params.promiseId;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params.promiseId]);

  const promise = useMemo(() => {
    if (!promiseId) return null;
    return promises.find((p) => p.id === promiseId) ?? null;
  }, [promiseId, promises]);

  const [stats, setStats] = useState<UserStats | null>(null);
  const [showConfetti, setShowConfetti] = useState(true);
  const [sharing, setSharing] = useState(false);
  const viewShotRef = useRef<ViewShot>(null);

  // Random copy
  const title = useMemo(() => pickRandom(SUCCESS_COPY.titles), []);
  const subtitle = useMemo(() => pickRandom(SUCCESS_COPY.subtitles), []);

  // Load stats
  useEffect(() => {
    if (!isHydrated) return;

    const loadStats = async () => {
      const computed = await computeStats(promises);
      setStats(computed);
    };

    loadStats();
    hapticSuccess();
  }, [isHydrated, promises]);

  const handleContinue = useCallback(() => {
    hapticLight();
    router.replace('/home');
  }, []);

  const handleShare = useCallback(async () => {
    if (!viewShotRef.current || sharing) return;
    setSharing(true);
    hapticLight();

    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        console.log('Sharing not available');
        setSharing(false);
        return;
      }

      const uri = await viewShotRef.current.capture?.();
      if (!uri) {
        setSharing(false);
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Share your win',
      });
    } catch (error) {
      console.error('Failed to share:', error);
    } finally {
      setSharing(false);
    }
  }, [sharing]);

  // Loading state
  if (!isHydrated || !promise) {
    return <LoadingState title="Loading celebration…" subtitle="Preparing your victory lap." />;
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Confetti */}
      {showConfetti && (
        <Confetti
          count={60}
          duration={3000}
          onComplete={() => setShowConfetti(false)}
        />
      )}

      {/* Content */}
      <View style={styles.content}>
        {/* Hero */}
        <Animated.View entering={FadeInUp.delay(200).duration(500)} style={styles.hero}>
          <PulsingEmoji emoji="🎉" />
          <Text style={styles.heroTitle}>{title}</Text>
          <Text style={styles.heroSubtitle}>{subtitle}</Text>
        </Animated.View>

        {/* Promise text */}
        <Animated.View entering={FadeInDown.delay(400).duration(400)} style={styles.promiseCard}>
          <Text style={styles.promiseText}>&quot;{promise.text}&quot;</Text>
        </Animated.View>

        {/* Saved badge */}
        <Animated.View entering={FadeIn.delay(600).duration(400)}>
          <GlowingBadge saved={promise.stake} />
        </Animated.View>

        {/* Streak */}
        {stats && stats.currentStreak > 1 && (
          <Animated.View entering={FadeIn.delay(800).duration(400)} style={styles.streakBadge}>
            <Text style={styles.streakText}>
              {SUCCESS_COPY.streakNote.replace('{count}', String(stats.currentStreak))}
            </Text>
          </Animated.View>
        )}

        {/* Verification proof */}
        {promise.verificationProof && (
          <Animated.View entering={FadeIn.delay(850).duration(400)} style={styles.verificationCard}>
            <View style={styles.verificationProofContainer}>
              <Image
                source={{ uri: promise.verificationProof }}
                style={styles.verificationThumbnail}
                resizeMode="cover"
              />
              <View style={styles.verificationBadgeOverlay}>
                <Text style={styles.verificationCheckmark}>✓</Text>
              </View>
            </View>
            <View style={styles.verificationInfo}>
              <Text style={styles.verificationLabel}>{VERIFICATION_COPY.proofLabel}</Text>
              <Text style={styles.verificationText}>{VERIFICATION_COPY.verifiedBadge}</Text>
            </View>
          </Animated.View>
        )}

        {/* Hidden share card for capture */}
        <View style={styles.shareCardContainer}>
          <ViewShot
            ref={viewShotRef}
            options={{ format: 'png', quality: 1, result: 'tmpfile' }}
          >
            <ShareCard promise={promise} streak={stats?.currentStreak ?? 0} />
          </ViewShot>
        </View>
      </View>

      {/* Actions */}
      <Animated.View entering={FadeInDown.delay(900).duration(400)} style={styles.actions}>
        <Pressable
          disabled={sharing}
          onPress={handleShare}
          style={({ pressed }) => [
            styles.shareButton,
            pressed && styles.buttonPressed,
            sharing && styles.buttonDisabled,
          ]}
        >
          <LinearGradient
            colors={[Colors.accent, '#0A7FD4']}
            style={styles.buttonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.buttonText}>
              {sharing ? 'Preparing…' : SUCCESS_COPY.sharePrompt}
            </Text>
          </LinearGradient>
        </Pressable>

        <Pressable
          onPress={handleContinue}
          style={({ pressed }) => [styles.continueButton, pressed && styles.buttonPressed]}
        >
          <Text style={styles.continueButtonText}>{SUCCESS_COPY.continueButton}</Text>
        </Pressable>
      </Animated.View>

      {/* Footer */}
      <Animated.View entering={FadeIn.delay(1100).duration(400)} style={styles.footer}>
        <Text style={styles.footerText}>
          Screenshot this. You earned it. (For once.)
        </Text>
      </Animated.View>
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
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.xl,
  },

  // Hero
  hero: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  heroEmoji: {
    fontSize: 72,
  },
  heroTitle: {
    ...Typography.h1,
    color: Colors.text,
    fontFamily: Fonts.rounded,
    textAlign: 'center',
  },
  heroSubtitle: {
    ...Typography.body,
    color: Colors.textTertiary,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Promise card
  promiseCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    maxWidth: '100%',
  },
  promiseText: {
    ...Typography.h3,
    color: Colors.text,
    fontFamily: Fonts.rounded,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Saved badge
  savedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.successDim,
    borderWidth: 1,
    borderColor: Colors.success + '55',
    borderRadius: Radius.full,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 20,
    elevation: 0,
  },
  savedEmoji: {
    fontSize: 24,
  },
  savedAmount: {
    ...Typography.h2,
    color: Colors.success,
    fontFamily: Fonts.rounded,
  },

  // Streak
  streakBadge: {
    backgroundColor: Colors.warningDim,
    borderWidth: 1,
    borderColor: Colors.warning + '44',
    borderRadius: Radius.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  streakText: {
    ...Typography.bodySemibold,
    color: Colors.warning,
  },

  // Verification proof
  verificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.successDim,
    borderWidth: 1,
    borderColor: Colors.success + '33',
    borderRadius: Radius.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  verificationProofContainer: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  verificationThumbnail: {
    width: '100%',
    height: '100%',
  },
  verificationBadgeOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.bgElevated,
  },
  verificationCheckmark: {
    color: Colors.text,
    fontSize: 10,
    fontWeight: '700',
  },
  verificationInfo: {
    flex: 1,
    gap: 2,
  },
  verificationLabel: {
    ...Typography.label,
    color: Colors.success,
    fontSize: 10,
  },
  verificationText: {
    ...Typography.bodySemibold,
    color: Colors.success,
    fontSize: 14,
  },

  // Share card (hidden, for capture)
  shareCardContainer: {
    position: 'absolute',
    left: -9999,
    top: -9999,
  },
  shareCard: {
    width: 360,
    height: 480,
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
  shareCardGradient: {
    flex: 1,
    padding: Spacing.xl,
  },
  shareCardContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  shareCardLabel: {
    ...Typography.label,
    color: Colors.textMuted,
  },
  shareCardAmount: {
    ...Typography.displayLarge,
    color: Colors.success,
    fontFamily: Fonts.rounded,
  },
  shareCardPromise: {
    ...Typography.h3,
    color: Colors.text,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  shareCardDivider: {
    width: 60,
    height: 2,
    backgroundColor: Colors.success,
    marginVertical: Spacing.md,
    borderRadius: 1,
  },
  shareCardResult: {
    ...Typography.h2,
    color: Colors.text,
    fontFamily: Fonts.rounded,
  },
  shareCardStreak: {
    marginTop: Spacing.sm,
  },
  shareCardStreakText: {
    ...Typography.bodySemibold,
    color: Colors.warning,
  },
  shareCardBrand: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: Spacing.xl,
    letterSpacing: 2,
  },

  // Actions
  actions: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
  },
  shareButton: {
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  buttonGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    ...Typography.bodySemibold,
    color: Colors.text,
    fontFamily: Fonts.rounded,
  },
  continueButton: {
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: {
    ...Typography.bodySemibold,
    color: Colors.textSecondary,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  // Footer
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    alignItems: 'center',
  },
  footerText: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});


import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
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
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ViewShot from "react-native-view-shot";

import { Confetti } from "@/components/celebration";
import { LoadingState } from "@/components/ui/loading-state";
import { SUCCESS_COPY, VERIFICATION_COPY } from "@/constants/content";
import { usePromiseStore } from "@/context/promise-store";
import { computeStats } from "@/lib/stats/store";
import type { UserStats, UserPromise } from "@/lib/promises/types";

function hapticSuccess() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
    () => {},
  );
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
    <View className="w-[360px] h-[480px] rounded-xl overflow-hidden">
      <LinearGradient
        colors={["#1a1a2e", "#16213e"]}
        className="flex-1 p-xl"
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View className="flex-1 items-center justify-center gap-md">
          <Text className="text-label text-text-muted">I BET</Text>
          <Text className="text-display-lg text-success font-rounded">
            ${promise.stake}
          </Text>
          <Text className="text-h3 text-white text-center italic">
            I&apos;d &quot;{promise.text}&quot;
          </Text>
          <View className="w-[60px] h-0.5 bg-success my-md rounded-sm" />
          <Text className="text-h2 text-white font-rounded">
            AND I DID IT 💪
          </Text>
          {streak > 1 && (
            <View className="mt-sm">
              <Text className="text-body-semibold text-warning">
                🔥 {streak} in a row
              </Text>
            </View>
          )}
          <Text className="text-caption text-text-muted mt-xl tracking-[2px]">
            OopsFee
          </Text>
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
        withSpring(1, { damping: 4 }),
      ),
      -1,
      true,
    );
  }, [scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.Text style={animStyle} className="text-[72px]">
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
        withTiming(0, { duration: 1500 }),
      ),
      -1,
      true,
    );
  }, [glow]);

  const glowStyle = useAnimatedStyle(() => ({
    shadowOpacity: glow.value * 0.6 + 0.2,
    transform: [{ scale: 1 + glow.value * 0.02 }],
  }));

  return (
    <Animated.View
      style={[
        glowStyle,
        {
          shadowColor: "#34C759",
          shadowOffset: { width: 0, height: 0 },
          shadowRadius: 20,
          elevation: 0,
        },
      ]}
      className="flex-row items-center gap-md bg-success-dim border border-success/[0.33] rounded-full py-md px-xl"
    >
      <Text className="text-[24px]">💪</Text>
      <Text className="text-h2 text-success font-rounded">${saved} SAVED</Text>
      <Text className="text-[24px]">💪</Text>
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
    router.replace("/(mobile)/home");
  }, []);

  const handleShare = useCallback(async () => {
    if (!viewShotRef.current || sharing) return;
    setSharing(true);
    hapticLight();

    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        console.log("Sharing not available");
        setSharing(false);
        return;
      }

      const uri = await viewShotRef.current.capture?.();
      if (!uri) {
        setSharing(false);
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: "Share your win",
      });
    } catch (error) {
      console.error("Failed to share:", error);
    } finally {
      setSharing(false);
    }
  }, [sharing]);

  // Loading state
  if (!isHydrated || !promise) {
    return (
      <LoadingState
        title="Loading celebration…"
        subtitle="Preparing your victory lap."
      />
    );
  }

  return (
    <View
      className="flex-1 bg-black"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      {/* Confetti */}
      {showConfetti && (
        <Confetti
          count={60}
          duration={3000}
          onComplete={() => setShowConfetti(false)}
        />
      )}

      {/* Content */}
      <View className="flex-1 items-center justify-center px-xl gap-xl">
        {/* Hero */}
        <Animated.View
          entering={FadeInUp.delay(200).duration(500)}
          className="items-center gap-md"
        >
          <PulsingEmoji emoji="🎉" />
          <Text className="text-h1 text-white font-rounded text-center">
            {title}
          </Text>
          <Text className="text-body text-text-tertiary text-center italic">
            {subtitle}
          </Text>
        </Animated.View>

        {/* Promise text */}
        <Animated.View
          entering={FadeInDown.delay(400).duration(400)}
          className="bg-card rounded-xl border border-border py-lg px-xl max-w-full"
        >
          <Text className="text-h3 text-white font-rounded text-center italic">
            &quot;{promise.text}&quot;
          </Text>
        </Animated.View>

        {/* Saved badge */}
        <Animated.View entering={FadeIn.delay(600).duration(400)}>
          <GlowingBadge saved={promise.stake} />
        </Animated.View>

        {/* Streak */}
        {stats && stats.currentStreak > 1 && (
          <Animated.View
            entering={FadeIn.delay(800).duration(400)}
            className="bg-warning-dim border border-warning/[0.27] rounded-lg py-sm px-lg"
          >
            <Text className="text-body-semibold text-warning">
              {SUCCESS_COPY.streakNote.replace(
                "{count}",
                String(stats.currentStreak),
              )}
            </Text>
          </Animated.View>
        )}

        {/* Verification proof */}
        {promise.verificationProof && (
          <Animated.View
            entering={FadeIn.delay(850).duration(400)}
            className="flex-row items-center gap-md bg-success-dim border border-success/20 rounded-lg py-sm px-md"
          >
            <View className="w-12 h-12 rounded-md overflow-hidden relative">
              <Image
                source={{ uri: promise.verificationProof }}
                className="w-full h-full"
                resizeMode="cover"
              />
              <View className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-success items-center justify-center border-2 border-abyss-700">
                <Text className="text-white text-[10px] font-bold">✓</Text>
              </View>
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="text-label text-success text-[10px]">
                {VERIFICATION_COPY.proofLabel}
              </Text>
              <Text className="text-body-semibold text-success text-sm">
                {VERIFICATION_COPY.verifiedBadge}
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Hidden share card for capture */}
        <View className="absolute -left-[9999px] -top-[9999px]">
          <ViewShot
            ref={viewShotRef}
            options={{ format: "png", quality: 1, result: "tmpfile" }}
          >
            <ShareCard promise={promise} streak={stats?.currentStreak ?? 0} />
          </ViewShot>
        </View>
      </View>

      {/* Actions */}
      <Animated.View
        entering={FadeInDown.delay(900).duration(400)}
        className="px-xl pb-lg gap-md"
      >
        <Pressable
          disabled={sharing}
          onPress={handleShare}
          className={`h-14 rounded-[28px] overflow-hidden shadow-lg active:opacity-90 active:scale-[0.98] ${
            sharing ? "opacity-60" : ""
          }`}
        >
          <LinearGradient
            colors={["#0B93F6", "#0A7FD4"]}
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 24,
            }}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text className="text-body-semibold text-white font-rounded">
              {sharing ? "Preparing…" : SUCCESS_COPY.sharePrompt}
            </Text>
          </LinearGradient>
        </Pressable>

        <Pressable
          onPress={handleContinue}
          className="h-[52px] rounded-[26px] bg-card border border-border items-center justify-center active:opacity-90 active:scale-[0.98]"
        >
          <Text className="text-body-semibold text-text-secondary">
            {SUCCESS_COPY.continueButton}
          </Text>
        </Pressable>
      </Animated.View>

      {/* Footer */}
      <Animated.View
        entering={FadeIn.delay(1100).duration(400)}
        className="px-xl pb-lg items-center"
      >
        <Text className="text-caption text-text-muted italic text-center">
          Screenshot this. You earned it. (For once.)
        </Text>
      </Animated.View>
    </View>
  );
}

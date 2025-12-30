/**
 * Friend Invite Screen
 *
 * Generate and share invite links with non-users.
 * When they sign up via the link, they automatically become friends.
 */

import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/auth";
import {
  createFriendInvite,
  type CreateFriendInviteResponse,
} from "@/lib/friends";

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

function hapticError() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
    () => {},
  );
}

function formatExpiryDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
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
      const msg = e instanceof Error ? e.message : "Failed to create invite";
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

    const displayName = profile?.display_name || profile?.username || "I";
    const message = `${displayName === "I" ? "I want" : `${displayName} wants`} you as an accountability partner on OopsFee! When you sign up, we'll automatically be connected.\n\n${invite.invite_url}`;

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
      console.error("[Invite] Share failed:", e);
    }
  }, [invite?.invite_url, profile]);

  const handleBack = () => {
    hapticLight();
    router.back();
  };

  const handleSetupUsername = () => {
    hapticMedium();
    router.push("/(mobile)/setup-username");
  };

  // ─────────────────────────────────────────────────────────────
  // NOT AUTHENTICATED
  // ─────────────────────────────────────────────────────────────

  if (!isAuthenticated) {
    return (
      <View className="flex-1 bg-black" style={{ paddingTop: insets.top }}>
        <Header onBack={handleBack} />
        <View className="flex-1 items-center justify-center px-xl gap-md">
          <Text className="text-[48px] mb-sm">🔒</Text>
          <Text className="text-h3 text-white text-center">
            Sign in required
          </Text>
          <Text className="text-body text-text-secondary text-center max-w-[280px]">
            Sign in to invite friends to OopsFee
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

  // ─────────────────────────────────────────────────────────────
  // NO USERNAME SET
  // ─────────────────────────────────────────────────────────────

  if (!hasUsername) {
    return (
      <View className="flex-1 bg-black" style={{ paddingTop: insets.top }}>
        <Header onBack={handleBack} />
        <View className="flex-1 items-center justify-center px-xl gap-md">
          <Text className="text-[48px] mb-sm">👤</Text>
          <Text className="text-h3 text-white text-center">
            Set up your username first
          </Text>
          <Text className="text-body text-text-secondary text-center max-w-[280px]">
            You need a username so friends can find you when they join.
          </Text>
          <Pressable
            onPress={handleSetupUsername}
            className="mt-md bg-imessage px-xl py-md rounded-lg active:opacity-80 active:scale-[0.98]"
          >
            <Text className="text-body-semibold text-white">Set Username</Text>
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
      <View className="flex-1 bg-black" style={{ paddingTop: insets.top }}>
        <Header onBack={handleBack} />
        <View className="flex-1 items-center justify-center px-xl gap-md">
          <ActivityIndicator size="large" color="#0B93F6" />
          <Text className="text-body text-text-secondary mt-md">
            Creating invite link...
          </Text>
        </View>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // ERROR
  // ─────────────────────────────────────────────────────────────

  if (error && !invite) {
    return (
      <View className="flex-1 bg-black" style={{ paddingTop: insets.top }}>
        <Header onBack={handleBack} />
        <View className="flex-1 items-center justify-center px-xl gap-md">
          <Text className="text-[48px] mb-sm">😕</Text>
          <Text className="text-h3 text-white text-center">
            Something went wrong
          </Text>
          <Text className="text-body text-text-secondary text-center max-w-[280px]">
            {error}
          </Text>
          <Pressable
            onPress={generateInvite}
            className="mt-md bg-imessage px-xl py-md rounded-lg active:opacity-80 active:scale-[0.98]"
          >
            <Text className="text-body-semibold text-white">Try Again</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // INVITE READY
  // ─────────────────────────────────────────────────────────────

  return (
    <View className="flex-1 bg-black" style={{ paddingTop: insets.top }}>
      <Header onBack={handleBack} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 16,
          gap: 24,
          paddingBottom: insets.bottom + 32,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <Animated.View
          entering={FadeInDown.duration(300)}
          className="items-center gap-sm py-lg"
        >
          <Text className="text-[56px]">🎉</Text>
          <Text className="text-h1 text-white text-center">
            Invite a friend
          </Text>
          <Text className="text-body text-text-secondary text-center max-w-[300px] leading-6">
            Share this link with anyone you want as an accountability partner.
            When they sign up, you&apos;ll automatically be connected!
          </Text>
        </Animated.View>

        {/* Link Card */}
        <Animated.View
          entering={FadeInUp.delay(100).duration(300)}
          className="bg-card rounded-xl border border-border p-xl gap-lg"
        >
          <View className="flex-row justify-between items-center">
            <Text className="text-label text-text-tertiary uppercase tracking-wide">
              YOUR INVITE LINK
            </Text>
            {invite?.expires_at && (
              <Text className="text-caption text-text-muted">
                Expires {formatExpiryDate(invite.expires_at)}
              </Text>
            )}
          </View>

          <View className="bg-black rounded-md border border-border p-md">
            <Text
              className="text-body text-imessage font-mono"
              numberOfLines={1}
            >
              {invite?.invite_url}
            </Text>
          </View>

          {/* Actions */}
          <View className="flex-row gap-md">
            <Pressable
              onPress={handleCopyLink}
              className={`flex-1 flex-row items-center justify-center gap-sm py-md rounded-lg border ${
                copied
                  ? "bg-success-dim border-success"
                  : "bg-card-hover border-border"
              } active:opacity-80 active:scale-[0.98]`}
            >
              <Text className="text-[18px]">{copied ? "✓" : "📋"}</Text>
              <Text
                className={`text-body-semibold ${copied ? "text-success" : "text-white"}`}
              >
                {copied ? "Copied!" : "Copy"}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleShare}
              className="flex-[2] rounded-lg overflow-hidden shadow-md active:opacity-80 active:scale-[0.98]"
            >
              <LinearGradient
                colors={["#0B93F6", "#0A84FF"]}
                className="flex-row items-center justify-center gap-sm py-md"
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text className="text-[18px]">📤</Text>
                <Text className="text-body-semibold text-white">Share</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </Animated.View>

        {/* Success feedback */}
        {shared && (
          <Animated.View
            entering={FadeIn.duration(200)}
            className="flex-row items-center gap-md bg-success-dim rounded-lg border border-success p-lg"
          >
            <Text className="text-[24px]">🚀</Text>
            <Text className="text-body text-success flex-1">
              Invite shared! They&apos;ll be your friend when they join.
            </Text>
          </Animated.View>
        )}

        {/* How it works */}
        <Animated.View
          entering={FadeInUp.delay(200).duration(300)}
          className="bg-card rounded-xl border border-border p-xl gap-lg"
        >
          <Text className="text-h3 text-white">How it works</Text>

          <View className="gap-md">
            <View className="flex-row items-start gap-md">
              <View className="w-7 h-7 rounded-full bg-imessage-dim items-center justify-center">
                <Text className="text-body-semibold text-imessage text-[14px]">
                  1
                </Text>
              </View>
              <View className="flex-1 gap-0.5">
                <Text className="text-body-semibold text-white">
                  Share your link
                </Text>
                <Text className="text-caption text-text-secondary">
                  Send to anyone via text, email, or social media
                </Text>
              </View>
            </View>

            <View className="w-0.5 h-3 bg-border ml-[13px]" />

            <View className="flex-row items-start gap-md">
              <View className="w-7 h-7 rounded-full bg-imessage-dim items-center justify-center">
                <Text className="text-body-semibold text-imessage text-[14px]">
                  2
                </Text>
              </View>
              <View className="flex-1 gap-0.5">
                <Text className="text-body-semibold text-white">
                  They sign up
                </Text>
                <Text className="text-caption text-text-secondary">
                  They open the link and create an account
                </Text>
              </View>
            </View>

            <View className="w-0.5 h-3 bg-border ml-[13px]" />

            <View className="flex-row items-start gap-md">
              <View className="w-7 h-7 rounded-full bg-imessage-dim items-center justify-center">
                <Text className="text-body-semibold text-imessage text-[14px]">
                  3
                </Text>
              </View>
              <View className="flex-1 gap-0.5">
                <Text className="text-body-semibold text-white">
                  Instant connection
                </Text>
                <Text className="text-caption text-text-secondary">
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
            className={`items-center justify-center py-md ${isLoading ? "opacity-60" : ""} active:opacity-80 active:scale-[0.98]`}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" />
            ) : (
              <Text className="text-body text-text-secondary">
                🔄 Generate new link
              </Text>
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
    <View className="flex-row items-center justify-between px-lg py-md">
      <Pressable
        onPress={onBack}
        className="w-10 h-10 rounded-full bg-card border border-border items-center justify-center active:opacity-70"
      >
        <Text className="text-[20px] text-white">←</Text>
      </Pressable>

      <Text className="text-h2 text-white font-rounded">Invite</Text>

      <View className="w-10" />
    </View>
  );
}

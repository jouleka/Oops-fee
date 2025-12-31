import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Link, router, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TopUpModal, WithdrawModal } from "@/components/wallet";
import { useAuth } from "@/context/auth";
import { fetchFriendsLeaderboard } from "@/lib/leaderboard/api";
import { isStripeConfigured } from "@/lib/stripe";
import { supabase } from "@/lib/supabase";
import { formatCents } from "@/lib/wallet/api";

function hapticMedium() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

function getPaymentEmoji(brand: string | null): string {
  const map: Record<string, string> = {
    visa: "💳",
    mastercard: "💳",
    amex: "💳",
    discover: "💳",
    apple_pay: "🍎",
    google_pay: "🤖",
    link: "🔗",
    cashapp: "💵",
    amazon_pay: "📦",
  };
  return map[brand || ""] || "💳";
}

function getPaymentName(brand: string | null): string {
  const map: Record<string, string> = {
    visa: "Visa",
    mastercard: "Mastercard",
    amex: "Amex",
    discover: "Discover",
    apple_pay: "Apple Pay",
    google_pay: "Google Pay",
    link: "Link",
    cashapp: "Cash App",
    amazon_pay: "Amazon Pay",
  };
  return map[brand || ""] || "Card";
}

// Extended profile type to access username (from migration 014)
type ExtendedProfile = {
  username?: string | null;
  username_set_at?: string | null;
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const {
    isAuthenticated,
    user,
    profile,
    signOut,
    isLoading,
    paymentState,
    walletState,
    refreshProfile,
  } = useAuth();
  const [showTopUp, setShowTopUp] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [friendCount, setFriendCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [friendsRank, setFriendsRank] = useState<number | null>(null);
  const [totalInLeaderboard, setTotalInLeaderboard] = useState<number | null>(
    null,
  );

  // Cast profile to access extended fields
  const extendedProfile = profile as (typeof profile & ExtendedProfile) | null;
  const hasUsername = Boolean(extendedProfile?.username);

  // Fetch friend counts and leaderboard rank
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    const fetchFriendData = async () => {
      try {
        const response = await supabase.functions.invoke("get-friends", {
          body: {},
        });

        if (!response.error && response.data) {
          setFriendCount(response.data.friends?.length ?? 0);
          setPendingCount(response.data.pendingReceived?.length ?? 0);
        }
      } catch {
        // Silently fail - friends feature may not be deployed yet
      }
    };

    const fetchRank = async () => {
      try {
        const data = await fetchFriendsLeaderboard({
          metric: "success_rate",
          period: "all_time",
        });
        setFriendsRank(data.current_user_rank);
        setTotalInLeaderboard(data.total_friends + 1); // +1 for self
      } catch {
        // Silently fail - leaderboard may not be deployed yet
      }
    };

    fetchFriendData();
    fetchRank();
  }, [isAuthenticated, user?.id]);

  const handleSignOut = async () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          hapticMedium();
          await signOut();
          router.replace("/(mobile)/home");
        },
      },
    ]);
  };

  const handleSignIn = () => {
    hapticMedium();
    router.push("/auth/sign-in");
  };

  // Show username as primary identifier, fallback to email prefix
  const displayName = extendedProfile?.username || user?.email?.split("@")[0] || "User";
  const email = user?.email || "No email";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <View className="flex-1 bg-black" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <Animated.View
        entering={FadeInDown.duration(300)}
        className="flex-row items-center justify-between px-lg py-md"
      >
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-card border border-border items-center justify-center active:bg-card-hover"
        >
          <Text className="text-xl text-white">←</Text>
        </Pressable>
        <Text className="text-h2 text-white font-rounded">Account</Text>
        <View className="w-10" />
      </Animated.View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 24,
          gap: 24,
          paddingBottom: insets.bottom + 32,
        }}
      >
        {isAuthenticated ? (
          <>
            {/* Profile Card */}
            <Animated.View
              entering={FadeInDown.delay(50).duration(300)}
              className="flex-row items-center gap-lg bg-card rounded-xl border border-border p-lg"
            >
              <LinearGradient
                colors={["#34C759", "rgba(52, 199, 89, 0.15)"]}
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text className="text-[28px] font-bold text-white">
                  {initial}
                </Text>
              </LinearGradient>
              <View className="flex-1 gap-xs">
                {/* Username as primary display */}
                {hasUsername ? (
                  <Pressable
                    onPress={() => {
                      hapticMedium();
                      router.push("/(mobile)/setup-username");
                    }}
                    className="active:opacity-70"
                  >
                    <Text className="text-h3 text-imessage font-mono">
                      @{extendedProfile?.username}
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => {
                      hapticMedium();
                      router.push("/(mobile)/setup-username");
                    }}
                    className="active:opacity-70"
                  >
                    <Text className="text-h3 text-imessage font-semibold">
                      + Set username
                    </Text>
                  </Pressable>
                )}
                <Text className="text-body text-text-secondary">{email}</Text>
                <View className="flex-row items-center gap-xs mt-xs">
                  <View className="w-2 h-2 rounded-full bg-success" />
                  <Text className="text-caption text-success">Signed in</Text>
                </View>
              </View>
            </Animated.View>

            {/* Account Details */}
            <Animated.View
              entering={FadeInDown.delay(100).duration(300)}
              className="gap-md"
            >
              <Text className="text-label text-text-muted ml-xs">
                Account Details
              </Text>
              <View className="bg-card rounded-lg border border-border overflow-hidden">
                <View className="flex-row justify-between items-center px-lg py-md">
                  <Text className="text-body text-text-secondary">
                    Provider
                  </Text>
                  <Text className="text-body text-white">
                    {user?.app_metadata?.provider === "apple"
                      ? "🍎 Apple"
                      : user?.app_metadata?.provider === "google"
                        ? "🔵 Google"
                        : "📧 Email"}
                  </Text>
                </View>
                <View className="h-px bg-border mx-lg" />
                <View className="flex-row justify-between items-center px-lg py-md">
                  <Text className="text-body text-text-secondary">User ID</Text>
                  <Text className="text-body text-text-muted font-mono text-[13px]">
                    {user?.id?.slice(0, 8)}...
                  </Text>
                </View>
              </View>
            </Animated.View>

            {/* Friends */}
            <Animated.View
              entering={FadeInDown.delay(105).duration(300)}
              className="gap-md"
            >
              <Text className="text-label text-text-muted ml-xs">Friends</Text>
              <Pressable
                onPress={() => {
                  hapticMedium();
                  router.push("/(mobile)/friends" as never);
                }}
                className="flex-row items-center justify-between bg-card rounded-lg border border-border p-lg active:opacity-80"
              >
                <View className="flex-row items-center gap-md flex-1">
                  <Text className="text-2xl">👥</Text>
                  <View className="flex-1 gap-0.5">
                    <Text className="text-body text-white font-semibold">
                      {friendCount === 0
                        ? "No friends yet"
                        : `${friendCount} friend${friendCount !== 1 ? "s" : ""}`}
                    </Text>
                    <Text className="text-caption text-text-tertiary">
                      {pendingCount > 0
                        ? `${pendingCount} pending request${pendingCount !== 1 ? "s" : ""}`
                        : "Find and add accountability partners"}
                    </Text>
                  </View>
                </View>
                <View className="flex-row items-center gap-sm">
                  {pendingCount > 0 && (
                    <View className="bg-imessage rounded-full min-w-[20px] h-5 items-center justify-center px-xs">
                      <Text className="text-caption text-white font-bold text-[11px]">
                        {pendingCount}
                      </Text>
                    </View>
                  )}
                  <Text className="text-text-muted text-base">›</Text>
                </View>
              </Pressable>
            </Animated.View>

            {/* Leaderboard */}
            <Animated.View
              entering={FadeInDown.delay(108).duration(300)}
              className="gap-md"
            >
              <Text className="text-label text-text-muted ml-xs">
                Leaderboard
              </Text>
              <Pressable
                onPress={() => {
                  hapticMedium();
                  router.push("/(mobile)/leaderboard" as never);
                }}
                className="flex-row items-center justify-between bg-card rounded-lg border border-border p-lg active:opacity-80"
              >
                <View className="flex-row items-center gap-md flex-1">
                  <Text className="text-2xl">🏆</Text>
                  <View className="flex-1 gap-0.5">
                    <Text className="text-body text-white font-semibold">
                      {friendsRank !== null && totalInLeaderboard !== null
                        ? `Rank #${friendsRank} of ${totalInLeaderboard}`
                        : friendCount > 0
                          ? "View your ranking"
                          : "Add friends to compete"}
                    </Text>
                    <Text className="text-caption text-text-tertiary">
                      {friendsRank !== null
                        ? "See how you compare with friends"
                        : "Compete with friends on success rate & more"}
                    </Text>
                  </View>
                </View>
                <Text className="text-text-muted text-base">›</Text>
              </Pressable>
            </Animated.View>

            {/* Wallet */}
            {isStripeConfigured() && (
              <Animated.View
                entering={FadeInDown.delay(110).duration(300)}
                className="gap-md"
              >
                <Text className="text-label text-text-muted ml-xs">Wallet</Text>
                <View className="bg-card rounded-lg border border-border overflow-hidden">
                  <View className="flex-row justify-between items-center p-lg">
                    <View className="gap-0.5">
                      <Text className="text-caption text-text-tertiary">
                        Balance
                      </Text>
                      <Text className="text-display-sm text-money font-mono">
                        {formatCents(walletState.balanceCents)}
                      </Text>
                    </View>
                    <View
                      className={`px-sm py-xs rounded-full ${
                        walletState.hasBalance
                          ? "bg-success-dim"
                          : "bg-card-hover"
                      }`}
                    >
                      <Text
                        className={`text-caption ${
                          walletState.hasBalance
                            ? "text-success"
                            : "text-text-muted"
                        }`}
                      >
                        {walletState.hasBalance ? "Funds available" : "Empty"}
                      </Text>
                    </View>
                  </View>

                  <View className="h-px bg-border" />

                  <View className="flex-row gap-sm p-md">
                    <Pressable
                      onPress={() => {
                        hapticMedium();
                        setShowTopUp(true);
                      }}
                      className="flex-1 flex-row items-center justify-center gap-xs py-md rounded-md bg-success-dim border border-success/40 active:opacity-80"
                    >
                      <Text className="text-lg font-semibold text-success">
                        +
                      </Text>
                      <Text className="text-body-semibold text-white">
                        Add Funds
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        hapticMedium();
                        setShowWithdraw(true);
                      }}
                      disabled={!walletState.hasBalance}
                      className={`flex-1 flex-row items-center justify-center gap-xs py-md rounded-md bg-card-hover border border-border active:opacity-80 ${
                        !walletState.hasBalance ? "opacity-50" : ""
                      }`}
                    >
                      <Text
                        className={`text-lg font-semibold ${walletState.hasBalance ? "text-success" : "text-text-muted"}`}
                      >
                        ↓
                      </Text>
                      <Text
                        className={`text-body-semibold ${walletState.hasBalance ? "text-white" : "text-text-muted"}`}
                      >
                        Withdraw
                      </Text>
                    </Pressable>
                  </View>

                  {walletState.hasBalance && (
                    <Text className="text-caption text-text-tertiary text-center px-lg pb-md">
                      Wallet funds are automatically used for stakes
                    </Text>
                  )}
                </View>
              </Animated.View>
            )}

            {/* Payment Method */}
            {isStripeConfigured() && (
              <Animated.View
                entering={FadeInDown.delay(125).duration(300)}
                className="gap-md"
              >
                <Text className="text-label text-text-muted ml-xs">
                  Payment Method
                </Text>
                <Pressable
                  onPress={() => {
                    hapticMedium();
                    router.push("/(auth)/payment-method" as never);
                  }}
                  className="bg-card rounded-lg border border-border overflow-hidden active:opacity-80"
                >
                  <View className="flex-row justify-between items-center px-lg py-md">
                    <Text className="text-body text-text-secondary">
                      {paymentState.hasPaymentMethod
                        ? `${getPaymentEmoji(paymentState.brand)} ${getPaymentName(paymentState.brand)}${paymentState.last4 ? ` •••• ${paymentState.last4}` : ""}`
                        : "💳 No card"}
                    </Text>
                    <View className="flex-row items-center gap-2">
                      <Text
                        className={`text-body ${!paymentState.hasPaymentMethod ? "text-text-muted" : "text-white"}`}
                      >
                        {paymentState.hasPaymentMethod ? "Manage" : "Add"}
                      </Text>
                      <Text className="text-text-muted text-base">›</Text>
                    </View>
                  </View>
                </Pressable>
              </Animated.View>
            )}

            {/* Sign Out */}
            <Animated.View
              entering={FadeInDown.delay(150).duration(300)}
              className="gap-md"
            >
              <Pressable
                onPress={handleSignOut}
                disabled={isLoading}
                className={`bg-danger-dim rounded-lg border border-danger/[0.27] py-md items-center active:opacity-80 ${
                  isLoading ? "opacity-50" : ""
                }`}
              >
                <Text className="text-body text-danger font-semibold">
                  Sign Out
                </Text>
              </Pressable>
            </Animated.View>

            {/* Legal Links */}
            <Animated.View
              entering={FadeInDown.delay(200).duration(300)}
              className="flex-row justify-center gap-lg pt-md pb-xl"
            >
              <Link href={"/privacy" as Href} asChild>
                <Pressable className="active:opacity-70">
                  <Text className="text-caption text-text-tertiary">
                    Privacy Policy
                  </Text>
                </Pressable>
              </Link>
              <Text className="text-caption text-text-muted">•</Text>
              <Link href={"/terms" as Href} asChild>
                <Pressable className="active:opacity-70">
                  <Text className="text-caption text-text-tertiary">
                    Terms of Service
                  </Text>
                </Pressable>
              </Link>
            </Animated.View>

            {/* Wallet Modals */}
            <TopUpModal
              visible={showTopUp}
              onClose={() => setShowTopUp(false)}
              onSuccess={() => {
                setShowTopUp(false);
                refreshProfile();
              }}
            />
            <WithdrawModal
              visible={showWithdraw}
              onClose={() => setShowWithdraw(false)}
              onSuccess={() => {
                setShowWithdraw(false);
                refreshProfile();
              }}
            />
          </>
        ) : (
          <GuestState onSignIn={handleSignIn} />
        )}
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// GUEST STATE COMPONENT
// ─────────────────────────────────────────────────────────────

const BENEFITS = [
  {
    emoji: "💸",
    title: "Real consequences",
    subtitle: "Lose money when you fail. Keep it when you don't.",
  },
  {
    emoji: "👥",
    title: "Friend accountability",
    subtitle: "They win your money if you flake.",
  },
  {
    emoji: "📈",
    title: "Track your word",
    subtitle: "See how often you actually follow through.",
  },
];

function GuestState({ onSignIn }: { onSignIn: () => void }) {
  return (
    <>
      {/* Hero Card */}
      <Animated.View
        entering={FadeInDown.delay(50).duration(300)}
        className="items-center bg-card rounded-xl border border-border p-xl gap-lg"
      >
        <View className="mb-xs">
          <View className="w-16 h-16 rounded-full items-center justify-center bg-white/5 border border-white/10">
            <Text className="text-[32px]">🎯</Text>
          </View>
        </View>
        <View className="items-center gap-sm">
          <Text className="text-h3 text-white font-rounded">
            Accountability costs money
          </Text>
          <Text className="text-body text-text-secondary text-center leading-6 px-sm">
            Make promises. Put cash on them.{"\n"}
            Break them, and you pay.
          </Text>
        </View>

        {/* Sign In CTA - Clean white button */}
        <Pressable
          onPress={onSignIn}
          className="mt-md bg-white px-8 py-4 rounded-lg active:opacity-90 active:scale-[0.98]"
        >
          <Text className="text-base font-semibold text-black">
            Get Started
          </Text>
        </Pressable>

        <Text className="text-[12px] text-text-muted mt-xs">
          Free to try. Costs money to quit.
        </Text>
      </Animated.View>

      {/* Benefits List */}
      <Animated.View
        entering={FadeInDown.delay(150).duration(300)}
        className="gap-sm mt-md"
      >
        <Text className="text-label text-text-muted ml-xs uppercase tracking-wide">
          How it works
        </Text>
        {BENEFITS.map((benefit, i) => (
          <Animated.View
            key={i}
            entering={FadeInDown.delay(180 + i * 50).duration(280)}
            className="flex-row items-center gap-md bg-card rounded-lg border border-border p-md"
          >
            <View className="w-10 h-10 rounded-full bg-white/5 items-center justify-center">
              <Text className="text-xl">{benefit.emoji}</Text>
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="text-body text-white font-medium">
                {benefit.title}
              </Text>
              <Text className="text-caption text-text-tertiary leading-5">
                {benefit.subtitle}
              </Text>
            </View>
          </Animated.View>
        ))}
      </Animated.View>

      {/* Bottom nudge */}
      <Animated.View
        entering={FadeIn.delay(400).duration(300)}
        className="items-center pt-xl pb-md"
      >
        <Pressable onPress={onSignIn} className="active:opacity-70">
          <Text className="text-caption text-text-tertiary">
            Already have an account?{" "}
            <Text className="text-white underline">Sign in</Text>
          </Text>
        </Pressable>
      </Animated.View>

      {/* Legal Links */}
      <Animated.View
        entering={FadeIn.delay(450).duration(300)}
        className="flex-row justify-center gap-lg pb-xl"
      >
        <Link href={"/privacy" as Href} asChild>
          <Pressable className="active:opacity-70">
            <Text className="text-caption text-text-tertiary">
              Privacy Policy
            </Text>
          </Pressable>
        </Link>
        <Text className="text-caption text-text-muted">•</Text>
        <Link href={"/terms" as Href} asChild>
          <Pressable className="active:opacity-70">
            <Text className="text-caption text-text-tertiary">
              Terms of Service
            </Text>
          </Pressable>
        </Link>
      </Animated.View>
    </>
  );
}

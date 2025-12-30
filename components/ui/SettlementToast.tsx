/**
 * SettlementToast
 *
 * In-app notification when a promise is settled (charged or payment failed).
 * Slides up from bottom with dramatic styling to reinforce loss salience.
 */

import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Dimensions, Pressable, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type SettlementType =
  | "charged"
  | "failed"
  | "requires_action"
  | "abandoned";

interface SettlementToastProps {
  visible: boolean;
  type: SettlementType;
  promiseText: string;
  stake: number;
  onDismiss: () => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const CONTENT = {
  charged: {
    emoji: "💸",
    title: "Promise Broken",
    subtitle: "Your stake has been charged.",
    buttonText: "View Graveyard",
    navigateTo: "/graveyard",
  },
  failed: {
    emoji: "⚠️",
    title: "Payment Failed",
    subtitle: "Your card was declined. Update your payment method.",
    buttonText: "Update Payment",
    navigateTo: "/(auth)/payment-method",
  },
  requires_action: {
    emoji: "🔐",
    title: "Action Required",
    subtitle: "Your bank requires verification.",
    buttonText: "Verify Payment",
    navigateTo: "/(auth)/payment-method",
  },
  abandoned: {
    emoji: "☠️",
    title: "Promise Abandoned",
    subtitle: "This promise expired without completion.",
    buttonText: "View Graveyard",
    navigateTo: "/graveyard",
  },
} as const;

export function SettlementToast({
  visible,
  type,
  promiseText,
  stake,
  onDismiss,
}: SettlementToastProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [isShowing, setIsShowing] = useState(false);
  const translateY = useSharedValue(SCREEN_HEIGHT);

  const handleDismiss = useCallback(() => {
    translateY.value = withTiming(SCREEN_HEIGHT, { duration: 300 }, () => {
      runOnJS(setIsShowing)(false);
      runOnJS(onDismiss)();
    });
  }, [onDismiss, translateY]);

  const handleAction = useCallback(() => {
    const content = CONTENT[type];
    handleDismiss();
    // Navigate after animation
    setTimeout(() => {
      router.push(content.navigateTo as never);
    }, 350);
  }, [type, handleDismiss, router]);

  // Handle visibility changes
  useEffect(() => {
    if (visible) {
      setIsShowing(true);
      translateY.value = withTiming(0, { duration: 400 });

      // Haptics - error feedback for losses
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
          () => {},
        );
      } catch {
        // Ignore
      }

      // Auto-dismiss after 10 seconds (longer for settlements)
      const timeout = setTimeout(() => {
        handleDismiss();
      }, 10000);

      return () => clearTimeout(timeout);
    } else {
      translateY.value = withTiming(SCREEN_HEIGHT, { duration: 300 });
      return;
    }
  }, [visible, handleDismiss, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!isShowing && !visible) return null;

  const content = CONTENT[type];
  const isPaymentIssue = type === "failed" || type === "requires_action";
  const accentColor = isPaymentIssue ? "#FF9F0A" : "#FF453A";
  const buttonColors: [string, string] = isPaymentIssue
    ? ["#FF9F0A", "#E68A00"]
    : ["#FF453A", "#CC362E"];

  const truncatedText =
    promiseText.length > 50
      ? promiseText.substring(0, 50) + "..."
      : promiseText;

  return (
    <View
      className="absolute inset-0 justify-end z-[9999]"
      pointerEvents="box-none"
    >
      {/* Backdrop */}
      {visible && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          className="absolute inset-0 bg-black/60"
        >
          <Pressable className="absolute inset-0" onPress={handleDismiss} />
        </Animated.View>
      )}

      {/* Toast Card */}
      <Animated.View
        style={[
          animatedStyle,
          {
            paddingBottom: Math.max(insets.bottom, 16),
            borderColor: accentColor + "44",
          },
        ]}
        className="bg-abyss-700 rounded-t-xxl border border-b-0 overflow-hidden shadow-lg"
      >
        {/* Accent bar at top */}
        <View className="h-1 w-full" style={{ backgroundColor: accentColor }} />

        <View className="p-xl gap-lg">
          {/* Header row */}
          <View className="flex-row items-center gap-md">
            <View
              className="w-14 h-14 rounded-full items-center justify-center"
              style={{ backgroundColor: accentColor + "20" }}
            >
              <Text className="text-[28px]">{content.emoji}</Text>
            </View>
            <View className="flex-1 gap-0.5">
              <Text
                className="text-h3 font-rounded"
                style={{ color: accentColor }}
              >
                {content.title}
              </Text>
              <Text className="text-body text-text-secondary">
                {content.subtitle}
              </Text>
            </View>
          </View>

          {/* Promise text */}
          <View className="bg-card rounded-lg border border-border p-md">
            <Text className="text-body text-white italic text-center">
              &ldquo;{truncatedText}&rdquo;
            </Text>
          </View>

          {/* Stake amount */}
          {stake > 0 && (
            <View
              className="flex-row items-center justify-center gap-sm rounded-md py-sm px-md"
              style={{ backgroundColor: accentColor + "15" }}
            >
              <Text className="text-[18px]">
                {type === "charged" ? "🔥" : "💳"}
              </Text>
              <Text
                className="text-body-semibold"
                style={{ color: accentColor }}
              >
                {type === "charged" ? `$${stake} charged` : `$${stake} pending`}
              </Text>
            </View>
          )}

          {/* Action button */}
          <Pressable
            onPress={handleAction}
            className="h-[52px] rounded-[26px] overflow-hidden shadow-md active:opacity-90 active:scale-[0.98]"
          >
            <LinearGradient
              colors={buttonColors}
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
                {content.buttonText}
              </Text>
            </LinearGradient>
          </Pressable>

          {/* Dismiss link */}
          <Pressable onPress={handleDismiss}>
            <Text className="text-body text-text-tertiary text-center">
              Dismiss
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

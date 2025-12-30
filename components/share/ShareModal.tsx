/**
 * ShareModal
 * Share your commitment with friends for accountability.
 *
 * Features:
 * - Share commitment card image
 * - Generate friend link (friends can pledge and/or write "I Told You So" messages)
 * - Generate partner link (for partner verification)
 */

import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Share,
  Text,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ViewShot from "react-native-view-shot";

import { useRequireAuth } from "@/hooks/use-require-auth";
import type { UserPromise } from "@/lib/promises/types";
import { createShareLink, type ShareLinkType } from "@/lib/share";
import { ShareCommitmentCard } from "./ShareCommitmentCard";

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

interface ShareModalProps {
  visible: boolean;
  promise: UserPromise;
  onClose: () => void;
}

type ShareOption = "image" | "friend" | "partner";

interface ShareLinkState {
  loading: boolean;
  url: string | null;
  error: string | null;
  copied: boolean;
}

export function ShareModal({ visible, promise, onClose }: ShareModalProps) {
  const insets = useSafeAreaInsets();
  const viewShotRef = useRef<ViewShot>(null);
  const translateY = useSharedValue(0);
  const [sharing, setSharing] = useState(false);
  const [activeOption, setActiveOption] = useState<ShareOption | null>(null);
  const { requireAuth, isAuthenticated } = useRequireAuth();

  // Track previous partner state to detect changes
  const prevPartnerStateRef = useRef(promise.partnerState);

  // Auto-close when partner verification completes
  useEffect(() => {
    const prev = prevPartnerStateRef.current;
    const curr = promise.partnerState;
    prevPartnerStateRef.current = curr;

    // If partner just approved/rejected, close modal
    if (prev === "awaiting" && (curr === "approved" || curr === "rejected")) {
      onClose();
    }
  }, [promise.partnerState, onClose]);

  // Share link states
  const [friendLink, setFriendLink] = useState<ShareLinkState>({
    loading: false,
    url: null,
    error: null,
    copied: false,
  });
  const [partnerLink, setPartnerLink] = useState<ShareLinkState>({
    loading: false,
    url: null,
    error: null,
    copied: false,
  });

  // Reset states when modal opens/closes
  useEffect(() => {
    if (visible) {
      // Reset translateY when modal opens so it's not stuck at bottom
      translateY.value = 0;
    } else {
      setActiveOption(null);
      setFriendLink({ loading: false, url: null, error: null, copied: false });
      setPartnerLink({ loading: false, url: null, error: null, copied: false });
    }
  }, [visible, translateY]);

  // Check auth when modal opens - if not authed, redirect to sign-in and close modal
  useEffect(() => {
    if (visible && !isAuthenticated) {
      requireAuth();
      onClose();
    }
  }, [visible, isAuthenticated, requireAuth, onClose]);

  const dismiss = useCallback(() => {
    translateY.value = withTiming(600, { duration: 200 });
    setTimeout(onClose, 200);
  }, [onClose, translateY]);

  const sheetAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // Share image
  const handleShareImage = useCallback(async () => {
    if (sharing) return;

    setSharing(true);
    hapticMedium();

    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        setSharing(false);
        return;
      }

      const uri = await viewShotRef.current?.capture?.();
      if (!uri) {
        setSharing(false);
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: "Share your commitment",
      });
    } catch (error) {
      console.error("Failed to share:", error);
    } finally {
      setSharing(false);
    }
  }, [sharing]);

  // Generate and share link
  const generateShareLink = useCallback(
    async (type: ShareLinkType) => {
      const setState = type === "friend" ? setFriendLink : setPartnerLink;

      setState((prev) => ({ ...prev, loading: true, error: null }));
      hapticMedium();

      try {
        const result = await createShareLink(promise.id, type);
        setState({
          loading: false,
          url: result.url,
          error: null,
          copied: false,
        });
        hapticSuccess();
      } catch (error) {
        setState({
          loading: false,
          url: null,
          error:
            error instanceof Error ? error.message : "Failed to create link",
          copied: false,
        });
        hapticError();
      }
    },
    [promise.id],
  );

  // Copy link to clipboard
  const copyLink = useCallback(async (url: string, type: ShareLinkType) => {
    await Clipboard.setStringAsync(url);
    hapticSuccess();

    const setState = type === "friend" ? setFriendLink : setPartnerLink;

    setState((prev) => ({ ...prev, copied: true }));

    // Reset copied state after 2 seconds
    setTimeout(() => {
      setState((prev) => ({ ...prev, copied: false }));
    }, 2000);
  }, []);

  // Share link via system share
  const shareLink = useCallback(async (url: string, type: ShareLinkType) => {
    const messages = {
      friend: `Help hold me accountable! You can add to my stake or write me a message I'll only see if I fail. ${url}`,
      partner: `I need you to verify that I completed my promise. Please confirm! ${url}`,
    };

    try {
      await Share.share({
        message: messages[type],
        url,
      });
    } catch (error) {
      console.error("Failed to share:", error);
    }
  }, []);

  // Render share option button
  const renderShareOption = (
    option: ShareOption,
    emoji: string,
    title: string,
    subtitle: string,
    state?: ShareLinkState,
    linkType?: ShareLinkType,
  ) => {
    const isActive = activeOption === option;
    const hasLink = state?.url;
    const isLoading = state?.loading;

    return (
      <View key={option}>
        <Pressable
          onPress={() => {
            setActiveOption(isActive ? null : option);
            if (option === "image") {
              handleShareImage();
            } else if (linkType && !state?.url) {
              generateShareLink(linkType);
            }
          }}
          disabled={sharing || isLoading}
          className={`flex-row items-center gap-md rounded-lg border p-md ${
            isActive
              ? "border-imessage bg-imessage-dim"
              : "border-border bg-card"
          } active:opacity-90`}
        >
          <Text className="text-[24px]">{emoji}</Text>
          <View className="flex-1 gap-0.5">
            <Text className="text-body-semibold text-white">{title}</Text>
            <Text className="text-caption text-text-tertiary">{subtitle}</Text>
          </View>
          {isLoading && <ActivityIndicator size="small" color="#0B93F6" />}
        </Pressable>

        {/* Link actions */}
        {isActive && hasLink && linkType && (
          <Animated.View
            entering={FadeIn.duration(200)}
            className="flex-row gap-sm pt-sm px-md"
          >
            <Pressable
              className={`flex-1 items-center justify-center py-sm rounded-md border ${
                state.copied
                  ? "bg-success-dim border-success"
                  : "bg-card border-border"
              }`}
              onPress={() => copyLink(state.url!, linkType)}
            >
              <Text className="text-caption text-white">
                {state.copied ? "✓ Copied!" : "📋 Copy link"}
              </Text>
            </Pressable>
            <Pressable
              className="flex-1 items-center justify-center py-sm bg-card rounded-md border border-border"
              onPress={() => shareLink(state.url!, linkType)}
            >
              <Text className="text-caption text-white">📤 Share</Text>
            </Pressable>
          </Animated.View>
        )}

        {/* Error */}
        {isActive && state?.error && (
          <Animated.View
            entering={FadeIn.duration(200)}
            className="flex-row items-center justify-between bg-danger-dim rounded-md p-sm mt-sm mx-md"
          >
            <Text className="text-caption text-danger flex-1">
              {state.error}
            </Text>
            <Pressable
              className="px-md py-xs"
              onPress={() => linkType && generateShareLink(linkType)}
            >
              <Text className="text-caption text-imessage font-semibold">
                Try again
              </Text>
            </Pressable>
          </Animated.View>
        )}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={dismiss}
    >
      <View className="flex-1 bg-black/60 justify-end">
        {/* Tap to dismiss */}
        <Pressable className="flex-1" onPress={dismiss} />

        {/* Sheet */}
        <Animated.View
          style={sheetAnimStyle}
          className="bg-abyss-700 rounded-t-xxl max-h-[90%]"
        >
          {/* Handle */}
          <View className="items-center pt-md pb-sm">
            <View className="w-10 h-1 rounded-sm bg-system-gray-4" />
          </View>

          <View
            className="px-xl gap-lg"
            style={{ paddingBottom: Math.max(insets.bottom, 20) }}
          >
            {/* Header */}
            <View className="items-center gap-1">
              <Text className="text-h3 text-white font-rounded">
                Share commitment
              </Text>
              <Text className="text-caption text-text-tertiary text-center">
                Get friends involved for extra accountability.
              </Text>
            </View>

            {/* Card Preview */}
            <Animated.View
              entering={FadeIn.duration(300)}
              className="items-center scale-75 -my-xxl"
            >
              <ShareCommitmentCard promise={promise} />
            </Animated.View>

            {/* Share Options */}
            <View className="gap-sm">
              {renderShareOption(
                "image",
                "🖼️",
                "Share image",
                "Post this card to social media",
              )}

              {renderShareOption(
                "friend",
                "🔗",
                "Share with friends",
                "They can pledge money or write roast messages",
                friendLink,
                "friend",
              )}

              {/* Only show partner option if user already clicked "I did it" (partnerState is awaiting) */}
              {promise.verificationType === "partner" &&
                promise.partnerState === "awaiting" &&
                renderShareOption(
                  "partner",
                  "👀",
                  "Get verified",
                  "Send to your accountability partner",
                  partnerLink,
                  "partner",
                )}
            </View>

            {/* Main Share Button */}
            <Pressable
              disabled={sharing}
              onPress={handleShareImage}
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
                  {sharing ? "Sharing..." : "Share commitment image"}
                </Text>
              </LinearGradient>
            </Pressable>
          </View>

          {/* Hidden capture card */}
          <View className="absolute -left-[9999px] -top-[9999px]">
            <ViewShot
              ref={viewShotRef}
              options={{ format: "png", quality: 1, result: "tmpfile" }}
            >
              <ShareCommitmentCard promise={promise} />
            </ViewShot>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

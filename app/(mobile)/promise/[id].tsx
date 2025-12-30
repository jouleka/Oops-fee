import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  Layout,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ShareModal } from "@/components/share";
import { LoadingState } from "@/components/ui/loading-state";
import { PhotoCaptureModal } from "@/components/verification";
import { VoicePlayback } from "@/components/voice";
import { FAILURE_COPY, VERIFICATION_COPY } from "@/constants/content";
import { useAuth } from "@/context/auth";
import { usePromiseStore } from "@/context/promise-store";
import {
  formatShortDateTime,
  getTimeRemaining,
  type Urgency,
} from "@/lib/promises/time";
import type { PromiseStatus, UserPromise } from "@/lib/promises/types";
import { supabase } from "@/lib/supabase";

function hapticLight() {
  Haptics.selectionAsync().catch(() => {});
}

function hapticMedium() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

const URGENCY_COLORS: Record<Urgency, string> = {
  low: "#34C759",
  medium: "#FF9F0A",
  high: "#FF453A",
  critical: "#FF453A",
};

function StatusPill({ status }: { status: PromiseStatus }) {
  const { label, colorClass, bgClass } = useMemo(() => {
    switch (status) {
      case "completed":
        return {
          label: "COMPLETED",
          colorClass: "text-success",
          bgClass: "bg-success-dim border-success/[0.33]",
        };
      case "failed":
        return {
          label: "FAILED",
          colorClass: "text-danger",
          bgClass: "bg-danger-dim border-danger/[0.33]",
        };
      case "expired":
        return {
          label: "EXPIRED",
          colorClass: "text-danger",
          bgClass: "bg-danger-dim border-danger/[0.33]",
        };
      default:
        return {
          label: "ACTIVE",
          colorClass: "text-imessage",
          bgClass: "bg-imessage-dim border-imessage/[0.33]",
        };
    }
  }, [status]);

  return (
    <View className={`py-1.5 px-2.5 rounded-full border ${bgClass}`}>
      <Text className={`text-label ${colorClass}`}>{label}</Text>
    </View>
  );
}

function formatDestination(p: UserPromise): string {
  switch (p.moneyDestination) {
    case "charity":
      return "💛 Charity";
    case "anti_charity":
      return "🧨 Anti-charity";
    case "friend":
      return p.friendName?.trim()
        ? `🤝 Friend · ${p.friendName.trim()}`
        : "🤝 Friend";
    default:
      return "☕️ OopsFee (us)";
  }
}

function ConfirmActionModal({
  visible,
  title,
  subtitle,
  confirmText,
  confirmColors,
  onCancel,
  onConfirm,
  working,
}: {
  visible: boolean;
  title: string;
  subtitle: string;
  confirmText: string;
  confirmColors: [string, string];
  onCancel: () => void;
  onConfirm: () => void;
  working: boolean;
}) {
  const closingRef = useRef(false);
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    closingRef.current = false;
    translateY.value = 0;
  }, [translateY, visible]);

  const dismiss = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    Keyboard.dismiss();
    translateY.value = withTiming(700, { duration: 180 });
    setTimeout(() => {
      closingRef.current = false;
      onCancel();
    }, 180);
  }, [onCancel, translateY]);

  const sheetAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, g) =>
          g.dy > 4 && Math.abs(g.dx) < 18,
        onPanResponderMove: (_evt, g) => {
          if (g.dy <= 0) return;
          translateY.value = g.dy;
        },
        onPanResponderRelease: (_evt, g) => {
          const shouldClose = g.dy > 120 || g.vy > 1.2;
          if (shouldClose) {
            dismiss();
            return;
          }
          translateY.value = withSpring(0, { damping: 16, stiffness: 180 });
        },
        onPanResponderTerminate: () => {
          translateY.value = withSpring(0, { damping: 16, stiffness: 180 });
        },
      }),
    [dismiss, translateY],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={dismiss}
    >
      <View className="flex-1 bg-black/65 items-center justify-end p-lg">
        <Pressable className="absolute inset-0" onPress={dismiss} />
        <Animated.View
          style={sheetAnimStyle}
          className="w-full max-h-[88%] bg-abyss-700 rounded-xxl border border-border p-xl gap-lg"
        >
          <View
            className="w-full items-center pt-0.5 pb-md -mt-1.5"
            {...panResponder.panHandlers}
          >
            <View className="w-11 h-[5px] rounded-sm bg-system-gray-4" />
          </View>
          <Text className="text-h3 text-white font-rounded text-center">
            {title}
          </Text>
          <Text className="text-caption text-text-tertiary text-center -mt-2">
            {subtitle}
          </Text>

          <View className="flex-row gap-md">
            <Pressable
              onPress={dismiss}
              className="flex-1 h-[52px] rounded-[26px] bg-card border border-border items-center justify-center active:opacity-90"
            >
              <Text className="text-body-semibold text-text-secondary">
                Cancel
              </Text>
            </Pressable>
            <Pressable
              disabled={working}
              onPress={onConfirm}
              className={`flex-1 h-[52px] rounded-[26px] overflow-hidden active:opacity-90 ${working ? "opacity-70" : ""}`}
            >
              <LinearGradient
                colors={confirmColors}
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 16,
                }}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text className="text-body-semibold text-white font-rounded">
                  {working ? "Processing feelings…" : confirmText}
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

/**
 * FailConfirmModal - The guilt-trip modal
 * If there's a voice recording, makes the user listen before they can confirm failure.
 * Shows "I Told You So" message reveal with dramatic animation.
 * Now includes free pass option when user has passes available.
 */
function FailConfirmModal({
  visible,
  voiceNoteUri,
  iToldYouSoMessages,
  sponsorAmount,
  stake,
  freePasses,
  useFreePass,
  onUseFreePassChange,
  moneyDestination,
  friendName,
  onCancel,
  onConfirm,
  working,
}: {
  visible: boolean;
  voiceNoteUri?: string;
  iToldYouSoMessages?: { message: string; from: string }[];
  sponsorAmount?: number;
  stake: number;
  freePasses: number;
  useFreePass: boolean;
  onUseFreePassChange: (value: boolean) => void;
  moneyDestination?: string;
  friendName?: string;
  onCancel: () => void;
  onConfirm: (useFreePass: boolean) => void;
  working: boolean;
}) {
  const [hasListened, setHasListened] = useState(false);
  const [voiceError, setVoiceError] = useState(false);
  const closingRef = useRef(false);
  const translateY = useSharedValue(0);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setHasListened(false);
      setVoiceError(false);
      closingRef.current = false;
      translateY.value = 0;
    }
  }, [visible, translateY]);

  const dismiss = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    Keyboard.dismiss();
    translateY.value = withTiming(700, { duration: 180 });
    setTimeout(() => {
      closingRef.current = false;
      onCancel();
    }, 180);
  }, [onCancel, translateY]);

  const sheetAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, g) =>
          g.dy > 4 && Math.abs(g.dx) < 18,
        onPanResponderMove: (_evt, g) => {
          if (g.dy <= 0) return;
          translateY.value = g.dy;
        },
        onPanResponderRelease: (_evt, g) => {
          const shouldClose = g.dy > 120 || g.vy > 1.2;
          if (shouldClose) {
            dismiss();
            return;
          }
          translateY.value = withSpring(0, { damping: 16, stiffness: 180 });
        },
        onPanResponderTerminate: () => {
          translateY.value = withSpring(0, { damping: 16, stiffness: 180 });
        },
      }),
    [dismiss, translateY],
  );

  // Allow confirmation if: no voice note, already listened, or voice failed to load
  const canConfirm = !voiceNoteUri || hasListened || voiceError;
  const hasVoice = !!voiceNoteUri && !voiceError;
  const hasIToldYouSo = (iToldYouSoMessages?.length ?? 0) > 0;
  const hasSponsor = (sponsorAmount ?? 0) > 0;
  const hasStake = stake > 0;
  const totalLoss = stake + (sponsorAmount ?? 0);
  const canUseFreePass = freePasses > 0 && hasStake;
  const isFriendDestination = moneyDestination === "friend";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={dismiss}
    >
      <View className="flex-1 bg-black/65 items-center justify-end p-lg">
        <Pressable className="absolute inset-0" onPress={dismiss} />
        <Animated.View
          style={sheetAnimStyle}
          className="w-full max-h-[85%] bg-abyss-700 rounded-xxl border border-border"
        >
          <View
            className="w-full items-center pt-md pb-sm -mt-1"
            {...panResponder.panHandlers}
          >
            <View className="w-11 h-[5px] rounded-sm bg-system-gray-4" />
          </View>

          <ScrollView
            className="flex-grow-0"
            contentContainerStyle={{ padding: 24, paddingBottom: 32, gap: 16 }}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Header with emoji */}
            <View className="items-center gap-sm">
              <Text className="text-[48px] mb-sm">💸</Text>
              <Text className="text-h3 text-white font-rounded text-center">
                Mark as failed?
              </Text>
              <Text className="text-caption text-text-tertiary text-center -mt-2">
                {hasVoice
                  ? "Wait. Before you quit, listen to yourself."
                  : "Pressing this builds character. Allegedly."}
              </Text>
            </View>

            {/* Voice playback if exists */}
            {hasVoice && (
              <View className="gap-md">
                <VoicePlayback
                  uri={voiceNoteUri}
                  autoPlay={true}
                  onPlaybackComplete={() => setHasListened(true)}
                  onError={() => {
                    setVoiceError(true);
                    setHasListened(true);
                  }}
                  message="This is what you said when you still believed."
                />
                {!hasListened && (
                  <Animated.View
                    entering={FadeIn.duration(200)}
                    className="bg-warning-dim border border-warning/[0.27] rounded-lg p-md items-center"
                  >
                    <Text className="text-caption text-warning font-semibold text-center">
                      Listen to your voice commitment before confirming.
                    </Text>
                  </Animated.View>
                )}
              </View>
            )}

            {/* No voice note message */}
            {!hasVoice && !voiceNoteUri && (
              <View className="bg-card rounded-lg border border-border p-lg items-center">
                <Text className="text-caption text-text-tertiary text-center italic">
                  No voice commitment recorded. (Next time, guilt-trip
                  yourself.)
                </Text>
              </View>
            )}

            {/* I Told You So preview - show sealed envelope before confirming */}
            {hasIToldYouSo && (
              <Animated.View
                entering={FadeInDown.delay(100).duration(250)}
                className="flex-row gap-md bg-warning/[0.08] rounded-lg border border-dashed border-warning/20 p-lg"
              >
                <View className="w-10 h-10 rounded-full bg-warning-dim items-center justify-center">
                  <Text className="text-xl">💌</Text>
                </View>
                <View className="flex-1 gap-0.5">
                  <Text className="text-body-semibold text-warning">
                    A message awaits...
                  </Text>
                  <Text className="text-caption text-text-secondary italic">
                    Someone left you a note. It will be revealed after you
                    confirm.
                  </Text>
                </View>
              </Animated.View>
            )}

            {/* Sponsor warning */}
            {hasSponsor && (
              <Animated.View
                entering={FadeIn.delay(150).duration(200)}
                className="flex-row items-center gap-sm bg-card rounded-lg border border-border p-md"
              >
                <Text className="text-base">👀</Text>
                <Text className="text-caption text-text-secondary flex-1">
                  +${sponsorAmount} from sponsors is also on the line.
                </Text>
              </Animated.View>
            )}

            {/* Free Pass Toggle */}
            {canUseFreePass && (
              <Animated.View
                entering={FadeIn.delay(180).duration(200)}
                className="flex-row items-center gap-md bg-imessage-dim border border-imessage/25 p-lg rounded-lg"
              >
                <View className="w-10 h-10 rounded-full bg-imessage/15 items-center justify-center">
                  <Text className="text-xl">🎟️</Text>
                </View>
                <View className="flex-1 gap-0.5">
                  <Text className="text-body-semibold text-imessage">
                    Use free pass ({freePasses} left)
                  </Text>
                  <Text className="text-caption text-text-secondary">
                    {isFriendDestination && friendName
                      ? `Skip the charge. ${friendName} won't receive anything.`
                      : "Skip the charge this time."}
                  </Text>
                </View>
                <Switch
                  value={useFreePass}
                  onValueChange={onUseFreePassChange}
                  trackColor={{
                    false: "#3A3A3C",
                    true: "rgba(11, 147, 246, 0.4)",
                  }}
                  thumbColor={useFreePass ? "#0B93F6" : "#636366"}
                  ios_backgroundColor="#3A3A3C"
                />
              </Animated.View>
            )}

            {/* Friend warning when using free pass */}
            {useFreePass && isFriendDestination && (
              <Animated.View
                entering={FadeIn.duration(180)}
                className="flex-row items-center gap-sm bg-warning/[0.08] border border-warning/20 rounded-lg p-md"
              >
                <Text className="text-base">⚠️</Text>
                <Text className="text-caption text-warning flex-1">
                  {friendName || "Your friend"} will be notified that you used a
                  free pass and won&apos;t receive the ${totalLoss}.
                </Text>
              </Animated.View>
            )}

            {/* Charge warning - the real talk (hidden when using free pass) */}
            {hasStake && !useFreePass && (
              <Animated.View
                entering={FadeIn.delay(200).duration(250)}
                className="bg-danger/[0.08] rounded-lg border border-danger/25 p-lg gap-sm"
              >
                <View className="flex-row items-center gap-sm">
                  <Text className="text-xl">💳</Text>
                  <Text className="text-body-semibold text-danger">
                    Real money. Real consequences.
                  </Text>
                </View>
                <Text className="text-h2 text-white font-mono text-center my-xs">
                  ${totalLoss} will be charged
                </Text>
                <Text className="text-caption text-text-tertiary text-center leading-[18px]">
                  No refunds. No excuses. No &quot;my dog ate my gym
                  shoes.&quot;
                </Text>
              </Animated.View>
            )}

            {/* Free pass confirmation message */}
            {useFreePass && hasStake && (
              <Animated.View
                entering={FadeIn.duration(180)}
                className="bg-success-dim border border-success/25 rounded-lg p-lg gap-sm items-center"
              >
                <Text className="text-h3 text-success font-rounded">
                  🎟️ No charge this time
                </Text>
                <Text className="text-caption text-text-secondary text-center">
                  Your free pass will be consumed. You&apos;ll have{" "}
                  {freePasses - 1} left.
                </Text>
              </Animated.View>
            )}

            {/* Action buttons - stacked vertically for better layout */}
            <View className="gap-md mt-sm">
              <Pressable
                disabled={working || !canConfirm}
                onPress={() => onConfirm(useFreePass)}
                className={`h-14 rounded-[28px] overflow-hidden active:opacity-90 ${working || !canConfirm ? "opacity-70" : ""}`}
              >
                <LinearGradient
                  colors={
                    canConfirm
                      ? useFreePass
                        ? ["#0B93F6", "#0A84FF"]
                        : ["#FF453A", "#FF6B35"]
                      : ["#3A3A3C", "#2C2C2E"]
                  }
                  style={{
                    flex: 1,
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: 24,
                  }}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text className="text-body-semibold text-white font-rounded text-center">
                    {working
                      ? "Processing…"
                      : !canConfirm
                        ? "Listen first"
                        : useFreePass
                          ? "🎟️ Use free pass & admit defeat"
                          : hasStake
                            ? `💳 Pay $${totalLoss} & admit defeat`
                            : "Yes, I failed"}
                  </Text>
                </LinearGradient>
              </Pressable>
              <Pressable
                onPress={dismiss}
                className="h-12 items-center justify-center active:opacity-90"
              >
                <Text className="text-body text-text-secondary">
                  Wait, I changed my mind
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function NotFound() {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-black" style={{ paddingTop: insets.top + 24 }}>
      <View className="flex-1 items-center justify-center px-xl gap-lg">
        <Text className="text-h1 text-white font-rounded">It&apos;s gone.</Text>
        <Text className="text-body text-text-tertiary text-center">
          Like motivation. Like innocence. Like that promise.
        </Text>
        <Pressable
          onPress={() => {
            hapticLight();
            router.replace("/(mobile)/home");
          }}
          className="h-[52px] px-xl rounded-[26px] bg-card border border-border items-center justify-center active:opacity-90"
        >
          <Text className="text-body-semibold text-text-secondary">
            Back to reality
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function PromiseDetailScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = useMemo(() => {
    const raw = params.id;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params.id]);
  const {
    promises,
    setPromiseStatus,
    updatePromise,
    deletePromise,
    isWorking,
    isHydrated,
  } = usePromiseStore();
  const { session, refreshProfile, freePasses } = useAuth();

  const promise: UserPromise | null = useMemo(() => {
    if (!id) return null;
    return promises.find((p) => p.id === id) ?? null;
  }, [id, promises]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const remaining = promise ? getTimeRemaining(promise.deadlineAt, now) : null;
  const urgencyColor = remaining
    ? URGENCY_COLORS[remaining.urgency]
    : "rgba(255, 255, 255, 0.30)";

  const [confirmComplete, setConfirmComplete] = useState(false);
  const [confirmFail, setConfirmFail] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showPhotoCapture, setShowPhotoCapture] = useState(false);
  const [showPartnerSendPrompt, setShowPartnerSendPrompt] = useState(false);

  // Calculate total stake including sponsors
  const totalStake = promise ? promise.stake + (promise.sponsorAmount ?? 0) : 0;
  const hasSponsor = promise && (promise.sponsorAmount ?? 0) > 0;
  const needsPhotoProof = promise?.verificationType === "photo";
  const needsPartnerVerification = promise?.verificationType === "partner";
  const isAwaitingPartner = promise?.partnerState === "awaiting";

  // Fetch roast messages directly for failed promises
  const [roastMessages, setRoastMessages] = useState<
    { message: string; from: string }[]
  >([]);
  const [loadingRoasts, setLoadingRoasts] = useState(false);

  useEffect(() => {
    if (!promise || promise.status !== "failed") return;

    const promiseId = promise.id;
    const existingMessages = promise.iToldYouSoMessages ?? [];
    const hasPlaceholder = existingMessages.some(
      (m) => m.message === "(from server)",
    );

    // If we already have valid messages (not placeholders), use them
    if (existingMessages.length > 0 && !hasPlaceholder) {
      setRoastMessages(existingMessages);
      return;
    }

    // Fetch fresh messages from database
    async function fetchMessages() {
      setLoadingRoasts(true);
      try {
        const { data, error } = await supabase
          .from("roast_messages")
          .select("message, from_name")
          .eq("promise_id", promiseId)
          .order("created_at", { ascending: false });

        if (!error && data && data.length > 0) {
          setRoastMessages(
            data.map((r) => ({ message: r.message, from: r.from_name })),
          );
        } else {
          // Fallback to existing messages if fetch fails
          const filtered = existingMessages.filter(
            (m) => m.message !== "(from server)",
          );
          setRoastMessages(filtered);
        }
      } catch {
        // Ignore fetch errors
      } finally {
        setLoadingRoasts(false);
      }
    }

    fetchMessages();
  }, [promise]);

  const hasIToldYouSo = roastMessages.length > 0;

  const handleBack = useCallback(() => {
    hapticLight();
    router.back();
  }, []);

  const canChangeStatus =
    promise?.status !== "completed" && promise?.status !== "failed";

  // Handler for initiating completion - checks if verification is needed
  const handleInitiateComplete = useCallback(() => {
    if (!promise) return;
    hapticLight();

    if (needsPhotoProof) {
      // Photo verification required - show photo capture modal
      setShowPhotoCapture(true);
    } else if (needsPartnerVerification) {
      // Partner verification required
      if (isAwaitingPartner) {
        // Already awaiting - just show share modal
        setShowShareModal(true);
      } else {
        // Show prompt to send to partner
        setShowPartnerSendPrompt(true);
      }
    } else {
      // No special verification needed - show regular confirmation
      setConfirmComplete(true);
    }
  }, [promise, needsPhotoProof, needsPartnerVerification, isAwaitingPartner]);

  // Handler for completing with photo proof
  const handlePhotoCapture = useCallback(
    async (photoUri: string) => {
      if (!promise) return;
      hapticMedium();

      // Store photo proof and mark as completed
      await updatePromise(promise.id, {
        status: "completed",
        completedAt: Date.now(),
        verificationProof: photoUri,
        verificationTimestamp: Date.now(),
      });

      setShowPhotoCapture(false);
      // Navigate to success celebration screen
      router.replace({
        pathname: "/(mobile)/promise/success",
        params: { promiseId: promise.id },
      });
    },
    [promise, updatePromise],
  );

  // Handler for completing without photo (honor system)
  const handleComplete = useCallback(async () => {
    if (!promise) return;
    hapticMedium();
    await setPromiseStatus(promise.id, "completed");
    setConfirmComplete(false);
    // Navigate to success celebration screen
    router.replace({
      pathname: "/(mobile)/promise/success",
      params: { promiseId: promise.id },
    });
  }, [promise, setPromiseStatus]);

  // Handler for initiating partner verification - sets awaiting state and opens share modal
  const handlePartnerVerificationStart = useCallback(async () => {
    if (!promise) return;
    hapticMedium();

    // Set partner state to awaiting with 24h deadline
    const partnerDeadlineAt = Date.now() + 24 * 60 * 60 * 1000;
    await updatePromise(promise.id, {
      partnerState: "awaiting",
      partnerDeadlineAt,
    });

    setShowPartnerSendPrompt(false);
    // Open share modal so they can send the partner link
    setShowShareModal(true);
  }, [promise, updatePromise]);

  // Track if we're processing a failure to prevent double charges
  const [isProcessingFail, setIsProcessingFail] = useState(false);
  
  // Free pass state for fail modal
  const [useFreePass, setUseFreePass] = useState(false);

  const handleFail = useCallback(async (useFreePassOverride?: boolean) => {
    if (!promise) return;

    // CRITICAL: Prevent double-click charges
    if (isProcessingFail) {
      console.log("[handleFail] Already processing, ignoring duplicate click");
      return;
    }
    setIsProcessingFail(true);

    hapticMedium();
    
    const shouldUseFreePass = useFreePassOverride ?? useFreePass;

    // If there's a stake and user is authenticated, charge immediately (unless using free pass)
    if (promise.stake > 0 && session?.access_token) {
      try {
        const { data, error } = await supabase.functions.invoke(
          "charge-promise",
          {
            body: { promiseId: promise.id, useFreePass: shouldUseFreePass },
          },
        );

        if (error) {
          console.error("[handleFail] Edge function error:", error);
          // No alert - the fail banner will show appropriate status
        } else if (data) {
          console.log("[handleFail] Charge result:", data);
          // Refresh profile to update wallet balance and free passes
          refreshProfile().catch(() => {});
          // No alerts - the updated fail banner shows accurate payment status
          // User will see "💸 $X charged" or "🔐 Bank confirmation needed" or "🎟️ Free pass used" etc.
        }
      } catch (err) {
        console.error("[handleFail] Error calling charge-promise:", err);
        // Still mark as failed locally even if charge call fails
      }
    }

    // Update local state
    await setPromiseStatus(promise.id, "failed");
    setConfirmFail(false);
    setUseFreePass(false); // Reset free pass state
    setIsProcessingFail(false);
  }, [promise, setPromiseStatus, session, isProcessingFail, refreshProfile, useFreePass]);

  const handleDelete = useCallback(async () => {
    if (!promise) return;
    hapticMedium();
    await deletePromise(promise.id);
    setConfirmDelete(false);
    router.replace("/(mobile)/home");
  }, [deletePromise, promise]);

  if (!isHydrated) {
    return (
      <LoadingState
        title="Loading promise…"
        subtitle="Locating the thing you swore you'd do."
      />
    );
  }

  if (!promise) return <NotFound />;

  const isExpiredView =
    promise.status === "expired" ||
    (promise.status === "active" && promise.deadlineAt <= now);
  const showCountdown =
    promise.status === "active" || promise.status === "expired";

  return (
    <View className="flex-1 bg-black">
      <View
        className="px-xl pb-lg flex-row items-center gap-md border-b border-border-subtle"
        style={{ paddingTop: insets.top + 16 }}
      >
        <Pressable
          onPress={handleBack}
          className="w-9 h-9 rounded-full bg-card border border-border items-center justify-center active:opacity-90"
        >
          <Text className="text-[28px] leading-7 text-text-secondary -mt-0.5">
            ‹
          </Text>
        </Pressable>

        <View className="flex-1 gap-0.5">
          <Text className="text-h2 text-white font-rounded">Promise</Text>
          <Text className="text-caption text-text-tertiary">Your move.</Text>
        </View>

        <View className="flex-row gap-sm">
          {canChangeStatus && (
            <Pressable
              onPress={() => {
                hapticLight();
                setShowShareModal(true);
              }}
              className="w-9 h-9 rounded-full bg-card border border-border items-center justify-center active:opacity-90"
            >
              <Text className="text-text-secondary text-lg font-bold -mt-0.5">
                ↗
              </Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => {
              hapticLight();
              setConfirmDelete(true);
            }}
            className="w-9 h-9 rounded-full bg-card border border-border items-center justify-center active:opacity-90"
          >
            <Text className="text-text-secondary text-lg font-bold -mt-0.5">
              ⋯
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 24,
          gap: 24,
          paddingBottom: insets.bottom + 28,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(220)} className="gap-lg">
          <View className="flex-row items-center justify-between">
            <StatusPill status={promise.status} />
            <View className="flex-row items-center gap-sm">
              {hasSponsor && (
                <View className="py-1 px-2.5 rounded-full border bg-warning-dim border-warning/[0.27]">
                  <Text className="text-caption text-warning font-semibold">
                    +${promise.sponsorAmount} sponsored
                  </Text>
                </View>
              )}
              <View className="py-1.5 px-3 rounded-full border bg-danger-dim border-danger/[0.33]">
                <Text className="text-body-semibold text-danger font-mono">
                  ${promise.stake}
                </Text>
              </View>
            </View>
          </View>

          <Text className="text-h2 text-white font-rounded leading-7">
            {promise.text}
          </Text>

          <View className="bg-card rounded-xl border border-border p-lg gap-md">
            <View className="flex-row items-center justify-between gap-md">
              <Text className="text-label text-text-muted">DEADLINE</Text>
              <Text className="text-body-semibold text-text-secondary font-rounded">
                {formatShortDateTime(promise.deadlineAt)}
              </Text>
            </View>
            <View className="h-px bg-border-subtle" />
            <View className="flex-row items-center justify-between gap-md">
              <Text className="text-label text-text-muted">
                {showCountdown ? "TIME LEFT" : "WHEN"}
              </Text>
              <Text
                className="text-body-semibold font-rounded"
                style={
                  showCountdown
                    ? { color: urgencyColor }
                    : { color: "rgba(255,255,255,0.7)" }
                }
              >
                {showCountdown
                  ? remaining?.label
                  : formatShortDateTime(promise.updatedAt)}
              </Text>
            </View>
            <View className="h-px bg-border-subtle" />
            <View className="flex-row items-center justify-between gap-md">
              <Text className="text-label text-text-muted">GOES TO</Text>
              <Text className="text-body-semibold text-text-secondary font-rounded">
                {formatDestination(promise)}
              </Text>
            </View>
            {promise.voiceNoteUri && (
              <>
                <View className="h-px bg-border-subtle" />
                <View className="flex-row items-center justify-between gap-md">
                  <Text className="text-label text-text-muted">VOICE</Text>
                  <Text className="text-body-semibold text-text-secondary font-rounded">
                    🎙️ Recorded
                  </Text>
                </View>
              </>
            )}
            <View className="h-px bg-border-subtle" />
            <View className="flex-row items-center justify-between gap-md">
              <Text className="text-label text-text-muted">VERIFICATION</Text>
              <Text
                className={`text-body-semibold font-rounded ${
                  promise.partnerState === "approved"
                    ? "text-success"
                    : promise.partnerState === "rejected"
                      ? "text-danger"
                      : promise.partnerState === "awaiting"
                        ? "text-imessage"
                        : "text-text-secondary"
                }`}
              >
                {promise.verificationType === "photo" && "📷 Photo proof"}
                {promise.verificationType === "partner" &&
                  (promise.partnerState === "approved"
                    ? "✅ Partner approved"
                    : promise.partnerState === "rejected"
                      ? "❌ Partner rejected"
                      : promise.partnerState === "awaiting"
                        ? "👀 Awaiting partner"
                        : promise.partnerState === "expired"
                          ? "⏳ Partner timed out"
                          : "👥 Friend confirms")}
                {promise.verificationType === "honor" && "🤞 Honor system"}
                {promise.verificationType === "healthkit" && "⌚ Health data"}
                {promise.verificationType === "location" && "📍 Location check"}
              </Text>
            </View>
            {promise.verificationProof && promise.status === "completed" && (
              <>
                <View className="h-px bg-border-subtle" />
                <View className="flex-row items-center justify-between gap-md">
                  <Text className="text-label text-text-muted">PROOF</Text>
                  <Text className="text-body-semibold text-success font-rounded">
                    ✓ {VERIFICATION_COPY.verifiedBadge}
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* Awaiting partner verification banner */}
          {isAwaitingPartner && promise.status === "active" && (
            <Animated.View
              entering={FadeIn.duration(180)}
              layout={Layout.springify()}
              className="flex-row gap-md bg-imessage-dim border border-imessage/[0.27] p-lg rounded-lg"
            >
              <Text className="text-[24px]">👀</Text>
              <View className="flex-1 gap-sm">
                <Text className="text-body-semibold text-imessage">
                  Waiting for partner
                </Text>
                <Text className="text-caption text-text-secondary leading-[18px]">
                  Your accountability partner needs to confirm you completed
                  this.
                  {promise.partnerDeadlineAt &&
                    ` They have until ${formatShortDateTime(promise.partnerDeadlineAt)}.`}
                </Text>
                <Pressable
                  onPress={() => {
                    hapticLight();
                    setShowShareModal(true);
                  }}
                  className="self-start py-sm px-md bg-imessage/[0.13] rounded-md mt-xs active:opacity-90"
                >
                  <Text className="text-caption text-imessage font-semibold">
                    Send reminder ↗
                  </Text>
                </Pressable>
              </View>
            </Animated.View>
          )}

          {isExpiredView && !isAwaitingPartner && (
            <Animated.View
              entering={FadeIn.duration(180)}
              layout={Layout.springify()}
              className="flex-row gap-sm bg-danger/[0.08] border border-danger/[0.18] p-md rounded-lg"
            >
              <Text className="text-sm mt-0.5">⏰</Text>
              <Text className="text-caption text-danger flex-1">
                Deadline passed. This is the part where you either own it or
                rewrite history.
              </Text>
            </Animated.View>
          )}

          {promise.status === "completed" && (
            <Animated.View
              entering={FadeIn.duration(180)}
              exiting={FadeOut.duration(120)}
              className="flex-row gap-sm bg-success-dim border border-success/[0.33] p-md rounded-lg"
            >
              <Text className="text-sm mt-0.5">✅</Text>
              <Text className="text-caption text-success flex-1">
                You did it. Your wallet lives to see another day.
              </Text>
            </Animated.View>
          )}

          {promise.status === "failed" && (
            <Animated.View
              entering={FadeIn.duration(180)}
              exiting={FadeOut.duration(120)}
              className="flex-row gap-sm bg-danger-dim border border-danger/[0.33] p-md rounded-lg"
            >
              <Text className="text-sm mt-0.5">
                {promise.paymentStatus === "succeeded"
                  ? "💸"
                  : promise.paymentStatus === "requires_action"
                    ? "🔐"
                    : promise.paymentStatus === "failed"
                      ? "⚠️"
                      : promise.stake > 0
                        ? "💸"
                        : "😔"}
              </Text>
              <Text className="text-caption text-danger flex-1">
                {promise.paymentStatus === "succeeded"
                  ? `You failed. $${totalStake} charged. The universe collected.`
                  : promise.paymentStatus === "requires_action"
                    ? "You failed. Your bank needs you to confirm the payment."
                    : promise.paymentStatus === "failed"
                      ? `You failed. Payment of $${totalStake} didn't go through. We'll retry.`
                      : promise.paymentStatus === "abandoned"
                        ? "You failed. Payment couldn't be collected after multiple attempts."
                        : totalStake > 0
                          ? `You failed. $${totalStake} will be charged.`
                          : "You failed. No stake, no pain. Just disappointment."}
              </Text>
            </Animated.View>
          )}

          {/* I Told You So reveal - only shown after failure */}
          {promise.status === "failed" && hasIToldYouSo && (
            <Animated.View
              entering={FadeInDown.delay(200).duration(300)}
              className="bg-warning/[0.08] rounded-xl border border-warning/20 p-lg gap-md"
            >
              <View className="flex-row items-center gap-sm">
                <Text className="text-xl">💌</Text>
                <Text className="text-label text-warning flex-1">
                  {roastMessages.length > 1
                    ? `${roastMessages.length} messages were left for you...`
                    : FAILURE_COPY.iToldYouSoRevealTitle}
                </Text>
              </View>
              <View className="gap-sm">
                {loadingRoasts ? (
                  <Text className="text-h3 text-white italic leading-6">
                    Loading messages...
                  </Text>
                ) : (
                  roastMessages.map((msg, index) => (
                    <View
                      key={index}
                      className="py-sm border-b border-border gap-xs"
                    >
                      <Text className="text-h3 text-white italic leading-6">
                        &quot;{msg.message}&quot;
                      </Text>
                      {msg.from && (
                        <Text className="text-caption text-text-secondary text-right">
                          — {msg.from}
                        </Text>
                      )}
                    </View>
                  ))
                )}
              </View>
            </Animated.View>
          )}

          {/* Sponsor loss notification */}
          {promise.status === "failed" && hasSponsor && (
            <Animated.View
              entering={FadeIn.delay(350).duration(250)}
              className="flex-row gap-md bg-card rounded-lg border border-border p-md"
            >
              <Text className="text-xl">👀</Text>
              <View className="flex-1 gap-0.5">
                <Text className="text-body-semibold text-white">
                  {FAILURE_COPY.sponsorLossTitle.replace(
                    "{amount}",
                    `$${promise.sponsorAmount}`,
                  )}
                </Text>
                <Text className="text-caption text-text-tertiary italic">
                  {FAILURE_COPY.sponsorLossSubtitle}
                </Text>
              </View>
            </Animated.View>
          )}
        </Animated.View>

        {canChangeStatus && (
          <Animated.View
            entering={FadeInDown.delay(100).duration(220)}
            className="gap-md pt-md"
          >
            {/* For awaiting partner state, show different action */}
            {isAwaitingPartner ? (
              <Pressable
                onPress={() => {
                  hapticLight();
                  setShowShareModal(true);
                }}
                style={{ height: 56, borderRadius: 28, overflow: "hidden" }}
              >
                <LinearGradient
                  colors={["#0B93F6", "#0A84FF"]}
                  style={{
                    flex: 1,
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: 24,
                  }}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: "#FFFFFF",
                    }}
                  >
                    Send to partner 👀
                  </Text>
                </LinearGradient>
              </Pressable>
            ) : (
              <Pressable
                onPress={handleInitiateComplete}
                style={{ height: 56, borderRadius: 28, overflow: "hidden" }}
              >
                <LinearGradient
                  colors={["#34C759", "#2EC44F"]}
                  style={{
                    flex: 1,
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: 24,
                  }}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: "#FFFFFF",
                    }}
                  >
                    {needsPhotoProof
                      ? "I did it 📷"
                      : needsPartnerVerification
                        ? "I did it 👥"
                        : "I did it ✓"}
                  </Text>
                </LinearGradient>
              </Pressable>
            )}

            <Pressable
              onPress={() => {
                hapticLight();
                setConfirmFail(true);
              }}
              style={{ height: 56, borderRadius: 28, overflow: "hidden" }}
            >
              <LinearGradient
                colors={["#FF453A", "#FF6B35"]}
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 24,
                }}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text
                  style={{ fontSize: 16, fontWeight: "600", color: "#FFFFFF" }}
                >
                  I failed 💸
                </Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        )}

        <View className="pt-xl">
          <Text className="text-caption text-text-muted text-center italic">
            {promise.status === "active"
              ? "Reminder: lying to the app is easier than lying to yourself. But not by much."
              : "No further actions required. (Unless you enjoy consequences.)"}
          </Text>
        </View>
      </ScrollView>

      <ConfirmActionModal
        visible={confirmComplete}
        title="Mark as completed?"
        subtitle="This is the part where the app trusts you. Weird."
        confirmText="Yes, I did it"
        confirmColors={["#34C759", "#2EC44F"]}
        onCancel={() => setConfirmComplete(false)}
        onConfirm={handleComplete}
        working={isWorking}
      />

      <FailConfirmModal
        visible={confirmFail}
        voiceNoteUri={promise.voiceNoteUri}
        iToldYouSoMessages={promise.iToldYouSoMessages}
        sponsorAmount={promise.sponsorAmount}
        stake={promise.stake}
        freePasses={freePasses}
        useFreePass={useFreePass}
        onUseFreePassChange={setUseFreePass}
        moneyDestination={promise.moneyDestination}
        friendName={promise.friendName}
        onCancel={() => {
          setConfirmFail(false);
          setUseFreePass(false); // Reset when canceling
        }}
        onConfirm={handleFail}
        working={isWorking || isProcessingFail}
      />

      <ConfirmActionModal
        visible={confirmDelete}
        title="Delete this promise?"
        subtitle="Sure. Delete the evidence. Very healthy."
        confirmText="Delete"
        confirmColors={["#636366", "#3A3A3C"]}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        working={isWorking}
      />

      {/* Share Modal */}
      {promise && (
        <ShareModal
          visible={showShareModal}
          promise={promise}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {/* Photo Capture Modal for verification */}
      {promise && (
        <PhotoCaptureModal
          visible={showPhotoCapture}
          promiseText={promise.text}
          onCapture={handlePhotoCapture}
          onCancel={() => setShowPhotoCapture(false)}
        />
      )}

      {/* Partner Verification Prompt Modal */}
      <ConfirmActionModal
        visible={showPartnerSendPrompt}
        title="Get verified by your partner"
        subtitle="You're claiming you did it. Now your accountability partner needs to confirm. They'll have 24 hours to respond."
        confirmText="Send to partner 👀"
        confirmColors={["#0B93F6", "#0A84FF"]}
        onCancel={() => setShowPartnerSendPrompt(false)}
        onConfirm={handlePartnerVerificationStart}
        working={isWorking}
      />
    </View>
  );
}

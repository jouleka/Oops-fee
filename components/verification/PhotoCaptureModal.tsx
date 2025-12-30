import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  Keyboard,
  Modal,
  PanResponder,
  Pressable,
  Text,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { VERIFICATION_COPY } from "@/constants/content";

function hapticLight() {
  Haptics.selectionAsync().catch(() => {});
}

function hapticMedium() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

function hapticError() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
    () => {},
  );
}

interface PhotoCaptureModalProps {
  visible: boolean;
  promiseText: string;
  onCapture: (photoUri: string) => void;
  onCancel: () => void;
}

export function PhotoCaptureModal({
  visible,
  promiseText,
  onCapture,
  onCancel,
}: PhotoCaptureModalProps) {
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const closingRef = useRef(false);
  const translateY = useSharedValue(0);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setPhotoUri(null);
      setError(null);
      setLoading(false);
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

  const launchCamera = useCallback(async () => {
    setLoading(true);
    setError(null);
    hapticLight();

    try {
      // Request camera permission
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        setError(VERIFICATION_COPY.photoCaptureFailed);
        hapticError();
        setLoading(false);
        return;
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.8,
        exif: true, // Include timestamp metadata
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setPhotoUri(asset.uri);
        hapticMedium();
      }
    } catch (e) {
      console.error("Camera error:", e);
      setError(VERIFICATION_COPY.photoCaptureFailed);
      hapticError();
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRetake = useCallback(() => {
    hapticLight();
    setPhotoUri(null);
    setError(null);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!photoUri) return;
    hapticMedium();
    onCapture(photoUri);
  }, [photoUri, onCapture]);

  // Format current time
  const timestamp = useMemo(() => {
    const now = new Date();
    return now.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }, []);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={dismiss}
    >
      <View className="flex-1 bg-black/75 items-center justify-end p-lg">
        <Pressable className="absolute inset-0" onPress={dismiss} />

        <Animated.View
          style={sheetAnimStyle}
          className="w-full max-h-[90%] bg-abyss-700 rounded-xxl border border-border p-xl gap-lg"
        >
          {/* Drag handle */}
          <View
            className="w-full items-center pt-0.5 pb-sm -mt-1.5"
            {...panResponder.panHandlers}
          >
            <View className="w-11 h-[5px] rounded-sm bg-system-gray-4" />
          </View>

          {/* Header */}
          <View className="items-center gap-xs">
            <Text className="text-[40px] mb-xs">📷</Text>
            <Text className="text-h2 text-white font-rounded text-center">
              {VERIFICATION_COPY.photoCaptureTitle}
            </Text>
            <Text className="text-body text-text-tertiary text-center">
              {VERIFICATION_COPY.photoCaptureSubtitle}
            </Text>
          </View>

          {/* Promise reminder */}
          <View className="bg-card rounded-lg border border-border p-lg gap-xs">
            <Text className="text-label text-text-muted">PROVING</Text>
            <Text
              className="text-body-semibold text-white font-rounded italic"
              numberOfLines={2}
            >
              &quot;{promiseText}&quot;
            </Text>
          </View>

          {/* Photo area */}
          <View className="h-[200px] rounded-xl overflow-hidden">
            {photoUri ? (
              <Animated.View
                entering={FadeIn.duration(200)}
                className="flex-1 rounded-xl overflow-hidden relative"
              >
                <Image
                  source={{ uri: photoUri }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
                <View className="absolute inset-0 p-md justify-end">
                  <View className="self-start bg-black/65 px-md py-xs rounded-md">
                    <Text className="text-caption text-white font-mono">
                      📍 {timestamp}
                    </Text>
                  </View>
                </View>
              </Animated.View>
            ) : (
              <Animated.View
                entering={FadeInDown.duration(200)}
                className="flex-1 bg-card rounded-xl border-2 border-dashed border-border items-center justify-center gap-md p-lg"
              >
                <Text className="text-[48px] opacity-60">📸</Text>
                <Text className="text-caption text-text-tertiary text-center italic">
                  {VERIFICATION_COPY.photoCaptureHint}
                </Text>

                {error && (
                  <Animated.View
                    entering={FadeIn.duration(150)}
                    className="bg-danger-dim border border-danger/[0.27] rounded-md p-md mt-sm"
                  >
                    <Text className="text-caption text-danger text-center">
                      {error}
                    </Text>
                  </Animated.View>
                )}
              </Animated.View>
            )}
          </View>

          {/* Actions */}
          <View className="flex-row gap-md">
            {photoUri ? (
              <>
                <Pressable
                  onPress={handleRetake}
                  className="flex-1 h-[52px] rounded-[26px] bg-card border border-border items-center justify-center active:opacity-90 active:scale-[0.98]"
                >
                  <Text className="text-body-semibold text-text-secondary">
                    {VERIFICATION_COPY.photoRetakeButton}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleConfirm}
                  className="flex-1 h-[52px] rounded-[26px] overflow-hidden shadow-md active:opacity-90 active:scale-[0.98]"
                >
                  <LinearGradient
                    colors={["#34C759", "#2EC44F"]}
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
                      {VERIFICATION_COPY.photoConfirmButton}
                    </Text>
                  </LinearGradient>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable
                  onPress={dismiss}
                  className="flex-1 h-[52px] rounded-[26px] bg-card border border-border items-center justify-center active:opacity-90 active:scale-[0.98]"
                >
                  <Text className="text-body-semibold text-text-secondary">
                    Cancel
                  </Text>
                </Pressable>

                <Pressable
                  disabled={loading}
                  onPress={launchCamera}
                  className={`flex-1 h-[52px] rounded-[26px] overflow-hidden shadow-md active:opacity-90 active:scale-[0.98] ${
                    loading ? "opacity-60" : ""
                  }`}
                >
                  <LinearGradient
                    colors={["#0B93F6", "#0A7FD4"]}
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
                      {loading
                        ? "Opening camera…"
                        : VERIFICATION_COPY.photoCaptureButton}
                    </Text>
                  </LinearGradient>
                </Pressable>
              </>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Keyboard, Modal, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { VERIFICATION_COPY } from '@/constants/content';
import { Colors, Fonts, Radius, Shadows, Spacing, Typography } from '@/constants/theme';

function hapticLight() {
  Haptics.selectionAsync().catch(() => {});
}

function hapticMedium() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

function hapticError() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}

interface PhotoCaptureModalProps {
  visible: boolean;
  promiseText: string;
  onCapture: (photoUri: string) => void;
  onCancel: () => void;
}

export function PhotoCaptureModal({ visible, promiseText, onCapture, onCancel }: PhotoCaptureModalProps) {
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
        onMoveShouldSetPanResponder: (_evt, g) => g.dy > 4 && Math.abs(g.dx) < 18,
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
    [dismiss, translateY]
  );

  const launchCamera = useCallback(async () => {
    setLoading(true);
    setError(null);
    hapticLight();

    try {
      // Request camera permission
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        setError(VERIFICATION_COPY.photoCaptureFailed);
        hapticError();
        setLoading(false);
        return;
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
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
      console.error('Camera error:', e);
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
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }, []);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={dismiss} />

        <Animated.View style={[styles.sheet, sheetAnimStyle]}>
          {/* Drag handle */}
          <View style={styles.handleHit} {...panResponder.panHandlers}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerEmoji}>📷</Text>
            <Text style={styles.title}>{VERIFICATION_COPY.photoCaptureTitle}</Text>
            <Text style={styles.subtitle}>{VERIFICATION_COPY.photoCaptureSubtitle}</Text>
          </View>

          {/* Promise reminder */}
          <View style={styles.promiseCard}>
            <Text style={styles.promiseLabel}>PROVING</Text>
            <Text style={styles.promiseText} numberOfLines={2}>
              "{promiseText}"
            </Text>
          </View>

          {/* Photo area */}
          <View style={styles.photoArea}>
            {photoUri ? (
              <Animated.View entering={FadeIn.duration(200)} style={styles.photoPreview}>
                <Image source={{ uri: photoUri }} style={styles.previewImage} resizeMode="cover" />
                <View style={styles.photoOverlay}>
                  <View style={styles.timestampBadge}>
                    <Text style={styles.timestampText}>📍 {timestamp}</Text>
                  </View>
                </View>
              </Animated.View>
            ) : (
              <Animated.View entering={FadeInDown.duration(200)} style={styles.cameraPlaceholder}>
                <Text style={styles.cameraIcon}>📸</Text>
                <Text style={styles.cameraHint}>{VERIFICATION_COPY.photoCaptureHint}</Text>

                {error && (
                  <Animated.View entering={FadeIn.duration(150)} style={styles.errorBanner}>
                    <Text style={styles.errorText}>{error}</Text>
                  </Animated.View>
                )}
              </Animated.View>
            )}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            {photoUri ? (
              <>
                <Pressable
                  onPress={handleRetake}
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                >
                  <Text style={styles.secondaryButtonText}>{VERIFICATION_COPY.photoRetakeButton}</Text>
                </Pressable>

                <Pressable
                  onPress={handleConfirm}
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
                >
                  <LinearGradient
                    colors={[Colors.success, '#2EC44F']}
                    style={styles.primaryButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={styles.primaryButtonText}>{VERIFICATION_COPY.photoConfirmButton}</Text>
                  </LinearGradient>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable
                  onPress={dismiss}
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                >
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </Pressable>

                <Pressable
                  disabled={loading}
                  onPress={launchCamera}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.pressed,
                    loading && styles.buttonDisabled,
                  ]}
                >
                  <LinearGradient
                    colors={[Colors.accent, '#0A7FD4']}
                    style={styles.primaryButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={styles.primaryButtonText}>
                      {loading ? 'Opening camera…' : VERIFICATION_COPY.photoCaptureButton}
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

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: Spacing.lg,
  },
  sheet: {
    width: '100%',
    maxHeight: '90%',
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.xxl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    gap: Spacing.lg,
  },

  // Handle
  handleHit: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 2,
    paddingBottom: Spacing.sm,
    marginTop: -6,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.systemGray4,
  },

  // Header
  header: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  headerEmoji: {
    fontSize: 40,
    marginBottom: Spacing.xs,
  },
  title: {
    ...Typography.h2,
    color: Colors.text,
    fontFamily: Fonts.rounded,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textTertiary,
    textAlign: 'center',
  },

  // Promise card
  promiseCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  promiseLabel: {
    ...Typography.label,
    color: Colors.textMuted,
  },
  promiseText: {
    ...Typography.bodySemibold,
    color: Colors.text,
    fontFamily: Fonts.rounded,
    fontStyle: 'italic',
  },

  // Photo area
  photoArea: {
    height: 200,
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },

  // Camera placeholder
  cameraPlaceholder: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  cameraIcon: {
    fontSize: 48,
    opacity: 0.6,
  },
  cameraHint: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Photo preview
  photoPreview: {
    flex: 1,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
    padding: Spacing.md,
    justifyContent: 'flex-end',
  },
  timestampBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.md,
  },
  timestampText: {
    ...Typography.caption,
    color: Colors.text,
    fontFamily: Fonts.mono,
  },

  // Error
  errorBanner: {
    backgroundColor: Colors.dangerDim,
    borderWidth: 1,
    borderColor: Colors.danger + '44',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  errorText: {
    ...Typography.caption,
    color: Colors.danger,
    textAlign: 'center',
  },

  // Actions
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  secondaryButton: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    ...Typography.bodySemibold,
    color: Colors.textSecondary,
  },
  primaryButton: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
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
  buttonDisabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});


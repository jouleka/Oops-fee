/**
 * ShareModal
 * Share your commitment with friends for accountability.
 * 
 * Note: Sponsor pledges and friend messages require backend sync.
 * For now, this just shares the commitment card image.
 */

import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ViewShot from 'react-native-view-shot';

import { Colors, Fonts, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useRequireAuth } from '@/hooks/use-require-auth';
import type { UserPromise } from '@/lib/promises/types';
import { ShareCommitmentCard } from './ShareCommitmentCard';

function hapticMedium() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

interface ShareModalProps {
  visible: boolean;
  promise: UserPromise;
  onClose: () => void;
}

export function ShareModal({ visible, promise, onClose }: ShareModalProps) {
  const insets = useSafeAreaInsets();
  const viewShotRef = useRef<ViewShot>(null);
  const translateY = useSharedValue(0);
  const [sharing, setSharing] = useState(false);
  const { requireAuth, isAuthenticated } = useRequireAuth();

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

  const handleShare = useCallback(async () => {
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
        mimeType: 'image/png',
        dialogTitle: 'Share your commitment',
      });
    } catch (error) {
      console.error('Failed to share:', error);
    } finally {
      setSharing(false);
    }
  }, [sharing]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={dismiss}>
      <View style={styles.container}>
        {/* Tap to dismiss */}
        <Pressable style={styles.backdrop} onPress={dismiss} />

        {/* Sheet */}
        <Animated.View style={[styles.sheet, sheetAnimStyle]}>
          {/* Handle */}
          <View style={styles.handleRow}>
            <View style={styles.handle} />
          </View>

          <View style={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Share commitment</Text>
              <Text style={styles.subtitle}>Post this to hold yourself accountable.</Text>
            </View>

            {/* Card Preview */}
            <Animated.View entering={FadeIn.duration(300)} style={styles.cardWrapper}>
              <ShareCommitmentCard promise={promise} />
            </Animated.View>

            {/* Coming Soon Note */}
            <View style={styles.comingSoonCard}>
              <Text style={styles.comingSoonEmoji}>🔮</Text>
              <View style={styles.comingSoonContent}>
                <Text style={styles.comingSoonTitle}>Coming soon</Text>
                <Text style={styles.comingSoonText}>
                  Friends will be able to add to your stake and leave messages that reveal if you fail.
                </Text>
              </View>
            </View>

            {/* Share Button */}
            <Pressable
              disabled={sharing}
              onPress={handleShare}
              style={({ pressed }) => [styles.shareBtn, pressed && styles.pressed, sharing && styles.disabled]}
            >
              <LinearGradient colors={[Colors.accent, '#0A7FD4']} style={styles.btnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Text style={styles.btnText}>{sharing ? 'Sharing...' : 'Share to friends'}</Text>
              </LinearGradient>
            </Pressable>
          </View>

          {/* Hidden capture card */}
          <View style={styles.hiddenCapture}>
            <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1, result: 'tmpfile' }}>
              <ShareCommitmentCard promise={promise} />
            </ViewShot>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: Colors.bgElevated,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.systemGray4,
  },
  content: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },

  // Header
  header: {
    alignItems: 'center',
    gap: 4,
  },
  title: {
    ...Typography.h3,
    color: Colors.text,
    fontFamily: Fonts.rounded,
  },
  subtitle: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textAlign: 'center',
  },

  // Card wrapper
  cardWrapper: {
    alignItems: 'center',
    transform: [{ scale: 0.85 }],
    marginVertical: -Spacing.lg,
  },

  // Coming soon
  comingSoonCard: {
    flexDirection: 'row',
    gap: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  comingSoonEmoji: {
    fontSize: 24,
  },
  comingSoonContent: {
    flex: 1,
    gap: 2,
  },
  comingSoonTitle: {
    ...Typography.bodySemibold,
    color: Colors.textSecondary,
  },
  comingSoonText: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },

  // Share button
  shareBtn: {
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  btnGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    ...Typography.bodySemibold,
    color: Colors.text,
    fontFamily: Fonts.rounded,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.6,
  },

  // Hidden capture
  hiddenCapture: {
    position: 'absolute',
    left: -9999,
    top: -9999,
  },
});

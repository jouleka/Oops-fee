/**
 * ShareModal
 * Share your commitment with friends for accountability.
 *
 * Features:
 * - Share commitment card image
 * - Generate friend link (friends can pledge and/or write "I Told You So" messages)
 * - Generate partner link (for partner verification)
 */

import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Share,
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
import { createShareLink, type ShareLinkType } from '@/lib/share';
import { ShareCommitmentCard } from './ShareCommitmentCard';

function hapticMedium() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

function hapticSuccess() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

function hapticError() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}

interface ShareModalProps {
  visible: boolean;
  promise: UserPromise;
  onClose: () => void;
}

type ShareOption = 'image' | 'friend' | 'partner';

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

  // Reset states when modal closes
  useEffect(() => {
    if (!visible) {
      setActiveOption(null);
      setFriendLink({ loading: false, url: null, error: null, copied: false });
      setPartnerLink({ loading: false, url: null, error: null, copied: false });
    }
  }, [visible]);

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
        mimeType: 'image/png',
        dialogTitle: 'Share your commitment',
      });
    } catch (error) {
      console.error('Failed to share:', error);
    } finally {
      setSharing(false);
    }
  }, [sharing]);

  // Generate and share link
  const generateShareLink = useCallback(
    async (type: ShareLinkType) => {
      const setState = type === 'friend' ? setFriendLink : setPartnerLink;

      setState((prev) => ({ ...prev, loading: true, error: null }));
      hapticMedium();

      try {
        const result = await createShareLink(promise.id, type);
        setState({ loading: false, url: result.url, error: null, copied: false });
        hapticSuccess();
      } catch (error) {
        setState({
          loading: false,
          url: null,
          error: error instanceof Error ? error.message : 'Failed to create link',
          copied: false,
        });
        hapticError();
      }
    },
    [promise.id]
  );

  // Copy link to clipboard
  const copyLink = useCallback(async (url: string, type: ShareLinkType) => {
    await Clipboard.setStringAsync(url);
    hapticSuccess();

    const setState = type === 'friend' ? setFriendLink : setPartnerLink;

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
      console.error('Failed to share:', error);
    }
  }, []);

  // Render share option button
  const renderShareOption = (
    option: ShareOption,
    emoji: string,
    title: string,
    subtitle: string,
    state?: ShareLinkState,
    linkType?: ShareLinkType
  ) => {
    const isActive = activeOption === option;
    const hasLink = state?.url;
    const isLoading = state?.loading;

    return (
      <View key={option}>
        <Pressable
          onPress={() => {
            setActiveOption(isActive ? null : option);
            if (option === 'image') {
              handleShareImage();
            } else if (linkType && !state?.url) {
              generateShareLink(linkType);
            }
          }}
          disabled={sharing || isLoading}
          style={({ pressed }) => [
            styles.optionBtn,
            isActive && styles.optionBtnActive,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.optionEmoji}>{emoji}</Text>
          <View style={styles.optionTextContainer}>
            <Text style={styles.optionTitle}>{title}</Text>
            <Text style={styles.optionSubtitle}>{subtitle}</Text>
          </View>
          {isLoading && <ActivityIndicator size="small" color={Colors.accent} />}
        </Pressable>

        {/* Link actions */}
        {isActive && hasLink && linkType && (
          <Animated.View entering={FadeIn.duration(200)} style={styles.linkActions}>
            <Pressable
              style={[styles.linkActionBtn, state.copied && styles.linkActionBtnSuccess]}
              onPress={() => copyLink(state.url!, linkType)}
            >
              <Text style={styles.linkActionText}>
                {state.copied ? '✓ Copied!' : '📋 Copy link'}
              </Text>
            </Pressable>
            <Pressable
              style={styles.linkActionBtn}
              onPress={() => shareLink(state.url!, linkType)}
            >
              <Text style={styles.linkActionText}>📤 Share</Text>
            </Pressable>
          </Animated.View>
        )}

        {/* Error */}
        {isActive && state?.error && (
          <Animated.View entering={FadeIn.duration(200)} style={styles.errorBox}>
            <Text style={styles.errorText}>{state.error}</Text>
            <Pressable
              style={styles.retryBtn}
              onPress={() => linkType && generateShareLink(linkType)}
            >
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </Animated.View>
        )}
      </View>
    );
  };

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
              <Text style={styles.subtitle}>Get friends involved for extra accountability.</Text>
            </View>

            {/* Card Preview */}
            <Animated.View entering={FadeIn.duration(300)} style={styles.cardWrapper}>
              <ShareCommitmentCard promise={promise} />
            </Animated.View>

            {/* Share Options */}
            <View style={styles.options}>
              {renderShareOption(
                'image',
                '🖼️',
                'Share image',
                'Post this card to social media',
              )}

              {renderShareOption(
                'friend',
                '🔗',
                'Share with friends',
                'They can pledge money or write roast messages',
                friendLink,
                'friend'
              )}

              {/* Only show partner option for partner verification type */}
              {promise.verificationType === 'partner' &&
                renderShareOption(
                  'partner',
                  '👀',
                  'Get verified',
                  'Send to your accountability partner',
                  partnerLink,
                  'partner'
                )}
            </View>

            {/* Main Share Button */}
            <Pressable
              disabled={sharing}
              onPress={handleShareImage}
              style={({ pressed }) => [styles.shareBtn, pressed && styles.pressed, sharing && styles.disabled]}
            >
              <LinearGradient colors={[Colors.accent, '#0A7FD4']} style={styles.btnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Text style={styles.btnText}>{sharing ? 'Sharing...' : 'Share commitment image'}</Text>
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
    maxHeight: '90%',
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
    transform: [{ scale: 0.75 }],
    marginVertical: -Spacing.xxl,
  },

  // Options
  options: {
    gap: Spacing.sm,
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  optionBtnActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentDim,
  },
  optionEmoji: {
    fontSize: 24,
  },
  optionTextContainer: {
    flex: 1,
    gap: 2,
  },
  optionTitle: {
    ...Typography.bodySemibold,
    color: Colors.text,
  },
  optionSubtitle: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },

  // Link actions
  linkActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  linkActionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  linkActionBtnSuccess: {
    backgroundColor: Colors.successDim,
    borderColor: Colors.success,
  },
  linkActionText: {
    ...Typography.caption,
    color: Colors.text,
  },

  // Error
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.dangerDim,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
    marginHorizontal: Spacing.md,
  },
  errorText: {
    ...Typography.caption,
    color: Colors.danger,
    flex: 1,
  },
  retryBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  retryText: {
    ...Typography.caption,
    color: Colors.accent,
    fontWeight: '600',
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

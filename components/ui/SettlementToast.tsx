/**
 * SettlementToast
 * 
 * In-app notification when a promise is settled (charged or payment failed).
 * Slides up from bottom with dramatic styling to reinforce loss salience.
 */

import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
    FadeIn,
    FadeOut,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts, Radius, Shadows, Spacing, Typography } from '@/constants/theme';

export type SettlementType = 'charged' | 'failed' | 'requires_action' | 'abandoned';

interface SettlementToastProps {
  visible: boolean;
  type: SettlementType;
  promiseText: string;
  stake: number;
  onDismiss: () => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const CONTENT = {
  charged: {
    emoji: '💸',
    title: 'Promise Broken',
    subtitle: 'Your stake has been charged.',
    buttonText: 'View Graveyard',
    navigateTo: '/graveyard',
  },
  failed: {
    emoji: '⚠️',
    title: 'Payment Failed',
    subtitle: 'Your card was declined. Update your payment method.',
    buttonText: 'Update Payment',
    navigateTo: '/(auth)/payment-method',
  },
  requires_action: {
    emoji: '🔐',
    title: 'Action Required',
    subtitle: 'Your bank requires verification.',
    buttonText: 'Verify Payment',
    navigateTo: '/(auth)/payment-method',
  },
  abandoned: {
    emoji: '☠️',
    title: 'Promise Abandoned',
    subtitle: 'This promise expired without completion.',
    buttonText: 'View Graveyard',
    navigateTo: '/graveyard',
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
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
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
  const isPaymentIssue = type === 'failed' || type === 'requires_action';
  const accentColor = isPaymentIssue ? Colors.warning : Colors.danger;
  const buttonColors: [string, string] = isPaymentIssue 
    ? [Colors.warning, '#E68A00'] 
    : [Colors.danger, '#CC362E'];

  const truncatedText = promiseText.length > 50 
    ? promiseText.substring(0, 50) + '...' 
    : promiseText;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      {/* Backdrop */}
      {visible && (
        <Animated.View 
          entering={FadeIn.duration(200)} 
          exiting={FadeOut.duration(150)}
          style={styles.backdrop}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss} />
        </Animated.View>
      )}

      {/* Toast Card */}
      <Animated.View 
        style={[
          styles.card, 
          animatedStyle,
          { 
            paddingBottom: Math.max(insets.bottom, Spacing.lg),
            borderColor: accentColor + '44',
          }
        ]}
      >
        {/* Accent bar at top */}
        <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

        <View style={styles.content}>
          {/* Header row */}
          <View style={styles.headerRow}>
            <View style={[styles.emojiContainer, { backgroundColor: accentColor + '20' }]}>
              <Text style={styles.emoji}>{content.emoji}</Text>
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: accentColor }]}>{content.title}</Text>
              <Text style={styles.subtitle}>{content.subtitle}</Text>
            </View>
          </View>

          {/* Promise text */}
          <View style={styles.promiseBox}>
            <Text style={styles.promiseText}>&ldquo;{truncatedText}&rdquo;</Text>
          </View>

          {/* Stake amount */}
          {stake > 0 && (
            <View style={[styles.stakeAmount, { backgroundColor: accentColor + '15' }]}>
              <Text style={styles.stakeIcon}>
                {type === 'charged' ? '🔥' : '💳'}
              </Text>
              <Text style={[styles.stakeText, { color: accentColor }]}>
                {type === 'charged' ? `$${stake} charged` : `$${stake} pending`}
              </Text>
            </View>
          )}

          {/* Action button */}
          <Pressable
            onPress={handleAction}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          >
            <LinearGradient
              colors={buttonColors}
              style={styles.buttonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.buttonText}>{content.buttonText}</Text>
            </LinearGradient>
          </Pressable>

          {/* Dismiss link */}
          <Pressable onPress={handleDismiss}>
            <Text style={styles.dismissText}>Dismiss</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 9999,
    elevation: 9999,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  card: {
    backgroundColor: Colors.bgElevated,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  accentBar: {
    height: 4,
    width: '100%',
  },
  content: {
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  emojiContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 28,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...Typography.h3,
    fontFamily: Fonts.rounded,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  promiseBox: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  promiseText: {
    ...Typography.body,
    color: Colors.text,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  stakeAmount: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  stakeIcon: {
    fontSize: 18,
  },
  stakeText: {
    ...Typography.bodySemibold,
  },
  button: {
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    ...Shadows.md,
  },
  buttonGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    ...Typography.bodySemibold,
    color: Colors.text,
    fontFamily: Fonts.rounded,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  dismissText: {
    ...Typography.body,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
});


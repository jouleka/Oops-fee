/**
 * PartnerNotification
 * 
 * Custom in-app toast notification for partner verification results.
 * Uses a View overlay instead of Modal to work on top of other modals.
 */

import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
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

export type PartnerNotificationType = 'approved' | 'rejected';

interface PartnerNotificationProps {
  visible: boolean;
  type: PartnerNotificationType;
  promiseText: string;
  stake?: number;
  onDismiss: () => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export function PartnerNotification({
  visible,
  type,
  promiseText,
  stake = 0,
  onDismiss,
}: PartnerNotificationProps) {
  const insets = useSafeAreaInsets();
  const [isShowing, setIsShowing] = useState(false);
  const translateY = useSharedValue(SCREEN_HEIGHT);

  const handleDismiss = useCallback(() => {
    translateY.value = withTiming(SCREEN_HEIGHT, { duration: 300 }, () => {
      runOnJS(setIsShowing)(false);
      runOnJS(onDismiss)();
    });
  }, [onDismiss, translateY]);

  // Handle visibility changes
  useEffect(() => {
    if (visible) {
      setIsShowing(true);
      translateY.value = withTiming(0, { duration: 400 });
      
      // Haptics
      try {
        if (type === 'approved') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        }
      } catch {
        // Ignore
      }
      
      // Auto-dismiss after 8 seconds
      const timeout = setTimeout(() => {
        handleDismiss();
      }, 8000);
      
      return () => clearTimeout(timeout);
    } else {
      translateY.value = withTiming(SCREEN_HEIGHT, { duration: 300 });
      return;
    }
  }, [visible, type, handleDismiss, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!isShowing && !visible) return null;

  const isApproved = type === 'approved';
  const emoji = isApproved ? '✅' : '❌';
  const title = isApproved ? 'Partner Approved!' : 'Partner Rejected';
  const subtitle = isApproved
    ? 'Your partner confirmed you did it!'
    : 'Your partner says you didn\'t do it.';
  const buttonText = isApproved ? 'Nice!' : 'Damn';
  const accentColor = isApproved ? Colors.success : Colors.danger;
  const buttonColors: [string, string] = isApproved 
    ? [Colors.success, '#2EC44F'] 
    : [Colors.danger, '#FF6B35'];

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
            <View style={[styles.emojiContainer, { backgroundColor: isApproved ? Colors.successDim : Colors.dangerDim }]}>
              <Text style={styles.emoji}>{emoji}</Text>
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: accentColor }]}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
          </View>

          {/* Promise text */}
          <View style={styles.promiseBox}>
            <Text style={styles.promiseText}>&ldquo;{truncatedText}&rdquo;</Text>
          </View>

          {/* Stake warning for rejections */}
          {!isApproved && stake > 0 && (
            <View style={styles.stakeWarning}>
              <Text style={styles.stakeIcon}>💸</Text>
              <Text style={styles.stakeText}>${stake} will be charged</Text>
            </View>
          )}

          {/* Action button */}
          <Pressable
            onPress={handleDismiss}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          >
            <LinearGradient
              colors={buttonColors}
              style={styles.buttonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.buttonText}>{buttonText}</Text>
            </LinearGradient>
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
    backgroundColor: 'rgba(0,0,0,0.5)',
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
  stakeWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.dangerDim,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  stakeIcon: {
    fontSize: 18,
  },
  stakeText: {
    ...Typography.bodySemibold,
    color: Colors.danger,
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
});

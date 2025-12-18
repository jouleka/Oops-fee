/**
 * CheckInBanner - Inline daily check-in prompt
 */

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { CHECKIN_COPY } from '@/constants/content';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { hapticMedium } from '@/lib/haptics';

interface CheckInBannerProps {
  totalAtStake: number;
  streak: number;
  onCommit: (committed: boolean) => void | Promise<void>;
}

export function CheckInBanner({ totalAtStake, streak, onCommit }: CheckInBannerProps) {
  const [working, setWorking] = useState(false);

  const handleCommit = async (committed: boolean) => {
    if (working) return;
    setWorking(true);
    hapticMedium();
    await onCommit(committed);
    setWorking(false);
  };

  return (
    <Animated.View entering={FadeInDown.duration(300)} style={styles.banner}>
      <View style={styles.header}>
        <View style={styles.left}>
          <Text style={styles.emoji}>👋</Text>
          <View>
            <Text style={styles.title}>{CHECKIN_COPY.title}</Text>
            <Text style={styles.subtitle}>
              ${totalAtStake} on the line
              {streak > 0 && ` • 🔥 ${streak} day streak`}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          disabled={working}
          onPress={() => handleCommit(true)}
          style={({ pressed }) => [
            styles.yesBtn,
            pressed && styles.pressed,
            working && styles.disabled,
          ]}
        >
          <Text style={styles.yesBtnText}>✓ On track</Text>
        </Pressable>

        <Pressable
          disabled={working}
          onPress={() => handleCommit(false)}
          style={({ pressed }) => [
            styles.noBtn,
            pressed && styles.noBtnPressed,
            working && styles.disabled,
          ]}
        >
          <Text style={styles.noBtnText}>✗ Failed</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.success + '30',
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  emoji: {
    fontSize: 28,
  },
  title: {
    ...Typography.bodyMedium,
    color: Colors.text,
  },
  subtitle: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  yesBtn: {
    flex: 1,
    height: 44,
    backgroundColor: Colors.success,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yesBtnText: {
    ...Typography.bodySemibold,
    color: '#000',
  },
  noBtn: {
    flex: 1,
    height: 44,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noBtnPressed: {
    backgroundColor: Colors.dangerDim,
    borderColor: Colors.danger + '40',
  },
  noBtnText: {
    ...Typography.bodySemibold,
    color: Colors.textSecondary,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.6,
  },
});


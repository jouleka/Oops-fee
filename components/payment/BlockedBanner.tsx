/**
 * BlockedBanner Component
 *
 * Shows a banner when the user has unresolved payment failures.
 * They must resolve their payments before creating new staked promises.
 */

import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { hapticLight } from '@/lib/haptics';

interface BlockedBannerProps {
  /** Number of failed payments */
  failedPaymentCount?: number;
  /** Custom message to display */
  message?: string;
}

export function BlockedBanner({
  failedPaymentCount = 1,
  message,
}: BlockedBannerProps) {
  const handlePress = () => {
    hapticLight();
    // Navigate to payment method screen to update card
    router.push('/(auth)/payment-method' as Href);
  };

  return (
    <Pressable style={styles.container} onPress={handlePress}>
      <View style={styles.iconContainer}>
        <Ionicons name="ban" size={24} color={Colors.danger} />
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Payment required</Text>
        <Text style={styles.description}>
          {message ||
            (failedPaymentCount > 1
              ? `You have ${failedPaymentCount} failed payments. Resolve them to continue.`
              : 'Resolve your failed payment to create new stakes.')}
        </Text>
      </View>

      <View style={styles.action}>
        <Text style={styles.actionText}>Fix</Text>
        <Ionicons name="chevron-forward" size={16} color={Colors.accent} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dangerDim,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255, 69, 58, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  title: {
    ...Typography.bodySemibold,
    color: Colors.danger,
    marginBottom: 2,
  },
  description: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
  },
  actionText: {
    ...Typography.caption,
    color: Colors.text,
    fontWeight: '600',
  },
});


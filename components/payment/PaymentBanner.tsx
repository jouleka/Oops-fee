/**
 * PaymentBanner Component
 *
 * Shows a banner when there's a failed promise that requires SCA resolution.
 * Tapping the banner presents the PaymentSheet for the user to complete authentication.
 */

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { hapticError, hapticLight, hapticSuccess } from '@/lib/haptics';
import { presentPaymentForSCA } from '@/lib/stripe';

interface PaymentBannerProps {
  /** The client secret from the PaymentIntent requiring action */
  clientSecret: string;
  /** The promise text to show context */
  promiseText?: string;
  /** The stake amount in cents */
  stakeAmount?: number;
  /** Called when payment is completed successfully */
  onPaymentComplete?: () => void;
}

export function PaymentBanner({
  clientSecret,
  promiseText,
  stakeAmount,
  onPaymentComplete,
}: PaymentBannerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePress = async () => {
    hapticLight();
    setIsLoading(true);
    setError(null);

    const result = await presentPaymentForSCA(clientSecret);

    setIsLoading(false);

    if (result.success) {
      hapticSuccess();
      onPaymentComplete?.();
    } else if (!result.cancelled && result.error) {
      hapticError();
      setError(result.error);
    }
  };

  const formattedAmount = stakeAmount
    ? `$${(stakeAmount / 100).toFixed(2)}`
    : null;

  return (
    <Pressable
      style={[styles.container, error && styles.containerError]}
      onPress={handlePress}
      disabled={isLoading}
    >
      <View style={styles.iconContainer}>
        {isLoading ? (
          <ActivityIndicator color={Colors.text} size="small" />
        ) : (
          <Ionicons
            name="alert-circle"
            size={24}
            color={error ? Colors.danger : Colors.warning}
          />
        )}
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>
          {error ? 'Payment failed' : 'Complete payment'}
        </Text>
        <Text style={styles.description} numberOfLines={2}>
          {error ? (
            error
          ) : promiseText ? (
            <>
              {formattedAmount && (
                <Text style={styles.amount}>{formattedAmount} · </Text>
              )}
              {promiseText.length > 40
                ? `${promiseText.slice(0, 40)}...`
                : promiseText}
            </>
          ) : (
            'Tap to verify your payment method'
          )}
        </Text>
      </View>

      <Ionicons
        name="chevron-forward"
        size={20}
        color={Colors.textSecondary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warningDim,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  containerError: {
    backgroundColor: Colors.dangerDim,
    borderColor: Colors.danger,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  title: {
    ...Typography.bodySemibold,
    color: Colors.text,
    marginBottom: 2,
  },
  description: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  amount: {
    ...Typography.caption,
    color: Colors.warning,
    fontWeight: '600',
  },
});


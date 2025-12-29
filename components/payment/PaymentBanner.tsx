/**
 * PaymentBanner Component
 *
 * Shows a banner when there's a failed promise that requires SCA resolution.
 * Tapping the banner presents the PaymentSheet for the user to complete authentication.
 */

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { hapticError, hapticLight, hapticSuccess } from '@/lib/haptics';
import { presentPaymentForSCA } from '@/lib/stripe';

interface PaymentBannerProps {
  /** The client secret from the PaymentIntent requiring action */
  clientSecret: string;
  /** The promise text to show context */
  promiseText?: string;
  /** The stake amount in dollars */
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

  const formattedAmount = stakeAmount ? `$${stakeAmount}` : null;

  return (
    <Pressable
      className={`flex-row items-center rounded-lg p-md gap-md border ${
        error
          ? 'bg-danger-dim border-danger'
          : 'bg-warning-dim border-warning'
      }`}
      onPress={handlePress}
      disabled={isLoading}
    >
      <View className="w-10 h-10 rounded-full bg-black/20 items-center justify-center">
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <Ionicons
            name="alert-circle"
            size={24}
            color={error ? '#FF453A' : '#FF9F0A'}
          />
        )}
      </View>

      <View className="flex-1">
        <Text className="text-body-semibold text-white mb-0.5">
          {error ? 'Payment failed' : 'Complete payment'}
        </Text>
        <Text className="text-caption text-text-secondary" numberOfLines={2}>
          {error ? (
            error
          ) : promiseText ? (
            <>
              {formattedAmount && (
                <Text className="text-caption text-warning font-semibold">
                  {formattedAmount} ·{' '}
                </Text>
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

      <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
    </Pressable>
  );
}

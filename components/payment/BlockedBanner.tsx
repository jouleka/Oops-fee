/**
 * BlockedBanner Component
 *
 * Shows a banner when the user has unresolved payment failures.
 * They must resolve their payments before creating new staked promises.
 */

import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

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
    <Pressable
      className="flex-row items-center bg-card rounded-lg p-md gap-md border border-border border-l-[3px] border-l-danger"
      onPress={handlePress}
    >
      <View className="w-10 h-10 rounded-full bg-danger-dim items-center justify-center">
        <Ionicons name="ban" size={24} color="#FF453A" />
      </View>

      <View className="flex-1">
        <Text className="text-body-semibold text-white mb-0.5">
          Payment required
        </Text>
        <Text className="text-caption text-text-secondary">
          {message ||
            (failedPaymentCount > 1
              ? `You have ${failedPaymentCount} failed payments. Resolve them to continue.`
              : 'Resolve your failed payment to create new stakes.')}
        </Text>
      </View>

      <View className="flex-row items-center gap-1 bg-danger px-md py-sm rounded-full">
        <Text className="text-caption text-white font-semibold">Fix</Text>
        <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
      </View>
    </Pressable>
  );
}

/**
 * Payment Method Screen
 *
 * Allows users to add/update their payment method using Stripe PaymentSheet.
 * This screen is shown when:
 * - User tries to create a staked promise without a payment method
 * - User wants to update their payment method from profile
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/auth';
import { hapticLight } from '@/lib/haptics';
import { isStripeConfigured, presentAddCardSheet, removePaymentMethod } from '@/lib/stripe';

export default function PaymentMethodScreen() {
  const { paymentState, refreshProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [removeSuccess, setRemoveSuccess] = useState(false);

  const handleAddCard = async () => {
    if (!isStripeConfigured()) {
      setError('Payment system is not configured');
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await presentAddCardSheet();

    setIsLoading(false);

    if (result.success) {
      setSuccess(true);
      // Refresh profile to get the new payment method
      await refreshProfile();
      // Close modal after a short delay to show success state
      setTimeout(() => {
        router.back();
      }, 1500);
    } else if (result.cancelled) {
      // User cancelled, do nothing
    } else if (result.error) {
      setError(result.error);
    }
  };

  const handleRemoveCard = async () => {
    if (!paymentState.hasPaymentMethod) return;

    setIsRemoving(true);
    setError(null);
    hapticLight();

    const result = await removePaymentMethod();

    setIsRemoving(false);

    if (result.success) {
      setRemoveSuccess(true);
      await refreshProfile();
      setTimeout(() => {
        setRemoveSuccess(false);
      }, 2000);
    } else if (result.error) {
      setError(result.error);
    }
  };

  const handleClose = () => {
    router.back();
  };

  // Format payment method display
  const getPaymentMethodDisplay = () => {
    if (!paymentState.hasPaymentMethod) return null;

    const { brand, last4 } = paymentState;
    
    // Brand to emoji/icon mapping
    const brandInfo: Record<string, { emoji: string; name: string }> = {
      visa: { emoji: '💳', name: 'Visa' },
      mastercard: { emoji: '💳', name: 'Mastercard' },
      amex: { emoji: '💳', name: 'Amex' },
      discover: { emoji: '💳', name: 'Discover' },
      apple_pay: { emoji: '🍎', name: 'Apple Pay' },
      google_pay: { emoji: '🤖', name: 'Google Pay' },
      link: { emoji: '🔗', name: 'Link' },
      cashapp: { emoji: '💵', name: 'Cash App' },
      amazon_pay: { emoji: '📦', name: 'Amazon Pay' },
      card: { emoji: '💳', name: 'Card' },
    };

    const info = brandInfo[brand || 'card'] || brandInfo.card;
    const displayLast4 = last4 ? ` •••• ${last4}` : '';

    return {
      emoji: info.emoji,
      name: info.name,
      last4: displayLast4,
      full: `${info.name}${displayLast4}`,
    };
  };

  const paymentDisplay = getPaymentMethodDisplay();

  return (
    <SafeAreaView className="flex-1 bg-black">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <View className="w-10" />
        <Text className="text-h3 text-white">Payment Method</Text>
        <Pressable onPress={handleClose} className="w-10 h-10 items-center justify-center">
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </Pressable>
      </View>

      <View className="flex-1 p-6">
        {/* Current Status */}
        <View className="items-center py-12">
          <View className="w-[72px] h-[72px] rounded-full bg-card items-center justify-center mb-4">
            {paymentState.hasPaymentMethod ? (
              <Text className="text-[32px]">{paymentDisplay?.emoji || '💳'}</Text>
            ) : (
              <Ionicons name="card-outline" size={32} color="rgba(255, 255, 255, 0.70)" />
            )}
          </View>
          <Text className="text-h2 text-white mb-2">
            {paymentDisplay ? paymentDisplay.full : 'No payment method'}
          </Text>
          <Text className="text-body text-text-secondary text-center">
            {paymentState.hasPaymentMethod
              ? 'Your card will be charged if you fail a staked promise'
              : 'Add a card to create promises with real stakes'}
          </Text>
        </View>

        {/* Info Card */}
        <View className="bg-card rounded-lg p-4 gap-3 mb-6">
          <View className="flex-row items-center gap-3">
            <Ionicons name="shield-checkmark" size={20} color="#0B93F6" />
            <Text className="text-body text-text-secondary flex-1">
              Your card is securely stored by Stripe
            </Text>
          </View>
          <View className="flex-row items-center gap-3">
            <Ionicons name="lock-closed" size={20} color="#0B93F6" />
            <Text className="text-body text-text-secondary flex-1">
              You&apos;re only charged if you fail a promise
            </Text>
          </View>
          <View className="flex-row items-center gap-3">
            <Ionicons name="wallet" size={20} color="#0B93F6" />
            <Text className="text-body text-text-secondary flex-1">
              Multiple payment options available
            </Text>
          </View>
        </View>

        {/* Error Message */}
        {error && (
          <View className="flex-row items-center gap-2 bg-danger-dim rounded-md p-3 mb-4">
            <Ionicons name="alert-circle" size={20} color="#FF453A" />
            <Text className="text-body text-danger flex-1">{error}</Text>
          </View>
        )}

        {/* Success Message */}
        {success && (
          <View className="flex-row items-center gap-2 bg-success-dim rounded-md p-3 mb-4">
            <Ionicons name="checkmark-circle" size={20} color="#34C759" />
            <Text className="text-body text-success flex-1">Card added successfully!</Text>
          </View>
        )}

        {/* Remove Success Message */}
        {removeSuccess && (
          <View className="flex-row items-center gap-2 bg-success-dim rounded-md p-3 mb-4">
            <Ionicons name="checkmark-circle" size={20} color="#34C759" />
            <Text className="text-body text-success flex-1">Card removed successfully!</Text>
          </View>
        )}

        {/* Add/Update Card Button */}
        <Pressable
          className={`flex-row items-center justify-center gap-2 bg-imessage rounded-lg py-4 px-6 ${(isLoading || success || isRemoving) ? 'opacity-50' : ''}`}
          onPress={handleAddCard}
          disabled={isLoading || success || isRemoving}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons
                name={paymentState.hasPaymentMethod ? 'refresh' : 'add'}
                size={20}
                color="#FFFFFF"
              />
              <Text className="text-body-semibold text-white">
                {paymentState.hasPaymentMethod ? 'Update Card' : 'Add Card'}
              </Text>
            </>
          )}
        </Pressable>

        {/* Remove Card Button - only show if card exists */}
        {paymentState.hasPaymentMethod && !success && !removeSuccess && (
          <Pressable
            className={`flex-row items-center justify-center gap-2 bg-transparent border border-danger rounded-lg py-3 px-6 mt-3 ${(isLoading || isRemoving) ? 'opacity-50' : ''}`}
            onPress={handleRemoveCard}
            disabled={isLoading || isRemoving}
          >
            {isRemoving ? (
              <ActivityIndicator color="#FF453A" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={20} color="#FF453A" />
                <Text className="text-body-semibold text-danger">Remove Card</Text>
              </>
            )}
          </Pressable>
        )}

        {/* Stripe Branding */}
        <View className="flex-row items-center justify-center gap-1 mt-8">
          <Text className="text-caption text-text-muted">Powered by</Text>
          <Text className="text-base font-bold text-text-muted italic">stripe</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

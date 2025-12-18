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
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
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
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft} />
        <Text style={styles.headerTitle}>Payment Method</Text>
        <Pressable onPress={handleClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={Colors.text} />
        </Pressable>
      </View>

      <View style={styles.content}>
        {/* Current Status */}
        <View style={styles.statusCard}>
          <View style={styles.statusIcon}>
            {paymentState.hasPaymentMethod ? (
              <Text style={styles.statusEmoji}>{paymentDisplay?.emoji || '💳'}</Text>
            ) : (
              <Ionicons name="card-outline" size={32} color={Colors.textSecondary} />
            )}
          </View>
          <Text style={styles.statusTitle}>
            {paymentDisplay ? paymentDisplay.full : 'No payment method'}
          </Text>
          <Text style={styles.statusDescription}>
            {paymentState.hasPaymentMethod
              ? 'Your card will be charged if you fail a staked promise'
              : 'Add a card to create promises with real stakes'}
          </Text>
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="shield-checkmark" size={20} color={Colors.accent} />
            <Text style={styles.infoText}>
              Your card is securely stored by Stripe
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="lock-closed" size={20} color={Colors.accent} />
            <Text style={styles.infoText}>
              You&apos;re only charged if you fail a promise
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="wallet" size={20} color={Colors.accent} />
            <Text style={styles.infoText}>
              Multiple payment options available
            </Text>
          </View>
        </View>

        {/* Error Message */}
        {error && (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={20} color={Colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Success Message */}
        {success && (
          <View style={styles.successCard}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
            <Text style={styles.successText}>Card added successfully!</Text>
          </View>
        )}

        {/* Remove Success Message */}
        {removeSuccess && (
          <View style={styles.successCard}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
            <Text style={styles.successText}>Card removed successfully!</Text>
          </View>
        )}

        {/* Add/Update Card Button */}
        <Pressable
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleAddCard}
          disabled={isLoading || success || isRemoving}
        >
          {isLoading ? (
            <ActivityIndicator color={Colors.text} />
          ) : (
            <>
              <Ionicons
                name={paymentState.hasPaymentMethod ? 'refresh' : 'add'}
                size={20}
                color={Colors.text}
              />
              <Text style={styles.buttonText}>
                {paymentState.hasPaymentMethod ? 'Update Card' : 'Add Card'}
              </Text>
            </>
          )}
        </Pressable>

        {/* Remove Card Button - only show if card exists */}
        {paymentState.hasPaymentMethod && !success && !removeSuccess && (
          <Pressable
            style={[styles.removeButton, isRemoving && styles.buttonDisabled]}
            onPress={handleRemoveCard}
            disabled={isLoading || isRemoving}
          >
            {isRemoving ? (
              <ActivityIndicator color={Colors.danger} />
            ) : (
              <>
                <Ionicons name="trash-outline" size={20} color={Colors.danger} />
                <Text style={styles.removeButtonText}>Remove Card</Text>
              </>
            )}
          </Pressable>
        )}

        {/* Stripe Branding */}
        <View style={styles.stripeBranding}>
          <Text style={styles.stripeText}>Powered by</Text>
          <Text style={styles.stripeLogo}>stripe</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: {
    width: 40,
  },
  headerTitle: {
    ...Typography.h3,
    color: Colors.text,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    padding: Spacing.xl,
  },
  statusCard: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
  },
  statusIcon: {
    width: 72,
    height: 72,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  statusEmoji: {
    fontSize: 32,
  },
  statusTitle: {
    ...Typography.h2,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  statusDescription: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  infoText: {
    ...Typography.body,
    color: Colors.textSecondary,
    flex: 1,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.dangerDim,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  errorText: {
    ...Typography.body,
    color: Colors.danger,
    flex: 1,
  },
  successCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.successDim,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  successText: {
    ...Typography.body,
    color: Colors.success,
    flex: 1,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.accent,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    ...Typography.bodySemibold,
    color: Colors.text,
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.danger,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.md,
  },
  removeButtonText: {
    ...Typography.bodySemibold,
    color: Colors.danger,
  },
  stripeBranding: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xxl,
  },
  stripeText: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  stripeLogo: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
});


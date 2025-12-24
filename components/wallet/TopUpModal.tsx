/**
 * TopUpModal
 * Add funds to wallet via PaymentSheet (Apple Pay, Google Pay, or card).
 *
 * Features:
 * - Amount input with min ($5) / max ($500)
 * - Quick preset buttons ($25, $50, $100)
 * - PaymentSheet with Apple Pay / Google Pay support
 * - Falls back to saved card for web/Expo Go
 */

import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { isStripeConfigured, presentTopUpSheet } from '@/lib/stripe';
import { confirmTopUp, createTopUpIntent, formatCents } from '@/lib/wallet/api';

function hapticMedium() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

function hapticSuccess() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

function hapticError() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}

const PRESETS = [2500, 5000, 10000]; // $25, $50, $100 in cents
const MIN_AMOUNT = 500; // $5
const MAX_AMOUNT = 50000; // $500

interface TopUpModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function TopUpModal({ visible, onClose, onSuccess }: TopUpModalProps) {
  const insets = useSafeAreaInsets();
  const { refreshProfile } = useAuth();
  const [amountText, setAmountText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const amountCents = Math.round(parseFloat(amountText.replace(/[^0-9.]/g, '') || '0') * 100);
  const isValidAmount = amountCents >= MIN_AMOUNT && amountCents <= MAX_AMOUNT;

  const handlePreset = (cents: number) => {
    hapticMedium();
    setAmountText((cents / 100).toFixed(0));
    setError(null);
    Keyboard.dismiss();
  };

  const handleTopUp = useCallback(async () => {
    if (!isValidAmount || loading) return;

    hapticMedium();
    Keyboard.dismiss();
    setLoading(true);
    setError(null);

    try {
      // Step 1: Create PaymentIntent for PaymentSheet
      const setupResult = await createTopUpIntent(amountCents);

      if (!setupResult.success || !setupResult.clientSecret || !setupResult.customerId || !setupResult.ephemeralKey) {
        setError(setupResult.message || 'Failed to initialize payment');
        hapticError();
        setLoading(false);
        return;
      }

      // Step 2: Present PaymentSheet (Apple Pay, Google Pay, or card)
      // Check if native Stripe is available (not on web or Expo Go)
      if (!isStripeConfigured()) {
        setError('Payments require the mobile app');
        hapticError();
        setLoading(false);
        return;
      }

      const sheetResult = await presentTopUpSheet(
        setupResult.clientSecret,
        setupResult.customerId,
        setupResult.ephemeralKey
      );

      if (sheetResult.cancelled) {
        // User cancelled - no error message needed
        setLoading(false);
        return;
      }

      if (!sheetResult.success) {
        setError(sheetResult.error || 'Payment failed');
        hapticError();
        setLoading(false);
        return;
      }

      // Step 3: Confirm the top-up (credit wallet)
      const confirmResult = await confirmTopUp(setupResult.paymentIntentId!);

      if (confirmResult.success) {
        hapticSuccess();
        setSuccess(true);
        await refreshProfile();
        setTimeout(() => {
          onSuccess();
          // Reset state after close
          setAmountText('');
          setSuccess(false);
        }, 1500);
      } else {
        // Payment succeeded but wallet credit failed - this is bad
        setError(confirmResult.message || 'Payment succeeded but wallet credit failed. Contact support.');
        hapticError();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Top-up failed');
      hapticError();
    } finally {
      setLoading(false);
    }
  }, [amountCents, isValidAmount, loading, onSuccess, refreshProfile]);

  const handleClose = () => {
    if (loading) return;
    setAmountText('');
    setError(null);
    setSuccess(false);
    onClose();
  };

  const getPaymentLabel = () => {
    if (Platform.OS === 'ios') {
      return 'Apple Pay, Card, or other';
    }
    if (Platform.OS === 'android') {
      return 'Google Pay, Card, or other';
    }
    return 'Card';
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.container}>
        <Pressable style={styles.backdrop} onPress={handleClose} />

        <Animated.View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handleRow}>
            <View style={styles.handle} />
          </View>

          <View style={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Add Funds</Text>
              <Text style={styles.subtitle}>
                {Platform.OS === 'ios' 
                  ? 'Pay with Apple Pay, card, or other methods.'
                  : Platform.OS === 'android'
                  ? 'Pay with Google Pay, card, or other methods.'
                  : 'Top up your wallet to stake on promises.'}
              </Text>
            </View>

            {success ? (
              <Animated.View entering={FadeIn.duration(300)} style={styles.successBox}>
                <Text style={styles.successEmoji}>✓</Text>
                <Text style={styles.successText}>
                  Added {formatCents(amountCents)} to wallet!
                </Text>
              </Animated.View>
            ) : (
              <>
                {/* Amount Input */}
                <Animated.View entering={FadeInDown.delay(50).duration(300)} style={styles.amountSection}>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.dollarSign}>$</Text>
                    <TextInput
                      style={styles.input}
                      value={amountText}
                      onChangeText={(t) => {
                        setAmountText(t);
                        setError(null);
                      }}
                      placeholder="0"
                      placeholderTextColor={Colors.textMuted}
                      keyboardType="decimal-pad"
                      maxLength={6}
                      autoFocus
                    />
                  </View>
                  <Text style={styles.hint}>
                    Min {formatCents(MIN_AMOUNT)} • Max {formatCents(MAX_AMOUNT)}
                  </Text>
                </Animated.View>

                {/* Presets */}
                <Animated.View entering={FadeInDown.delay(100).duration(300)} style={styles.presets}>
                  {PRESETS.map((cents) => (
                    <Pressable
                      key={cents}
                      style={({ pressed }) => [
                        styles.presetBtn,
                        amountCents === cents && styles.presetBtnActive,
                        pressed && styles.pressed,
                      ]}
                      onPress={() => handlePreset(cents)}
                    >
                      <Text
                        style={[
                          styles.presetText,
                          amountCents === cents && styles.presetTextActive,
                        ]}
                      >
                        {formatCents(cents)}
                      </Text>
                    </Pressable>
                  ))}
                </Animated.View>

                {/* Payment Method */}
                <Animated.View entering={FadeInDown.delay(150).duration(300)} style={styles.paymentInfo}>
                  <Text style={styles.paymentLabel}>Charging</Text>
                  <Text style={styles.paymentValue}>{getPaymentLabel()}</Text>
                </Animated.View>

                {/* Error */}
                {error && (
                  <Animated.View entering={FadeIn.duration(200)} style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </Animated.View>
                )}

                {/* Add Button */}
                <Animated.View entering={FadeInDown.delay(200).duration(300)}>
                  <Pressable
                    disabled={!isValidAmount || loading}
                    onPress={handleTopUp}
                    style={({ pressed }) => [
                      styles.addBtn,
                      pressed && styles.pressed,
                      !isValidAmount && styles.disabled,
                    ]}
                  >
                    <LinearGradient
                      colors={[Colors.success, '#28A745']}
                      style={styles.btnGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      {loading ? (
                        <ActivityIndicator color={Colors.text} />
                      ) : (
                        <Text style={styles.btnText}>
                          Add {isValidAmount ? formatCents(amountCents) : 'Funds'}
                        </Text>
                      )}
                    </LinearGradient>
                  </Pressable>
                </Animated.View>
              </>
            )}
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

  // Amount
  amountSection: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dollarSign: {
    ...Typography.displayMedium,
    color: Colors.textMuted,
    marginRight: Spacing.xs,
  },
  input: {
    ...Typography.displayMedium,
    color: Colors.text,
    minWidth: 100,
    textAlign: 'center',
    padding: 0,
  },
  hint: {
    ...Typography.caption,
    color: Colors.textMuted,
  },

  // Presets
  presets: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  presetBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  presetBtnActive: {
    backgroundColor: Colors.successDim,
    borderColor: Colors.success,
  },
  presetText: {
    ...Typography.bodySemibold,
    color: Colors.textSecondary,
  },
  presetTextActive: {
    color: Colors.success,
  },

  // Payment info
  paymentInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  paymentLabel: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  paymentValue: {
    ...Typography.body,
    color: Colors.text,
  },

  // Error
  errorBox: {
    backgroundColor: Colors.dangerDim,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  errorText: {
    ...Typography.caption,
    color: Colors.danger,
    textAlign: 'center',
  },

  // Success
  successBox: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xxl,
  },
  successEmoji: {
    fontSize: 48,
    color: Colors.success,
  },
  successText: {
    ...Typography.h3,
    color: Colors.success,
    fontFamily: Fonts.rounded,
  },

  // Button
  addBtn: {
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
    opacity: 0.5,
  },
});


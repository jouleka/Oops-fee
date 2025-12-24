/**
 * WithdrawModal
 * Withdraw funds from wallet to PayPal or bank account.
 *
 * Features:
 * - Amount input (up to current balance)
 * - Toggle: PayPal or Bank Account
 * - PayPal: email input (or saved email)
 * - Stripe: Connect account display (onboarding placeholder)
 * - Calls wallet-withdraw edge function
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Modal,
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
import { formatCents, savePayoutMethod, withdrawWallet } from '@/lib/wallet/api';

function hapticMedium() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

function hapticSuccess() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

function hapticError() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}

const MIN_WITHDRAWAL = 500; // $5 minimum withdrawal

type PayoutMethod = 'paypal' | 'stripe';

interface WithdrawModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function WithdrawModal({ visible, onClose, onSuccess }: WithdrawModalProps) {
  const insets = useSafeAreaInsets();
  const { walletState, refreshProfile } = useAuth();
  
  const [method, setMethod] = useState<PayoutMethod>('paypal');
  const [amountText, setAmountText] = useState('');
  const [paypalEmail, setPaypalEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);

  // Pre-fill saved payout methods
  useEffect(() => {
    if (visible) {
      // Pre-fill PayPal email if saved
      if (walletState.paypalPayoutEmail) {
        setPaypalEmail(walletState.paypalPayoutEmail);
      }
      // Pre-fill amount with max balance
      if (walletState.balanceCents > 0) {
        setAmountText((walletState.balanceCents / 100).toFixed(2));
      }
      // Default to saved method if available
      if (walletState.stripeConnectAccountId && !walletState.paypalPayoutEmail) {
        setMethod('stripe');
      }
    }
  }, [visible, walletState]);

  const amountCents = Math.round(parseFloat(amountText.replace(/[^0-9.]/g, '') || '0') * 100);
  const maxAmount = walletState.balanceCents;
  const isValidAmount = amountCents >= MIN_WITHDRAWAL && amountCents <= maxAmount;

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paypalEmail.trim());
  const hasStripeConnect = Boolean(walletState.stripeConnectAccountId);

  const canWithdraw =
    isValidAmount &&
    ((method === 'paypal' && isValidEmail) || (method === 'stripe' && hasStripeConnect));

  const handleMethodSwitch = (m: PayoutMethod) => {
    hapticMedium();
    setMethod(m);
    setError(null);
  };

  const handleMaxAmount = () => {
    hapticMedium();
    setAmountText((maxAmount / 100).toFixed(2));
    setError(null);
    Keyboard.dismiss();
  };

  const handleWithdraw = useCallback(async () => {
    if (!canWithdraw || loading) return;

    hapticMedium();
    setLoading(true);
    setError(null);

    try {
      // If using PayPal and email is different from saved, save it first
      if (method === 'paypal' && paypalEmail.trim() !== walletState.paypalPayoutEmail) {
        setSavingEmail(true);
        await savePayoutMethod('paypal', paypalEmail.trim());
        setSavingEmail(false);
      }

      const destination =
        method === 'paypal'
          ? paypalEmail.trim()
          : walletState.stripeConnectAccountId!;

      const result = await withdrawWallet({
        amountCents,
        method,
        destination,
      });

      if (result.success) {
        hapticSuccess();
        setSuccess(true);
        await refreshProfile();
        setTimeout(() => {
          onSuccess();
          // Reset state after close
          setAmountText('');
          setSuccess(false);
          setError(null);
        }, 1500);
      } else {
        setError(result.message);
        hapticError();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Withdrawal failed');
      hapticError();
    } finally {
      setLoading(false);
      setSavingEmail(false);
    }
  }, [
    amountCents,
    canWithdraw,
    loading,
    method,
    onSuccess,
    paypalEmail,
    refreshProfile,
    walletState.paypalPayoutEmail,
    walletState.stripeConnectAccountId,
  ]);

  const handleClose = () => {
    if (loading) return;
    setAmountText('');
    setError(null);
    setSuccess(false);
    onClose();
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
              <Text style={styles.title}>Withdraw Funds</Text>
              <Text style={styles.subtitle}>
                Available: {formatCents(walletState.balanceCents)}
              </Text>
            </View>

            {success ? (
              <Animated.View entering={FadeIn.duration(300)} style={styles.successBox}>
                <Text style={styles.successEmoji}>✓</Text>
                <Text style={styles.successText}>
                  Withdrew {formatCents(amountCents)}!
                </Text>
                <Text style={styles.successSubtext}>
                  {method === 'paypal'
                    ? `Sent to ${paypalEmail}`
                    : 'Transferred to your bank'}
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
                      maxLength={10}
                      autoFocus
                    />
                  </View>
                  <Pressable onPress={handleMaxAmount} style={styles.maxBtn}>
                    <Text style={styles.hint}>
                      Min {formatCents(MIN_WITHDRAWAL)} •{' '}
                      <Text style={styles.maxLink}>Max {formatCents(maxAmount)}</Text>
                    </Text>
                  </Pressable>
                </Animated.View>

                {/* Method Toggle */}
                <Animated.View entering={FadeInDown.delay(100).duration(300)} style={styles.methodSection}>
                  <Text style={styles.sectionLabel}>Withdraw to</Text>
                  <View style={styles.methodToggle}>
                    <Pressable
                      style={[
                        styles.methodBtn,
                        method === 'paypal' && styles.methodBtnActive,
                      ]}
                      onPress={() => handleMethodSwitch('paypal')}
                    >
                    <Ionicons
                      name="logo-paypal"
                      size={20}
                      color={method === 'paypal' ? Colors.accent : Colors.textSecondary}
                    />
                      <Text
                        style={[
                          styles.methodText,
                          method === 'paypal' && styles.methodTextActive,
                        ]}
                      >
                        PayPal
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.methodBtn,
                        method === 'stripe' && styles.methodBtnActive,
                      ]}
                      onPress={() => handleMethodSwitch('stripe')}
                    >
                    <Ionicons
                      name="card-outline"
                      size={20}
                      color={method === 'stripe' ? Colors.accent : Colors.textSecondary}
                    />
                      <Text
                        style={[
                          styles.methodText,
                          method === 'stripe' && styles.methodTextActive,
                        ]}
                      >
                        Bank
                      </Text>
                    </Pressable>
                  </View>
                </Animated.View>

                {/* PayPal Email Input */}
                {method === 'paypal' && (
                  <Animated.View entering={FadeIn.duration(200)} style={styles.destinationSection}>
                    <Text style={styles.sectionLabel}>PayPal Email</Text>
                    <View style={styles.emailInputWrapper}>
                      <Ionicons
                        name="mail-outline"
                        size={20}
                        color={Colors.textMuted}
                        style={styles.emailIcon}
                      />
                      <TextInput
                        style={styles.emailInput}
                        value={paypalEmail}
                        onChangeText={(t) => {
                          setPaypalEmail(t);
                          setError(null);
                        }}
                        placeholder="your@email.com"
                        placeholderTextColor={Colors.textMuted}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      {walletState.paypalPayoutEmail &&
                        paypalEmail === walletState.paypalPayoutEmail && (
                          <View style={styles.savedBadge}>
                            <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                            <Text style={styles.savedText}>Saved</Text>
                          </View>
                        )}
                    </View>
                  </Animated.View>
                )}

                {/* Stripe Connect Status */}
                {method === 'stripe' && (
                  <Animated.View entering={FadeIn.duration(200)} style={styles.destinationSection}>
                    {hasStripeConnect ? (
                      <View style={styles.stripeConnected}>
                        <View style={styles.stripeRow}>
                          <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
                          <View style={styles.stripeInfo}>
                            <Text style={styles.stripeLabel}>Bank Account Connected</Text>
                            <Text style={styles.stripeHint}>
                              Account: •••• {walletState.stripeConnectAccountId?.slice(-4)}
                            </Text>
                          </View>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.stripeSetup}>
                        <Ionicons
                          name="information-circle-outline"
                          size={24}
                          color={Colors.warning}
                        />
                        <View style={styles.stripeSetupInfo}>
                          <Text style={styles.stripeSetupLabel}>Bank Transfers Not Available</Text>
                          <Text style={styles.stripeSetupHint}>
                            Direct bank payouts require additional verification. For instant withdrawals, use PayPal instead – it&apos;s free and funds arrive in minutes!
                          </Text>
                        </View>
                      </View>
                    )}
                  </Animated.View>
                )}

                {/* Error */}
                {error && (
                  <Animated.View entering={FadeIn.duration(200)} style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </Animated.View>
                )}

                {/* Withdraw Button */}
                <Animated.View entering={FadeInDown.delay(200).duration(300)}>
                  <Pressable
                    disabled={!canWithdraw || loading}
                    onPress={handleWithdraw}
                    style={({ pressed }) => [
                      styles.withdrawBtn,
                      pressed && styles.pressed,
                      !canWithdraw && styles.disabled,
                    ]}
                  >
                    <LinearGradient
                      colors={[Colors.accent, '#0B7BC4']}
                      style={styles.btnGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      {loading ? (
                        <View style={styles.loadingRow}>
                          <ActivityIndicator color={Colors.text} />
                          <Text style={styles.btnTextLoading}>
                            {savingEmail ? 'Saving...' : 'Processing...'}
                          </Text>
                        </View>
                      ) : (
                        <Text style={styles.btnText}>
                          {!isValidAmount
                            ? 'Enter valid amount'
                            : method === 'paypal' && !isValidEmail
                            ? 'Enter PayPal email'
                            : method === 'stripe' && !hasStripeConnect
                            ? 'Bank not connected'
                            : `Withdraw ${formatCents(amountCents)}`}
                        </Text>
                      )}
                    </LinearGradient>
                  </Pressable>
                </Animated.View>

                {/* Fee Notice */}
                <Animated.View entering={FadeInDown.delay(250).duration(300)}>
                  <Text style={styles.feeNotice}>
                    No withdrawal fees. Funds typically arrive in 1-3 business days.
                  </Text>
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
    ...Typography.body,
    color: Colors.success,
    fontWeight: '600',
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
  maxBtn: {
    paddingVertical: Spacing.xs,
  },
  hint: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  maxLink: {
    color: Colors.accent,
    textDecorationLine: 'underline',
  },

  // Method Toggle
  methodSection: {
    gap: Spacing.sm,
  },
  sectionLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  methodToggle: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  methodBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  methodBtnActive: {
    backgroundColor: Colors.accentDim,
    borderColor: Colors.accent,
  },
  methodText: {
    ...Typography.bodySemibold,
    color: Colors.textSecondary,
  },
  methodTextActive: {
    color: Colors.accent,
  },

  // Destination inputs
  destinationSection: {
    gap: Spacing.sm,
  },
  emailInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
  },
  emailIcon: {
    marginRight: Spacing.sm,
  },
  emailInput: {
    flex: 1,
    ...Typography.body,
    color: Colors.text,
    paddingVertical: Spacing.md,
  },
  savedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.successDim,
    borderRadius: Radius.sm,
  },
  savedText: {
    ...Typography.caption,
    color: Colors.success,
  },

  // Stripe Connect
  stripeConnected: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  stripeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  stripeInfo: {
    flex: 1,
    gap: 2,
  },
  stripeLabel: {
    ...Typography.bodySemibold,
    color: Colors.text,
  },
  stripeHint: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  stripeSetup: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    backgroundColor: Colors.warningDim,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  stripeSetupInfo: {
    flex: 1,
    gap: 2,
  },
  stripeSetupLabel: {
    ...Typography.bodySemibold,
    color: Colors.warning,
  },
  stripeSetupHint: {
    ...Typography.caption,
    color: Colors.textSecondary,
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
  successSubtext: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },

  // Button
  withdrawBtn: {
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
  btnTextLoading: {
    ...Typography.body,
    color: Colors.text,
    marginLeft: Spacing.sm,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.5,
  },

  // Fee notice
  feeNotice: {
    ...Typography.caption,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});

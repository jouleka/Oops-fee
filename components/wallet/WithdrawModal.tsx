/**
 * WithdrawModal
 * Withdraw funds from wallet to debit card or PayPal.
 *
 * Features:
 * - Amount input (up to current balance)
 * - Toggle: Debit Card (instant) or PayPal
 * - Debit: instant payout to saved or new card (1.5% fee)
 * - PayPal: email input (or saved email)
 * - Calls payout-to-card or wallet-withdraw edge functions
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
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/auth';
import { CardField, createCardTokenFromField, isStripeConfigured } from '@/lib/stripe';
import { formatCents, payoutToCard, savePayoutMethod, withdrawWallet } from '@/lib/wallet/api';

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
const DEBIT_FEE_PERCENT = 1.5; // 1.5% fee for instant debit card payouts

type PayoutMethod = 'paypal' | 'debit';

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
  // Debit card - use saved card or enter new one via CardField
  const [useSavedCard, setUseSavedCard] = useState(true);
  const [cardComplete, setCardComplete] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [successCardLast4, setSuccessCardLast4] = useState<string | null>(null);

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
      // Default to best available method (debit > paypal)
      if (walletState.payoutCard) {
        setMethod('debit');
        setUseSavedCard(true);
      }
    }
  }, [visible, walletState]);

  const amountCents = Math.round(parseFloat(amountText.replace(/[^0-9.]/g, '') || '0') * 100);
  const maxAmount = walletState.balanceCents;
  const isValidAmount = amountCents >= MIN_WITHDRAWAL && amountCents <= maxAmount;

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paypalEmail.trim());
  const hasSavedCard = Boolean(walletState.payoutCard);
  
  // Validate card - either using saved card or CardField is complete
  const isValidCard = (useSavedCard && hasSavedCard) || cardComplete;
  
  // Calculate fee for debit card payout
  const debitFeeAmount = Math.round(amountCents * (DEBIT_FEE_PERCENT / 100));
  const debitNetAmount = amountCents - debitFeeAmount;

  const canWithdraw =
    isValidAmount &&
    ((method === 'paypal' && isValidEmail) || 
     (method === 'debit' && isValidCard));

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
      // Handle debit card payout
      if (method === 'debit') {
        let cardToken: string | undefined;

        // If not using saved card, tokenize the new card first
        if (!(useSavedCard && hasSavedCard)) {
          if (!isStripeConfigured()) {
            setError('Payments require the mobile app');
            hapticError();
            setLoading(false);
            return;
          }

          // CardField component handles card details - create token from it
          const tokenResult = await createCardTokenFromField();

          if (!tokenResult.success || !tokenResult.tokenId) {
            setError(tokenResult.error || 'Failed to process card');
            hapticError();
            setLoading(false);
            return;
          }

          cardToken = tokenResult.tokenId;
        }

        const result = await payoutToCard({
          amountCents,
          useSavedCard: useSavedCard && hasSavedCard,
          cardToken,
        });

        if (result.success) {
          hapticSuccess();
          setSuccess(true);
          setSuccessCardLast4(result.cardLast4 ?? null);
          await refreshProfile();
          setTimeout(() => {
            onSuccess();
            // Reset state after close
            resetForm();
          }, 1500);
        } else {
          setError(result.message);
          hapticError();
        }
        return;
      }

      // PayPal withdrawal - save email if different from saved
      if (paypalEmail.trim() !== walletState.paypalPayoutEmail) {
        setSavingEmail(true);
        await savePayoutMethod('paypal', paypalEmail.trim());
        setSavingEmail(false);
      }

      const result = await withdrawWallet({
        amountCents,
        method: 'paypal',
        destination: paypalEmail.trim(),
      });

      if (result.success) {
        hapticSuccess();
        setSuccess(true);
        await refreshProfile();
        setTimeout(() => {
          onSuccess();
          // Reset state after close
          resetForm();
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
    hasSavedCard,
    loading,
    method,
    onSuccess,
    paypalEmail,
    refreshProfile,
    useSavedCard,
    walletState.paypalPayoutEmail,
  ]);

  const resetForm = () => {
    setAmountText('');
    setSuccess(false);
    setError(null);
    setCardComplete(false);
    setUseSavedCard(true);
    setSuccessCardLast4(null);
  };

  const handleClose = () => {
    if (loading) return;
    resetForm();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View className="flex-1 bg-black/60 justify-end">
        <Pressable className="flex-1" onPress={handleClose} />

        <Animated.View className="bg-abyss-800 rounded-t-xxl">
          {/* Handle */}
          <View className="items-center pt-md pb-sm">
            <View className="w-10 h-1 rounded-sm bg-system-gray-4" />
          </View>

          <View className="px-xl gap-lg" style={{ paddingBottom: Math.max(insets.bottom, 20) }}>
            {/* Header */}
            <View className="items-center gap-1">
              <Text className="text-h3 text-white font-rounded">Withdraw Funds</Text>
              <Text className="text-body text-success font-semibold">
                Available: {formatCents(walletState.balanceCents)}
              </Text>
            </View>

            {success ? (
              <Animated.View entering={FadeIn.duration(300)} className="items-center gap-md py-xxl">
                <Text className="text-5xl text-success">✓</Text>
                <Text className="text-h3 text-success font-rounded">
                  {method === 'debit' ? `Sent ${formatCents(debitNetAmount)}!` : `Withdrew ${formatCents(amountCents)}!`}
                </Text>
                <Text className="text-caption text-text-secondary">
                  {method === 'paypal'
                    ? `Sent to ${paypalEmail}`
                    : `Instant transfer to card •••• ${successCardLast4 ?? ''}`}
                </Text>
              </Animated.View>
            ) : (
              <>
                {/* Amount Input */}
                <Animated.View entering={FadeInDown.delay(50).duration(300)} className="items-center gap-sm">
                  <View className="flex-row items-center justify-center">
                    <Text className="text-display-md text-text-muted mr-xs">$</Text>
                    <TextInput
                      className="text-display-md text-white min-w-[100px] text-center p-0"
                      value={amountText}
                      onChangeText={(t) => {
                        setAmountText(t);
                        setError(null);
                      }}
                      placeholder="0"
                      placeholderTextColor="rgba(255, 255, 255, 0.30)"
                      keyboardType="decimal-pad"
                      maxLength={10}
                      autoFocus
                    />
                  </View>
                  <Pressable onPress={handleMaxAmount} className="py-xs">
                    <Text className="text-caption text-text-muted">
                      Min {formatCents(MIN_WITHDRAWAL)} •{' '}
                      <Text className="text-imessage underline">Max {formatCents(maxAmount)}</Text>
                    </Text>
                  </Pressable>
                </Animated.View>

                {/* Method Toggle */}
                <Animated.View entering={FadeInDown.delay(100).duration(300)} className="gap-sm">
                  <Text className="text-caption text-text-secondary uppercase tracking-wide">Withdraw to</Text>
                  <View className="flex-row gap-sm">
                    <Pressable
                      className={`flex-1 py-md px-sm rounded-lg border gap-1.5 ${
                        method === 'debit'
                          ? 'bg-imessage-dim border-imessage'
                          : 'bg-card border-border'
                      }`}
                      onPress={() => handleMethodSwitch('debit')}
                    >
                      <View className="flex-row items-center justify-center gap-1">
                        <Ionicons
                          name="flash"
                          size={18}
                          color={method === 'debit' ? '#0B93F6' : 'rgba(255, 255, 255, 0.70)'}
                        />
                        <Text
                          className={`text-caption font-semibold ${
                            method === 'debit' ? 'text-imessage' : 'text-text-secondary'
                          }`}
                        >
                          Debit
                        </Text>
                      </View>
                      <View className="self-center bg-success-dim px-1.5 py-0.5 rounded">
                        <Text className="text-caption text-[10px] text-success font-bold">Instant</Text>
                      </View>
                    </Pressable>
                    <Pressable
                      className={`flex-1 flex-row items-center justify-center py-md px-sm gap-sm rounded-lg border ${
                        method === 'paypal'
                          ? 'bg-imessage-dim border-imessage'
                          : 'bg-card border-border'
                      }`}
                      onPress={() => handleMethodSwitch('paypal')}
                    >
                      <Ionicons
                        name="logo-paypal"
                        size={18}
                        color={method === 'paypal' ? '#0B93F6' : 'rgba(255, 255, 255, 0.70)'}
                      />
                      <Text
                        className={`text-caption font-semibold ${
                          method === 'paypal' ? 'text-imessage' : 'text-text-secondary'
                        }`}
                      >
                        PayPal
                      </Text>
                    </Pressable>
                  </View>
                </Animated.View>

                {/* PayPal Email Input */}
                {method === 'paypal' && (
                  <Animated.View entering={FadeIn.duration(200)} className="gap-sm">
                    <Text className="text-caption text-text-secondary uppercase tracking-wide">PayPal Email</Text>
                    <View className="flex-row items-center bg-card rounded-lg border border-border px-md">
                      <Ionicons
                        name="mail-outline"
                        size={20}
                        color="rgba(255, 255, 255, 0.30)"
                        style={{ marginRight: 8 }}
                      />
                      <TextInput
                        className="flex-1 text-body text-white py-md"
                        value={paypalEmail}
                        onChangeText={(t) => {
                          setPaypalEmail(t);
                          setError(null);
                        }}
                        placeholder="your@email.com"
                        placeholderTextColor="rgba(255, 255, 255, 0.30)"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      {walletState.paypalPayoutEmail &&
                        paypalEmail === walletState.paypalPayoutEmail && (
                          <View className="flex-row items-center gap-1 px-sm py-xs bg-success-dim rounded-sm">
                            <Ionicons name="checkmark-circle" size={14} color="#34C759" />
                            <Text className="text-caption text-success">Saved</Text>
                          </View>
                        )}
                    </View>
                  </Animated.View>
                )}

                {/* Debit Card Input */}
                {method === 'debit' && (
                  <Animated.View entering={FadeIn.duration(200)} className="gap-sm">
                    {/* Saved Card Option */}
                    {hasSavedCard && (
                      <Pressable
                        className={`flex-row items-center rounded-lg border p-md mb-sm ${
                          useSavedCard
                            ? 'bg-imessage-dim border-imessage'
                            : 'bg-card border-border'
                        }`}
                        onPress={() => {
                          hapticMedium();
                          setUseSavedCard(true);
                          setError(null);
                        }}
                      >
                        <View className="flex-row items-center flex-1">
                          <Ionicons
                            name={useSavedCard ? 'radio-button-on' : 'radio-button-off'}
                            size={20}
                            color={useSavedCard ? '#0B93F6' : 'rgba(255, 255, 255, 0.70)'}
                          />
                          <Ionicons
                            name="card"
                            size={24}
                            color="#0B93F6"
                            style={{ marginLeft: 8 }}
                          />
                          <View className="ml-md flex-1">
                            <Text className="text-body-semibold text-white">
                              {walletState.payoutCard?.brand?.toUpperCase()} •••• {walletState.payoutCard?.last4}
                            </Text>
                            <Text className="text-caption text-text-muted">Saved card</Text>
                          </View>
                        </View>
                      </Pressable>
                    )}

                    {/* New Card Option */}
                    <Pressable
                      className={`rounded-lg border p-md ${
                        !hasSavedCard || !useSavedCard ? 'border-imessage' : 'bg-card border-border'
                      }`}
                      onPress={() => {
                        hapticMedium();
                        setUseSavedCard(false);
                        setError(null);
                      }}
                    >
                      <View className="flex-row items-center">
                        {hasSavedCard && (
                          <Ionicons
                            name={!useSavedCard ? 'radio-button-on' : 'radio-button-off'}
                            size={20}
                            color={!useSavedCard ? '#0B93F6' : 'rgba(255, 255, 255, 0.70)'}
                            style={{ marginRight: 8 }}
                          />
                        )}
                        <Text className="text-caption text-text-secondary uppercase tracking-wide">
                          {hasSavedCard ? 'Use a different card' : 'Debit Card'}
                        </Text>
                      </View>

                      {(!hasSavedCard || !useSavedCard) && (
                        <View className="mt-md">
                          {/* Stripe CardField - single line, no country/postal */}
                          {CardField ? (
                            <CardField
                              postalCodeEnabled={false}
                              cardStyle={{
                                backgroundColor: '#1C1C1E',
                                textColor: '#FFFFFF',
                                placeholderColor: '#8E8E93',
                                fontSize: 17,
                                borderRadius: 10,
                                borderWidth: 1,
                                borderColor: '#3A3A3C',
                                cursorColor: '#007AFF',
                              }}
                              style={{ width: '100%', height: 54, backgroundColor: '#1C1C1E', borderRadius: 10 }}
                              onCardChange={(cardDetails: { complete: boolean }) => {
                                setCardComplete(cardDetails.complete);
                                if (cardDetails.complete) {
                                  setError(null);
                                }
                              }}
                            />
                          ) : (
                            <View className="h-14 bg-abyss-800 rounded-md justify-center items-center">
                              <Text className="text-caption text-text-muted">
                                Card input requires mobile app
                              </Text>
                            </View>
                          )}
                          <Text className="text-caption text-text-muted text-center mt-xs">
                            Card number • MM/YY • CVC
                          </Text>
                        </View>
                      )}
                    </Pressable>

                    {/* Debit card notice */}
                    <View className="flex-row items-center gap-xs pt-xs">
                      <Ionicons name="information-circle" size={16} color="rgba(255, 255, 255, 0.30)" />
                      <Text className="text-caption text-text-muted flex-1">
                        Only Visa/Mastercard debit cards eligible for instant payout
                      </Text>
                    </View>

                    {/* Fee breakdown */}
                    {isValidAmount && (
                      <View className="bg-card rounded-md p-md mt-sm">
                        <View className="flex-row justify-between items-center py-1">
                          <Text className="text-caption text-text-secondary">Amount</Text>
                          <Text className="text-caption text-text-secondary">{formatCents(amountCents)}</Text>
                        </View>
                        <View className="flex-row justify-between items-center py-1">
                          <Text className="text-caption text-text-secondary">Instant transfer fee (1.5%)</Text>
                          <Text className="text-caption text-text-secondary">-{formatCents(debitFeeAmount)}</Text>
                        </View>
                        <View className="flex-row justify-between items-center border-t border-border mt-xs pt-sm">
                          <Text className="text-body-semibold text-white">You receive</Text>
                          <Text className="text-body-semibold text-success">{formatCents(debitNetAmount)}</Text>
                        </View>
                      </View>
                    )}
                  </Animated.View>
                )}

                {/* Error */}
                {error && (
                  <Animated.View entering={FadeIn.duration(200)} className="bg-danger-dim rounded-md p-md">
                    <Text className="text-caption text-danger text-center">{error}</Text>
                  </Animated.View>
                )}

                {/* Withdraw Button */}
                <Animated.View entering={FadeInDown.delay(200).duration(300)}>
                  <Pressable
                    disabled={!canWithdraw || loading}
                    onPress={handleWithdraw}
                    className={`h-14 rounded-full overflow-hidden shadow-lg active:opacity-90 active:scale-[0.98] ${
                      !canWithdraw ? 'opacity-50' : ''
                    }`}
                  >
                    <LinearGradient
                      colors={['#0B93F6', '#0B7BC4']}
                      className="flex-1 items-center justify-center"
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      {loading ? (
                        <View className="flex-row items-center justify-center">
                          <ActivityIndicator color="#FFFFFF" />
                          <Text className="text-body text-white ml-sm">
                            {savingEmail ? 'Saving...' : 'Processing...'}
                          </Text>
                        </View>
                      ) : (
                        <Text className="text-body-semibold text-white font-rounded">
                          {!isValidAmount
                            ? 'Enter valid amount'
                            : method === 'paypal' && !isValidEmail
                            ? 'Enter PayPal email'
                            : method === 'debit' && !isValidCard
                            ? 'Enter card details'
                            : method === 'debit'
                            ? `Send ${formatCents(debitNetAmount)} Instantly`
                            : `Withdraw ${formatCents(amountCents)}`}
                        </Text>
                      )}
                    </LinearGradient>
                  </Pressable>
                </Animated.View>

                {/* Fee Notice */}
                <Animated.View entering={FadeInDown.delay(250).duration(300)}>
                  <Text className="text-caption text-text-muted text-center">
                    {method === 'debit'
                      ? '⚡ Funds arrive in seconds. 1.5% instant transfer fee.'
                      : 'No withdrawal fees. Funds typically arrive in 1-3 business days.'}
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

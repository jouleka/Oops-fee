/**
 * TopUpModal
 * Add funds to wallet.
 *
 * Features:
 * - Amount input with min ($5) / max ($500)
 * - Quick preset buttons ($25, $50, $100)
 * - If user has saved card → charges it directly (one tap)
 * - If no card or charge fails → shows PaymentSheet
 */

import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/auth";
import { isStripeConfigured, presentTopUpSheet } from "@/lib/stripe";
import {
  confirmTopUp,
  createTopUpIntent,
  formatCents,
  topUpWallet,
} from "@/lib/wallet/api";

function hapticMedium() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

function hapticSuccess() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
    () => {},
  );
}

function hapticError() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
    () => {},
  );
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
  const { refreshProfile, paymentState } = useAuth();
  const [amountText, setAmountText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const amountCents = Math.round(
    parseFloat(amountText.replace(/[^0-9.]/g, "") || "0") * 100,
  );
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
      // If user has a saved card, charge it directly (no PaymentSheet)
      if (paymentState.hasPaymentMethod) {
        const result = await topUpWallet(amountCents);

        if (result.success) {
          hapticSuccess();
          setSuccess(true);
          await refreshProfile();
          setTimeout(() => {
            onSuccess();
            setAmountText("");
            setSuccess(false);
          }, 1500);
          return;
        }

        // Check if card needs 3DS authentication
        if (result.requiresAction && result.clientSecret) {
          // TODO: Handle SCA if needed
          setError(
            "Your bank requires additional verification. Please try again.",
          );
          hapticError();
          setLoading(false);
          return;
        }

        // Card failed - show error but don't fall back to PaymentSheet
        // User can go to profile to update their card
        setError(
          result.message ||
            "Payment failed. Try updating your card in Profile.",
        );
        hapticError();
        setLoading(false);
        return;
      }

      // No saved card - show PaymentSheet to add one
      if (!isStripeConfigured()) {
        setError("Payments require the mobile app");
        hapticError();
        setLoading(false);
        return;
      }

      const setupResult = await createTopUpIntent(amountCents);

      if (
        !setupResult.success ||
        !setupResult.clientSecret ||
        !setupResult.customerId ||
        !setupResult.ephemeralKey
      ) {
        setError(setupResult.message || "Failed to initialize payment");
        hapticError();
        setLoading(false);
        return;
      }

      const sheetResult = await presentTopUpSheet(
        setupResult.clientSecret,
        setupResult.customerId,
        setupResult.ephemeralKey,
      );

      if (sheetResult.cancelled) {
        setLoading(false);
        return;
      }

      if (!sheetResult.success) {
        setError(sheetResult.error || "Payment failed");
        hapticError();
        setLoading(false);
        return;
      }

      // Confirm the top-up (credit wallet)
      const confirmResult = await confirmTopUp(setupResult.paymentIntentId!);

      if (confirmResult.success) {
        hapticSuccess();
        setSuccess(true);
        await refreshProfile();
        setTimeout(() => {
          onSuccess();
          setAmountText("");
          setSuccess(false);
        }, 1500);
      } else {
        setError(
          confirmResult.message ||
            "Payment succeeded but wallet credit failed. Contact support.",
        );
        hapticError();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Top-up failed");
      hapticError();
    } finally {
      setLoading(false);
    }
  }, [
    amountCents,
    isValidAmount,
    loading,
    onSuccess,
    refreshProfile,
    paymentState.hasPaymentMethod,
  ]);

  const handleClose = () => {
    if (loading) return;
    setAmountText("");
    setError(null);
    setSuccess(false);
    onClose();
  };

  const getPaymentLabel = () => {
    // If user has a saved card, show that
    if (paymentState.hasPaymentMethod) {
      const brandName = paymentState.brand
        ? paymentState.brand.charAt(0).toUpperCase() +
          paymentState.brand.slice(1)
        : "Card";
      return paymentState.last4
        ? `${brandName} •••• ${paymentState.last4}`
        : brandName;
    }
    // No saved card - will show PaymentSheet
    if (Platform.OS === "ios") {
      return "Apple Pay or Card";
    }
    if (Platform.OS === "android") {
      return "Google Pay or Card";
    }
    return "Card";
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View className="flex-1 bg-black/60 justify-end">
        <Pressable className="flex-1" onPress={handleClose} />

        <Animated.View className="bg-abyss-800 rounded-t-xxl">
          {/* Handle */}
          <View className="items-center pt-md pb-sm">
            <View className="w-10 h-1 rounded-sm bg-system-gray-4" />
          </View>

          <View
            className="px-xl gap-lg"
            style={{ paddingBottom: Math.max(insets.bottom, 20) }}
          >
            {/* Header */}
            <View className="items-center gap-1">
              <Text className="text-h3 text-white font-rounded">Add Funds</Text>
              <Text className="text-caption text-text-tertiary text-center">
                {paymentState.hasPaymentMethod
                  ? "Charges your saved payment method."
                  : "Add a card to top up your wallet."}
              </Text>
            </View>

            {success ? (
              <Animated.View
                entering={FadeIn.duration(300)}
                className="items-center gap-md py-xxl"
              >
                <Text className="text-5xl text-success">✓</Text>
                <Text className="text-h3 text-success font-rounded">
                  Added {formatCents(amountCents)} to wallet!
                </Text>
              </Animated.View>
            ) : (
              <>
                {/* Amount Input */}
                <Animated.View
                  entering={FadeInDown.delay(50).duration(300)}
                  className="items-center gap-sm"
                >
                  <View className="flex-row items-center justify-center">
                    <Text className="text-display-md text-text-muted mr-xs">
                      $
                    </Text>
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
                      maxLength={6}
                      autoFocus
                    />
                  </View>
                  <Text className="text-caption text-text-muted">
                    Min {formatCents(MIN_AMOUNT)} • Max{" "}
                    {formatCents(MAX_AMOUNT)}
                  </Text>
                </Animated.View>

                {/* Presets */}
                <Animated.View
                  entering={FadeInDown.delay(100).duration(300)}
                  className="flex-row gap-sm"
                >
                  {PRESETS.map((cents) => (
                    <Pressable
                      key={cents}
                      className={`flex-1 items-center justify-center py-md rounded-lg border ${
                        amountCents === cents
                          ? "bg-success-dim border-success"
                          : "bg-card border-border"
                      } active:opacity-90 active:scale-[0.98]`}
                      onPress={() => handlePreset(cents)}
                    >
                      <Text
                        className={`text-body-semibold ${
                          amountCents === cents
                            ? "text-success"
                            : "text-text-secondary"
                        }`}
                      >
                        {formatCents(cents)}
                      </Text>
                    </Pressable>
                  ))}
                </Animated.View>

                {/* Payment Method */}
                <Animated.View
                  entering={FadeInDown.delay(150).duration(300)}
                  className="flex-row justify-between items-center bg-card rounded-lg border border-border px-lg py-md"
                >
                  <Text className="text-body text-text-secondary">
                    Charging
                  </Text>
                  <Text className="text-body text-white">
                    {getPaymentLabel()}
                  </Text>
                </Animated.View>

                {/* Error */}
                {error && (
                  <Animated.View
                    entering={FadeIn.duration(200)}
                    className="bg-danger-dim rounded-md p-md"
                  >
                    <Text className="text-caption text-danger text-center">
                      {error}
                    </Text>
                  </Animated.View>
                )}

                {/* Add Button */}
                <Animated.View entering={FadeInDown.delay(200).duration(300)}>
                  <Pressable
                    disabled={!isValidAmount || loading}
                    onPress={handleTopUp}
                    className={`h-14 rounded-full overflow-hidden shadow-lg active:opacity-90 active:scale-[0.98] ${
                      !isValidAmount ? "opacity-50" : ""
                    }`}
                  >
                    <LinearGradient
                      colors={["#34C759", "#28A745"]}
                      style={{
                        flex: 1,
                        alignItems: "center",
                        justifyContent: "center",
                        paddingHorizontal: 24,
                      }}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      {loading ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text className="text-body-semibold text-white font-rounded">
                          Add{" "}
                          {isValidAmount ? formatCents(amountCents) : "Funds"}
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

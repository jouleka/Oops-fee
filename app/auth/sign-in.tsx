/**
 * Sign-In Screen
 * Same vibe as the rest of the app - dark, snarky, premium.
 */

import * as AppleAuthentication from "expo-apple-authentication";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  Layout,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppleAuthAvailable, useAuth } from "@/context/auth";

type SignInStep = "initial" | "email-input" | "email-verify";

function hapticLight() {
  Haptics.selectionAsync().catch(() => {});
}

function hapticMedium() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

export default function SignInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    signInWithApple,
    signInWithGoogle,
    sendEmailOtp,
    verifyEmailOtp,
    isAuthenticated,
  } = useAuth();
  const appleAuthAvailable = useAppleAuthAvailable();

  const [step, setStep] = useState<SignInStep>("initial");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Navigate back on successful auth
  useEffect(() => {
    if (isAuthenticated) {
      router.back();
    }
  }, [isAuthenticated, router]);

  const handleAppleSignIn = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    hapticMedium();
    try {
      await signInWithApple();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err.message || "Apple Sign-In failed");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  }, [signInWithApple]);

  const handleGoogleSignIn = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    hapticMedium();
    try {
      await signInWithGoogle();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err.message || "Google Sign-In failed");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  }, [signInWithGoogle]);

  // Email OTP handlers
  const handleSendEmailOtp = useCallback(async () => {
    if (!email.trim()) {
      setError("Enter your email. We need somewhere to send the magic.");
      return;
    }

    // Basic email validation
    if (!email.includes("@") || !email.includes(".")) {
      setError("That doesn't look like an email. Try again.");
      return;
    }

    setIsLoading(true);
    setError(null);
    hapticMedium();
    const result = await sendEmailOtp(email.trim().toLowerCase());

    if (result.error) {
      setError(result.error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else {
      setStep("email-verify");
    }
    setIsLoading(false);
  }, [email, sendEmailOtp]);

  const handleVerifyEmailOtp = useCallback(async () => {
    if (otpCode.length < 6) {
      setError("Enter the full code from your email.");
      return;
    }

    setIsLoading(true);
    setError(null);
    hapticMedium();
    const result = await verifyEmailOtp(email.trim().toLowerCase(), otpCode);

    if (result.error) {
      setError(result.error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setIsLoading(false);
  }, [email, otpCode, verifyEmailOtp]);

  const handleBack = useCallback(() => {
    hapticLight();
    if (step === "email-verify") {
      setStep("email-input");
      setOtpCode("");
    } else if (step === "email-input") {
      setStep("initial");
      setEmail("");
    } else {
      router.back();
    }
    setError(null);
  }, [step, router]);

  return (
    <View className="flex-1 bg-black">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: 24,
            gap: 24,
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 24,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View className="flex-row items-center">
            <Pressable
              onPress={handleBack}
              className="w-10 h-10 rounded-full bg-card items-center justify-center border border-border active:opacity-80"
            >
              <Text className="text-2xl text-text-secondary -mt-0.5">
                {step === "initial" ? "✕" : "‹"}
              </Text>
            </Pressable>
          </View>

          {/* Title Section */}
          <Animated.View entering={FadeInDown.duration(300)} className="gap-2">
            <Text className="text-display-sm text-white font-rounded">
              {step === "initial" && "Sign in"}
              {step === "email-input" && "Your email"}
              {step === "email-verify" && "Enter code"}
            </Text>
            <Text className="text-body text-text-secondary">
              {step === "initial" &&
                "To put actual money on your promises. No pressure."}
              {step === "email-input" &&
                "We'll email you a magic code. Check your inbox."}
              {step === "email-verify" &&
                `Sent to ${email}. Check your inbox (and spam).`}
            </Text>
          </Animated.View>

          {/* Error */}
          {error && (
            <Animated.View
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(150)}
              className="flex-row items-start gap-2 bg-danger-dim border border-danger/25 rounded-lg p-3"
            >
              <Text className="text-sm mt-0.5">⚠️</Text>
              <Text className="text-body text-danger flex-1">{error}</Text>
            </Animated.View>
          )}

          {/* Initial step - Social buttons */}
          {step === "initial" && (
            <Animated.View
              entering={FadeInDown.delay(100).duration(300)}
              className="gap-3"
            >
              <Text className="text-label text-text-muted ml-1 uppercase tracking-wider">
                QUICK OPTIONS
              </Text>
              <Text className="text-caption text-text-tertiary ml-1 -mt-2">
                One tap. No password to forget.
              </Text>

              <View className="gap-3">
                {/* Apple Sign-In */}
                {appleAuthAvailable && (
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={
                      AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
                    }
                    buttonStyle={
                      AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                    }
                    cornerRadius={16}
                    style={{ height: 54, width: "100%" }}
                    onPress={handleAppleSignIn}
                  />
                )}

                {/* Google Sign-In */}
                <Pressable
                  onPress={handleGoogleSignIn}
                  disabled={isLoading}
                  className={`flex-row items-center justify-center h-[54px] rounded-lg bg-white gap-2 active:opacity-90 active:scale-[0.99] ${isLoading ? "opacity-60" : ""}`}
                >
                  <Text className="text-xl font-bold text-black">G</Text>
                  <Text className="text-body-semibold text-black">
                    Continue with Google
                  </Text>
                </Pressable>
              </View>

              {/* Divider */}
              <View className="flex-row items-center my-4 gap-3">
                <View className="flex-1 h-px bg-border" />
                <Text className="text-caption text-text-muted">
                  or the old-fashioned way
                </Text>
                <View className="flex-1 h-px bg-border" />
              </View>

              {/* Email option */}
              <View className="gap-3">
                <Pressable
                  onPress={() => {
                    hapticLight();
                    setStep("email-input");
                  }}
                  disabled={isLoading}
                  className="flex-row items-center gap-3 bg-card rounded-xl border border-border p-4 active:bg-card-hover active:border-border-focus"
                >
                  <View className="w-10 h-10 rounded-full bg-abyss-800 border border-border-subtle items-center justify-center">
                    <Text className="text-lg">✉️</Text>
                  </View>
                  <View className="flex-1 gap-0.5">
                    <Text className="text-body-semibold text-white font-rounded">
                      Email
                    </Text>
                    <Text className="text-caption text-text-tertiary">
                      Magic link. No password needed.
                    </Text>
                  </View>
                  <Text className="text-2xl text-text-muted font-light">›</Text>
                </Pressable>
              </View>
            </Animated.View>
          )}

          {/* Email input step */}
          {step === "email-input" && (
            <Animated.View
              entering={FadeInDown.duration(300)}
              layout={Layout.springify()}
              className="gap-3"
            >
              <Text className="text-label text-text-muted ml-1 uppercase tracking-wider">
                EMAIL ADDRESS
              </Text>
              <Text className="text-caption text-text-tertiary ml-1 -mt-2">
                We&apos;ll send you a 6-digit code. No password needed.
              </Text>

              <View className="bg-card rounded-xl border border-border p-4">
                <TextInput
                  className="text-white text-center py-3 text-lg"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor="rgba(255, 255, 255, 0.30)"
                  keyboardType="email-address"
                  autoFocus
                  autoComplete="email"
                  autoCapitalize="none"
                  textContentType="emailAddress"
                />
              </View>

              <Pressable
                onPress={handleSendEmailOtp}
                disabled={isLoading || !email.trim()}
                className={`h-14 rounded-full overflow-hidden shadow-lg active:scale-[0.99] ${!email.trim() || isLoading ? "opacity-60" : ""}`}
              >
                <LinearGradient
                  colors={
                    !email.trim() || isLoading
                      ? ["#3A3A3C", "#2C2C2E"]
                      : ["#0B93F6", "#0A7FD4"]
                  }
                  style={{
                    flex: 1,
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: 24,
                  }}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text className="text-body-semibold text-white font-rounded">
                      Send code
                    </Text>
                  )}
                </LinearGradient>
              </Pressable>
            </Animated.View>
          )}

          {/* Email OTP verify step */}
          {step === "email-verify" && (
            <Animated.View
              entering={FadeInDown.duration(300)}
              layout={Layout.springify()}
              className="gap-3"
            >
              <Text className="text-label text-text-muted ml-1 uppercase tracking-wider">
                VERIFICATION CODE
              </Text>
              <Text className="text-caption text-text-tertiary ml-1 -mt-2">
                Check your inbox for the code.
              </Text>

              <View className="bg-card rounded-xl border border-border p-4">
                <TextInput
                  className="text-h2 text-white text-center tracking-widest py-3 font-mono"
                  value={otpCode}
                  onChangeText={(text) => setOtpCode(text.replace(/\D/g, ""))}
                  placeholder="00000000"
                  placeholderTextColor="rgba(255, 255, 255, 0.30)"
                  keyboardType="number-pad"
                  autoFocus
                  maxLength={8}
                  textContentType="oneTimeCode"
                />
              </View>

              <Pressable
                onPress={handleVerifyEmailOtp}
                disabled={isLoading || otpCode.length < 6}
                className={`h-14 rounded-full overflow-hidden shadow-lg active:scale-[0.99] ${otpCode.length < 6 || isLoading ? "opacity-60" : ""}`}
              >
                <LinearGradient
                  colors={
                    otpCode.length < 6 || isLoading
                      ? ["#3A3A3C", "#2C2C2E"]
                      : ["#0B93F6", "#0A7FD4"]
                  }
                  style={{
                    flex: 1,
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: 24,
                  }}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text className="text-body-semibold text-white font-rounded">
                      Verify
                    </Text>
                  )}
                </LinearGradient>
              </Pressable>

              <Pressable
                onPress={handleSendEmailOtp}
                disabled={isLoading}
                className="self-center py-3 px-4 active:opacity-80"
              >
                <Text className="text-body text-imessage">
                  Didn&apos;t get it? Resend code
                </Text>
              </Pressable>
            </Animated.View>
          )}

          {/* Footer */}
          <View className="mt-auto pt-6">
            <Text className="text-caption text-text-muted text-center leading-[18px]">
              By continuing, you agree to our Terms of Service and Privacy
              Policy.
              {"\n"}(The lawyers made us say that.)
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Loading overlay */}
      {isLoading && step === "initial" && (
        <View className="absolute inset-0 bg-black/70 justify-center items-center">
          <View className="bg-abyss-800 rounded-xl border border-border p-8 items-center gap-3">
            <ActivityIndicator size="large" color="#0B93F6" />
            <Text className="text-body text-text-secondary">
              Working on it...
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

/**
 * Sign-In Screen
 * Same vibe as the rest of the app - dark, snarky, premium.
 */

import * as AppleAuthentication from 'expo-apple-authentication';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  Layout,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useAppleAuthAvailable, useAuth } from '@/context/auth';

type SignInStep = 'initial' | 'email-input' | 'email-verify';

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

  const [step, setStep] = useState<SignInStep>('initial');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
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
      setError(err.message || 'Apple Sign-In failed');
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
      setError(err.message || 'Google Sign-In failed');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  }, [signInWithGoogle]);

  // Email OTP handlers
  const handleSendEmailOtp = useCallback(async () => {
    if (!email.trim()) {
      setError('Enter your email. We need somewhere to send the magic.');
      return;
    }

    // Basic email validation
    if (!email.includes('@') || !email.includes('.')) {
      setError('That doesn\'t look like an email. Try again.');
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
      setStep('email-verify');
    }
    setIsLoading(false);
  }, [email, sendEmailOtp]);

  const handleVerifyEmailOtp = useCallback(async () => {
    if (otpCode.length < 6) {
      setError('Enter the full code from your email.');
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
    if (step === 'email-verify') {
      setStep('email-input');
      setOtpCode('');
    } else if (step === 'email-input') {
      setStep('initial');
      setEmail('');
    } else {
      router.back();
    }
    setError(null);
  }, [step, router]);

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.screen}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable
              onPress={handleBack}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            >
              <Text style={styles.backButtonText}>
                {step === 'initial' ? '✕' : '‹'}
              </Text>
            </Pressable>
          </View>

          {/* Title Section */}
          <Animated.View entering={FadeInDown.duration(300)} style={styles.titleSection}>
            <Text style={styles.title}>
              {step === 'initial' && 'Sign in'}
              {step === 'email-input' && 'Your email'}
              {step === 'email-verify' && 'Enter code'}
            </Text>
            <Text style={styles.subtitle}>
              {step === 'initial' && 'To put actual money on your promises. No pressure.'}
              {step === 'email-input' && "We'll email you a magic code. Check your inbox."}
              {step === 'email-verify' && `Sent to ${email}. Check your inbox (and spam).`}
            </Text>
          </Animated.View>

          {/* Error */}
          {error && (
            <Animated.View
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(150)}
              style={styles.errorCard}
            >
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorText}>{error}</Text>
            </Animated.View>
          )}

          {/* Initial step - Social buttons */}
          {step === 'initial' && (
            <Animated.View
              entering={FadeInDown.delay(100).duration(300)}
              style={styles.section}
            >
              <Text style={styles.sectionLabel}>QUICK OPTIONS</Text>
              <Text style={styles.sectionHint}>One tap. No password to forget.</Text>

              <View style={styles.buttonStack}>
                {/* Apple Sign-In */}
                {appleAuthAvailable && (
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                    cornerRadius={Radius.lg}
                    style={styles.appleButton}
                    onPress={handleAppleSignIn}
                  />
                )}

                {/* Google Sign-In */}
                <Pressable
                  onPress={handleGoogleSignIn}
                  disabled={isLoading}
                  style={({ pressed }) => [
                    styles.socialButton,
                    pressed && styles.socialButtonPressed,
                    isLoading && styles.buttonDisabled,
                  ]}
                >
                  <Text style={styles.socialButtonIcon}>G</Text>
                  <Text style={styles.socialButtonText}>Continue with Google</Text>
                </Pressable>
              </View>

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or the old-fashioned way</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Email option */}
              <View style={styles.buttonStack}>
                <Pressable
                  onPress={() => {
                    hapticLight();
                    setStep('email-input');
                  }}
                  disabled={isLoading}
                  style={({ pressed }) => [
                    styles.optionCard,
                    pressed && styles.cardPressed,
                  ]}
                >
                  <View style={styles.optionIcon}>
                    <Text style={styles.optionEmoji}>✉️</Text>
                  </View>
                  <View style={styles.optionBody}>
                    <Text style={styles.optionTitle}>Email</Text>
                    <Text style={styles.optionSubtitle}>
                      Magic link. No password needed.
                    </Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              </View>
            </Animated.View>
          )}

          {/* Email input step */}
          {step === 'email-input' && (
            <Animated.View
              entering={FadeInDown.duration(300)}
              layout={Layout.springify()}
              style={styles.section}
            >
              <Text style={styles.sectionLabel}>EMAIL ADDRESS</Text>
              <Text style={styles.sectionHint}>We&apos;ll send you a 6-digit code. No password needed.</Text>

              <View style={styles.inputCard}>
                <TextInput
                  style={styles.emailInput}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={Colors.textMuted}
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
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.primaryButtonPressed,
                  (!email.trim() || isLoading) && styles.buttonDisabled,
                ]}
              >
                <LinearGradient
                  colors={!email.trim() || isLoading ? [Colors.systemGray4, Colors.systemGray5] : [Colors.accent, '#0A7FD4']}
                  style={styles.primaryButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  {isLoading ? (
                    <ActivityIndicator color={Colors.text} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Send code</Text>
                  )}
                </LinearGradient>
              </Pressable>
            </Animated.View>
          )}

          {/* Email OTP verify step */}
          {step === 'email-verify' && (
            <Animated.View
              entering={FadeInDown.duration(300)}
              layout={Layout.springify()}
              style={styles.section}
            >
              <Text style={styles.sectionLabel}>VERIFICATION CODE</Text>
              <Text style={styles.sectionHint}>Check your inbox for the code.</Text>

              <View style={styles.inputCard}>
                <TextInput
                  style={styles.emailOtpInput}
                  value={otpCode}
                  onChangeText={(text) => setOtpCode(text.replace(/\D/g, ''))}
                  placeholder="00000000"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="number-pad"
                  autoFocus
                  maxLength={8}
                  textContentType="oneTimeCode"
                />
              </View>

              <Pressable
                onPress={handleVerifyEmailOtp}
                disabled={isLoading || otpCode.length < 6}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.primaryButtonPressed,
                  (otpCode.length < 6 || isLoading) && styles.buttonDisabled,
                ]}
              >
                <LinearGradient
                  colors={otpCode.length < 6 || isLoading ? [Colors.systemGray4, Colors.systemGray5] : [Colors.accent, '#0A7FD4']}
                  style={styles.primaryButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  {isLoading ? (
                    <ActivityIndicator color={Colors.text} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Verify</Text>
                  )}
                </LinearGradient>
              </Pressable>

              <Pressable
                onPress={handleSendEmailOtp}
                disabled={isLoading}
                style={({ pressed }) => [styles.resendButton, pressed && styles.pressed]}
              >
                <Text style={styles.resendText}>Didn&apos;t get it? Resend code</Text>
              </Pressable>
            </Animated.View>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              By continuing, you agree to our Terms of Service and Privacy Policy.
              {'\n'}(The lawyers made us say that.)
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Loading overlay */}
      {isLoading && step === 'initial' && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={Colors.accent} />
            <Text style={styles.loadingText}>Working on it...</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.xl,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: Colors.textSecondary,
    marginTop: -2,
  },

  // Title section
  titleSection: {
    gap: Spacing.sm,
  },
  title: {
    ...Typography.displaySmall,
    color: Colors.text,
    fontFamily: Fonts.rounded,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
  },

  // Sections
  section: {
    gap: Spacing.md,
  },
  sectionLabel: {
    ...Typography.label,
    color: Colors.textMuted,
    marginLeft: Spacing.xs,
  },
  sectionHint: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginLeft: Spacing.xs,
    marginTop: -8,
  },

  // Error
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.dangerDim,
    borderWidth: 1,
    borderColor: Colors.danger + '44',
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  errorIcon: {
    fontSize: 14,
    marginTop: 1,
  },
  errorText: {
    ...Typography.body,
    color: Colors.danger,
    flex: 1,
  },

  // Buttons stack
  buttonStack: {
    gap: Spacing.md,
  },

  // Apple button
  appleButton: {
    height: 54,
    width: '100%',
  },

  // Social button (Google)
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
    borderRadius: Radius.lg,
    backgroundColor: Colors.text,
    gap: Spacing.sm,
  },
  socialButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  socialButtonIcon: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.bg,
  },
  socialButtonText: {
    ...Typography.bodySemibold,
    color: Colors.bg,
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.lg,
    gap: Spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    ...Typography.caption,
    color: Colors.textMuted,
  },

  // Option cards
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
  },
  cardPressed: {
    backgroundColor: Colors.bgCardHover,
    borderColor: Colors.borderFocus,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionEmoji: {
    fontSize: 18,
  },
  optionBody: {
    flex: 1,
    gap: 2,
  },
  optionTitle: {
    ...Typography.bodySemibold,
    color: Colors.text,
    fontFamily: Fonts.rounded,
  },
  optionSubtitle: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  chevron: {
    fontSize: 24,
    color: Colors.textMuted,
    fontWeight: '300',
  },

  // Input card
  inputCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
  },
  emailInput: {
    ...Typography.body,
    color: Colors.text,
    textAlign: 'center',
    paddingVertical: Spacing.md,
    fontSize: 18,
  },
  otpInput: {
    ...Typography.displaySmall,
    color: Colors.text,
    textAlign: 'center',
    letterSpacing: 8,
    paddingVertical: Spacing.md,
    fontFamily: Fonts.mono,
  },
  emailOtpInput: {
    ...Typography.h2,
    color: Colors.text,
    textAlign: 'center',
    letterSpacing: 4,
    paddingVertical: Spacing.md,
    fontFamily: Fonts.mono,
  },

  // Primary button
  primaryButton: {
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  primaryButtonPressed: {
    transform: [{ scale: 0.99 }],
  },
  primaryButtonGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    ...Typography.bodySemibold,
    color: Colors.text,
    fontFamily: Fonts.rounded,
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  // Resend
  resendButton: {
    alignSelf: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  resendText: {
    ...Typography.body,
    color: Colors.accent,
  },

  // Footer
  footer: {
    marginTop: 'auto',
    paddingTop: Spacing.xl,
  },
  footerText: {
    ...Typography.caption,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Loading overlay
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingCard: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xxl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },

  pressed: {
    opacity: 0.8,
  },
});

/**
 * Username Setup Screen
 * Shown after first sign-in if username is not set.
 * Allows users to pick a unique username for friend discovery.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

// Storage key for pending invite token (must match invite/[token].tsx)
const PENDING_INVITE_TOKEN_KEY = 'oopsfee_pending_invite_token';
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
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { supabase } from '@/lib/supabase';

// Username validation regex: 3-20 chars, alphanumeric + underscores, must start with letter
const USERNAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/;

// Reserved usernames that cannot be used
const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'support',
  'help',
  'oopsfee',
  'system',
  'root',
  'mod',
  'moderator',
  'official',
  'staff',
  'team',
  'null',
  'undefined',
  'api',
  'www',
]);

type ValidationState = 'idle' | 'validating' | 'valid' | 'invalid' | 'taken';

function hapticLight() {
  Haptics.selectionAsync().catch(() => {});
}

function hapticMedium() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

function validateUsernameFormat(username: string): { valid: boolean; error?: string } {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: 'Username is required' };
  }

  const trimmed = username.trim();

  if (trimmed.length < 3) {
    return { valid: false, error: 'At least 3 characters' };
  }

  if (trimmed.length > 20) {
    return { valid: false, error: '20 characters max' };
  }

  if (!USERNAME_REGEX.test(trimmed)) {
    if (!/^[a-zA-Z]/.test(trimmed)) {
      return { valid: false, error: 'Must start with a letter' };
    }
    return { valid: false, error: 'Letters, numbers, and underscores only' };
  }

  if (RESERVED_USERNAMES.has(trimmed.toLowerCase())) {
    return { valid: false, error: 'This username is reserved' };
  }

  return { valid: true };
}

function generateSuggestions(displayName: string | null | undefined): string[] {
  if (!displayName) return [];

  // Clean up the display name
  const clean = displayName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim();

  if (!clean) return [];

  const parts = clean.split(/\s+/);
  const suggestions: string[] = [];

  // First name only
  if (parts[0] && parts[0].length >= 3) {
    suggestions.push(parts[0]);
  }

  // First name + last initial
  if (parts.length > 1 && parts[0] && parts[1]) {
    const combo = parts[0] + parts[1][0];
    if (combo.length >= 3) {
      suggestions.push(combo);
    }
  }

  // First name + random number
  if (parts[0]) {
    const num = Math.floor(Math.random() * 99) + 1;
    suggestions.push(`${parts[0]}${num}`);
  }

  // Full name combined (no spaces)
  if (parts.length > 1) {
    const full = parts.join('');
    if (full.length >= 3 && full.length <= 20) {
      suggestions.push(full);
    }
  }

  // First name + underscore + year
  if (parts[0]) {
    const year = new Date().getFullYear().toString().slice(-2);
    suggestions.push(`${parts[0]}_${year}`);
  }

  // Filter valid suggestions
  return suggestions
    .filter((s) => validateUsernameFormat(s).valid)
    .slice(0, 4);
}

export default function SetupUsernameScreen() {
  const insets = useSafeAreaInsets();
  const { profile, refreshProfile, isAuthenticated } = useAuth();

  const [username, setUsername] = useState('');
  const [validationState, setValidationState] = useState<ValidationState>('idle');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPendingInvite, setHasPendingInvite] = useState(false);
  const [isCheckingInvite, setIsCheckingInvite] = useState(true);

  // Generate suggestions based on display name
  const suggestions = useMemo(
    () => generateSuggestions(profile?.display_name),
    [profile?.display_name]
  );

  // Check if user has a pending invite token (from invite link signup)
  // If so, they must set a username - can't skip
  useEffect(() => {
    const checkPendingInvite = async () => {
      try {
        const token = await AsyncStorage.getItem(PENDING_INVITE_TOKEN_KEY);
        setHasPendingInvite(Boolean(token));
      } catch {
        // On error, allow skip to be safe
        setHasPendingInvite(false);
      } finally {
        setIsCheckingInvite(false);
      }
    };
    checkPendingInvite();
  }, []);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth/sign-in');
    }
  }, [isAuthenticated]);

  // Redirect if username already set
  // Cast to access username column (added in migration 014)
  const extendedProfile = profile as typeof profile & { username?: string | null };
  useEffect(() => {
    if (extendedProfile?.username) {
      router.replace('/home');
    }
  }, [extendedProfile?.username]);

  // Real-time format validation
  useEffect(() => {
    if (!username.trim()) {
      setValidationState('idle');
      setValidationError(null);
      return;
    }

    const result = validateUsernameFormat(username);
    if (!result.valid) {
      setValidationState('invalid');
      setValidationError(result.error || 'Invalid username');
    } else {
      // Format is valid, mark as needing availability check
      setValidationState('idle');
      setValidationError(null);
    }
  }, [username]);

  // Check availability on blur or after typing stops
  const checkAvailability = useCallback(async () => {
    const trimmed = username.trim();
    if (!trimmed) return;

    const result = validateUsernameFormat(trimmed);
    if (!result.valid) {
      setValidationState('invalid');
      setValidationError(result.error || 'Invalid username');
      return;
    }

    setValidationState('validating');
    setValidationError(null);

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        setValidationState('invalid');
        setValidationError('Please sign in first');
        return;
      }

      const response = await supabase.functions.invoke('validate-username', {
        body: { username: trimmed },
      });

      if (response.error) {
        setValidationState('invalid');
        setValidationError('Failed to check availability');
        return;
      }

      const data = response.data;
      if (data.valid && data.available) {
        setValidationState('valid');
        setValidationError(null);
      } else if (data.valid && !data.available) {
        setValidationState('taken');
        setValidationError('Already taken');
      } else {
        setValidationState('invalid');
        setValidationError(data.error || 'Invalid username');
      }
    } catch {
      setValidationState('invalid');
      setValidationError('Failed to check availability');
    }
  }, [username]);

  // Debounced availability check
  useEffect(() => {
    const result = validateUsernameFormat(username);
    if (!result.valid || !username.trim()) return;

    const timer = setTimeout(checkAvailability, 500);
    return () => clearTimeout(timer);
  }, [username, checkAvailability]);

  const handleSubmit = useCallback(async () => {
    const trimmed = username.trim();
    if (!trimmed) {
      setError('Enter a username');
      return;
    }

    const result = validateUsernameFormat(trimmed);
    if (!result.valid) {
      setError(result.error || 'Invalid username');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    hapticMedium();

    try {
      const response = await supabase.functions.invoke('set-username', {
        body: { username: trimmed },
      });

      if (response.error) {
        setError(response.error.message || 'Failed to set username');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      const data = response.data;
      if (data.error) {
        setError(data.error);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      if (data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await refreshProfile();
        router.replace('/home');
      }
    } catch (e) {
      const err = e as { message?: string };
      setError(err.message || 'Something went wrong');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSubmitting(false);
    }
  }, [username, refreshProfile]);

  const handleSkip = useCallback(() => {
    hapticLight();
    router.replace('/home');
  }, []);

  const handleSuggestionPress = useCallback((suggestion: string) => {
    hapticLight();
    setUsername(suggestion);
  }, []);

  const getValidationIcon = () => {
    switch (validationState) {
      case 'validating':
        return <ActivityIndicator size="small" color={Colors.textMuted} />;
      case 'valid':
        return <Text style={styles.validIcon}>✓</Text>;
      case 'invalid':
      case 'taken':
        return <Text style={styles.invalidIcon}>✕</Text>;
      default:
        return null;
    }
  };

  const getInputBorderColor = () => {
    switch (validationState) {
      case 'valid':
        return Colors.success + '60';
      case 'invalid':
      case 'taken':
        return Colors.danger + '60';
      default:
        return Colors.border;
    }
  };

  const canSubmit = validationState === 'valid' && !isSubmitting;

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
            { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <Animated.View entering={FadeInDown.duration(300)} style={styles.titleSection}>
            <Text style={styles.emoji}>👋</Text>
            <Text style={styles.title}>Pick a username</Text>
            <Text style={styles.subtitle}>
              This is how friends will find you. Choose wisely—or don&apos;t. You can always change it later.
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

          {/* Input Section */}
          <Animated.View
            entering={FadeInDown.delay(100).duration(300)}
            style={styles.section}
          >
            <Text style={styles.sectionLabel}>USERNAME</Text>
            
            <View style={[styles.inputCard, { borderColor: getInputBorderColor() }]}>
              <View style={styles.inputRow}>
                <Text style={styles.atSymbol}>@</Text>
                <TextInput
                  style={styles.usernameInput}
                  value={username}
                  onChangeText={(text) => setUsername(text.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="yourname"
                  placeholderTextColor={Colors.textMuted}
                  autoFocus
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={20}
                  onBlur={checkAvailability}
                />
                <View style={styles.validationIcon}>
                  {getValidationIcon()}
                </View>
              </View>
            </View>

            {/* Validation hint */}
            <View style={styles.hintRow}>
              {validationError ? (
                <Text style={styles.hintError}>{validationError}</Text>
              ) : validationState === 'valid' ? (
                <Text style={styles.hintSuccess}>Available!</Text>
              ) : (
                <Text style={styles.hint}>3-20 characters, letters, numbers, underscores</Text>
              )}
            </View>
          </Animated.View>

          {/* Suggestions */}
          {suggestions.length > 0 && !username && (
            <Animated.View
              entering={FadeInDown.delay(150).duration(300)}
              style={styles.section}
            >
              <Text style={styles.sectionLabel}>SUGGESTIONS</Text>
              <View style={styles.suggestionsRow}>
                {suggestions.map((suggestion) => (
                  <Pressable
                    key={suggestion}
                    onPress={() => handleSuggestionPress(suggestion)}
                    style={({ pressed }) => [
                      styles.suggestionChip,
                      pressed && styles.suggestionChipPressed,
                    ]}
                  >
                    <Text style={styles.suggestionText}>@{suggestion}</Text>
                  </Pressable>
                ))}
              </View>
            </Animated.View>
          )}

          {/* Submit Button */}
          <Animated.View
            entering={FadeInDown.delay(200).duration(300)}
            style={styles.section}
          >
            <Pressable
              onPress={handleSubmit}
              disabled={!canSubmit}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.primaryButtonPressed,
                !canSubmit && styles.buttonDisabled,
              ]}
            >
              <LinearGradient
                colors={canSubmit ? [Colors.accent, '#0A7FD4'] : [Colors.systemGray4, Colors.systemGray5]}
                style={styles.primaryButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={Colors.text} />
                ) : (
                  <Text style={styles.primaryButtonText}>Claim @{username || 'username'}</Text>
                )}
              </LinearGradient>
            </Pressable>
          </Animated.View>

          {/* Skip option - only show if no pending invite */}
          {!isCheckingInvite && !hasPendingInvite && (
            <Animated.View
              entering={FadeIn.delay(300).duration(300)}
              style={styles.skipSection}
            >
              <Pressable
                onPress={handleSkip}
                style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}
              >
                <Text style={styles.skipText}>Skip for now</Text>
              </Pressable>
              <Text style={styles.skipHint}>
                You can set this later in your profile
              </Text>
            </Animated.View>
          )}

          {/* Required notice for invite signups */}
          {!isCheckingInvite && hasPendingInvite && (
            <Animated.View
              entering={FadeIn.delay(300).duration(300)}
              style={styles.inviteNotice}
            >
              <Text style={styles.inviteNoticeText}>
                Your friend is waiting to connect! Pick a username so they can find you.
              </Text>
            </Animated.View>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Your username is public. Friends can find you by searching @{username || 'yourname'}.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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

  // Title section
  titleSection: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.xl,
  },
  emoji: {
    fontSize: 48,
    marginBottom: Spacing.sm,
  },
  title: {
    ...Typography.displaySmall,
    color: Colors.text,
    fontFamily: Fonts.rounded,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
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

  // Input card
  inputCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  atSymbol: {
    ...Typography.h2,
    color: Colors.textMuted,
    marginRight: Spacing.xs,
  },
  usernameInput: {
    flex: 1,
    ...Typography.h2,
    color: Colors.text,
    paddingVertical: Spacing.sm,
  },
  validationIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  validIcon: {
    fontSize: 18,
    color: Colors.success,
    fontWeight: '700',
  },
  invalidIcon: {
    fontSize: 18,
    color: Colors.danger,
    fontWeight: '700',
  },

  // Hints
  hintRow: {
    marginTop: -Spacing.sm,
    marginLeft: Spacing.xs,
  },
  hint: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  hintError: {
    ...Typography.caption,
    color: Colors.danger,
  },
  hintSuccess: {
    ...Typography.caption,
    color: Colors.success,
  },

  // Suggestions
  suggestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  suggestionChip: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  suggestionChipPressed: {
    backgroundColor: Colors.bgCardHover,
    borderColor: Colors.accent + '60',
  },
  suggestionText: {
    ...Typography.caption,
    color: Colors.textSecondary,
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

  // Skip
  skipSection: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  skipButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  skipText: {
    ...Typography.body,
    color: Colors.textTertiary,
  },
  skipHint: {
    ...Typography.caption,
    color: Colors.textMuted,
  },

  // Invite notice (when skip is disabled)
  inviteNotice: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.accent + '15',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.accent + '30',
  },
  inviteNoticeText: {
    ...Typography.caption,
    color: Colors.accent,
    textAlign: 'center',
    lineHeight: 18,
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

  pressed: {
    opacity: 0.8,
  },
});


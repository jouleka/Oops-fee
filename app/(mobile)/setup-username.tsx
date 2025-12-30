/**
 * Username Setup Screen
 * Shown after first sign-in if username is not set.
 * Allows users to pick a unique username for friend discovery.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import Animated, { FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";

// Storage key for pending invite token (must match invite/[token].tsx)
const PENDING_INVITE_TOKEN_KEY = "oopsfee_pending_invite_token";

// Username validation regex: 3-20 chars, alphanumeric + underscores, must start with letter
const USERNAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/;

// Reserved usernames that cannot be used
const RESERVED_USERNAMES = new Set([
  "admin",
  "administrator",
  "support",
  "help",
  "oopsfee",
  "system",
  "root",
  "mod",
  "moderator",
  "official",
  "staff",
  "team",
  "null",
  "undefined",
  "api",
  "www",
]);

type ValidationState = "idle" | "validating" | "valid" | "invalid" | "taken";

function hapticLight() {
  Haptics.selectionAsync().catch(() => {});
}

function hapticMedium() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

function validateUsernameFormat(username: string): {
  valid: boolean;
  error?: string;
} {
  if (!username || typeof username !== "string") {
    return { valid: false, error: "Username is required" };
  }

  const trimmed = username.trim();

  if (trimmed.length < 3) {
    return { valid: false, error: "At least 3 characters" };
  }

  if (trimmed.length > 20) {
    return { valid: false, error: "20 characters max" };
  }

  if (!USERNAME_REGEX.test(trimmed)) {
    if (!/^[a-zA-Z]/.test(trimmed)) {
      return { valid: false, error: "Must start with a letter" };
    }
    return { valid: false, error: "Letters, numbers, and underscores only" };
  }

  if (RESERVED_USERNAMES.has(trimmed.toLowerCase())) {
    return { valid: false, error: "This username is reserved" };
  }

  return { valid: true };
}

function generateSuggestions(displayName: string | null | undefined): string[] {
  if (!displayName) return [];

  // Clean up the display name
  const clean = displayName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
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
    const full = parts.join("");
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
  return suggestions.filter((s) => validateUsernameFormat(s).valid).slice(0, 4);
}

export default function SetupUsernameScreen() {
  const insets = useSafeAreaInsets();
  const { profile, refreshProfile, isAuthenticated } = useAuth();

  const [username, setUsername] = useState("");
  const [validationState, setValidationState] =
    useState<ValidationState>("idle");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPendingInvite, setHasPendingInvite] = useState(false);
  const [isCheckingInvite, setIsCheckingInvite] = useState(true);

  // Generate suggestions based on display name
  const suggestions = useMemo(
    () => generateSuggestions(profile?.display_name),
    [profile?.display_name],
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
      router.replace("/auth/sign-in");
    }
  }, [isAuthenticated]);

  // Cast to access username column (added in migration 014)
  const extendedProfile = profile as typeof profile & {
    username?: string | null;
  };
  
  // Pre-fill with current username if editing
  const isEditing = Boolean(extendedProfile?.username);
  useEffect(() => {
    if (extendedProfile?.username && !username) {
      setUsername(extendedProfile.username);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only run when profile loads, not when username changes
  }, [extendedProfile?.username]);

  // Real-time format validation
  useEffect(() => {
    if (!username.trim()) {
      setValidationState("idle");
      setValidationError(null);
      return;
    }

    const result = validateUsernameFormat(username);
    if (!result.valid) {
      setValidationState("invalid");
      setValidationError(result.error || "Invalid username");
    } else {
      // Format is valid, mark as needing availability check
      setValidationState("idle");
      setValidationError(null);
    }
  }, [username]);

  // Check availability on blur or after typing stops
  const checkAvailability = useCallback(async () => {
    const trimmed = username.trim();
    if (!trimmed) return;

    const result = validateUsernameFormat(trimmed);
    if (!result.valid) {
      setValidationState("invalid");
      setValidationError(result.error || "Invalid username");
      return;
    }

    setValidationState("validating");
    setValidationError(null);

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        setValidationState("invalid");
        setValidationError("Please sign in first");
        return;
      }

      const response = await supabase.functions.invoke("validate-username", {
        body: { username: trimmed },
      });

      if (response.error) {
        setValidationState("invalid");
        setValidationError("Failed to check availability");
        return;
      }

      const data = response.data;
      if (data.valid && data.available) {
        setValidationState("valid");
        setValidationError(null);
      } else if (data.valid && !data.available) {
        setValidationState("taken");
        setValidationError("Already taken");
      } else {
        setValidationState("invalid");
        setValidationError(data.error || "Invalid username");
      }
    } catch {
      setValidationState("invalid");
      setValidationError("Failed to check availability");
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
      setError("Enter a username");
      return;
    }

    const result = validateUsernameFormat(trimmed);
    if (!result.valid) {
      setError(result.error || "Invalid username");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    hapticMedium();

    try {
      const response = await supabase.functions.invoke("set-username", {
        body: { username: trimmed },
      });

      if (response.error) {
        setError(response.error.message || "Failed to set username");
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
        router.replace("/(mobile)/home");
      }
    } catch (e) {
      const err = e as { message?: string };
      setError(err.message || "Something went wrong");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSubmitting(false);
    }
  }, [username, refreshProfile]);

  const handleSkip = useCallback(() => {
    hapticLight();
    router.replace("/(mobile)/home");
  }, []);

  const handleSuggestionPress = useCallback((suggestion: string) => {
    hapticLight();
    setUsername(suggestion);
  }, []);

  const getValidationIcon = () => {
    switch (validationState) {
      case "validating":
        return (
          <ActivityIndicator size="small" color="rgba(255, 255, 255, 0.30)" />
        );
      case "valid":
        return <Text className="text-lg text-success font-bold">✓</Text>;
      case "invalid":
      case "taken":
        return <Text className="text-lg text-danger font-bold">✕</Text>;
      default:
        return null;
    }
  };

  const getInputBorderColor = () => {
    switch (validationState) {
      case "valid":
        return "border-success/60";
      case "invalid":
      case "taken":
        return "border-danger/60";
      default:
        return "border-border";
    }
  };

  const canSubmit = validationState === "valid" && !isSubmitting;

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
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 24,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back button for editing mode */}
          {isEditing && (
            <Animated.View entering={FadeIn.duration(200)}>
              <Pressable
                onPress={() => router.back()}
                className="flex-row items-center gap-xs active:opacity-70"
              >
                <Text className="text-lg text-text-muted">←</Text>
                <Text className="text-body text-text-muted">Back</Text>
              </Pressable>
            </Animated.View>
          )}
          
          {/* Header */}
          <Animated.View
            entering={FadeInDown.duration(300)}
            className="items-center gap-sm pt-xl"
          >
            <Text className="text-5xl mb-sm">👋</Text>
            <Text className="text-display-sm text-white font-rounded text-center">
              {isEditing ? "Change username" : "Pick a username"}
            </Text>
            <Text className="text-body text-text-secondary text-center leading-[22px]">
              {isEditing 
                ? "Your username is how friends find you. Make sure it's still available."
                : "This is how friends will find you. Choose wisely—or don't. You can always change it later."}
            </Text>
          </Animated.View>

          {/* Error */}
          {error && (
            <Animated.View
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(150)}
              className="flex-row items-start gap-sm bg-danger-dim border border-danger/[0.27] rounded-lg p-md"
            >
              <Text className="text-sm mt-px">⚠️</Text>
              <Text className="text-body text-danger flex-1">{error}</Text>
            </Animated.View>
          )}

          {/* Input Section */}
          <Animated.View
            entering={FadeInDown.delay(100).duration(300)}
            className="gap-md"
          >
            <Text className="text-label text-text-muted ml-xs">USERNAME</Text>

            <View
              className={`bg-card rounded-xl border p-lg ${getInputBorderColor()}`}
            >
              <View className="flex-row items-center">
                <Text className="text-h2 text-text-muted mr-xs">@</Text>
                <TextInput
                  className="flex-1 text-h2 text-white py-sm"
                  value={username}
                  onChangeText={(text) =>
                    setUsername(text.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                  }
                  placeholder="yourname"
                  placeholderTextColor="rgba(255, 255, 255, 0.30)"
                  autoFocus
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={20}
                  onBlur={checkAvailability}
                />
                <View className="w-6 h-6 items-center justify-center">
                  {getValidationIcon()}
                </View>
              </View>
            </View>

            {/* Validation hint */}
            <View className="-mt-sm ml-xs">
              {validationError ? (
                <Text className="text-caption text-danger">
                  {validationError}
                </Text>
              ) : validationState === "valid" ? (
                <Text className="text-caption text-success">Available!</Text>
              ) : (
                <Text className="text-caption text-text-tertiary">
                  3-20 characters, letters, numbers, underscores
                </Text>
              )}
            </View>
          </Animated.View>

          {/* Suggestions - only show for new username setup */}
          {suggestions.length > 0 && !username && !isEditing && (
            <Animated.View
              entering={FadeInDown.delay(150).duration(300)}
              className="gap-md"
            >
              <Text className="text-label text-text-muted ml-xs">
                SUGGESTIONS
              </Text>
              <View className="flex-row flex-wrap gap-sm">
                {suggestions.map((suggestion) => (
                  <Pressable
                    key={suggestion}
                    onPress={() => handleSuggestionPress(suggestion)}
                    className="bg-card rounded-full border border-border px-md py-sm active:bg-card-hover active:border-imessage/60"
                  >
                    <Text className="text-caption text-text-secondary font-mono">
                      @{suggestion}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Animated.View>
          )}

          {/* Submit Button */}
          <Animated.View
            entering={FadeInDown.delay(200).duration(300)}
            className="gap-md"
          >
            <Pressable
              onPress={handleSubmit}
              disabled={!canSubmit}
              className={`h-14 rounded-full overflow-hidden shadow-lg active:scale-[0.99] ${
                !canSubmit ? "opacity-60" : ""
              }`}
            >
              <LinearGradient
                colors={
                  canSubmit ? ["#0B93F6", "#0A7FD4"] : ["#3A3A3C", "#2C2C2E"]
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
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text className="text-body-semibold text-white font-rounded">
                    {isEditing ? `Update to @${username || "username"}` : `Claim @${username || "username"}`}
                  </Text>
                )}
              </LinearGradient>
            </Pressable>
          </Animated.View>

          {/* Skip option - only show if no pending invite AND not editing */}
          {!isCheckingInvite && !hasPendingInvite && !isEditing && (
            <Animated.View
              entering={FadeIn.delay(300).duration(300)}
              className="items-center gap-xs"
            >
              <Pressable
                onPress={handleSkip}
                className="py-md px-lg active:opacity-80"
              >
                <Text className="text-body text-text-tertiary">
                  Skip for now
                </Text>
              </Pressable>
              <Text className="text-caption text-text-muted">
                You can set this later in your profile
              </Text>
            </Animated.View>
          )}
          
          {/* Cancel button for editing mode */}
          {isEditing && (
            <Animated.View
              entering={FadeIn.delay(300).duration(300)}
              className="items-center"
            >
              <Pressable
                onPress={() => router.back()}
                className="py-md px-lg active:opacity-80"
              >
                <Text className="text-body text-text-tertiary">
                  Cancel
                </Text>
              </Pressable>
            </Animated.View>
          )}

          {/* Required notice for invite signups */}
          {!isCheckingInvite && hasPendingInvite && (
            <Animated.View
              entering={FadeIn.delay(300).duration(300)}
              className="items-center py-md px-lg bg-imessage/15 rounded-lg border border-imessage/30"
            >
              <Text className="text-caption text-imessage text-center leading-[18px]">
                Your friend is waiting to connect! Pick a username so they can
                find you.
              </Text>
            </Animated.View>
          )}

          {/* Footer */}
          <View className="mt-auto pt-xl">
            <Text className="text-caption text-text-muted text-center leading-[18px]">
              Your username is public. Friends can find you by searching @
              {username || "yourname"}.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

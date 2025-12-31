/**
 * Auth Context for OopsFee
 *
 * Provides authentication state and methods for:
 * - Apple Sign-In (iOS)
 * - Google Sign-In (all platforms)
 * - Email OTP
 *
 * Usage:
 * ```tsx
 * const { user, signInWithApple, signInWithGoogle, signOut } = useAuth();
 * ```
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, User } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as WebBrowser from 'expo-web-browser';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';

import type { Profile, ProfileInsert, UserPaymentState } from '@/lib/supabase';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

// Storage key for pending invite token (imported from invite page)
const PENDING_INVITE_TOKEN_KEY = 'oopsfee_pending_invite_token';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

/**
 * Wallet state derived from profile
 */
export interface WalletState {
  /** Current balance in cents */
  balanceCents: number;
  /** Current balance formatted as dollars */
  balanceDollars: number;
  /** Whether user has any balance */
  hasBalance: boolean;
  /** PayPal email for withdrawals (if set) */
  paypalPayoutEmail: string | null;
  /** Saved payout card info for instant debit card withdrawals */
  payoutCard: { last4: string; brand: string } | null;
  /** Whether user has a payout method configured */
  hasPayoutMethod: boolean;
}

export interface AuthState {
  /** Current session, null if not authenticated */
  session: Session | null;
  /** Current user, null if not authenticated */
  user: User | null;
  /** User profile from database */
  profile: Profile | null;
  /** Payment state (for blocking stake creation) */
  paymentState: UserPaymentState;
  /** Wallet state (balance and payout methods) */
  walletState: WalletState;
  /** Number of free passes available (earned via invite rewards) */
  freePasses: number;
  /** Whether auth state is still loading */
  isLoading: boolean;
  /** Whether user is authenticated */
  isAuthenticated: boolean;
}

export interface AuthActions {
  /** Sign in with Apple (iOS only) */
  signInWithApple: () => Promise<void>;
  /** Sign in with Google */
  signInWithGoogle: () => Promise<void>;
  /** Send magic link/OTP to email */
  sendEmailOtp: (email: string) => Promise<{ error: string | null }>;
  /** Verify email OTP code */
  verifyEmailOtp: (email: string, code: string) => Promise<{ error: string | null }>;
  /** Sign in with email + password (for test accounts) */
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  /** Sign out */
  signOut: () => Promise<void>;
  /** Refresh profile from server */
  refreshProfile: () => Promise<void>;
  /** Set username via edge function */
  setUsername: (username: string) => Promise<{ success: boolean; error?: string }>;
  /** Delete account and all associated data */
  deleteAccount: () => Promise<{ success: boolean; error?: string; walletBalance?: number }>;
}

export type AuthContextType = AuthState & AuthActions;

// ─────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null);

// ─────────────────────────────────────────────────────────────
// Push Token Registration
// ─────────────────────────────────────────────────────────────

/**
 * Check for and claim any pending friend invite token stored during signup.
 * This runs after profile creation to auto-connect the user with their inviter.
 */
async function claimPendingInviteToken(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(PENDING_INVITE_TOKEN_KEY);
    if (!token) return;

    console.log('[Auth] Found pending invite token, attempting to claim...');

    // Claim the invite
    const response = await supabase.functions.invoke('claim-friend-invite', {
      body: { invite_token: token },
    });

    if (response.error) {
      console.error('[Auth] Failed to claim invite:', response.error);
    } else if (response.data?.success) {
      console.log('[Auth] Successfully claimed invite, now friends with:', response.data.inviter);
    } else if (response.data?.error) {
      console.log('[Auth] Invite claim failed:', response.data.error);
    }

    // Clear the token regardless of success/failure
    await AsyncStorage.removeItem(PENDING_INVITE_TOKEN_KEY);
  } catch (e) {
    console.error('[Auth] Error claiming pending invite:', e);
  }
}

/**
 * Get Expo push token and store it in the user's profile.
 * Only works on physical devices (not simulators/web).
 */
async function registerPushToken(userId: string): Promise<void> {
  // Push tokens only work on physical devices
  if (!Device.isDevice) {
    console.log('[Auth] Push tokens require a physical device, skipping');
    return;
  }

  // Skip web platform
  if (Platform.OS === 'web') {
    return;
  }

  try {
    // Check if we have permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // If not granted, request permission
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Auth] Push notification permission not granted');
      return;
    }

    // Get the Expo push token
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    const pushToken = tokenData.data;
    console.log('[Auth] Got Expo push token:', pushToken);

    // Store in profile
    const { error } = await supabase
      .from('profiles')
      .update({ expo_push_token: pushToken })
      .eq('id', userId);

    if (error) {
      console.error('[Auth] Failed to store push token:', error);
    } else {
      console.log('[Auth] Push token stored successfully');
    }
  } catch (error) {
    console.error('[Auth] Error registering push token:', error);
  }
}

// ─────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ─────────────────────────────────────────────────────────────
  // Session Management
  // ─────────────────────────────────────────────────────────────

  // Initialize auth state
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setIsLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setIsLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch profile when session changes
  useEffect(() => {
    if (!session?.user?.id) {
      setProfile(null);
      return;
    }

    const userId = session.user.id;
    const user = session.user;

    const doFetch = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        // Profile doesn't exist yet, create it
        if (error.code === 'PGRST116') {
          const displayName =
            user?.user_metadata?.full_name ||
            user?.user_metadata?.name ||
            user?.email?.split('@')[0] ||
            null;

          const profileData: ProfileInsert = {
            id: userId,
            display_name: displayName,
            avatar_url: user?.user_metadata?.avatar_url || null,
            stripe_customer_id: null,
            default_payment_method_id: null,
          };

          const { data: newData, error: insertError } = await supabase
            .from('profiles')
            .insert(profileData)
            .select()
            .single();

          if (insertError) {
            console.error('[Auth] Error creating profile:', insertError);
          } else {
            setProfile(newData as Profile);
            // Register push token for new profile
            registerPushToken(userId);
            // Note: Username is now auto-generated by DB trigger (handle_new_user)
            // Claim any pending invite (for users who signed up via invite link)
            claimPendingInviteToken();
          }
        } else {
          console.error('[Auth] Error fetching profile:', error);
        }
        return;
      }

      setProfile(data);
      // Register push token on profile fetch (token may have changed)
      registerPushToken(userId);
      // Update last active timestamp for re-engagement tracking
      updateLastActive();
    };

    doFetch();
  }, [session?.user?.id, session?.user]);

  /**
   * Update last_active_at timestamp for re-engagement notification targeting.
   * Called on app open when user is authenticated.
   */
  async function updateLastActive(): Promise<void> {
    try {
      const { error } = await supabase.rpc('update_last_active');
      if (error) {
        // Silently fail - this is non-critical telemetry
        console.log('[Auth] Failed to update last_active:', error.message);
      }
    } catch {
      // Ignore errors - non-critical
    }
  }

  const refreshProfile = useCallback(async () => {
    if (!session?.user?.id) return;
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (!error && data) {
      setProfile(data);
    }
  }, [session?.user?.id]);

  const setUsername = useCallback(async (username: string): Promise<{ success: boolean; error?: string }> => {
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const response = await supabase.functions.invoke('set-username', {
        body: { username },
      });

      if (response.error) {
        return { success: false, error: response.error.message || 'Failed to set username' };
      }

      const data = response.data;
      if (data.error) {
        return { success: false, error: data.error };
      }

      if (data.success) {
        // Refresh profile to get updated username
        await refreshProfile();
        return { success: true };
      }

      return { success: false, error: 'Unknown error' };
    } catch (e) {
      const err = e as { message?: string };
      return { success: false, error: err.message || 'Failed to set username' };
    }
  }, [session?.user?.id, refreshProfile]);

  // ─────────────────────────────────────────────────────────────
  // Delete Account
  // ─────────────────────────────────────────────────────────────

  const deleteAccount = useCallback(async (): Promise<{ success: boolean; error?: string; walletBalance?: number }> => {
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const response = await supabase.functions.invoke('delete-account');

      if (response.error) {
        return { success: false, error: response.error.message || 'Failed to delete account' };
      }

      const data = response.data;
      if (data.error) {
        // Check if it's a wallet balance error
        if (data.wallet_balance !== undefined) {
          return { success: false, error: data.error, walletBalance: data.wallet_balance };
        }
        return { success: false, error: data.error };
      }

      if (data.success) {
        // Clear local state - user is now deleted
        setSession(null);
        setProfile(null);
        return { success: true };
      }

      return { success: false, error: 'Unknown error' };
    } catch (e) {
      const err = e as { message?: string };
      return { success: false, error: err.message || 'Failed to delete account' };
    }
  }, [session?.user?.id]);

  // ─────────────────────────────────────────────────────────────
  // Apple Sign-In
  // ─────────────────────────────────────────────────────────────

  const signInWithApple = useCallback(async () => {
    if (Platform.OS !== 'ios') {
      throw new Error('Apple Sign-In is only available on iOS');
    }

    // Generate nonce for security
    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce
    );

    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (!credential.identityToken) {
        throw new Error('No identity token received from Apple');
      }

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        nonce: rawNonce,
      });

      if (error) throw error;
    } catch (e: unknown) {
      const error = e as { code?: string; message?: string };
      if (error.code === 'ERR_REQUEST_CANCELED') {
        // User canceled, don't throw
        return;
      }
      throw e;
    }
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Google Sign-In
  // ─────────────────────────────────────────────────────────────

  const signInWithGoogle = useCallback(async () => {
    // Use Expo's proxy for OAuth in Expo Go, native scheme for dev builds
    const redirectUrl = AuthSession.makeRedirectUri({
      scheme: 'oopsfee',
      path: 'auth/callback',
      preferLocalhost: false,
    });

    console.log('[Auth] Google OAuth redirect URL:', redirectUrl);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
      },
    });

    if (error) throw error;
    if (!data.url) throw new Error('No OAuth URL returned');

    console.log('[Auth] Opening OAuth URL:', data.url);

    // Open browser for OAuth flow
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
    console.log('[Auth] OAuth result:', result.type);

    if (result.type === 'success' && result.url) {
      console.log('[Auth] OAuth success URL:', result.url);
      // Parse the URL to extract tokens (could be in hash or query params)
      const url = new URL(result.url);
      
      // Try hash first (implicit flow), then query params (PKCE flow)
      let params = new URLSearchParams(url.hash.slice(1));
      let accessToken = params.get('access_token');
      let refreshToken = params.get('refresh_token');
      
      if (!accessToken) {
        params = new URLSearchParams(url.search);
        accessToken = params.get('access_token');
        refreshToken = params.get('refresh_token');
      }

      if (accessToken) {
        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || '',
        });

        if (setSessionError) throw setSessionError;
      } else {
        console.log('[Auth] No access token found in callback URL');
      }
    }
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Email Magic Link / OTP
  // ─────────────────────────────────────────────────────────────

  const sendEmailOtp = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
    });

    if (error) {
      return { error: error.message };
    }

    return { error: null };
  }, []);

  const verifyEmailOtp = useCallback(async (email: string, code: string) => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'email',
    });

    if (error) {
      return { error: error.message };
    }

    return { error: null };
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error: error.message };
    }

    return { error: null };
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Sign Out
  // ─────────────────────────────────────────────────────────────

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setProfile(null);
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Derived State
  // ─────────────────────────────────────────────────────────────

  const paymentState: UserPaymentState = useMemo(
    () => ({
      hasPaymentMethod: Boolean(profile?.default_payment_method_id),
      paymentBlocked: profile?.payment_blocked ?? false,
      failedPaymentCount: profile?.failed_payment_count ?? 0,
      brand: profile?.payment_method_brand ?? null,
      last4: profile?.payment_method_last4 ?? null,
      type: profile?.payment_method_type ?? null,
    }),
    [profile]
  );

  const walletState: WalletState = useMemo(() => {
    const balanceCents = profile?.balance_cents ?? 0;
    const paypalPayoutEmail = profile?.paypal_payout_email ?? null;
    // Cast to access payout card columns (added in migration 011)
    const extendedProfile = profile as typeof profile & {
      payout_card_last4?: string | null;
      payout_card_brand?: string | null;
    };
    const payoutCard = extendedProfile?.payout_card_last4
      ? { last4: extendedProfile.payout_card_last4, brand: extendedProfile.payout_card_brand ?? 'unknown' }
      : null;

    return {
      balanceCents,
      balanceDollars: balanceCents / 100,
      hasBalance: balanceCents > 0,
      paypalPayoutEmail,
      payoutCard,
      hasPayoutMethod: Boolean(paypalPayoutEmail || payoutCard),
    };
  }, [profile]);

  // Free passes from invite rewards
  const freePasses = profile?.free_passes ?? 0;

  const value = useMemo<AuthContextType>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      paymentState,
      walletState,
      freePasses,
      isLoading,
      isAuthenticated: Boolean(session?.user),
      signInWithApple,
      signInWithGoogle,
      sendEmailOtp,
      verifyEmailOtp,
      signInWithPassword,
      signOut,
      refreshProfile,
      setUsername,
      deleteAccount,
    }),
    [
      session,
      profile,
      paymentState,
      walletState,
      freePasses,
      isLoading,
      signInWithApple,
      signInWithGoogle,
      sendEmailOtp,
      verifyEmailOtp,
      signInWithPassword,
      signOut,
      refreshProfile,
      setUsername,
      deleteAccount,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

/**
 * Hook to check if Apple Sign-In is available on this device
 */
export function useAppleAuthAvailable(): boolean {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setAvailable);
    }
  }, []);

  return available;
}


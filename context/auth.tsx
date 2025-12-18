/**
 * Auth Context for OopsFee
 *
 * Provides authentication state and methods for:
 * - Apple Sign-In (iOS)
 * - Google Sign-In (all platforms)
 * - Phone OTP (fallback)
 *
 * Usage:
 * ```tsx
 * const { user, signInWithApple, signInWithGoogle, signOut } = useAuth();
 * ```
 */

import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
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

import type { Session, User } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface AuthState {
  /** Current session, null if not authenticated */
  session: Session | null;
  /** Current user, null if not authenticated */
  user: User | null;
  /** User profile from database */
  profile: Profile | null;
  /** Payment state (for blocking stake creation) */
  paymentState: UserPaymentState;
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
  /** Request OTP code to phone number */
  sendOtp: (phone: string) => Promise<{ error: string | null }>;
  /** Verify OTP code */
  verifyOtp: (phone: string, code: string) => Promise<{ error: string | null }>;
  /** Send magic link/OTP to email */
  sendEmailOtp: (email: string) => Promise<{ error: string | null }>;
  /** Verify email OTP code */
  verifyEmailOtp: (email: string, code: string) => Promise<{ error: string | null }>;
  /** Sign out */
  signOut: () => Promise<void>;
  /** Refresh profile from server */
  refreshProfile: () => Promise<void>;
}

export type AuthContextType = AuthState & AuthActions;

// ─────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null);

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
          }
        } else {
          console.error('[Auth] Error fetching profile:', error);
        }
        return;
      }

      setProfile(data);
    };

    doFetch();
  }, [session?.user?.id, session?.user]);

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
  // Phone OTP
  // ─────────────────────────────────────────────────────────────

  const sendOtp = useCallback(async (phone: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      phone,
    });

    if (error) {
      return { error: error.message };
    }

    return { error: null };
  }, []);

  const verifyOtp = useCallback(async (phone: string, code: string) => {
    const { error } = await supabase.auth.verifyOtp({
      phone,
      token: code,
      type: 'sms',
    });

    if (error) {
      return { error: error.message };
    }

    return { error: null };
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Email Magic Link / OTP
  // ─────────────────────────────────────────────────────────────

  const sendEmailOtp = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // This sends a 6-digit code instead of a magic link
        // User enters the code just like phone OTP
      },
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
    }),
    [profile]
  );

  const value = useMemo<AuthContextType>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      paymentState,
      isLoading,
      isAuthenticated: Boolean(session?.user),
      signInWithApple,
      signInWithGoogle,
      sendOtp,
      verifyOtp,
      sendEmailOtp,
      verifyEmailOtp,
      signOut,
      refreshProfile,
    }),
    [
      session,
      profile,
      paymentState,
      isLoading,
      signInWithApple,
      signInWithGoogle,
      sendOtp,
      verifyOtp,
      sendEmailOtp,
      verifyEmailOtp,
      signOut,
      refreshProfile,
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


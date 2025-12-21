import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { Database } from './types.generated';

// Environment variables (set in app.json extra or .env)
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// During static build (SSR), env vars may not be available
// Use placeholder to prevent crash - client will be non-functional but won't break build
const IS_BUILD_TIME = !SUPABASE_URL || !SUPABASE_ANON_KEY;

if (IS_BUILD_TIME && typeof window !== 'undefined') {
  // Only warn at runtime, not during SSR build
  console.warn(
    '[Supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
    'Backend features will not work.'
  );
}

// Placeholder URL for build time (must be valid URL format)
const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

// Keys stored in SecureStore (auth tokens) vs AsyncStorage (larger data)
const SECURE_STORE_KEYS = ['supabase.auth.token', 'sb-'];

/**
 * Check if a key should be stored in SecureStore (for sensitive auth data)
 */
function isSecureKey(key: string): boolean {
  return SECURE_STORE_KEYS.some(prefix => key.includes(prefix));
}

/**
 * Custom storage adapter using:
 * - SecureStore for auth tokens on native (encrypted, limited to 2KB)
 * - AsyncStorage for larger data on native
 * - localStorage on web
 */
const ExpoSecureStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      if (typeof localStorage === 'undefined') return null;
      return localStorage.getItem(key);
    }
    
    // Use SecureStore for auth tokens
    if (isSecureKey(key)) {
      try {
        return await SecureStore.getItemAsync(key);
      } catch {
        // Fall back to AsyncStorage if SecureStore fails
        return AsyncStorage.getItem(key);
      }
    }
    return AsyncStorage.getItem(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(key, value);
      return;
    }
    
    // Use SecureStore for auth tokens
    if (isSecureKey(key)) {
      try {
        await SecureStore.setItemAsync(key, value);
        return;
      } catch {
        // Fall back to AsyncStorage if SecureStore fails (e.g., value too large)
      }
    }
    await AsyncStorage.setItem(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      if (typeof localStorage === 'undefined') return;
      localStorage.removeItem(key);
      return;
    }
    
    // Remove from both stores to ensure cleanup
    if (isSecureKey(key)) {
      try {
        await SecureStore.deleteItemAsync(key);
      } catch {
        // Ignore errors
      }
    }
    await AsyncStorage.removeItem(key);
  },
};

/**
 * Supabase client configured for React Native / Expo
 * 
 * Features:
 * - Uses SecureStore for auth tokens on native (encrypted)
 * - Uses AsyncStorage for larger data on native
 * - Uses localStorage on web
 * - Auto-refreshes tokens
 * - Typed with database schema
 */
export const supabase = createClient<Database>(
  SUPABASE_URL || PLACEHOLDER_URL,
  SUPABASE_ANON_KEY || PLACEHOLDER_KEY,
  {
  auth: {
    storage: ExpoSecureStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web', // Only on web for OAuth redirects
  },
  realtime: {
    params: {
      eventsPerSecond: 10, // Rate limit realtime events
    },
  },
});

/**
 * Helper to check if Supabase is configured
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/**
 * Get the current authenticated user's ID, or null if not signed in
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Get the current session, or null if not signed in
 */
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}


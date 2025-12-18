/**
 * Hook to require authentication for specific actions
 * 
 * Usage:
 * const { requireAuth } = useRequireAuth();
 * 
 * const handleShare = () => {
 *   if (!requireAuth('share your promise')) return;
 *   // ... continue with share logic
 * };
 */

import { router } from 'expo-router';
import { useCallback } from 'react';

import { useAuth } from '@/context/auth';

interface UseRequireAuthReturn {
  /** Check if authenticated, redirect to sign-in if not. Returns true if authed. */
  requireAuth: (reason?: string) => boolean;
  /** Whether user is currently authenticated */
  isAuthenticated: boolean;
  /** Whether auth state is still loading */
  isLoading: boolean;
}

export function useRequireAuth(): UseRequireAuthReturn {
  const { isAuthenticated, isLoading } = useAuth();

  const requireAuth = useCallback(
    (_reason?: string): boolean => {
      if (isAuthenticated) return true;

      // Navigate to sign-in
      // The reason could be passed as a param to show context on the sign-in screen
      router.push('/auth/sign-in');
      return false;
    },
    [isAuthenticated]
  );

  return {
    requireAuth,
    isAuthenticated,
    isLoading,
  };
}


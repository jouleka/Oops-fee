/**
 * Protected route layout
 * Routes in (auth)/ require authentication
 */

import { Redirect, Stack, type Href } from 'expo-router';

import { LoadingState } from '@/components/ui/loading-state';
import { useAuth } from '@/context/auth';

export default function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading while checking auth state
  if (isLoading) {
    return <LoadingState />;
  }

  // Redirect to sign-in if not authenticated
  if (!isAuthenticated) {
    return <Redirect href={'/auth/sign-in' as Href} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="payment-method" options={{ presentation: 'modal' }} />
    </Stack>
  );
}


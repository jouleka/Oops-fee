import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { AuthProvider } from '@/context/auth';
import { PromiseStoreProvider } from '@/context/promise-store';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  addNotificationResponseListener,
  getLastNotificationResponse,
  initializeNotifications,
} from '@/lib/notifications/setup';
import { StripeProvider } from '@/lib/stripe';
import type { NotificationResponse } from 'expo-notifications';

// ─────────────────────────────────────────────────────────────
// NOTIFICATION TAP HANDLER
// ─────────────────────────────────────────────────────────────

type NotificationData = {
  type?: string;
  promiseId?: string;
};

function getNotificationRoute(response: NotificationResponse): Href {
  const data = response.notification.request.content.data as NotificationData;
  const type = data?.type;
  const promiseId = data?.promiseId;

  switch (type) {
    case 'settlement_charged':
    case 'settlement_abandoned':
      return '/graveyard';
    case 'settlement_failed':
    case 'settlement_requires_action':
      return '/(auth)/payment-method';
    case 'sponsor':
    case 'roast':
    case 'partner_approved':
    case 'partner_rejected':
      if (promiseId) return { pathname: '/promise/[id]', params: { id: promiseId } };
      return '/home';
    case 'reminder':
    case 'checkin':
    case 'streak_milestone':
    case 'momentum':
    case 'near_miss':
    case 'comeback':
    case 'reengagement':
    case 'social_proof':
      return '/home';
    default:
      return '/home';
  }
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();

  // Initialize notifications on app start
  useEffect(() => {
    initializeNotifications().catch(console.error);
  }, []);

  // Handle notification taps (deep linking)
  useEffect(() => {
    // Handle notification tap when app is already running
    const subscription = addNotificationResponseListener((response) => {
      router.push(getNotificationRoute(response));
    });

    // Handle case where app was opened from a notification
    getLastNotificationResponse().then((response) => {
      if (response) {
        router.push(getNotificationRoute(response));
      }
    });

    return () => subscription.remove();
  }, [router]);

  return (
    <StripeProvider>
      <AuthProvider>
        <PromiseStoreProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" options={{ animation: 'fade' }} />
              <Stack.Screen name="landing" options={{ animation: 'fade' }} />
              <Stack.Screen name="home" options={{ animation: 'fade_from_bottom' }} />
              <Stack.Screen name="stats" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="check-in" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
              <Stack.Screen name="promise/new" options={{ animation: 'fade_from_bottom' }} />
              <Stack.Screen name="promise/[id]" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="promise/success" options={{ animation: 'fade', gestureEnabled: false }} />
              <Stack.Screen name="s/[token]" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="claim/[token]" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="auth" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            </Stack>
            <StatusBar style="light" />
          </ThemeProvider>
        </PromiseStoreProvider>
      </AuthProvider>
    </StripeProvider>
  );
}

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { AuthProvider } from '@/context/auth';
import { PromiseStoreProvider } from '@/context/promise-store';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { initializeNotifications } from '@/lib/notifications/setup';
import { StripeProvider } from '@/lib/stripe';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  // Initialize notifications on app start
  useEffect(() => {
    initializeNotifications().catch(console.error);
  }, []);

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

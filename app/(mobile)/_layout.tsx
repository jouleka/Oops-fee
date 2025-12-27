/**
 * Mobile-only route layout
 * Routes in (mobile)/ are blocked on web and redirect to landing page
 */

import { Redirect, Stack } from 'expo-router';
import { Platform } from 'react-native';

export default function MobileLayout() {
  // Block web users - redirect to marketing page
  if (Platform.OS === 'web') {
    return <Redirect href="/" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="home" options={{ animation: 'fade_from_bottom' }} />
      <Stack.Screen name="stats" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="check-in" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="profile" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="graveyard" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="leaderboard" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="setup-username" options={{ animation: 'fade' }} />
      <Stack.Screen name="promise/new" options={{ animation: 'fade_from_bottom' }} />
      <Stack.Screen name="promise/[id]" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="promise/success" options={{ animation: 'fade', gestureEnabled: false }} />
      <Stack.Screen name="friends" options={{ headerShown: false }} />
    </Stack>
  );
}


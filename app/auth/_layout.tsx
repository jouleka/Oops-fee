/**
 * Auth routes layout (public - accessible without authentication)
 */

import { Stack } from 'expo-router';

export default function AuthRoutesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="sign-in"
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="callback"
        options={{
          presentation: 'transparentModal',
        }}
      />
    </Stack>
  );
}


/**
 * Entry point
 * - Web: Show marketing landing page (app store download funnel)
 * - Native: Route to onboarding (first time) or home (returning user)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';

import { WebMarketingLanding } from '@/components/landing';
import { Colors } from '@/constants/theme';

const ONBOARDING_KEY = '@oopsfee:has_completed_onboarding';

export default function Index() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  useEffect(() => {
    // Skip AsyncStorage check on web - we always show marketing page
    if (Platform.OS === 'web') {
      setIsLoading(false);
      return;
    }
    checkOnboardingStatus();
  }, []);

  async function checkOnboardingStatus() {
    try {
      const value = await AsyncStorage.getItem(ONBOARDING_KEY);
      setHasCompletedOnboarding(value === 'true');
    } catch {
      // On error, show onboarding to be safe
      setHasCompletedOnboarding(false);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  // Web → show marketing landing page with app store buttons
  if (Platform.OS === 'web') {
    return <WebMarketingLanding />;
  }

  // Native: First time user → show landing/onboarding
  if (!hasCompletedOnboarding) {
    return <Redirect href="/landing" />;
  }

  // Native: Returning user → go straight to home
  return <Redirect href="/(mobile)/home" />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: Colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

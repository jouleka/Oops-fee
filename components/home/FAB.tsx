/**
 * FAB - Floating Action Button for creating new promises
 */

import { LinearGradient } from 'expo-linear-gradient';
import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';

import { Animation, Colors, Shadows, Spacing } from '@/constants/theme';
import { hapticMedium } from '@/lib/haptics';

interface FABProps {
  onPress: () => void;
}

export function FAB({ onPress }: FABProps) {
  const scale = useSharedValue(1);

  const handlePress = useCallback(() => {
    scale.value = withSequence(
      withSpring(0.88, { damping: 12 }),
      withSpring(1, Animation.spring)
    );
    hapticMedium();
    onPress();
  }, [onPress, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.fab, animStyle, Shadows.lg]}>
      <Pressable onPress={handlePress} style={styles.touchable}>
        <LinearGradient
          colors={[Colors.accent, '#0A7FD4']}
          style={styles.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.icon}>+</Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

interface FABWrapperProps {
  children: React.ReactNode;
  bottom: number;
}

export function FABWrapper({ children, bottom }: FABWrapperProps) {
  return (
    <View style={[styles.wrapper, { bottom: bottom + Spacing.xl }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    right: Spacing.xl,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  touchable: {
    flex: 1,
    borderRadius: 28,
    overflow: 'hidden',
  },
  gradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 30,
    color: Colors.text,
    fontWeight: '300',
    marginTop: -1,
  },
});


import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSpring,
} from 'react-native-reanimated';

interface TypingIndicatorProps {
  side: 'sent' | 'received';
}

export function TypingIndicator({ side }: TypingIndicatorProps) {
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    const animate = () => {
      dot1.value = withSpring(1, { damping: 10, stiffness: 150 });
      dot2.value = withDelay(120, withSpring(1, { damping: 10, stiffness: 150 }));
      dot3.value = withDelay(240, withSpring(1, { damping: 10, stiffness: 150 }));

      setTimeout(() => {
        dot1.value = withSpring(0.4, { damping: 10, stiffness: 150 });
        dot2.value = withDelay(120, withSpring(0.4, { damping: 10, stiffness: 150 }));
        dot3.value = withDelay(240, withSpring(0.4, { damping: 10, stiffness: 150 }));
      }, 500);
    };

    animate();
    const interval = setInterval(animate, 1000);
    return () => clearInterval(interval);
  }, [dot1, dot2, dot3]);

  const dot1Style = useAnimatedStyle(() => ({
    opacity: dot1.value,
    transform: [{ scale: 0.85 + dot1.value * 0.15 }],
  }));

  const dot2Style = useAnimatedStyle(() => ({
    opacity: dot2.value,
    transform: [{ scale: 0.85 + dot2.value * 0.15 }],
  }));

  const dot3Style = useAnimatedStyle(() => ({
    opacity: dot3.value,
    transform: [{ scale: 0.85 + dot3.value * 0.15 }],
  }));

  const isSent = side === 'sent';
  const dotColor = isSent ? 'rgba(255,255,255,0.8)' : '#8e8e93';

  return (
    <View style={[styles.bubble, isSent ? styles.sent : styles.received, styles.typingBubble]}>
      <View style={styles.typingContainer}>
        <Animated.View style={[styles.typingDot, { backgroundColor: dotColor }, dot1Style]} />
        <Animated.View style={[styles.typingDot, { backgroundColor: dotColor }, dot2Style]} />
        <Animated.View style={[styles.typingDot, { backgroundColor: dotColor }, dot3Style]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
  },
  sent: {
    alignSelf: 'flex-end',
    backgroundColor: '#0b93f6',
  },
  received: {
    alignSelf: 'flex-start',
    backgroundColor: '#2c2c2e',
  },
  typingBubble: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginVertical: 2,
  },
  typingContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
});

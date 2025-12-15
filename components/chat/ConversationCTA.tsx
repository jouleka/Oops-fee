import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { REPLY_TEXT } from '@/constants/conversation';

interface ConversationCTAProps {
  onStart: () => void;
  onShare: () => void;
  onLayout: (height: number) => void;
  bottomInset: number;
}

export function ConversationCTA({ onStart, onShare, onLayout, bottomInset }: ConversationCTAProps) {
  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={styles.ctaContainer}
      onLayout={(e) => onLayout(e.nativeEvent.layout.height)}
    >
      <View style={[styles.ctaInner, { paddingBottom: bottomInset + 12 }]}>
        <Pressable
          onPress={onStart}
          style={({ pressed }) => [styles.responseButton, pressed && styles.responseButtonPressed]}
        >
          <Text style={styles.responseButtonText}>{REPLY_TEXT}</Text>
        </Pressable>

        <Pressable
          onPress={onShare}
          style={({ pressed }) => [styles.altButton, pressed && styles.altButtonPressed]}
        >
          <Text style={styles.altButtonText}>Send to friend who needs this</Text>
        </Pressable>

        <Text style={styles.bottomNote}>
          {"No card required. Until you break a promise.\nThen... well."}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ctaContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#000',
    borderTopWidth: 0.5,
    borderTopColor: '#2c2c2e',
  },
  ctaInner: {
    padding: 16,
    gap: 10,
  },
  responseButton: {
    backgroundColor: '#0b93f6',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 22,
    alignItems: 'center',
  },
  responseButtonPressed: {
    backgroundColor: '#0a84e0',
    transform: [{ scale: 0.98 }],
  },
  responseButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  altButton: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  altButtonPressed: {
    opacity: 0.7,
  },
  altButtonText: {
    color: '#0b93f6',
    fontSize: 14,
    fontWeight: '500',
  },
  bottomNote: {
    fontSize: 11,
    color: '#48484a',
    textAlign: 'center',
    marginTop: 2,
    lineHeight: 16,
  },
});

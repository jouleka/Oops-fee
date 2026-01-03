import { Pressable, Text, View } from 'react-native';
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
      onLayout={(e) => onLayout(e.nativeEvent.layout.height)}
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#1c1c1e',
        borderTopWidth: 1,
        borderTopColor: '#3a3a3c',
        paddingTop: 12,
        paddingHorizontal: 12,
        paddingBottom: bottomInset + 12,
      }}
    >
      {/* Input bar row */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {/* Text input field */}
        <Pressable
          onPress={onStart}
          style={{
            flex: 1,
            backgroundColor: '#2c2c2e',
            borderRadius: 20,
            borderWidth: 1,
            borderColor: '#48484a',
            paddingHorizontal: 16,
            paddingVertical: 10,
            marginRight: 10,
          }}
        >
          <Text style={{ color: '#ffffff', fontSize: 16 }}>{REPLY_TEXT}</Text>
        </Pressable>

        {/* Send button */}
        <Pressable
          onPress={onStart}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: '#0b93f6',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#ffffff', fontSize: 22, fontWeight: '700', marginTop: -2 }}>↑</Text>
        </Pressable>
      </View>

      {/* Share link */}
      <Pressable onPress={onShare} style={{ alignItems: 'center', paddingVertical: 10 }}>
        <Text style={{ color: '#0b93f6', fontSize: 14, fontWeight: '500' }}>
          Send to friend who needs this
        </Text>
      </Pressable>

      {/* Disclaimer */}
      <Text style={{ color: '#8e8e93', fontSize: 11, textAlign: 'center', lineHeight: 16 }}>
        {"No card required. Until you break a promise.\nThen... well."}
      </Text>
    </Animated.View>
  );
}

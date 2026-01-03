import { StyleSheet, Text, View } from 'react-native';
import Animated, {
    FadeInDown,
    FadeInLeft,
    FadeInRight,
    Layout,
} from 'react-native-reanimated';

import type { Message } from '@/constants/conversation';

interface MessageBubbleProps {
  message: Message;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  animate?: boolean;
}

export function MessageBubble({
  message,
  isFirstInGroup,
  isLastInGroup,
  animate,
}: MessageBubbleProps) {
  if (message.type === 'date') {
    const content = (
      <View style={styles.dateContainer}>
        <Text style={styles.dateText}>{message.text}</Text>
      </View>
    );

    if (animate) {
      return (
        <Animated.View entering={FadeInDown.duration(220)} layout={Layout.springify()}>
          {content}
        </Animated.View>
      );
    }
    return content;
  }

  const isSent = message.type === 'sent';

  const getBorderRadii = () => {
    if (isSent) {
      return {
        borderTopRightRadius: isFirstInGroup ? 18 : 4,
        borderBottomRightRadius: isLastInGroup ? 18 : 4,
      };
    }
    return {
      borderTopLeftRadius: isFirstInGroup ? 18 : 4,
      borderBottomLeftRadius: isLastInGroup ? 18 : 4,
    };
  };

  const content = (
    <View
      style={[
        styles.bubble,
        isSent ? styles.sent : styles.received,
        getBorderRadii(),
        { marginTop: isFirstInGroup ? 4 : 1, marginBottom: isLastInGroup ? 4 : 1 },
      ]}
    >
      <Text style={[styles.bubbleText, isSent ? styles.sentText : styles.receivedText]}>
        {message.text}
      </Text>
    </View>
  );

  if (animate) {
    return (
      <Animated.View
        entering={(isSent ? FadeInRight : FadeInLeft).duration(220)}
        layout={Layout.springify().damping(18).stiffness(180)}
      >
        {content}
      </Animated.View>
    );
  }

  return content;
}

export function getMessageGrouping(messages: Message[], index: number) {
  const current = messages[index];
  if (current.type === 'date') return { isFirst: false, isLast: false };

  const prev = messages[index - 1];
  const next = messages[index + 1];

  const isFirst = !prev || prev.type === 'date' || prev.type !== current.type;
  const isLast = !next || next.type === 'date' || next.type !== current.type;

  return { isFirst, isLast };
}

const styles = StyleSheet.create({
  dateContainer: {
    alignItems: 'center',
    paddingVertical: 12,
    marginVertical: 4,
  },
  dateText: {
    fontSize: 12,
    color: '#8e8e93',
    fontWeight: '500',
  },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    overflow: 'hidden',
  },
  sent: {
    alignSelf: 'flex-end',
    backgroundColor: '#0b93f6',
  },
  received: {
    alignSelf: 'flex-start',
    backgroundColor: '#2c2c2e',
  },
  bubbleText: {
    fontSize: 16,
    lineHeight: 20,
  },
  sentText: {
    color: '#ffffff',
  },
  receivedText: {
    color: '#ffffff',
  },
});

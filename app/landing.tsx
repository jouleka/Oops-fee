import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInRight, FadeOut, Layout } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
    ConversationCTA,
    getMessageGrouping,
    MessageBubble,
    TypingIndicator,
} from '@/components/chat';
import { CTA_HEIGHT, REPLY_TEXT } from '@/constants/conversation';
import { useConversationPlayback } from '@/hooks/use-conversation-playback';

const ONBOARDING_KEY = '@oopsfee:has_completed_onboarding';

export default function LandingScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [ctaHeight, setCtaHeight] = useState<number>(CTA_HEIGHT);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const isNearBottomRef = useRef(true);

  const {
    visibleMessages,
    currentTyping,
    showCTA,
    showUserTyping,
    isSending,
    showSentReply,
    animateMessages,
    isAutoPlaying,
    handleTap,
    startSending,
    allowAdvanceTap,
  } = useConversationPlayback();

  const scrollBottomPadding = showCTA ? Math.max(ctaHeight, CTA_HEIGHT) + 32 : insets.bottom + 24;
  const fabBottomOffset = showCTA ? Math.max(ctaHeight, CTA_HEIGHT) + 16 : insets.bottom + 12;

  // Auto-scroll when content changes
  useEffect(() => {
    const shouldScroll = showCTA || isNearBottomRef.current || isAutoPlaying;
    if (!shouldScroll) return;
    const delay = showCTA ? 100 : 50;
    const timer = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, delay);
    return () => clearTimeout(timer);
  }, [
    visibleMessages.length,
    currentTyping,
    showUserTyping,
    showSentReply,
    showCTA,
    ctaHeight,
    isAutoPlaying,
  ]);

  const onMessagesScroll = useCallback((e: { nativeEvent: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } } }) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    const isNearBottom = distanceFromBottom < 80;
    if (isNearBottom !== isNearBottomRef.current) {
      isNearBottomRef.current = isNearBottom;
      setShowScrollToBottom(!isNearBottom);
    }
  }, []);

  async function onStart() {
    await startSending();
    // Mark onboarding as complete so we skip it next time
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
    router.replace('/home');
  }

  async function onShare() {
    try {
      await Share.share({
        message:
          "I'm tired of lying to myself so I got an app that charges me money when I break promises.\n\nYeah.\n\noopsfee.app",
      });
    } catch {}
  }

  const MessagesWrapper = allowAdvanceTap ? Pressable : View;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerCenter}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>🪞</Text>
          </View>
          <View>
            <Text style={styles.contactName}>You (honest version)</Text>
            <Text style={styles.contactStatus}>has been waiting</Text>
          </View>
        </View>
      </View>

      {/* Messages */}
      <MessagesWrapper
        style={styles.messagesWrapper}
        {...(allowAdvanceTap ? { onPress: handleTap } : {})}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.messages}
          contentContainerStyle={[styles.messagesContent, { paddingBottom: scrollBottomPadding }]}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={onMessagesScroll}
          keyboardShouldPersistTaps="handled"
        >
          {visibleMessages.map((msg, index) => {
            const { isFirst, isLast } = getMessageGrouping(visibleMessages, index);
            return (
              <MessageBubble
                key={msg.id}
                message={msg}
                isFirstInGroup={isFirst}
                isLastInGroup={isLast}
                animate={animateMessages}
              />
            );
          })}

          {/* Typing indicator */}
          {currentTyping && (
            <Animated.View
              entering={FadeInDown.duration(180)}
              exiting={FadeOut.duration(120)}
              layout={Layout.springify()}
            >
              <TypingIndicator side={currentTyping} />
            </Animated.View>
          )}

          {/* User typing indicator */}
          {showUserTyping && !showSentReply && (
            <Animated.View
              entering={FadeInDown.duration(180)}
              exiting={FadeOut.duration(120)}
              layout={Layout.springify()}
            >
              <TypingIndicator side="sent" />
            </Animated.View>
          )}

          {/* The sent reply */}
          {showSentReply && (
            <Animated.View
              entering={FadeInRight.duration(220)}
              layout={Layout.springify().damping(18).stiffness(180)}
            >
              <View style={[styles.bubble, styles.sent, styles.replyBubble]}>
                <Text style={[styles.bubbleText, styles.sentText]}>{REPLY_TEXT}</Text>
              </View>
              <View style={styles.deliveredContainer}>
                <Text style={styles.deliveredText}>Delivered</Text>
              </View>
            </Animated.View>
          )}
        </ScrollView>
      </MessagesWrapper>

      {/* Scroll-to-bottom */}
      {showScrollToBottom && (
        <Animated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(120)}
          style={[styles.scrollToBottom, { bottom: fabBottomOffset }]}
        >
          <Pressable
            onPress={() => scrollRef.current?.scrollToEnd({ animated: true })}
            style={({ pressed }) => [
              styles.scrollToBottomButton,
              pressed && styles.scrollToBottomButtonPressed,
            ]}
          >
            <Text style={styles.scrollToBottomText}>↓</Text>
          </Pressable>
        </Animated.View>
      )}

      {/* CTA */}
      {showCTA && !isSending && (
        <ConversationCTA
          onStart={onStart}
          onShare={onShare}
          onLayout={setCtaHeight}
          bottomInset={insets.bottom}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 54,
    paddingBottom: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#2c2c2e',
    backgroundColor: '#000',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2c2c2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
  },
  contactName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  contactStatus: {
    fontSize: 11,
    color: '#8e8e93',
  },
  messagesWrapper: {
    flex: 1,
  },
  messages: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingTop: 12,
  },
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
  replyBubble: {
    marginTop: 4,
    borderBottomRightRadius: 18,
  },
  bubbleText: {
    fontSize: 16,
    lineHeight: 20,
  },
  sentText: {
    color: '#fff',
  },
  deliveredContainer: {
    alignSelf: 'flex-end',
    marginTop: 4,
    marginRight: 4,
    marginBottom: 8,
  },
  deliveredText: {
    fontSize: 11,
    color: '#8e8e93',
  },
  scrollToBottom: {
    position: 'absolute',
    right: 14,
  },
  scrollToBottomButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(44,44,46,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: '#3a3a3c',
  },
  scrollToBottomButtonPressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.9,
  },
  scrollToBottomText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginTop: -1,
  },
});

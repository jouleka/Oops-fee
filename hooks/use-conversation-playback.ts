import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useReducer, useRef } from 'react';

import { CONVERSATION, TIMING } from '@/constants/conversation';

// Types
type TypingSide = 'sent' | 'received' | null;

interface State {
  visibleCount: number;
  currentTyping: TypingSide;
  showCTA: boolean;
  showUserTyping: boolean;
  isSending: boolean;
  showSentReply: boolean;
  animateMessages: boolean;
  isAutoPlaying: boolean;
  conversationComplete: boolean;
}

type Action =
  | { type: 'SHOW_MESSAGE' }
  | { type: 'SET_TYPING'; side: TypingSide }
  | { type: 'COMPLETE_TYPING' }
  | { type: 'SHOW_CTA' }
  | { type: 'START_SENDING' }
  | { type: 'SHOW_REPLY' }
  | { type: 'STOP_AUTO_PLAY' }
  | { type: 'SKIP_TO_END' };

const initialState: State = {
  visibleCount: 0,
  currentTyping: null,
  showCTA: false,
  showUserTyping: false,
  isSending: false,
  showSentReply: false,
  animateMessages: true,
  isAutoPlaying: true,
  conversationComplete: false,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SHOW_MESSAGE':
      return { ...state, visibleCount: state.visibleCount + 1, currentTyping: null };
    case 'SET_TYPING':
      return { ...state, currentTyping: action.side };
    case 'COMPLETE_TYPING':
      return { ...state, currentTyping: null };
    case 'SHOW_CTA':
      return {
        ...state,
        conversationComplete: true,
        currentTyping: null,
        showUserTyping: true,
        showCTA: true,
      };
    case 'START_SENDING':
      return { ...state, isSending: true, showCTA: false, showUserTyping: false };
    case 'SHOW_REPLY':
      return { ...state, showSentReply: true };
    case 'STOP_AUTO_PLAY':
      return { ...state, isAutoPlaying: false };
    case 'SKIP_TO_END':
      return {
        ...state,
        animateMessages: false,
        isAutoPlaying: false,
        currentTyping: null,
        visibleCount: CONVERSATION.length,
        showUserTyping: true,
        showCTA: true,
        isSending: false,
        showSentReply: false,
        conversationComplete: true,
      };
    default:
      return state;
  }
}

// Session skip flag - persists across re-renders but resets on app restart
let shouldSkipIntroThisSession = false;

export function markSessionAsStarted() {
  shouldSkipIntroThisSession = true;
}

export function useConversationPlayback() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const autoPlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visibleMessages = CONVERSATION.slice(0, state.visibleCount);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (autoPlayTimer.current) clearTimeout(autoPlayTimer.current);
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, []);

  const clearTimers = useCallback(() => {
    if (autoPlayTimer.current) {
      clearTimeout(autoPlayTimer.current);
      autoPlayTimer.current = null;
    }
    if (typingTimer.current) {
      clearTimeout(typingTimer.current);
      typingTimer.current = null;
    }
  }, []);

  // Show next message
  const showNextMessage = useCallback(() => {
    if (state.visibleCount >= CONVERSATION.length) {
      if (!state.conversationComplete) {
        dispatch({ type: 'SET_TYPING', side: null });
        setTimeout(() => {
          dispatch({ type: 'SHOW_CTA' });
        }, 400);
      }
      return;
    }

    const nextMsg = CONVERSATION[state.visibleCount];
    clearTimers();

    if (nextMsg.type === 'date') {
      dispatch({ type: 'SHOW_MESSAGE' });

      if (state.isAutoPlaying) {
        autoPlayTimer.current = setTimeout(() => {
          showNextMessage();
        }, TIMING.DATE_DELAY);
      }
    } else {
      dispatch({ type: 'SET_TYPING', side: nextMsg.type as 'sent' | 'received' });
      Haptics.selectionAsync().catch(() => {});

      const typingTime = state.isAutoPlaying
        ? TIMING.TYPING_DURATION + Math.min(nextMsg.text.length * 12, 500) + Math.random() * 200
        : 0;

      typingTimer.current = setTimeout(() => {
        typingTimer.current = null;
        dispatch({ type: 'SHOW_MESSAGE' });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

        if (state.isAutoPlaying) {
          autoPlayTimer.current = setTimeout(() => {
            showNextMessage();
          }, TIMING.PAUSE_BETWEEN);
        }
      }, typingTime);
    }
  }, [state.visibleCount, state.isAutoPlaying, state.conversationComplete, clearTimers]);

  // Handle tap to advance
  const handleTap = useCallback(() => {
    if (state.conversationComplete || state.showCTA) return;

    dispatch({ type: 'STOP_AUTO_PLAY' });
    clearTimers();

    if (state.currentTyping) {
      dispatch({ type: 'SHOW_MESSAGE' });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } else {
      showNextMessage();
    }
  }, [state.currentTyping, state.showCTA, state.conversationComplete, clearTimers, showNextMessage]);

  // Skip to end state
  const skipToEnd = useCallback(() => {
    dispatch({ type: 'SKIP_TO_END' });
  }, []);

  // Start conversation
  useEffect(() => {
    if (shouldSkipIntroThisSession) {
      skipToEnd();
      return;
    }

    const timer = setTimeout(() => {
      showNextMessage();
    }, 500);
    return () => clearTimeout(timer);
  }, [skipToEnd, showNextMessage]);

  // Start sending (CTA press)
  const startSending = useCallback(async () => {
    if (state.isSending) return;
    markSessionAsStarted();

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    dispatch({ type: 'START_SENDING' });

    await new Promise((r) => setTimeout(r, 150));
    dispatch({ type: 'SHOW_REPLY' });

    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}

    await new Promise((r) => setTimeout(r, 1200));
  }, [state.isSending]);

  return {
    ...state,
    visibleMessages,
    handleTap,
    startSending,
    allowAdvanceTap:
      !state.showCTA && !state.showSentReply && state.visibleCount < CONVERSATION.length,
  };
}

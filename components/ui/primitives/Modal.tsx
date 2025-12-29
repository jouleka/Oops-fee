/**
 * Modal - Bottom sheet modal wrapper
 * Features: Swipe to dismiss, backdrop tap, animated entrance
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Keyboard,
  Modal as RNModal,
  PanResponder,
  Pressable,
  View,
  type ModalProps as RNModalProps,
} from 'react-native';
import Animated, {
  FadeIn,
  SlideInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ModalProps extends Omit<RNModalProps, 'animationType' | 'transparent'> {
  /** Whether modal is visible */
  visible: boolean;
  /** Called when modal should close */
  onClose: () => void;
  /** Modal content */
  children: React.ReactNode;
  /** Disable swipe to dismiss */
  disableSwipe?: boolean;
  /** Disable backdrop tap to dismiss */
  disableBackdropPress?: boolean;
  /** Show grab handle */
  showHandle?: boolean;
  /** Custom max height (0-1 as percentage of screen) */
  maxHeight?: number;
}

export function Modal({
  visible,
  onClose,
  children,
  disableSwipe = false,
  disableBackdropPress = false,
  showHandle = true,
  maxHeight = 0.9,
  ...modalProps
}: ModalProps) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(0);
  const closingRef = useRef(false);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      translateY.value = 0;
      closingRef.current = false;
    }
  }, [visible, translateY]);

  const dismiss = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    Keyboard.dismiss();
    translateY.value = withTiming(700, { duration: 180 });
    setTimeout(() => {
      closingRef.current = false;
      onClose();
    }, 180);
  }, [onClose, translateY]);

  const sheetAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, g) =>
          !disableSwipe && g.dy > 4 && Math.abs(g.dx) < 18,
        onPanResponderMove: (_evt, g) => {
          if (g.dy <= 0) return;
          translateY.value = g.dy;
        },
        onPanResponderRelease: (_evt, g) => {
          const shouldClose = g.dy > 120 || g.vy > 1.2;
          if (shouldClose) {
            dismiss();
            return;
          }
          translateY.value = withSpring(0, { damping: 16, stiffness: 180 });
        },
        onPanResponderTerminate: () => {
          translateY.value = withSpring(0, { damping: 16, stiffness: 180 });
        },
      }),
    [disableSwipe, dismiss, translateY]
  );

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={dismiss}
      {...modalProps}
    >
      <View className="flex-1 justify-end">
        {/* Backdrop */}
        <Animated.View
          entering={FadeIn.duration(200)}
          className="absolute inset-0 bg-black/60"
        >
          <Pressable
            className="flex-1"
            onPress={disableBackdropPress ? undefined : dismiss}
          />
        </Animated.View>

        {/* Sheet */}
        <Animated.View
          entering={SlideInDown.springify().damping(18).stiffness(140)}
          style={[sheetAnimStyle, { maxHeight: `${maxHeight * 100}%` }]}
          className="bg-abyss-800 rounded-t-3xl border-t border-white/10"
          {...panResponder.panHandlers}
        >
          {/* Handle */}
          {showHandle && (
            <View className="items-center pt-3 pb-2">
              <View className="w-9 h-1 rounded-full bg-white/20" />
            </View>
          )}

          {/* Content with safe area padding */}
          <View style={{ paddingBottom: Math.max(insets.bottom, 20) }}>
            {children}
          </View>
        </Animated.View>
      </View>
    </RNModal>
  );
}

/**
 * ModalHeader - Standard modal header with title and optional subtitle
 */
interface ModalHeaderProps {
  title: string;
  subtitle?: string;
  className?: string;
}

export function ModalHeader({ title, subtitle, className = '' }: ModalHeaderProps) {
  return (
    <View className={`px-5 py-4 gap-1 ${className}`}>
      <Animated.Text
        entering={FadeIn.delay(100).duration(200)}
        className="text-white text-xl font-bold"
      >
        {title}
      </Animated.Text>
      {subtitle && (
        <Animated.Text
          entering={FadeIn.delay(150).duration(200)}
          className="text-white/60 text-base"
        >
          {subtitle}
        </Animated.Text>
      )}
    </View>
  );
}

/**
 * ModalContent - Scrollable content area
 */
interface ModalContentProps {
  children: React.ReactNode;
  className?: string;
}

export function ModalContent({ children, className = '' }: ModalContentProps) {
  return (
    <View className={`px-5 ${className}`}>
      {children}
    </View>
  );
}

/**
 * ModalFooter - Footer with action buttons
 */
interface ModalFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function ModalFooter({ children, className = '' }: ModalFooterProps) {
  return (
    <View className={`px-5 pt-4 gap-3 ${className}`}>
      {children}
    </View>
  );
}


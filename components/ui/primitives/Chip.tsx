/**
 * Chip - Selectable pill/chip component
 * Used for: stake presets, filters, multi-select options
 */

import { useState } from 'react';
import { Pressable, Text, View, type PressableProps } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { hapticLight } from '@/lib/haptics';

type ChipVariant = 'default' | 'accent' | 'danger' | 'success';
type ChipSize = 'sm' | 'md' | 'lg';

interface ChipProps extends Omit<PressableProps, 'children'> {
  /** Chip label */
  children: string;
  /** Whether the chip is selected */
  selected?: boolean;
  /** Visual variant (affects selected state color) */
  variant?: ChipVariant;
  /** Size variant */
  size?: ChipSize;
  /** Left icon (emoji) */
  icon?: string;
  /** Right icon (emoji) */
  iconRight?: string;
  className?: string;
}

const SIZE_CLASSES: Record<ChipSize, { container: string; text: string }> = {
  sm: {
    container: 'px-2.5 py-1.5 rounded-lg',
    text: 'text-sm',
  },
  md: {
    container: 'px-3 py-2 rounded-full',
    text: 'text-base',
  },
  lg: {
    container: 'px-4 py-2.5 rounded-full',
    text: 'text-lg',
  },
};

const VARIANT_CLASSES: Record<ChipVariant, { selected: string; selectedText: string }> = {
  default: {
    selected: 'bg-white/20 border-white/30',
    selectedText: 'text-white',
  },
  accent: {
    selected: 'bg-blue-500/20 border-blue-500',
    selectedText: 'text-blue-400',
  },
  danger: {
    selected: 'bg-red-500/15 border-red-500',
    selectedText: 'text-red-400',
  },
  success: {
    selected: 'bg-green-500/15 border-green-500',
    selectedText: 'text-green-400',
  },
};

const BASE_CLASSES = 'bg-white/[0.04] border border-white/10';
const BASE_TEXT_CLASSES = 'text-white/70 font-medium';
const PRESSED_CLASSES = 'bg-white/[0.08]';

export function Chip({
  children,
  selected = false,
  variant = 'default',
  size = 'md',
  icon,
  iconRight,
  onPress,
  disabled,
  className = '',
  ...pressableProps
}: ChipProps) {
  const scale = useSharedValue(1);
  const [isPressed, setIsPressed] = useState(false);
  const sizeConfig = SIZE_CLASSES[size];
  const variantConfig = VARIANT_CLASSES[variant];

  const handlePress = (e: Parameters<NonNullable<PressableProps['onPress']>>[0]) => {
    scale.value = withSpring(0.95, { damping: 15 });
    setTimeout(() => {
      scale.value = withSpring(1, { damping: 15 });
    }, 100);
    hapticLight();
    onPress?.(e);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const containerClasses = selected
    ? `${sizeConfig.container} ${variantConfig.selected}`
    : `${sizeConfig.container} ${BASE_CLASSES}`;

  const textClasses = selected
    ? `${sizeConfig.text} ${variantConfig.selectedText} font-semibold`
    : `${sizeConfig.text} ${BASE_TEXT_CLASSES}`;

  const pressedClass = isPressed && !selected ? PRESSED_CLASSES : '';

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={handlePress}
        onPressIn={() => setIsPressed(true)}
        onPressOut={() => setIsPressed(false)}
        disabled={disabled}
        className={`flex-row items-center ${containerClasses} ${pressedClass} ${disabled ? 'opacity-50' : ''} ${className}`}
        {...pressableProps}
      >
        {icon && <Text className={`mr-1.5 ${sizeConfig.text}`}>{icon}</Text>}
        <Text className={textClasses}>{children}</Text>
        {iconRight && <Text className={`ml-1.5 ${sizeConfig.text}`}>{iconRight}</Text>}
      </Pressable>
    </Animated.View>
  );
}

/**
 * ChipGroup - Wrapper for horizontal chip row with proper spacing
 */
interface ChipGroupProps {
  children: React.ReactNode;
  /** Wrap chips to multiple lines */
  wrap?: boolean;
  className?: string;
}

export function ChipGroup({ children, wrap = false, className = '' }: ChipGroupProps) {
  return (
    <View
      className={`flex-row items-center gap-2 ${wrap ? 'flex-wrap' : ''} ${className}`}
    >
      {children}
    </View>
  );
}

/**
 * IconChip - Icon-only chip (for increment/decrement buttons)
 */
interface IconChipProps extends Omit<PressableProps, 'children'> {
  icon: string;
  size?: ChipSize;
  variant?: ChipVariant;
  className?: string;
}

export function IconChip({
  icon,
  size = 'md',
  onPress,
  disabled,
  className = '',
  ...pressableProps
}: IconChipProps) {
  const scale = useSharedValue(1);
  const [isPressed, setIsPressed] = useState(false);

  const handlePress = (e: Parameters<NonNullable<PressableProps['onPress']>>[0]) => {
    scale.value = withSpring(0.9, { damping: 15 });
    setTimeout(() => {
      scale.value = withSpring(1, { damping: 15 });
    }, 100);
    hapticLight();
    onPress?.(e);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const sizeClasses: Record<ChipSize, string> = {
    sm: 'w-8 h-8 rounded-lg',
    md: 'w-10 h-10 rounded-full',
    lg: 'w-12 h-12 rounded-full',
  };

  const textSizes: Record<ChipSize, string> = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-xl',
  };

  const pressedClass = isPressed ? PRESSED_CLASSES : '';

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={handlePress}
        onPressIn={() => setIsPressed(true)}
        onPressOut={() => setIsPressed(false)}
        disabled={disabled}
        className={`${sizeClasses[size]} ${BASE_CLASSES} items-center justify-center ${pressedClass} ${disabled ? 'opacity-50' : ''} ${className}`}
        {...pressableProps}
      >
        <Text className={`${textSizes[size]} text-white/70`}>{icon}</Text>
      </Pressable>
    </Animated.View>
  );
}

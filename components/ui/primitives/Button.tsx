/**
 * Button - Reusable button with multiple variants
 * Supports: primary, secondary, danger, ghost, and custom gradients
 */

import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View, type PressableProps } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';

import { hapticLight, hapticMedium } from '@/lib/haptics';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<PressableProps, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Button label text */
  children: string;
  /** Show loading spinner */
  loading?: boolean;
  /** Left icon (emoji or component) */
  icon?: React.ReactNode;
  /** Right icon (emoji or component) */
  iconRight?: React.ReactNode;
  /** Use stronger haptic feedback */
  strongHaptic?: boolean;
  /** Full width button */
  fullWidth?: boolean;
  className?: string;
}

const GRADIENT_COLORS: Record<string, readonly [string, string]> = {
  primary: ['#007AFF', '#0066D6'] as const,
  danger: ['#FF3B30', '#FF6B35'] as const,
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-3 py-2 rounded-lg',
  md: 'px-4 py-3 rounded-xl',
  lg: 'px-6 py-4 rounded-2xl',
};

const SIZE_TEXT_CLASSES: Record<ButtonSize, string> = {
  sm: 'text-sm font-semibold',
  md: 'text-base font-semibold',
  lg: 'text-lg font-bold',
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: '', // Uses gradient
  secondary: 'bg-white/10',
  danger: '', // Uses gradient
  ghost: 'bg-transparent',
  outline: 'bg-transparent border border-white/20',
};

const VARIANT_TEXT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'text-white',
  secondary: 'text-white',
  danger: 'text-white',
  ghost: 'text-white/70',
  outline: 'text-white',
};

const PRESSED_CLASSES: Record<ButtonVariant, string> = {
  primary: 'opacity-90',
  secondary: 'bg-white/15',
  danger: 'opacity-90',
  ghost: 'bg-white/5',
  outline: 'bg-white/5',
};

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  loading = false,
  icon,
  iconRight,
  disabled,
  onPress,
  strongHaptic = false,
  fullWidth = false,
  className = '',
  ...pressableProps
}: ButtonProps) {
  const scale = useSharedValue(1);
  const [isPressed, setIsPressed] = useState(false);

  const handlePress = (e: Parameters<NonNullable<PressableProps['onPress']>>[0]) => {
    scale.value = withSequence(
      withSpring(0.95, { damping: 12 }),
      withSpring(1, { damping: 18, stiffness: 180 })
    );
    if (strongHaptic) {
      hapticMedium();
    } else {
      hapticLight();
    }
    onPress?.(e);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const isDisabled = disabled || loading;
  const useGradient = variant === 'primary' || variant === 'danger';
  const sizeClasses = SIZE_CLASSES[size];
  const textClasses = SIZE_TEXT_CLASSES[size];
  const variantClasses = VARIANT_CLASSES[variant];
  const textVariantClasses = VARIANT_TEXT_CLASSES[variant];
  const widthClass = fullWidth ? 'w-full' : '';
  const pressedClasses = isPressed ? PRESSED_CLASSES[variant] : '';

  const content = (
    <>
      {loading ? (
        <ActivityIndicator color="white" size="small" />
      ) : (
        <>
          {icon && <Text className="mr-2">{icon}</Text>}
          <Text className={`${textClasses} ${textVariantClasses} text-center`}>
            {children}
          </Text>
          {iconRight && <Text className="ml-2">{iconRight}</Text>}
        </>
      )}
    </>
  );

  if (useGradient && !isDisabled) {
    return (
      <Animated.View style={animatedStyle} className={widthClass}>
        <Pressable
          onPress={handlePress}
          onPressIn={() => setIsPressed(true)}
          onPressOut={() => setIsPressed(false)}
          disabled={isDisabled}
          className={`${sizeClasses} overflow-hidden ${widthClass} ${pressedClasses} ${className}`}
          {...pressableProps}
        >
          <LinearGradient
            colors={[...GRADIENT_COLORS[variant]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              opacity: isPressed ? 0.9 : 1,
            }}
          />
          <View className="flex-row items-center justify-center z-10">
            {content}
          </View>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={animatedStyle} className={widthClass}>
      <Pressable
        onPress={handlePress}
        onPressIn={() => setIsPressed(true)}
        onPressOut={() => setIsPressed(false)}
        disabled={isDisabled}
        className={`${sizeClasses} ${variantClasses} flex-row items-center justify-center ${widthClass} ${isDisabled ? 'opacity-50' : ''} ${pressedClasses} ${className}`}
        {...pressableProps}
      >
        {content}
      </Pressable>
    </Animated.View>
  );
}

/**
 * IconButton - Circular icon-only button (like FAB)
 */
interface IconButtonProps extends Omit<PressableProps, 'children'> {
  icon: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  className?: string;
}

const ICON_BUTTON_SIZES: Record<string, string> = {
  sm: 'w-8 h-8 rounded-full',
  md: 'w-12 h-12 rounded-full',
  lg: 'w-14 h-14 rounded-full',
};

export function IconButton({
  icon,
  size = 'md',
  variant = 'secondary',
  onPress,
  disabled,
  className = '',
  ...props
}: IconButtonProps) {
  const scale = useSharedValue(1);
  const [isPressed, setIsPressed] = useState(false);

  const handlePress = (e: Parameters<NonNullable<PressableProps['onPress']>>[0]) => {
    scale.value = withSequence(
      withSpring(0.88, { damping: 12 }),
      withSpring(1, { damping: 18, stiffness: 180 })
    );
    hapticLight();
    onPress?.(e);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const sizeClass = ICON_BUTTON_SIZES[size];
  const variantClass = VARIANT_CLASSES[variant];
  const pressedClass = isPressed ? PRESSED_CLASSES[variant] : '';

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={handlePress}
        onPressIn={() => setIsPressed(true)}
        onPressOut={() => setIsPressed(false)}
        disabled={disabled}
        className={`${sizeClass} ${variantClass} items-center justify-center ${disabled ? 'opacity-50' : ''} ${pressedClass} ${className}`}
        {...props}
      >
        {icon}
      </Pressable>
    </Animated.View>
  );
}

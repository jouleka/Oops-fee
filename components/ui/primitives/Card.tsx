/**
 * Card - Reusable card component with glass morphism effect
 * Variants: default, elevated, danger, success
 */

import { useState } from 'react';
import { Pressable, View, type ViewProps } from 'react-native';

type CardVariant = 'default' | 'elevated' | 'danger' | 'success' | 'accent';

interface CardProps extends ViewProps {
  variant?: CardVariant;
  /** Adds press handler and pressed state styling */
  onPress?: () => void;
  /** Disable the card (dims opacity) */
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}

const VARIANT_CLASSES: Record<CardVariant, string> = {
  default: 'bg-white/[0.04] border-white/10',
  elevated: 'bg-white/[0.06] border-white/[0.12]',
  danger: 'bg-red-500/10 border-red-500/30',
  success: 'bg-green-500/10 border-green-500/30',
  accent: 'bg-blue-500/10 border-blue-500/30',
};

const PRESSED_CLASSES: Record<CardVariant, string> = {
  default: 'bg-white/[0.06]',
  elevated: 'bg-white/[0.08]',
  danger: 'bg-red-500/15',
  success: 'bg-green-500/15',
  accent: 'bg-blue-500/15',
};

export function Card({
  variant = 'default',
  onPress,
  disabled = false,
  children,
  className = '',
  ...viewProps
}: CardProps) {
  const [isPressed, setIsPressed] = useState(false);
  const baseClasses = 'rounded-2xl border overflow-hidden';
  const variantClasses = isPressed && onPress ? PRESSED_CLASSES[variant] : VARIANT_CLASSES[variant];
  const disabledClasses = disabled ? 'opacity-50' : '';

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        onPressIn={() => setIsPressed(true)}
        onPressOut={() => setIsPressed(false)}
        disabled={disabled}
        className={`${baseClasses} ${variantClasses} ${disabledClasses} ${className}`}
        {...viewProps}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View
      className={`${baseClasses} ${VARIANT_CLASSES[variant]} ${disabledClasses} ${className}`}
      {...viewProps}
    >
      {children}
    </View>
  );
}

/**
 * CardContent - Wrapper for card content with consistent padding
 */
export function CardContent({
  children,
  className = '',
  ...props
}: ViewProps & { children: React.ReactNode; className?: string }) {
  return (
    <View className={`p-4 ${className}`} {...props}>
      {children}
    </View>
  );
}

/**
 * CardAccent - Left accent bar (like urgency indicator)
 */
interface CardAccentProps {
  color?: string;
  className?: string;
}

export function CardAccent({ color, className = '' }: CardAccentProps) {
  return (
    <View
      className={`w-1 self-stretch ${className}`}
      style={color ? { backgroundColor: color } : undefined}
    />
  );
}

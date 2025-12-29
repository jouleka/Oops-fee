/**
 * Input - Text input with proper dark theme styling
 * Supports: prefix/suffix, icons, error state, multiline
 */

import { forwardRef, useState } from 'react';
import {
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewProps,
} from 'react-native';

import { Colors } from '@/constants/theme';

type InputSize = 'sm' | 'md' | 'lg';

interface InputProps extends TextInputProps {
  /** Input size variant */
  size?: InputSize;
  /** Label text above input */
  label?: string;
  /** Helper text below input */
  helper?: string;
  /** Error message (replaces helper when present) */
  error?: string;
  /** Prefix text (like "$") */
  prefix?: string;
  /** Suffix text (like "USD") */
  suffix?: string;
  /** Left icon element */
  leftIcon?: React.ReactNode;
  /** Right icon element */
  rightIcon?: React.ReactNode;
  /** Container className */
  containerClassName?: string;
}

const SIZE_CLASSES: Record<InputSize, { container: string; input: string; text: string }> = {
  sm: {
    container: 'px-3 py-2 rounded-lg',
    input: 'text-sm',
    text: 'text-sm',
  },
  md: {
    container: 'px-4 py-3 rounded-xl',
    input: 'text-base',
    text: 'text-base',
  },
  lg: {
    container: 'px-4 py-4 rounded-2xl',
    input: 'text-lg',
    text: 'text-lg',
  },
};

export const Input = forwardRef<TextInput, InputProps>(function Input(
  {
    size = 'md',
    label,
    helper,
    error,
    prefix,
    suffix,
    leftIcon,
    rightIcon,
    containerClassName = '',
    className = '',
    editable = true,
    ...textInputProps
  },
  ref
) {
  const [isFocused, setIsFocused] = useState(false);
  const sizeConfig = SIZE_CLASSES[size];
  
  const hasError = Boolean(error);
  const isDisabled = !editable;

  const borderClass = hasError
    ? 'border-red-500/50'
    : isFocused
    ? 'border-white/20'
    : 'border-white/10';

  const bgClass = isDisabled ? 'bg-white/[0.02]' : 'bg-abyss-800';

  return (
    <View className={containerClassName}>
      {/* Label */}
      {label && (
        <Text className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2 ml-1">
          {label}
        </Text>
      )}

      {/* Input container */}
      <View
        className={`flex-row items-center ${sizeConfig.container} ${bgClass} border ${borderClass}`}
      >
        {/* Left icon */}
        {leftIcon && <View className="mr-2">{leftIcon}</View>}

        {/* Prefix */}
        {prefix && (
          <Text className={`${sizeConfig.text} text-white/50 font-semibold mr-1`}>
            {prefix}
          </Text>
        )}

        {/* Text Input */}
        <TextInput
          ref={ref}
          className={`flex-1 ${sizeConfig.input} text-white ${className}`}
          placeholderTextColor={Colors.textMuted}
          cursorColor={Colors.accent}
          selectionColor={Colors.accentDim}
          editable={editable}
          onFocus={(e) => {
            setIsFocused(true);
            textInputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            textInputProps.onBlur?.(e);
          }}
          {...textInputProps}
        />

        {/* Suffix */}
        {suffix && (
          <Text className={`${sizeConfig.text} text-white/50 font-medium ml-1`}>
            {suffix}
          </Text>
        )}

        {/* Right icon */}
        {rightIcon && <View className="ml-2">{rightIcon}</View>}
      </View>

      {/* Helper/Error text */}
      {(helper || error) && (
        <Text
          className={`text-xs mt-1.5 ml-1 ${hasError ? 'text-red-400' : 'text-white/40'}`}
        >
          {error || helper}
        </Text>
      )}
    </View>
  );
});

/**
 * TextArea - Multiline text input
 */
interface TextAreaProps extends InputProps {
  /** Number of visible lines */
  lines?: number;
}

export const TextArea = forwardRef<TextInput, TextAreaProps>(function TextArea(
  { lines = 4, ...props },
  ref
) {
  return (
    <Input
      ref={ref}
      multiline
      numberOfLines={lines}
      textAlignVertical="top"
      className="min-h-[100px]"
      {...props}
    />
  );
});

/**
 * InputGroup - Wrapper for grouping input with label and actions
 */
interface InputGroupProps extends ViewProps {
  label?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export function InputGroup({
  label,
  action,
  children,
  className = '',
  ...viewProps
}: InputGroupProps) {
  return (
    <View className={`gap-2 ${className}`} {...viewProps}>
      {(label || action) && (
        <View className="flex-row items-center justify-between">
          {label && (
            <Text className="text-white/50 text-xs font-semibold uppercase tracking-wide ml-1">
              {label}
            </Text>
          )}
          {action}
        </View>
      )}
      {children}
    </View>
  );
}


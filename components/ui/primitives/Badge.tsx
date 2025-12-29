/**
 * Badge - Status badges and counters
 * Variants: default, success, warning, danger, accent
 */

import { Text, View, type ViewProps } from 'react-native';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'accent' | 'muted';
type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps extends ViewProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  /** Badge label */
  children: React.ReactNode;
  /** Optional left icon (emoji) */
  icon?: string;
  /** Filled style (more prominent) */
  filled?: boolean;
}

const VARIANT_CLASSES: Record<BadgeVariant, { bg: string; text: string; filledBg: string }> = {
  default: {
    bg: 'bg-white/10',
    text: 'text-white',
    filledBg: 'bg-white/20',
  },
  success: {
    bg: 'bg-green-500/15',
    text: 'text-green-400',
    filledBg: 'bg-green-500',
  },
  warning: {
    bg: 'bg-orange-500/15',
    text: 'text-orange-400',
    filledBg: 'bg-orange-500',
  },
  danger: {
    bg: 'bg-red-500/15',
    text: 'text-red-400',
    filledBg: 'bg-red-500',
  },
  accent: {
    bg: 'bg-blue-500/15',
    text: 'text-blue-400',
    filledBg: 'bg-blue-500',
  },
  muted: {
    bg: 'bg-white/5',
    text: 'text-white/50',
    filledBg: 'bg-white/10',
  },
};

const SIZE_CLASSES: Record<BadgeSize, { container: string; text: string }> = {
  sm: {
    container: 'px-2 py-0.5 rounded',
    text: 'text-xs font-medium',
  },
  md: {
    container: 'px-2.5 py-1 rounded-md',
    text: 'text-sm font-semibold',
  },
  lg: {
    container: 'px-3 py-1.5 rounded-lg',
    text: 'text-base font-semibold',
  },
};

export function Badge({
  variant = 'default',
  size = 'md',
  children,
  icon,
  filled = false,
  className = '',
  ...viewProps
}: BadgeProps) {
  const variantConfig = VARIANT_CLASSES[variant];
  const sizeConfig = SIZE_CLASSES[size];
  const bgClass = filled ? variantConfig.filledBg : variantConfig.bg;
  const textClass = filled && variant !== 'default' && variant !== 'muted' ? 'text-white' : variantConfig.text;

  return (
    <View
      className={`flex-row items-center ${sizeConfig.container} ${bgClass} ${className}`}
      {...viewProps}
    >
      {icon && <Text className={`mr-1 ${sizeConfig.text}`}>{icon}</Text>}
      <Text className={`${sizeConfig.text} ${textClass}`}>{children}</Text>
    </View>
  );
}

/**
 * CountBadge - Numeric counter badge (for notifications, etc)
 */
interface CountBadgeProps {
  count: number;
  max?: number;
  variant?: 'default' | 'danger' | 'accent';
  size?: 'sm' | 'md';
}

export function CountBadge({
  count,
  max = 99,
  variant = 'danger',
  size = 'sm',
}: CountBadgeProps) {
  if (count <= 0) return null;

  const displayCount = count > max ? `${max}+` : String(count);
  const variantClasses: Record<string, string> = {
    default: 'bg-white/20',
    danger: 'bg-red-500',
    accent: 'bg-blue-500',
  };
  
  const sizeClasses = size === 'sm' 
    ? 'min-w-5 h-5 px-1.5 text-xs' 
    : 'min-w-6 h-6 px-2 text-sm';

  return (
    <View className={`${variantClasses[variant]} ${sizeClasses} rounded-full items-center justify-center`}>
      <Text className="text-white font-bold">{displayCount}</Text>
    </View>
  );
}

/**
 * StatusDot - Simple status indicator dot
 */
interface StatusDotProps {
  status: 'online' | 'offline' | 'busy' | 'away';
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  online: 'bg-green-500',
  offline: 'bg-gray-500',
  busy: 'bg-red-500',
  away: 'bg-orange-500',
};

const DOT_SIZES: Record<string, string> = {
  sm: 'w-2 h-2',
  md: 'w-3 h-3',
  lg: 'w-4 h-4',
};

export function StatusDot({ status, size = 'md', pulse = false }: StatusDotProps) {
  return (
    <View className={`${DOT_SIZES[size]} ${STATUS_COLORS[status]} rounded-full ${pulse ? 'animate-pulse' : ''}`} />
  );
}


/**
 * OopsFee Global Theme
 * Dark mode, iOS-inspired, premium feel with a snarky edge
 */

import { Platform } from 'react-native';

// ─────────────────────────────────────────────────────────────
// COLORS
// ─────────────────────────────────────────────────────────────

export const Colors = {
  // Core backgrounds
  bg: '#000000',
  bgElevated: '#0A0A0C',
  bgCard: 'rgba(255, 255, 255, 0.04)',
  bgCardHover: 'rgba(255, 255, 255, 0.06)',

  // Borders
  border: 'rgba(255, 255, 255, 0.08)',
  borderSubtle: 'rgba(255, 255, 255, 0.05)',
  borderFocus: 'rgba(255, 255, 255, 0.15)',

  // Text
  text: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.70)',
  textTertiary: 'rgba(255, 255, 255, 0.45)',
  textMuted: 'rgba(255, 255, 255, 0.30)',

  // Brand / Accent
  accent: '#0B93F6', // iMessage blue
  accentDim: 'rgba(11, 147, 246, 0.15)',
  accentGlow: 'rgba(11, 147, 246, 0.25)',

  // Semantic colors
  success: '#34C759',
  successDim: 'rgba(52, 199, 89, 0.15)',
  warning: '#FF9F0A',
  warningDim: 'rgba(255, 159, 10, 0.15)',
  danger: '#FF453A',
  dangerDim: 'rgba(255, 69, 58, 0.12)',
  dangerGlow: 'rgba(255, 69, 58, 0.35)',

  // Money colors (special treatment)
  money: '#00D632',
  moneyDim: 'rgba(0, 214, 50, 0.12)',

  // Urgency gradient stops
  urgencyLow: '#34C759',
  urgencyMedium: '#FF9F0A',
  urgencyHigh: '#FF6B35',
  urgencyCritical: '#FF453A',

  // iOS system colors (for consistency)
  systemGray: '#8E8E93',
  systemGray2: '#636366',
  systemGray3: '#48484A',
  systemGray4: '#3A3A3C',
  systemGray5: '#2C2C2E',
  systemGray6: '#1C1C1E',
} as const;

// ─────────────────────────────────────────────────────────────
// TYPOGRAPHY
// ─────────────────────────────────────────────────────────────

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', system-ui, sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
})!;

export const Typography = {
  // Display (for big numbers, hero text)
  displayLarge: {
    fontSize: 56,
    lineHeight: 60,
    fontWeight: '800' as const,
    letterSpacing: -1.5,
    fontFamily: Fonts.rounded,
  },
  displayMedium: {
    fontSize: 40,
    lineHeight: 44,
    fontWeight: '700' as const,
    letterSpacing: -1,
    fontFamily: Fonts.rounded,
  },
  displaySmall: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
    fontFamily: Fonts.rounded,
  },

  // Headings
  h1: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700' as const,
    letterSpacing: -0.4,
  },
  h2: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600' as const,
    letterSpacing: -0.2,
  },
  h3: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600' as const,
  },

  // Body
  body: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '400' as const,
  },
  bodyMedium: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500' as const,
  },
  bodySemibold: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600' as const,
  },

  // Small
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500' as const,
  },
  captionMono: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500' as const,
    fontFamily: Fonts.mono,
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
} as const;

// ─────────────────────────────────────────────────────────────
// SPACING & LAYOUT
// ─────────────────────────────────────────────────────────────

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
} as const;

// ─────────────────────────────────────────────────────────────
// SHADOWS (iOS-style subtle depth)
// ─────────────────────────────────────────────────────────────

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 0,
  }),
} as const;

// ─────────────────────────────────────────────────────────────
// ANIMATION PRESETS
// ─────────────────────────────────────────────────────────────

export const Animation = {
  spring: {
    damping: 18,
    stiffness: 180,
    mass: 1,
  },
  springBouncy: {
    damping: 12,
    stiffness: 200,
    mass: 0.8,
  },
  springGentle: {
    damping: 20,
    stiffness: 120,
    mass: 1,
  },
  duration: {
    fast: 150,
    normal: 250,
    slow: 400,
  },
} as const;

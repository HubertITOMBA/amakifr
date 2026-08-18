/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

/**
 * Tokens visuels AMAKI — thème clair (UI-1B.1).
 * Dark mode : à brancher plus tard, sans changer ces clés.
 */
export const AmakiColors = {
  primary: "#1d4ed8",
  primaryStrong: "#1e3a8a",
  primarySoft: "#eff6ff",
  primaryBorder: "#bfdbfe",
  accent: "#f59e0b",
  danger: "#b91c1c",
  success: "#15803d",
  successSoft: "#dcfce7",
  warning: "#c2410c",
  warningSoft: "#ffedd5",
  dangerSoft: "#fee2e2",
  dangerBorder: "#fecaca",
  background: "#f8fafc",
  surface: "#ffffff",
  surfaceMuted: "#f1f5f9",
  text: "#0f172a",
  textMuted: "#64748b",
  border: "#e2e8f0",
} as const;

export const AmakiSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
} as const;

export const AmakiRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const AmakiTypography = {
  display: { fontSize: 28, fontWeight: "700" as const, lineHeight: 34 },
  title: { fontSize: 20, fontWeight: "700" as const, lineHeight: 26 },
  heading: { fontSize: 16, fontWeight: "700" as const, lineHeight: 22 },
  body: { fontSize: 16, fontWeight: "400" as const, lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: "400" as const, lineHeight: 18 },
  label: {
    fontSize: 11,
    fontWeight: "700" as const,
    lineHeight: 14,
    letterSpacing: 0.4,
    textTransform: "uppercase" as const,
  },
};

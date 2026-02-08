/**
 * Handicap-Caddy Theme
 * Slate / Navy palette for a calm, professional, non-template look
 */

import { Platform } from 'react-native';

/**
 * Core palette
 */
const slate50 = '#F6F7F9';
const slate100 = '#ECEFF3';
const slate300 = '#C7CDD6';
const slate600 = '#5B6472';
const slate900 = '#1E2430';

const navy700 = '#1F3A5F';
const navy800 = '#162B45';
const navy100 = '#E4ECF5';

const dangerRed = '#C44536';

export const Colors = {
  light: {
    // Backgrounds
    background: slate50,
    card: slate100,

    // Text
    text: slate900,
    textSecondary: slate600,
    textMuted: slate300,

    // Brand / actions
    primary: navy700,
    primaryPressed: navy800,
    primarySoft: navy100,

    // Icons / tabs
    icon: slate600,
    tabIconDefault: slate600,
    tabIconSelected: navy700,

    // Borders / dividers
    border: slate300,

    // Status
    danger: dangerRed,
  },

  dark: {
    // Dark mode kept conservative (not the focus for MVP)
    background: '#151718',
    card: '#1C1F24',

    text: '#ECEDEE',
    textSecondary: '#9BA1A6',
    textMuted: '#687076',

    primary: '#4A6FA5',
    primaryPressed: '#3A5A8C',
    primarySoft: '#243447',

    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#FFFFFF',

    border: '#2A2F36',
    danger: '#E05A4F',
  },
};

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
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

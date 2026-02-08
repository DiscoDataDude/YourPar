import { Colors, Fonts } from './theme';

/**
 * Typography scale
 * Use these instead of raw numbers
 */
export const typography = {
  titleXL: {
    fontSize: 28,
    fontWeight: '700',
    fontFamily: Fonts.sans,
  },
  titleL: {
    fontSize: 22,
    fontWeight: '700',
    fontFamily: Fonts.sans,
  },
  titleM: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: Fonts.sans,
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    fontFamily: Fonts.sans,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: '400',
    fontFamily: Fonts.sans,
  },
  meta: {
    fontSize: 13,
    fontWeight: '400',
    fontFamily: Fonts.sans,
    opacity: 0.7,
  },
};

/**
 * Spacing scale
 */
export const spacing = {
  xs: 4,
  s: 8,
  m: 16,
  l: 24,
  xl: 32,
};

/**
 * Semantic colours
 * (avoid raw hex usage in screens)
 */
export const uiColours = {
  background: Colors.light.background,
  textPrimary: Colors.light.text,
  textSecondary: Colors.light.icon,
  accent: Colors.light.primary,
  divider: Colors.light.border,
};

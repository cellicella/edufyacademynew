import { Platform, TextStyle } from 'react-native';

/** Edufy Academy brand system (mirrors the website's "Editorial Material" tokens). */
export const colors = {
  primary: '#004AAD',
  primaryDark: '#003B8B',
  secondary: '#5271FF',
  accent: '#5E17EB',
  primarySoft: '#E8EFFB',
  accentSoft: '#F1EAFE',
  bg: '#F7F9FC',
  surface: '#FFFFFF',
  ink: '#111827',
  text: '#334155',
  muted: '#64748B',
  subtle: '#94A3B8',
  border: '#E2E8F0',
  hairline: '#EEF2F7',
  success: '#059669',
  successSoft: '#ECFDF5',
  warning: '#B45309',
  warningSoft: '#FFFBEB',
  danger: '#E11D48',
  dangerSoft: '#FFF1F2',
  overlay: 'rgba(11,18,32,0.55)',
  white: '#FFFFFF',
  black: '#000000',
};

export const gradients = {
  brand: ['#004AAD', '#5271FF'] as const,
  brandDeep: ['#003B8B', '#004AAD', '#5E17EB'] as const,
  scrim: ['transparent', 'rgba(11,18,32,0.85)'] as const,
};

export const fonts = {
  display: 'Manrope_800ExtraBold',
  displayBold: 'Manrope_700Bold',
  displaySemi: 'Manrope_600SemiBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
};

export const radius = { xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };

export const type: Record<string, TextStyle> = {
  hero: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, color: colors.ink, letterSpacing: -0.6 },
  h1: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: colors.ink, letterSpacing: -0.4 },
  h2: { fontFamily: fonts.displayBold, fontSize: 20, lineHeight: 26, color: colors.ink, letterSpacing: -0.2 },
  h3: { fontFamily: fonts.displayBold, fontSize: 17, lineHeight: 23, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23, color: colors.text },
  bodyStrong: { fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 22, color: colors.ink },
  small: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.muted },
  smallStrong: { fontFamily: fonts.bodySemi, fontSize: 13, lineHeight: 18, color: colors.text },
  eyebrow: { fontFamily: fonts.bodyBold, fontSize: 11.5, letterSpacing: 1.1, textTransform: 'uppercase', color: colors.accent },
  button: { fontFamily: fonts.bodySemi, fontSize: 15.5, letterSpacing: 0.1 },
};

export const shadow = Platform.select({
  ios: { shadowColor: '#0B1220', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  default: { elevation: 3 },
}) as object;

export const shadowLg = Platform.select({
  ios: { shadowColor: '#0B1220', shadowOpacity: 0.14, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } },
  default: { elevation: 8 },
}) as object;

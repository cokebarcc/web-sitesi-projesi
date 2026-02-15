/**
 * MEDİS Design System — Design Tokens
 *
 * Tüm modüllerde tutarlı spacing, radius, shadow, font-scale ve transition değerleri.
 * CSS variable'larla uyumlu JS sabitleri.
 */

// ── Spacing Scale ──
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 64,
} as const;

// ── Border Radius ──
export const RADIUS = {
  sm: 'rounded-lg',       // 8px
  md: 'rounded-xl',       // 12px
  lg: 'rounded-2xl',      // 16px — GlassCard default
  xl: 'rounded-3xl',      // 24px
  full: 'rounded-full',
} as const;

// ── Shadow System ──
export const SHADOW = {
  dark: {
    sm: 'shadow-[0_4px_12px_rgba(0,0,0,0.3)]',
    md: 'shadow-[0_8px_24px_rgba(0,0,0,0.35)]',
    lg: 'shadow-[0_20px_60px_-15px_rgba(0,0,0,0.65),0_8px_24px_rgba(0,0,0,0.35)]',
    xl: 'shadow-[0_24px_70px_-10px_rgba(0,0,0,0.8)]',
  },
  light: {
    sm: 'shadow-[0_2px_8px_rgba(15,23,42,0.04)]',
    md: 'shadow-[0_4px_16px_rgba(15,23,42,0.06)]',
    lg: 'shadow-[0_8px_30px_rgba(15,23,42,0.08),0_2px_8px_rgba(15,23,42,0.04)]',
    xl: 'shadow-[0_24px_70px_-20px_rgba(0,0,0,0.20)]',
  },
} as const;

// ── Font Scale ──
export const FONT = {
  /** 10px — badges, meta info */
  xs: 'text-[10px]',
  /** 11px — secondary labels */
  sm: 'text-[11px]',
  /** 13px — body text, table cells */
  base: 'text-[13px]',
  /** 14px — prominent text */
  md: 'text-sm',
  /** 16px — card titles */
  lg: 'text-base',
  /** 20px — section headings */
  xl: 'text-xl',
  /** 28px — page headings */
  '2xl': 'text-[28px]',
  /** 36px — hero/display */
  '3xl': 'text-4xl',
} as const;

// ── Transition ──
export const TRANSITION = {
  fast: 'transition-all duration-150 ease-out',
  base: 'transition-all duration-200 ease-out',
  slow: 'transition-all duration-300 ease-out',
} as const;

// ── Common Surface Classes ──
export const SURFACE = {
  dark: {
    primary: 'bg-slate-900/60',
    secondary: 'bg-slate-800/40',
    tertiary: 'bg-white/[0.03]',
    hover: 'bg-white/[0.06]',
    border: 'border-white/[0.10]',
    borderLight: 'border-white/[0.06]',
    text1: 'text-white',
    text2: 'text-slate-300',
    text3: 'text-slate-400',
    textMuted: 'text-slate-500',
  },
  light: {
    primary: 'bg-white/90',
    secondary: 'bg-slate-50/80',
    tertiary: 'bg-black/[0.02]',
    hover: 'bg-black/[0.04]',
    border: 'border-black/[0.08]',
    borderLight: 'border-black/[0.04]',
    text1: 'text-slate-900',
    text2: 'text-slate-700',
    text3: 'text-slate-500',
    textMuted: 'text-slate-400',
  },
} as const;

/** isDark'a göre surface token'larını döner */
export const getSurface = (isDark: boolean) => isDark ? SURFACE.dark : SURFACE.light;

/** isDark'a göre shadow token'larını döner */
export const getShadow = (isDark: boolean) => isDark ? SHADOW.dark : SHADOW.light;

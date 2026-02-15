import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';
type ButtonRounded = 'md' | 'xl' | 'full';

interface GlassButtonProps {
  children: React.ReactNode;
  isDark: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  rounded?: ButtonRounded;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  type?: 'button' | 'submit' | 'reset';
  title?: string;
}

// ── Size map ──
const SIZE_MAP: Record<ButtonSize, string> = {
  xs: 'px-2.5 py-1 text-[10px] gap-1',
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-6 py-2.5 text-sm gap-2.5',
};

// ── Rounded map ──
const ROUNDED_MAP: Record<ButtonRounded, string> = {
  md: 'rounded-xl',
  xl: 'rounded-2xl',
  full: 'rounded-full',
};

// ── Variant styles ──
const getVariantStyles = (variant: ButtonVariant, isDark: boolean): string => {
  switch (variant) {
    case 'primary':
      return isDark
        ? 'bg-sky-500 text-white hover:bg-sky-400 shadow-sm shadow-sky-500/20'
        : 'bg-sky-500 text-white hover:bg-sky-600 shadow-sm shadow-sky-500/15';
    case 'secondary':
      return isDark
        ? 'bg-white/[0.06] text-slate-300 border border-white/[0.10] hover:bg-white/[0.10] hover:text-white'
        : 'bg-white text-slate-700 border border-black/[0.08] hover:bg-slate-50 hover:border-black/[0.12] shadow-sm';
    case 'ghost':
      return isDark
        ? 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
        : 'text-slate-500 hover:text-slate-900 hover:bg-black/[0.04]';
    case 'danger':
      return isDark
        ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20 hover:bg-rose-500/25'
        : 'bg-rose-50 text-rose-600 border border-rose-200/60 hover:bg-rose-100';
    case 'success':
      return isDark
        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25'
        : 'bg-emerald-50 text-emerald-600 border border-emerald-200/60 hover:bg-emerald-100';
    default:
      return '';
  }
};

/**
 * MEDİS Design System — GlassButton
 *
 * Flat, minimal buton sistemi. Apple tarzı yumuşak, premium hissiyat.
 * Variants: primary (sky), secondary (surface), ghost (transparent), danger (rose), success (emerald)
 */
const GlassButton: React.FC<GlassButtonProps> = ({
  children,
  isDark,
  variant = 'secondary',
  size = 'sm',
  rounded = 'xl',
  icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  className = '',
  onClick,
  type = 'button',
  title,
}) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      className={[
        'inline-flex items-center justify-center font-medium',
        'transition-all duration-200 ease-out',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40',
        SIZE_MAP[size],
        ROUNDED_MAP[rounded],
        getVariantStyles(variant, isDark),
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
        loading ? 'pointer-events-none' : '',
        className,
      ].join(' ')}
    >
      {/* Loading spinner */}
      {loading && (
        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {/* Icon left */}
      {!loading && icon && iconPosition === 'left' && <span className="shrink-0">{icon}</span>}
      {/* Label */}
      <span>{children}</span>
      {/* Icon right */}
      {!loading && icon && iconPosition === 'right' && <span className="shrink-0">{icon}</span>}
    </button>
  );
};

export default GlassButton;

import React from 'react';

type CardVariant = 'default' | 'elevated' | 'flat' | 'outlined';

interface GlassCardProps {
  children?: React.ReactNode;
  isDark: boolean;
  /** Kart stili: default (premium), elevated (daha güçlü gölge), flat (düz), outlined (sadece border) */
  variant?: CardVariant;
  className?: string;
  hover?: boolean;
  padding?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
  /** overflow-hidden yerine overflow-visible kullanmak için (dropdown içeren paneller) */
  overflowVisible?: boolean;
}

// ── Variant: Surface + Border + Shadow ──
const getVariantBase = (variant: CardVariant, isDark: boolean): string => {
  switch (variant) {
    case 'elevated':
      return isDark
        ? 'bg-slate-900/70 border-white/[0.18] shadow-[0_24px_70px_-10px_rgba(0,0,0,0.8),0_12px_30px_rgba(0,0,0,0.4)]'
        : 'bg-white/95 border-black/[0.10] shadow-[0_20px_60px_rgba(15,23,42,0.12),0_4px_12px_rgba(15,23,42,0.06)]';
    case 'flat':
      return isDark
        ? 'bg-white/[0.04] border-white/[0.06] shadow-none'
        : 'bg-white/70 border-black/[0.05] shadow-[0_1px_3px_rgba(15,23,42,0.03)]';
    case 'outlined':
      return isDark
        ? 'bg-transparent border-white/[0.12] shadow-none'
        : 'bg-transparent border-black/[0.08] shadow-none';
    default: // 'default'
      return isDark
        ? 'bg-slate-900/60 border-white/[0.15] shadow-[0_10px_40px_rgba(0,0,0,0.55),0_2px_12px_rgba(0,0,0,0.35)]'
        : 'bg-white/[0.88] border-black/[0.10] shadow-[0_2px_12px_rgba(0,0,0,0.05),0_18px_40px_rgba(0,0,0,0.08)]';
  }
};

// ── Variant: Hover ──
const getVariantHover = (variant: CardVariant, isDark: boolean): string => {
  switch (variant) {
    case 'elevated':
      return isDark
        ? 'hover:-translate-y-0.5 hover:border-white/[0.22] hover:shadow-[0_28px_80px_-10px_rgba(0,0,0,0.85)]'
        : 'hover:-translate-y-0.5 hover:border-black/[0.14] hover:shadow-[0_28px_80px_rgba(15,23,42,0.16)]';
    case 'flat':
      return isDark
        ? 'hover:bg-white/[0.06] hover:border-white/[0.08]'
        : 'hover:bg-white/80 hover:border-black/[0.07]';
    case 'outlined':
      return isDark
        ? 'hover:bg-white/[0.03] hover:border-white/[0.18]'
        : 'hover:bg-black/[0.02] hover:border-black/[0.12]';
    default:
      return isDark
        ? 'hover:-translate-y-px hover:border-white/[0.20] hover:bg-slate-900/70 hover:shadow-[0_24px_70px_-10px_rgba(0,0,0,0.8)]'
        : 'hover:-translate-y-px hover:border-black/[0.12] hover:shadow-[0_24px_70px_-20px_rgba(0,0,0,0.20)]';
  }
};

/**
 * Premium Glassmorphism Card — Surface System
 *
 * Variants:
 *   default  — Premium glassmorphism (orijinal stil)
 *   elevated — Daha güçlü gölge, daha belirgin kart (hero alanları, öne çıkan kartlar)
 *   flat     — Düz, minimal arka plan (nested kartlar, section içi gruplar)
 *   outlined — Sadece border, transparan arka plan (secondary container'lar)
 *
 * Light: bg white/88, border-black/10, ring + shadow + inner highlight → clear separation from pale bg
 * Dark:  bg slate-800/55, border-white/10, ring + deep shadow + soft inner gradient
 * Hover: contrast INCREASES (not washes out) — border darkens, shadow deepens, subtle lift
 * Focus: accessible sky ring
 */
const GlassCard: React.FC<GlassCardProps> = ({
  children,
  isDark,
  variant = 'default',
  className = '',
  hover = true,
  padding = 'p-5',
  onClick,
  style,
  overflowVisible = false,
}) => {
  const showInnerEffects = variant === 'default' || variant === 'elevated';

  return (
    <div
      onClick={onClick}
      style={style}
      className={[
        `relative rounded-2xl border ${overflowVisible ? 'overflow-visible' : 'overflow-hidden'}`,
        showInnerEffects ? 'backdrop-blur-xl' : 'backdrop-blur-sm',
        // ── Surface + Border + Shadow (variant-aware) ──
        getVariantBase(variant, isDark),
        'transition-all duration-200',
        // ── Hover (variant-aware) ──
        hover ? getVariantHover(variant, isDark) : '',
        'focus-within:ring-2 focus-within:ring-sky-400/40 focus-within:ring-offset-0',
        padding,
        className,
      ].join(' ')}
    >
      {/* Inner highlight — only for default & elevated */}
      {showInnerEffects && (
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{
            background: isDark
              ? 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 50%, rgba(0,0,0,0.08) 100%)'
              : 'linear-gradient(135deg, rgba(255,255,255,0.50) 0%, transparent 50%, rgba(0,0,0,0.02) 100%)',
          }}
        />
      )}
      {/* Edge ring — adds crisp boundary */}
      <div className={[
        'pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset',
        isDark ? 'ring-white/[0.06]' : 'ring-black/[0.06]',
      ].join(' ')} />
      {/* Top highlight — light mode: white glow from top for depth (default & elevated only) */}
      {showInnerEffects && !isDark && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-12 rounded-t-2xl"
          style={{
            background: 'linear-gradient(to bottom, rgba(255,255,255,0.60) 0%, transparent 100%)',
          }}
        />
      )}
      {children}
    </div>
  );
};

export default GlassCard;

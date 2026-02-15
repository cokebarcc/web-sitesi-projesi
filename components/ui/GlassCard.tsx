import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  isDark: boolean;
  className?: string;
  hover?: boolean;
  padding?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}

/**
 * Premium Glassmorphism Card — Apple keynote style.
 *
 * Light: bg-white/40  border-black/5  wide soft layered shadow  ring-white/60
 * Dark:  bg-white/[0.04] border-white/[0.08] deep shadow  ring-white/10
 * Hover: -translate-y-1 + blue glow
 */
const GlassCard: React.FC<GlassCardProps> = ({
  children,
  isDark,
  className = '',
  hover = true,
  padding = 'p-6',
  onClick,
  style,
}) => {
  return (
    <div
      onClick={onClick}
      style={style}
      className={[
        'relative rounded-3xl border backdrop-blur-2xl overflow-hidden',
        isDark
          ? 'bg-white/[0.04] border-white/[0.08] shadow-[0_8px_40px_rgba(0,0,0,0.4),0_2px_12px_rgba(0,0,0,0.25)]'
          : 'bg-white/40 border-black/[0.05] shadow-[0_2px_8px_rgba(0,0,0,0.03),0_8px_32px_rgba(0,0,0,0.05),0_20px_60px_rgba(99,102,241,0.06)]',
        'transition-all duration-300 will-change-transform',
        hover
          ? isDark
            ? 'hover:-translate-y-1 hover:shadow-[0_0_80px_rgba(59,130,246,0.18),0_8px_40px_rgba(0,0,0,0.35)] hover:border-white/[0.14]'
            : 'hover:-translate-y-1 hover:shadow-[0_0_60px_rgba(99,102,241,0.12),0_20px_60px_rgba(0,0,0,0.06)] hover:border-black/[0.08]'
          : '',
        padding,
        className,
      ].join(' ')}
    >
      {/* Inner highlight ring — glass edge */}
      <div className={[
        'pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset',
        isDark ? 'ring-white/[0.10]' : 'ring-white/60',
      ].join(' ')} />
      {children}
    </div>
  );
};

export default GlassCard;

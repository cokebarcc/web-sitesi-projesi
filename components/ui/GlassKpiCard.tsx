import React from 'react';
import GlassCard from './GlassCard';

type KpiColor = 'blue' | 'emerald' | 'amber' | 'purple' | 'rose' | 'indigo' | 'sky';

interface GlassKpiCardProps {
  isDark: boolean;
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  color?: KpiColor;
  /** Trend göstergesi: +5.2 → yeşil ok yukarı, -2.1 → kırmızı ok aşağı */
  trend?: { value: number; label?: string };
  className?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}

// ── Renk token'ları — ikon arkaplanı ──
const COLOR_BG: Record<KpiColor, { dark: string; light: string }> = {
  blue:    { dark: 'bg-blue-500/10',    light: 'bg-blue-50' },
  emerald: { dark: 'bg-emerald-500/10', light: 'bg-emerald-50' },
  amber:   { dark: 'bg-amber-500/10',   light: 'bg-amber-50' },
  purple:  { dark: 'bg-purple-500/10',  light: 'bg-purple-50' },
  rose:    { dark: 'bg-rose-500/10',    light: 'bg-rose-50' },
  indigo:  { dark: 'bg-indigo-500/10',  light: 'bg-indigo-50' },
  sky:     { dark: 'bg-sky-500/10',     light: 'bg-sky-50' },
};

const COLOR_TEXT: Record<KpiColor, { dark: string; light: string }> = {
  blue:    { dark: 'text-blue-400',    light: 'text-blue-600' },
  emerald: { dark: 'text-emerald-400', light: 'text-emerald-600' },
  amber:   { dark: 'text-amber-400',   light: 'text-amber-600' },
  purple:  { dark: 'text-purple-400',  light: 'text-purple-600' },
  rose:    { dark: 'text-rose-400',    light: 'text-rose-600' },
  indigo:  { dark: 'text-indigo-400',  light: 'text-indigo-600' },
  sky:     { dark: 'text-sky-400',     light: 'text-sky-600' },
};

/**
 * MEDİS Design System — GlassKpiCard
 *
 * Premium KPI/İstatistik kartı.
 * Yapı: ikon üstte → büyük sayı → küçük label → soluk meta
 */
const GlassKpiCard: React.FC<GlassKpiCardProps> = ({
  isDark,
  title,
  value,
  subtitle,
  icon,
  color = 'sky',
  trend,
  className = '',
  onClick,
  style,
}) => {
  const iconBg = isDark ? COLOR_BG[color].dark : COLOR_BG[color].light;
  const iconText = isDark ? COLOR_TEXT[color].dark : COLOR_TEXT[color].light;

  return (
    <GlassCard
      isDark={isDark}
      padding="p-5"
      hover={!!onClick}
      onClick={onClick}
      className={className}
      style={style}
    >
      {/* İkon */}
      {icon && (
        <div className={`p-2 rounded-xl inline-block mb-3 ${iconBg}`}>
          <div className={iconText}>{icon}</div>
        </div>
      )}

      {/* Değer — büyük, bold, tabular-nums */}
      <div className={`text-2xl font-bold tracking-tight leading-none tabular-nums ${
        isDark ? 'text-white' : 'text-slate-900'
      }`}>
        {typeof value === 'number' ? value.toLocaleString('tr-TR') : value}
      </div>

      {/* Başlık — küçük, medium */}
      <div className={`text-[11px] font-medium mt-2 ${
        isDark ? 'text-slate-400' : 'text-slate-500'
      }`}>
        {title}
      </div>

      {/* Alt bilgi + Trend */}
      {(subtitle || trend) && (
        <div className="flex items-center gap-2 mt-1.5">
          {subtitle && (
            <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {subtitle}
            </span>
          )}
          {trend && (
            <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${
              trend.value >= 0
                ? isDark ? 'text-emerald-400' : 'text-emerald-600'
                : isDark ? 'text-rose-400' : 'text-rose-600'
            }`}>
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d={trend.value >= 0 ? 'M4.5 19.5l15-15' : 'M4.5 4.5l15 15'}
                />
              </svg>
              {trend.value > 0 ? '+' : ''}{trend.value}%
              {trend.label && <span className="font-normal ml-0.5">{trend.label}</span>}
            </span>
          )}
        </div>
      )}
    </GlassCard>
  );
};

export default GlassKpiCard;

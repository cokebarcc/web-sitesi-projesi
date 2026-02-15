import React from 'react';
import GlassCard from './GlassCard';

interface GlassTableColumn {
  key: string;
  label: string;
  minWidth?: string;
  align?: 'left' | 'center' | 'right';
  /** Sayısal sütun — sağ hizalı, tabular-nums */
  numeric?: boolean;
  className?: string;
}

interface GlassTableProps {
  isDark: boolean;
  columns: GlassTableColumn[];
  data: any[];
  renderRow: (item: any, index: number) => React.ReactNode;
  /** Tablo üst başlığı */
  title?: string;
  subtitle?: string;
  /** Başlık sağ tarafı — legend, buton vb. */
  headerRight?: React.ReactNode;
  /** Kompakt mod — daha küçük padding */
  compact?: boolean;
  /** Veri yoksa gösterilecek mesaj */
  emptyMessage?: string;
  /** Scrollable max yükseklik */
  maxHeight?: string;
  /** Ek CSS class */
  className?: string;
  /** Sticky ilk sütun */
  stickyFirstColumn?: boolean;
  /** GlassCard variant (default: 'default') */
  variant?: 'default' | 'elevated' | 'flat' | 'outlined';
}

/**
 * MEDİS Design System — GlassTable
 *
 * Apple tarzı premium tablo:
 * - Sticky header + backdrop-blur
 * - Row min-height 44-48px
 * - Hairline separator (1px)
 * - Zebra: light rgba(15,23,42,0.02), dark rgba(255,255,255,0.03)
 * - Cell padding: px-4 py-3
 * - Numeric: sağ hizalı, tabular-nums
 */
const GlassTable: React.FC<GlassTableProps> = ({
  isDark,
  columns,
  data,
  renderRow,
  title,
  subtitle,
  headerRight,
  compact = false,
  emptyMessage = 'Veri bulunamadı',
  maxHeight,
  className = '',
  stickyFirstColumn = false,
  variant = 'default',
}) => {
  return (
    <GlassCard isDark={isDark} padding="p-0" hover={false} className={className} variant={variant}>
      {/* ── Title Bar ── */}
      {(title || headerRight) && (
        <div className={`flex items-center justify-between px-5 pt-4 pb-2 ${
          subtitle ? 'items-start' : 'items-center'
        }`}>
          <div>
            {title && (
              <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {title}
              </h3>
            )}
            {subtitle && (
              <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {subtitle}
              </p>
            )}
          </div>
          {headerRight && <div className="flex items-center gap-2">{headerRight}</div>}
        </div>
      )}

      {/* ── Table Container ── */}
      <div
        className="overflow-x-auto"
        style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}
      >
        <table className="w-full border-collapse" style={{ borderSpacing: 0 }}>
          {/* ── Header — sticky + backdrop-blur ── */}
          <thead className="sticky top-0 z-10">
            <tr className={[
              isDark
                ? 'bg-slate-900/80 backdrop-blur-xl'
                : 'bg-white/80 backdrop-blur-xl',
            ].join(' ')}>
              {columns.map((col, i) => {
                const isNum = col.numeric || col.align === 'right';
                return (
                  <th
                    key={col.key}
                    className={[
                      compact ? 'px-3 py-2' : 'px-4 py-3',
                      'text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap',
                      isDark ? 'text-slate-400' : 'text-slate-500',
                      col.align === 'center' ? 'text-center' : isNum ? 'text-right' : 'text-left',
                      // Hairline bottom border
                      isDark ? 'border-b border-white/[0.08]' : 'border-b border-black/[0.08]',
                      // Sticky first col
                      stickyFirstColumn && i === 0
                        ? `sticky left-0 z-20 ${isDark ? 'bg-slate-900/95' : 'bg-white/95'} backdrop-blur-sm`
                        : '',
                      col.className || '',
                    ].join(' ')}
                    style={col.minWidth ? { minWidth: col.minWidth } : undefined}
                  >
                    {col.label}
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* ── Body ── */}
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className={`text-center py-12 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <svg className="w-6 h-6 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                    </svg>
                    <span className="text-xs font-medium">{emptyMessage}</span>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((item, idx) => renderRow(item, idx))
            )}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
};

export default GlassTable;

/**
 * Tablo satırı helper — Apple standart row styling
 * Min-height 44px, zebra, hover, hairline divider
 */
export const glassRowClass = (isDark: boolean, index: number, compact = false) => {
  return [
    'transition-colors duration-150',
    // Min-height
    compact ? 'min-h-[40px]' : 'min-h-[44px]',
    // Zebra — hafif
    index % 2 === 1
      ? isDark ? 'bg-white/[0.03]' : 'bg-[rgba(15,23,42,0.02)]'
      : '',
    // Hover
    isDark
      ? 'hover:bg-white/[0.05]'
      : 'hover:bg-sky-50/50',
    // Hairline divider
    isDark ? 'border-b border-white/[0.04]' : 'border-b border-[rgba(15,23,42,0.06)]',
  ].join(' ');
};

/** Standart td className — Apple cell padding + typography */
export const glassCellClass = (isDark: boolean, compact = false, align?: 'left' | 'center' | 'right', numeric?: boolean) => {
  const pad = compact ? 'px-3 py-2' : 'px-4 py-3';
  const isNum = numeric || align === 'right';
  return [
    pad,
    'text-[13px]',
    isDark ? 'text-slate-300' : 'text-slate-700',
    isNum ? 'text-right tabular-nums' : align === 'center' ? 'text-center' : 'text-left',
  ].join(' ');
};

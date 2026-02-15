import React from 'react';

interface FilterChipProps {
  isDark: boolean;
  label: string;
  active?: boolean;
  onClick?: () => void;
  icon?: React.ReactNode;
  className?: string;
}

/**
 * MEDİS Design System — FilterChip
 *
 * Filtre chip: aktif/pasif, opsiyonel ikon.
 * Aktif: accent renkli, pasif: transparan.
 */
const FilterChip: React.FC<FilterChipProps> = ({
  isDark,
  label,
  active = false,
  onClick,
  icon,
  className = '',
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all duration-200 border',
        active
          ? isDark
            ? 'bg-sky-500/20 border-sky-400/30 text-sky-300'
            : 'bg-sky-50 border-sky-200 text-sky-700'
          : isDark
            ? 'bg-white/[0.04] border-white/[0.08] text-slate-400 hover:bg-white/[0.08] hover:text-white'
            : 'bg-white/80 border-black/[0.06] text-slate-500 hover:bg-white hover:text-slate-900',
        className,
      ].join(' ')}
    >
      {icon && <span className="w-3.5 h-3.5 flex-shrink-0">{icon}</span>}
      {label}
    </button>
  );
};

export default FilterChip;

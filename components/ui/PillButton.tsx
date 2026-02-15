import React from 'react';

interface PillButtonOption {
  label: string;
  value: string;
}

interface PillButtonProps {
  isDark: boolean;
  options: PillButtonOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/**
 * MEDİS Design System — PillButton
 *
 * Segment kontrol (pill tarzı). Aktif tab glassmorphism,
 * pasif tab transparan.
 */
const PillButton: React.FC<PillButtonProps> = ({
  isDark,
  options,
  value,
  onChange,
  className = '',
}) => {
  return (
    <div className={[
      'inline-flex items-center gap-0.5 p-1 rounded-full',
      isDark
        ? 'bg-white/[0.06] border border-white/[0.08]'
        : 'bg-black/[0.04] border border-black/[0.06]',
      className,
    ].join(' ')}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={[
              'px-4 py-1.5 rounded-full text-[12px] font-semibold transition-all duration-200',
              active
                ? isDark
                  ? 'bg-white/[0.14] text-white shadow-sm backdrop-blur-sm'
                  : 'bg-white text-slate-900 shadow-sm'
                : isDark
                  ? 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-black/[0.04]',
            ].join(' ')}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};

export default PillButton;

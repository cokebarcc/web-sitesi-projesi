import React from 'react';

interface SectionHeaderProps {
  isDark: boolean;
  /** Ana başlık */
  title: string;
  /** Alt açıklama */
  subtitle?: string;
  /** Sağ taraf — buton, legend, filtre vb. */
  right?: React.ReactNode;
  /** Ek CSS class */
  className?: string;
}

/**
 * MEDİS Design System — SectionHeader
 *
 * Modül bölüm başlığı + sağ aksiyon alanı.
 * Tutarlı spacing, font boyutu, renk.
 */
const SectionHeader: React.FC<SectionHeaderProps> = ({
  isDark,
  title,
  subtitle,
  right,
  className = '',
}) => {
  return (
    <div className={`flex items-center justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        <h2 className={`text-base font-semibold tracking-tight ${
          isDark ? 'text-white' : 'text-slate-900'
        }`}>
          {title}
        </h2>
        {subtitle && (
          <p className={`text-[11px] mt-0.5 ${
            isDark ? 'text-slate-400' : 'text-slate-500'
          }`}>
            {subtitle}
          </p>
        )}
      </div>
      {right && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {right}
        </div>
      )}
    </div>
  );
};

export default SectionHeader;

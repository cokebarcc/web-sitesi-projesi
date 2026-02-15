import React from 'react';

interface GlassSectionProps {
  isDark: boolean;
  children: React.ReactNode;
  /** Bölüm başlığı */
  title?: string;
  subtitle?: string;
  /** Başlık sağ tarafı — butonlar, legend vb. */
  headerRight?: React.ReactNode;
  /** Padding: varsayılan p-5 */
  padding?: string;
  /** Ek CSS class */
  className?: string;
}

/**
 * MEDİS Design System — GlassSection
 *
 * Modül içi bölüm grupları için hafif container.
 * GlassCard'dan daha düşük profil — surface-2 bg, ince border, hover yok.
 * Chart, form grubu, filtre paneli vb. sarmak için kullanılır.
 */
const GlassSection: React.FC<GlassSectionProps> = ({
  isDark,
  children,
  title,
  subtitle,
  headerRight,
  padding = 'p-5',
  className = '',
}) => {
  return (
    <div className={[
      'relative rounded-2xl border backdrop-blur-sm overflow-hidden',
      isDark
        ? 'bg-white/[0.03] border-white/[0.08]'
        : 'bg-white/60 border-black/[0.06] shadow-[0_2px_8px_rgba(15,23,42,0.03)]',
      padding,
      className,
    ].join(' ')}>
      {/* Edge ring — GlassCard ile aynı dil */}
      <div className={[
        'pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset',
        isDark ? 'ring-white/[0.04]' : 'ring-black/[0.03]',
      ].join(' ')} />

      {/* Header */}
      {(title || headerRight) && (
        <div className={`flex items-center justify-between ${title ? 'mb-4' : ''}`}>
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

      {children}
    </div>
  );
};

export default GlassSection;

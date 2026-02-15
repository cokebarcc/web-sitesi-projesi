import React from 'react';

interface ModuleLayoutProps {
  isDark: boolean;
  children: React.ReactNode;
  /** Maksimum genişlik: varsayılan 1600px */
  maxWidth?: 'full' | '7xl' | '6xl' | '5xl';
  /** Ek CSS class */
  className?: string;
}

const MAX_WIDTH_MAP = {
  full: 'max-w-full',
  '7xl': 'max-w-7xl',   // 1280px
  '6xl': 'max-w-6xl',   // 1152px
  '5xl': 'max-w-5xl',   // 1024px
};

/**
 * MEDİS Design System — ModuleLayout
 *
 * Tüm modüller için ortak wrapper.
 * - max-w-[1600px] centered
 * - Simetrik yan boşluklar
 * - Tutarlı dikey spacing
 */
const ModuleLayout: React.FC<ModuleLayoutProps> = ({
  isDark,
  children,
  maxWidth,
  className = '',
}) => {
  const maxW = maxWidth ? MAX_WIDTH_MAP[maxWidth] : 'max-w-[1600px]';

  return (
    <div className={[
      'w-full mx-auto px-6 py-5',
      maxW,
      className,
    ].join(' ')}>
      {children}
    </div>
  );
};

export default ModuleLayout;

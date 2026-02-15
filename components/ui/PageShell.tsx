import React from 'react';

interface PageShellProps {
  isDark: boolean;
  children: React.ReactNode;
  /** Maksimum genişlik: varsayılan 1600px */
  maxWidth?: 'full' | '7xl' | '6xl' | '5xl';
  className?: string;
}

const MAX_WIDTH_MAP: Record<string, string> = {
  full: 'max-w-full',
  '7xl': 'max-w-7xl',
  '6xl': 'max-w-6xl',
  '5xl': 'max-w-5xl',
};

/**
 * MEDİS Design System — PageShell
 *
 * Sayfa arka planı (radial gradient), padding, max-width.
 * Her modülün en dışındaki wrapper.
 *
 * Light: radial gradient soft blue/gray (#F6F8FC bazlı)
 * Dark:  deep navy (#071024 bazlı)
 */
const PageShell: React.FC<PageShellProps> = ({
  isDark,
  children,
  maxWidth,
  className = '',
}) => {
  const maxW = maxWidth ? MAX_WIDTH_MAP[maxWidth] : 'max-w-[1600px]';

  return (
    <div
      className="min-h-full w-full"
      style={{
        background: isDark
          ? 'radial-gradient(ellipse at 50% 0%, #0f1d35 0%, #071024 60%, #030712 100%)'
          : 'radial-gradient(ellipse at 50% 0%, #eef2f9 0%, #F6F8FC 40%, #f0f2f5 100%)',
      }}
    >
      <div className={[
        'w-full mx-auto px-6 py-5',
        maxW,
        className,
      ].join(' ')}>
        {children}
      </div>
    </div>
  );
};

export default PageShell;

import React from 'react';

interface EmptyStateProps {
  icon?: 'chart' | 'hospital' | 'search' | 'data' | 'calendar';
  title: string;
  description?: string;
}

const icons: Record<string, React.ReactNode> = {
  chart: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" /><path d="M7 16l4-8 4 4 4-6" />
    </svg>
  ),
  hospital: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" /><path d="M9 9h1" /><path d="M9 13h1" /><path d="M9 17h1" />
    </svg>
  ),
  search: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
  ),
  data: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" /><path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
    </svg>
  ),
  calendar: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="4" rx="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" />
    </svg>
  ),
};

const EmptyState: React.FC<EmptyStateProps> = ({ icon = 'data', title, description }) => (
  <div className="flex flex-col items-center justify-center py-12 px-6 rounded-[20px]"
       style={{ background: 'var(--surface-2)', border: '2px dashed var(--border-2)' }}>
    <div className="mb-4 opacity-40" style={{ color: 'var(--text-muted)' }}>
      {icons[icon]}
    </div>
    <p className="font-black uppercase tracking-[0.15em] text-sm"
       style={{ color: 'var(--text-muted)' }}>
      {title}
    </p>
    {description && (
      <p className="mt-2 text-xs" style={{ color: 'var(--text-3)' }}>
        {description}
      </p>
    )}
  </div>
);

export default EmptyState;

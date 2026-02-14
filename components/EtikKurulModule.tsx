import React from 'react';

const EtikKurulModule: React.FC = () => {
  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>Etik Kurul</h1>
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>Etik kurul modülü</p>
          </div>
        </div>
      </div>

      {/* Boş İçerik */}
      <div className="backdrop-blur-xl rounded-2xl p-12 text-center" style={{ background: 'var(--surface-1)', borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--border-2)' }}>
        <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-2)' }}>Etik Kurul</h3>
        <p className="text-sm max-w-md mx-auto" style={{ color: 'var(--text-3)' }}>
          Bu modül yakında aktif olacaktır.
        </p>
      </div>
    </div>
  );
};

export default EtikKurulModule;

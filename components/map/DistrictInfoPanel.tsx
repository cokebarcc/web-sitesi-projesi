import React from 'react';
import { DISTRICTS, getDistrictInstitutionCount } from '../../src/data/sanliurfaDistricts';

interface DistrictInfoPanelProps {
  districtName: string;
  theme: 'dark' | 'light';
  onClose: () => void;
}

const DistrictInfoPanel: React.FC<DistrictInfoPanelProps> = ({
  districtName,
  theme,
  onClose,
}) => {
  const isDark = theme === 'dark';
  const district = DISTRICTS[districtName];
  if (!district) return null;

  const institutionCount = getDistrictInstitutionCount(district);

  const kpiCards = [
    {
      label: 'Hastane',
      value: district.hospitals.length,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      color: '#3b82f6',
    },
    {
      label: 'Ilce SM',
      value: district.ilceSM.length,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      color: '#10b981',
    },
    {
      label: 'ADSH',
      value: district.adsh.length,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      ),
      color: '#f59e0b',
    },
    {
      label: 'Toplam Kurum',
      value: institutionCount,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      color: '#8b5cf6',
    },
  ];

  // Kurumlar listesi
  const institutions: { name: string; type: string; color: string }[] = [];
  district.hospitals.forEach(h => {
    institutions.push({ name: h, type: 'Hastane', color: '#3b82f6' });
  });
  district.ilceSM.forEach(s => {
    institutions.push({ name: s, type: 'Ilce SM', color: '#10b981' });
  });
  district.adsh.forEach(a => {
    institutions.push({ name: a, type: 'ADSH', color: '#f59e0b' });
  });

  return (
    <div className={`h-full overflow-y-auto p-6 ${
      isDark
        ? 'bg-gradient-to-b from-[#0f1729] to-[#131d33]'
        : 'bg-gradient-to-b from-white to-[#f8fafc]'
    }`}>
      {/* Baslik */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: district.color }}
            />
            <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {districtName}
            </h2>
          </div>
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Sanliurfa / {districtName}
          </p>
        </div>
        <button
          onClick={onClose}
          className={`p-2 rounded-xl transition-colors ${
            isDark
              ? 'hover:bg-white/10 text-slate-400 hover:text-white'
              : 'hover:bg-black/5 text-slate-500 hover:text-slate-900'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* KPI Kartlari */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {kpiCards.map((kpi) => (
          <div
            key={kpi.label}
            className={`p-4 rounded-2xl border transition-all ${
              isDark
                ? 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]'
                : 'bg-white border-slate-200 hover:shadow-md'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div
                className="p-1.5 rounded-lg"
                style={{ backgroundColor: `${kpi.color}20` }}
              >
                <div style={{ color: kpi.color }}>{kpi.icon}</div>
              </div>
            </div>
            <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {kpi.value}
            </div>
            <div className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {kpi.label}
            </div>
          </div>
        ))}
      </div>

      {/* Konum Bilgisi */}
      <div className={`p-4 rounded-2xl border mb-6 ${
        isDark
          ? 'bg-white/[0.03] border-white/[0.06]'
          : 'bg-white border-slate-200'
      }`}>
        <div className={`text-xs font-semibold uppercase tracking-wider mb-2 ${
          isDark ? 'text-slate-500' : 'text-slate-400'
        }`}>
          Konum
        </div>
        <div className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          <span className="font-mono">{district.center[0].toFixed(4)}°N, {district.center[1].toFixed(4)}°E</span>
        </div>
        {district.population && (
          <div className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Nufus: ~{(district.population / 1000).toFixed(0)}K
          </div>
        )}
      </div>

      {/* Kurum Listesi */}
      <div>
        <div className={`text-xs font-semibold uppercase tracking-wider mb-3 ${
          isDark ? 'text-slate-500' : 'text-slate-400'
        }`}>
          Kurumlar ({institutions.length})
        </div>
        {institutions.length > 0 ? (
          <div className="space-y-2">
            {institutions.map((inst, i) => (
              <div
                key={i}
                className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${
                  isDark
                    ? 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05]'
                    : 'bg-white border-slate-200 hover:shadow-sm'
                }`}
              >
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: inst.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium truncate ${
                    isDark ? 'text-slate-200' : 'text-slate-700'
                  }`}>
                    {inst.name}
                  </div>
                  <div className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    {inst.type}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={`text-sm text-center py-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Bu ilcede tanimli kurum bulunmuyor
          </div>
        )}
      </div>
    </div>
  );
};

export default DistrictInfoPanel;

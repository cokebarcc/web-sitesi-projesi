import React, { useState, useCallback } from 'react';
import { DISTRICTS, getDistrictInstitutionCount } from '../../src/data/sanliurfaDistricts';
import SanliurfaLeafletMap from './SanliurfaLeafletMap';

interface MapDashboardProps {
  theme: 'dark' | 'light';
  userName?: string;
}

const MapDashboard: React.FC<MapDashboardProps> = ({ theme, userName }) => {
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);

  const isDark = theme === 'dark';

  const handleDistrictClick = useCallback((districtName: string) => {
    setSelectedDistrict(prev => prev === districtName ? null : districtName);
  }, []);

  const district = selectedDistrict ? DISTRICTS[selectedDistrict] : null;
  const institutionCount = district ? getDistrictInstitutionCount(district) : 0;

  // Toplam il istatistikleri (sabit degerler)
  const kpiCards = [
    { label: 'Ilce', value: '13', color: '#8b5cf6', icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z' },
    { label: 'Ilce Saglik Mud.', value: '13', color: '#10b981', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { label: 'Kamu Hastanesi', value: '12', color: '#3b82f6', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    { label: 'ADSH / ADSM', value: '2 / 2', color: '#ef4444', icon: 'M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342' },
    { label: 'Universite Hastanesi', value: '1', color: '#6366f1', icon: 'M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z' },
    { label: 'Ozel Hastane', value: '6', color: '#ec4899', icon: 'M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z' },
    { label: 'Nufus', value: '2.265.800', color: '#f59e0b', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  ];

  return (
    <div className="w-full h-full overflow-y-auto p-4">
      {/* Baslik */}
      <div className="mb-3">
        <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {userName ? `Hos geldiniz, ${userName}` : 'Sanliurfa Il Haritasi'}
        </h1>
        <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Sanliurfa ili ilce bazli saglik kurumlari haritasi
        </p>
      </div>

      {/* Ozet KPI Kartlari */}
      <div className="grid grid-cols-7 gap-2 mb-3">
        {kpiCards.map((kpi) => (
          <div
            key={kpi.label}
            className={`px-3 py-2 rounded-xl border transition-all ${
              isDark
                ? 'bg-white/[0.03] border-white/[0.06]'
                : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <div className="p-0.5 rounded" style={{ backgroundColor: `${kpi.color}20` }}>
                <svg className="w-3 h-3" fill="none" stroke={kpi.color} viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={kpi.icon} />
                </svg>
              </div>
              <span className={`text-[10px] leading-tight ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {kpi.label}
              </span>
            </div>
            <div className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* Ana Icerik: Harita + Ilce Bilgi */}
      <div className="flex gap-4" style={{ height: 'calc(100vh - 180px)', minHeight: '500px' }}>
        {/* Harita Karti */}
        <div
          className={[
            'rounded-2xl border overflow-hidden flex flex-col flex-1',
            isDark ? 'border-white/[0.06]' : 'border-slate-200',
          ].join(' ')}
          style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#ffffff' }}
        >
          {/* Harita Kart Basligi */}
          <div className={`flex items-center justify-between px-5 py-3 border-b shrink-0 ${
            isDark ? 'border-white/[0.06]' : 'border-slate-200'
          }`}>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke={isDark ? '#94a3b8' : '#64748b'} viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <span className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Ilce Haritasi
              </span>
              {selectedDistrict && (
                <span className="text-xs px-2 py-0.5 rounded-full" style={{
                  backgroundColor: `${district?.color}20`,
                  color: district?.color,
                }}>
                  {selectedDistrict}
                </span>
              )}
            </div>

          </div>

          {/* Harita Alani */}
          <div className="flex-1 relative" style={{ minHeight: 0 }}>
            <SanliurfaLeafletMap
              theme={theme}
              selectedDistrict={selectedDistrict}
              isPanelOpen={false}
              onDistrictClick={handleDistrictClick}
            />
          </div>
        </div>

        {/* Sag Panel - Ilce Bilgisi */}
        <div className={`w-[320px] shrink-0 rounded-2xl border overflow-hidden flex flex-col ${
          isDark
            ? 'bg-white/[0.02] border-white/[0.06]'
            : 'bg-white border-slate-200'
        }`}>
          {selectedDistrict && district ? (
            <>
              {/* Ilce Basligi */}
              <div className={`px-5 py-4 border-b shrink-0 ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: district.color }} />
                  <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {selectedDistrict}
                  </h2>
                </div>
                <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Sanliurfa / {selectedDistrict}
                </p>
              </div>

              {/* Ilce KPI */}
              <div className={`px-5 py-4 grid grid-cols-2 gap-3 shrink-0 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                {[
                  { label: 'Hastane', value: district.hospitals.length, color: '#3b82f6' },
                  { label: 'Ilce SM', value: district.ilceSM.length, color: '#10b981' },
                  { label: 'ADSH', value: district.adsh.length, color: '#f59e0b' },
                  { label: 'Toplam', value: institutionCount, color: '#8b5cf6' },
                ].map((kpi) => (
                  <div
                    key={kpi.label}
                    className={`p-3 rounded-xl border ${
                      isDark
                        ? 'bg-white/[0.03] border-white/[0.06]'
                        : 'bg-slate-50 border-slate-100'
                    }`}
                  >
                    <div className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {kpi.value}
                    </div>
                    <div className="text-[10px] mt-0.5" style={{ color: kpi.color }}>
                      {kpi.label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Konum & Nufus */}
              <div className={`px-5 py-3 shrink-0 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
                <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  <span className="font-mono">{district.center[0].toFixed(4)}°N, {district.center[1].toFixed(4)}°E</span>
                  {district.population > 0 && (
                    <span className="ml-3">Nufus: ~{(district.population / 1000).toFixed(0)}K</span>
                  )}
                </div>
              </div>

              {/* Kurum Listesi */}
              <div className="flex-1 overflow-y-auto px-5 py-4" style={{ minHeight: 0 }}>
                <div className={`text-[10px] font-semibold uppercase tracking-wider mb-3 ${
                  isDark ? 'text-slate-500' : 'text-slate-400'
                }`}>
                  Kurumlar
                </div>
                <div className="space-y-2">
                  {district.hospitals.map((h, i) => (
                    <div key={`h-${i}`} className={`flex items-center gap-2 p-2.5 rounded-lg ${
                      isDark ? 'bg-white/[0.03]' : 'bg-slate-50'
                    }`}>
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: '#3b82f6' }} />
                      <div className="min-w-0">
                        <div className={`text-xs font-medium truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{h}</div>
                        <div className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Hastane</div>
                      </div>
                    </div>
                  ))}
                  {district.ilceSM.map((s, i) => (
                    <div key={`s-${i}`} className={`flex items-center gap-2 p-2.5 rounded-lg ${
                      isDark ? 'bg-white/[0.03]' : 'bg-slate-50'
                    }`}>
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: '#10b981' }} />
                      <div className="min-w-0">
                        <div className={`text-xs font-medium truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{s}</div>
                        <div className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Ilce SM</div>
                      </div>
                    </div>
                  ))}
                  {district.adsh.map((a, i) => (
                    <div key={`a-${i}`} className={`flex items-center gap-2 p-2.5 rounded-lg ${
                      isDark ? 'bg-white/[0.03]' : 'bg-slate-50'
                    }`}>
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: '#f59e0b' }} />
                      <div className="min-w-0">
                        <div className={`text-xs font-medium truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{a}</div>
                        <div className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>ADSH</div>
                      </div>
                    </div>
                  ))}
                  {institutionCount === 0 && (
                    <div className={`text-xs text-center py-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      Bu ilcede tanimli kurum yok
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* Ilce secilmediyse bilgi mesaji */
            <div className="flex-1 flex flex-col items-center justify-center px-6">
              <div className={`p-4 rounded-2xl mb-4 ${isDark ? 'bg-white/[0.04]' : 'bg-slate-50'}`}>
                <svg className="w-8 h-8" fill="none" stroke={isDark ? '#475569' : '#94a3b8'} viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
              </div>
              <p className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Ilce Secin
              </p>
              <p className={`text-xs mt-1 text-center ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                Haritadan bir ilceye tiklayarak detaylarini gorun
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MapDashboard;

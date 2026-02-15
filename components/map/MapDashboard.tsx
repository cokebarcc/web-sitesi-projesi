import React, { useState, useCallback, useEffect } from 'react';
import { DISTRICTS, INSTITUTION_MARKERS, INSTITUTION_STYLES, getDistrictInstitutionCount } from '../../src/data/sanliurfaDistricts';
import type { InstitutionMarker } from '../../src/data/sanliurfaDistricts';
import { loadInstitutions, saveInstitutions } from '../../src/services/mapInstitutionStorage';
import SanliurfaLeafletMap from './SanliurfaLeafletMap';
import SanliurfaSvgMap from './SanliurfaSvgMap';
import PinEditorPanel from './PinEditorPanel';

interface MapDashboardProps {
  theme: 'dark' | 'light';
  userName?: string;
  userEmail?: string;
  isAdmin?: boolean;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const MapDashboard: React.FC<MapDashboardProps> = ({ theme, userName, userEmail, isAdmin }) => {
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [markers, setMarkers] = useState<InstitutionMarker[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Pin yönetim modu
  const [editMode, setEditMode] = useState(false);
  const [editorMarker, setEditorMarker] = useState<Partial<InstitutionMarker> | null>(null);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [mapMode, setMapMode] = useState<'svg' | 'satellite'>('svg');

  const isDark = theme === 'dark';

  // Firestore'dan pin verileri yükle
  useEffect(() => {
    loadInstitutions().then((data) => {
      setMarkers(data.length > 0 ? data : INSTITUTION_MARKERS);
      setIsLoading(false);
    });
  }, []);

  const handleDistrictClick = useCallback((districtName: string) => {
    setSelectedDistrict(prev => prev === districtName ? null : districtName);
  }, []);

  // Haritaya tıklayınca yeni pin formu aç
  const handleMapClick = useCallback((lat: number, lng: number) => {
    setSelectedMarkerId(null);
    setEditorMarker({ lat, lng, type: 'HASTANE', name: '' });
  }, []);

  // Mevcut pin'e tıklayınca düzenleme formu aç
  const handleMarkerClick = useCallback((marker: InstitutionMarker) => {
    setSelectedMarkerId(marker.id);
    setEditorMarker(marker);
  }, []);

  // Pin kaydet (yeni veya güncelle)
  const handleSavePin = useCallback(async (data: Omit<InstitutionMarker, 'id'> & { id?: string }) => {
    setSaving(true);
    try {
      let updated: InstitutionMarker[];
      if (data.id) {
        // Güncelle
        updated = markers.map(m => m.id === data.id ? { ...m, ...data } as InstitutionMarker : m);
      } else {
        // Yeni ekle
        const newMarker: InstitutionMarker = { ...data, id: generateId() };
        updated = [...markers, newMarker];
      }
      await saveInstitutions(updated, userEmail || '');
      setMarkers(updated);
      setEditorMarker(null);
      setSelectedMarkerId(null);
    } catch (err) {
      console.error('Pin kaydedilemedi:', err);
    } finally {
      setSaving(false);
    }
  }, [markers, userEmail]);

  // Pin sil
  const handleDeletePin = useCallback(async () => {
    if (!selectedMarkerId) return;
    setSaving(true);
    try {
      const updated = markers.filter(m => m.id !== selectedMarkerId);
      await saveInstitutions(updated, userEmail || '');
      setMarkers(updated);
      setEditorMarker(null);
      setSelectedMarkerId(null);
    } catch (err) {
      console.error('Pin silinemedi:', err);
    } finally {
      setSaving(false);
    }
  }, [selectedMarkerId, markers, userEmail]);

  const handleCancelEditor = useCallback(() => {
    setEditorMarker(null);
    setSelectedMarkerId(null);
  }, []);

  const handleToggleEditMode = useCallback(() => {
    setEditMode(prev => {
      if (prev) {
        // Kapanırken editor'ı da kapat
        setEditorMarker(null);
        setSelectedMarkerId(null);
      }
      return !prev;
    });
  }, []);

  const district = selectedDistrict ? DISTRICTS[selectedDistrict] : null;
  const institutionCount = district ? getDistrictInstitutionCount(district) : 0;

  // Toplam il istatistikleri (sabit degerler)
  const kpiCards = [
    { label: 'İlçe', value: '13', color: '#8b5cf6', gradient: 'from-violet-500/20 to-purple-600/5', icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z', trend: '+2' },
    { label: 'İlçe Sağlık Müd.', value: '13', color: '#10b981', gradient: 'from-emerald-500/20 to-teal-600/5', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', trend: '' },
    { label: 'Kamu Hastanesi', value: '12', color: '#3b82f6', gradient: 'from-blue-500/20 to-cyan-600/5', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', trend: '' },
    { label: 'ADSH / ADSM', value: '2 / 2', color: '#ef4444', gradient: 'from-red-500/20 to-rose-600/5', icon: 'M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342', trend: '' },
    { label: 'Üniversite Hast.', value: '1', color: '#6366f1', gradient: 'from-indigo-500/20 to-violet-600/5', icon: 'M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z', trend: '' },
    { label: 'Özel Hastane', value: '6', color: '#ec4899', gradient: 'from-pink-500/20 to-fuchsia-600/5', icon: 'M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z', trend: '+1' },
    { label: 'Nüfus', value: '2.265.800', color: '#f59e0b', gradient: 'from-amber-500/20 to-orange-600/5', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', trend: '' },
  ];

  // Sağ panel KPI verileri
  const rightPanelCards = [
    {
      title: 'Aktif Randevu',
      value: '4.832',
      subtitle: 'Bu hafta',
      change: '+12.5%',
      changeType: 'up' as const,
      color: '#10b981',
      icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    },
    {
      title: 'Toplam Hekim',
      value: '284',
      subtitle: 'Aktif çalışan',
      change: '+3',
      changeType: 'up' as const,
      color: '#8b5cf6',
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
    },
    {
      title: 'Doluluk Oranı',
      value: '78%',
      subtitle: 'Ortalama kapasite',
      change: '+5.2%',
      changeType: 'up' as const,
      color: '#3b82f6',
      icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z',
    },
    {
      title: 'Günlük Muayene',
      value: '1.247',
      subtitle: 'Bugün',
      change: '-2.1%',
      changeType: 'down' as const,
      color: '#f59e0b',
      icon: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z',
    },
  ];

  return (
    <div className="w-full h-full overflow-hidden p-4 pl-6 flex flex-col">
      {!mapExpanded && (<>

      {/* Edit mod banner */}
      {editMode && !mapExpanded && (
        <div className={`mb-3 px-4 py-2.5 rounded-xl border flex items-center gap-3 ${
          isDark
            ? 'bg-amber-500/10 border-amber-500/20'
            : 'bg-amber-50 border-amber-200'
        }`}>
          <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
          <span className={`text-xs font-medium ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
            Pin Yonetim Modu Aktif — Haritaya tiklayarak pin ekleyin, mevcut pin'e tiklayarak duzenleyin
          </span>
          <span className={`text-xs ml-auto ${isDark ? 'text-amber-400/60' : 'text-amber-500/60'}`}>
            {markers.length} pin
          </span>
        </div>
      )}

      {/* Ozet KPI Kartlari — Kompakt Premium */}
      <div className="grid grid-cols-7 gap-2 mb-3">
        {kpiCards.map((kpi) => (
          <div
            key={kpi.label}
            className="premium-stat-card premium-noise group relative !p-3 !rounded-xl"
          >
            <div className="premium-shimmer" />
            <div className="premium-accent-top" style={{ background: `linear-gradient(90deg, transparent, ${kpi.color}, transparent)` }} />

            <svg className="premium-wave" viewBox="0 0 80 40" fill="none">
              <path d="M0 30 Q20 10 40 25 T80 20" stroke={kpi.color} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
            </svg>

            <div className="flex items-center gap-2 mb-1.5 relative z-10">
              <div className="p-1 rounded-lg" style={{ backgroundColor: `${kpi.color}15` }}>
                <svg className="w-3 h-3" fill="none" stroke={kpi.color} viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={kpi.icon} />
                </svg>
              </div>
              <span className={`text-[10px] font-medium leading-tight ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {kpi.label}
              </span>
            </div>
            <div className="flex items-end justify-between relative z-10">
              <div className={`text-base font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {kpi.value}
              </div>
              {kpi.trend && (
                <span className="text-[9px] font-semibold px-1 py-0.5 rounded" style={{ color: kpi.color, backgroundColor: `${kpi.color}15` }}>
                  {kpi.trend}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      </>)}

      {/* Ana Icerik: Harita + Sag Panel — flex-1 ile kalan alanı doldur */}
      <div className={mapExpanded ? 'fixed inset-0 z-[9999]' : 'flex gap-3 flex-1 min-h-0'} style={mapExpanded ? { width: '100vw', height: '100vh' } : {}}>
        {/* Harita Karti */}
        <div
          className={[
            'overflow-hidden flex flex-col',
            mapExpanded ? 'w-full h-full' : 'premium-card',
            editMode && !mapExpanded ? (isDark ? 'ring-1 ring-amber-500/30' : 'ring-1 ring-amber-300') : '',
          ].join(' ')}
          style={{
            backgroundColor: isDark ? (mapExpanded ? '#0a0f1a' : 'rgba(255,255,255,0.02)') : '#ffffff',
            ...(mapExpanded ? {} : { flex: '0 0 60%', maxWidth: '60%' }),
          }}
        >
          {/* Harita Kart Basligi — expanded modda floating */}
          {!mapExpanded && (
            <div className={`flex items-center justify-between px-5 py-3 border-b shrink-0 ${
              isDark ? 'border-white/[0.06]' : 'border-slate-200'
            }`}>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke={isDark ? '#94a3b8' : '#64748b'} viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                <span className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {editMode ? 'Pin Yerlestirme Modu' : 'Ilce Haritasi'}
                </span>
                {selectedDistrict && !editMode && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{
                    backgroundColor: `${district?.color}20`,
                    color: district?.color,
                  }}>
                    {selectedDistrict}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Pin Yönetimi butonu — sadece admin */}
                {isAdmin && (
                  <button
                    onClick={handleToggleEditMode}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all border ${
                      editMode
                        ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                        : isDark
                          ? 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                          : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                    {editMode ? 'Pin Yonetimini Kapat' : 'Pin Yonetimi'}
                    {editMode && (
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    )}
                  </button>
                )}
                {/* Harita modu geçiş butonları */}
                <div className={`flex rounded-lg p-0.5 ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
                  <button
                    onClick={() => setMapMode('svg')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                      mapMode === 'svg'
                        ? isDark
                          ? 'bg-white/10 text-white shadow-sm'
                          : 'bg-white text-slate-900 shadow-sm'
                        : isDark
                          ? 'text-slate-500 hover:text-slate-300'
                          : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    Harita
                  </button>
                  <button
                    onClick={() => setMapMode('satellite')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                      mapMode === 'satellite'
                        ? isDark
                          ? 'bg-white/10 text-white shadow-sm'
                          : 'bg-white text-slate-900 shadow-sm'
                        : isDark
                          ? 'text-slate-500 hover:text-slate-300'
                          : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    Uydu
                  </button>
                </div>
                {/* Büyütme butonu — sadece satellite modda */}
                {mapMode === 'satellite' && (
                  <button
                    onClick={() => setMapExpanded(true)}
                    className={`p-1.5 rounded-lg transition-all ${
                      isDark
                        ? 'hover:bg-white/10 text-slate-400 hover:text-white'
                        : 'hover:bg-slate-100 text-slate-400 hover:text-slate-700'
                    }`}
                    title="Haritayı büyüt"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Harita Alani */}
          <div className="flex-1 relative" style={{ minHeight: 0 }}>
            {/* Expanded modda floating küçültme butonu */}
            {mapExpanded && (
              <button
                onClick={() => setMapExpanded(false)}
                className={`absolute top-3 right-3 z-[1001] p-2 rounded-xl shadow-lg transition-all ${
                  isDark
                    ? 'bg-[#0f1729]/90 hover:bg-[#0f1729] text-white border border-white/10'
                    : 'bg-white/90 hover:bg-white text-slate-700 border border-slate-200'
                } backdrop-blur-sm`}
                title="Haritayı küçült"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                </svg>
              </button>
            )}
            {mapMode === 'svg' && !mapExpanded ? (
              <SanliurfaSvgMap
                theme={theme}
                selectedDistrict={selectedDistrict}
                onDistrictClick={handleDistrictClick}
                markers={markers}
              />
            ) : isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Yukleniyor...
                </div>
              </div>
            ) : (
              <SanliurfaLeafletMap
                theme={theme}
                selectedDistrict={editMode ? null : selectedDistrict}
                isPanelOpen={false}
                onDistrictClick={handleDistrictClick}
                markers={markers}
                editMode={editMode}
                selectedMarkerId={selectedMarkerId}
                onMapClick={handleMapClick}
                onMarkerClick={handleMarkerClick}
                mapExpanded={mapExpanded}
              />
            )}

            {/* Pin Editor — harita üstünde overlay */}
            {editMode && editorMarker && (
              <div className="absolute top-3 right-3 z-[1000] w-[280px]">
                <PinEditorPanel
                  theme={theme}
                  marker={editorMarker}
                  onSave={handleSavePin}
                  onDelete={selectedMarkerId ? handleDeletePin : undefined}
                  onCancel={handleCancelEditor}
                />
                {saving && (
                  <div className={`mt-2 text-center text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    Kaydediliyor...
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sag Panel — Boş KPI Kartları (expanded modda gizle) */}
        {!mapExpanded && (
          <div className="flex-1 flex flex-col gap-3 min-w-0">
            {/* Üst 2x2 Grid — Boş KPI Kartları */}
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="premium-panel premium-noise group p-5 flex items-center justify-center min-h-[120px]">
                  <div className="premium-shimmer" />
                  <span className={`text-xs relative z-10 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>—</span>
                </div>
              ))}
            </div>

            {/* Alt Kart — Boş */}
            <div className="premium-panel premium-noise group flex-1 p-5 flex items-center justify-center">
              <div className="premium-shimmer" />
              <span className={`text-xs relative z-10 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>—</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MapDashboard;

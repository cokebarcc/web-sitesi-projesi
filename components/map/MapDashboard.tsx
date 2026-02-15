import React, { useState, useCallback, useEffect } from 'react';
import { DISTRICTS, INSTITUTION_MARKERS, INSTITUTION_STYLES, getDistrictInstitutionCount } from '../../src/data/sanliurfaDistricts';
import type { InstitutionMarker, InstitutionType } from '../../src/data/sanliurfaDistricts';
import { loadInstitutions, saveInstitutions } from '../../src/services/mapInstitutionStorage';
import SanliurfaLeafletMap from './SanliurfaLeafletMap';
import SanliurfaSvgMap from './SanliurfaSvgMap';
import PinEditorPanel from './PinEditorPanel';
import { useWeather, getWeatherInfo } from '../../src/hooks/useWeather';
import GlassCard from '../ui/GlassCard';

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
  const { weather, loading: weatherLoading } = useWeather();

  // Pin yönetim modu
  const [editMode, setEditMode] = useState(false);
  const [editorMarker, setEditorMarker] = useState<Partial<InstitutionMarker> | null>(null);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [mapMode, setMapMode] = useState<'svg' | 'satellite'>('svg');
  const [filterOpen, setFilterOpen] = useState(true);

  // Pin filtre state'i — hangi kurum tipleri gösterilsin
  const [visibleTypes, setVisibleTypes] = useState<Set<InstitutionType>>(
    new Set<InstitutionType>(['ISM', 'HASTANE', 'OZEL', 'UNIVERSITE', 'SEHIR', 'ILCE_SM', 'ADSH', 'ASHİ', 'ASM', 'SHM'])
  );

  const pinFilterConfig: { type: InstitutionType; label: string }[] = [
    { type: 'ISM', label: 'İl Sağlık Müdürlüğü' },
    { type: 'HASTANE', label: 'Kamu Hastanesi' },
    { type: 'OZEL', label: 'Özel Hastane' },
    { type: 'UNIVERSITE', label: 'Üniversite Hastanesi' },
    { type: 'SEHIR', label: 'Şehir Hastanesi' },
    { type: 'ILCE_SM', label: 'İlçe Sağlık Müdürlüğü' },
    { type: 'ADSH', label: 'ADSH / ADSM' },
    { type: 'ASHİ', label: 'Acil Sağlık Hizm. İst.' },
    { type: 'ASM', label: 'Aile Sağlığı Merkezi' },
    { type: 'SHM', label: 'Sağlıklı Hayat Merkezi' },
  ];

  const toggleType = useCallback((type: InstitutionType) => {
    setVisibleTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  // Filtrelenmiş marker listesi
  const filteredMarkers = markers.filter(m => visibleTypes.has(m.type));

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
        updated = markers.map(m => m.id === data.id ? { ...m, ...data } as InstitutionMarker : m);
      } else {
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
        setEditorMarker(null);
        setSelectedMarkerId(null);
      }
      return !prev;
    });
  }, []);

  const district = selectedDistrict ? DISTRICTS[selectedDistrict] : null;

  // Sağ panel KPI verileri (placeholder)
  const rightPanelCards = [
    {
      title: 'Aktif Randevu',
      value: '4.832',
      subtitle: 'Bu hafta',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
      ),
    },
    {
      title: 'Toplam Hekim',
      value: '284',
      subtitle: 'Aktif çalışan',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      ),
    },
  ];

  // ==================================================================
  //  RENDER
  // ==================================================================

  // Fullscreen map mode
  if (mapExpanded) {
    return (
      <div className="fixed inset-0 z-[9999]" style={{ width: '100vw', height: '100vh' }}>
        <div className="w-full h-full relative">
          {/* Filter overlay */}
          <div className={`absolute top-3 left-3 z-[100] rounded-xl backdrop-blur-md border shadow-lg transition-all ${
            isDark ? 'bg-[#0f1729]/85 border-white/10' : 'bg-white/85 border-slate-200/60'
          }`}>
            <button onClick={() => setFilterOpen(p => !p)} className={`flex items-center gap-2 w-full px-3 py-2 ${filterOpen ? 'pb-1' : ''}`}>
              <span className={`text-[9px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Kurum Tipi</span>
              <svg className={`w-3 h-3 ml-auto transition-transform duration-200 ${filterOpen ? 'rotate-180' : ''} ${isDark ? 'text-slate-500' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {filterOpen && renderFilterGrid()}
          </div>
          {/* Close button */}
          <button
            onClick={() => setMapExpanded(false)}
            className={`absolute top-3 right-3 z-[1001] p-2 rounded-xl shadow-lg transition-all ${
              isDark ? 'bg-[#0f1729]/90 hover:bg-[#0f1729] text-white border border-white/10' : 'bg-white/90 hover:bg-white text-slate-700 border border-slate-200'
            } backdrop-blur-sm`}
            title="Haritayı küçült"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
            </svg>
          </button>
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Yukleniyor...</div>
            </div>
          ) : (
            <SanliurfaLeafletMap
              theme={theme}
              selectedDistrict={editMode ? null : selectedDistrict}
              isPanelOpen={false}
              onDistrictClick={handleDistrictClick}
              markers={filteredMarkers}
              editMode={editMode}
              selectedMarkerId={selectedMarkerId}
              onMapClick={handleMapClick}
              onMarkerClick={handleMarkerClick}
              mapExpanded={mapExpanded}
            />
          )}
        </div>
      </div>
    );
  }

  // Filter checkbox grid — extracted helper
  function renderFilterGrid() {
    return (
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 px-3 pb-2.5 pt-1">
        {pinFilterConfig.map(({ type, label }) => {
          const style = INSTITUTION_STYLES[type];
          const checked = visibleTypes.has(type);
          return (
            <label
              key={type}
              className={`flex items-center gap-2 cursor-pointer group select-none rounded-lg px-2 py-1 transition-all ${
                checked
                  ? isDark ? 'bg-white/5' : 'bg-slate-50'
                  : 'opacity-50 hover:opacity-75'
              }`}
            >
              <div
                className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-all border"
                style={{
                  backgroundColor: checked ? style.bg : 'transparent',
                  borderColor: checked ? style.bg : isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
                }}
              >
                {checked && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className={`text-[11px] font-medium whitespace-nowrap ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                {label}
              </span>
              <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggleType(type)} />
            </label>
          );
        })}
      </div>
    );
  }

  // ── Weather Hero Card ──
  function renderWeatherHero() {
    const wi = weather ? getWeatherInfo(weather.weatherCode, weather.isDay) : null;
    return (
      <div className={[
        'relative overflow-hidden rounded-3xl min-h-[220px] group border',
        'transition-all duration-300 will-change-transform',
        isDark
          ? 'border-white/[0.08] shadow-[0_8px_40px_rgba(0,0,0,0.35),0_2px_12px_rgba(0,0,0,0.2)]'
          : 'border-black/[0.06] shadow-[0_4px_24px_rgba(0,0,0,0.08),0_12px_48px_rgba(99,102,241,0.06)]',
        isDark
          ? 'hover:-translate-y-1 hover:shadow-[0_0_60px_rgba(59,130,246,0.18),0_8px_40px_rgba(0,0,0,0.3)]'
          : 'hover:-translate-y-1 hover:shadow-[0_0_60px_rgba(99,102,241,0.14),0_12px_48px_rgba(99,102,241,0.08)]',
      ].join(' ')}>
        {/* Background photo */}
        {wi && (
          <div
            className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
            style={{ backgroundImage: `url(${wi.bg})` }}
          />
        )}
        {/* Gradient overlays — dual-layer for readability */}
        <div className="absolute inset-0" style={{
          background: wi?.gradient || 'linear-gradient(135deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.3) 100%)',
        }} />
        <div className="absolute inset-0" style={{
          background: isDark
            ? 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.20) 100%)'
            : 'linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(0,0,0,0.10) 100%)',
        }} />
        {/* Fallback bg */}
        <div className="absolute inset-0 -z-10" style={{
          background: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)',
        }} />

        {/* Inner highlight ring */}
        <div className={[
          'pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset z-20',
          isDark ? 'ring-white/[0.10]' : 'ring-white/30',
        ].join(' ')} />

        {/* Content */}
        <div className="relative z-10 p-6 h-full flex flex-col justify-between">
          {weatherLoading || !weather || !wi ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-xs text-white/60">Yükleniyor...</div>
            </div>
          ) : (
            <>
              {/* Location */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                  <span className="text-xs font-semibold text-white/80 tracking-wide">Şanlıurfa</span>
                </div>
                <span className="text-4xl leading-none">{wi.icon}</span>
              </div>

              {/* Temperature — Apple typography */}
              <div className="mt-2">
                <div className="text-5xl font-semibold text-white tracking-tight leading-none drop-shadow-lg">
                  {weather.temperature}°C
                </div>
                <div className="text-sm text-white/60 mt-1 font-medium">
                  {wi.label} · Hissedilen {weather.apparentTemperature}°
                </div>
              </div>

              {/* Glassmorphism pill chips — rounded-full */}
              <div className="flex gap-3 mt-5">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3.5 py-1.5 text-xs text-white/85 backdrop-blur-md">
                  <svg className="w-3.5 h-3.5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636" />
                  </svg>
                  <span className="font-semibold">%{weather.humidity}</span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3.5 py-1.5 text-xs text-white/85 backdrop-blur-md">
                  <svg className="w-3.5 h-3.5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-semibold">{weather.windSpeed} km/s</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  //  MAIN LAYOUT — Apple keynote style
  // ══════════════════════════════════════════════════════════════
  return (
    <div className="w-full h-full overflow-y-auto overflow-x-hidden relative">
      {/* ── Apple-style atmospheric background ── */}
      <div className="fixed inset-0 pointer-events-none z-0" style={{
        background: isDark
          ? [
              'radial-gradient(circle at 30% 10%, rgba(59,130,246,0.10) 0%, transparent 55%)',
              'radial-gradient(circle at 70% 0%, rgba(6,182,212,0.08) 0%, transparent 55%)',
              'radial-gradient(circle at 50% 90%, rgba(139,92,246,0.06) 0%, transparent 50%)',
              'radial-gradient(ellipse at center, transparent 40%, rgba(15,23,42,0.5) 100%)',
            ].join(', ')
          : [
              'radial-gradient(circle at 30% 8%, rgba(99,102,241,0.07) 0%, transparent 50%)',
              'radial-gradient(circle at 75% 5%, rgba(59,130,246,0.06) 0%, transparent 45%)',
              'radial-gradient(circle at 50% 85%, rgba(139,92,246,0.04) 0%, transparent 45%)',
              'radial-gradient(ellipse at center, transparent 55%, rgba(160,170,195,0.18) 100%)',
            ].join(', '),
      }} />

      {/* ── Content — above atmosphere ── */}
      <div className="relative z-10">

        {/* ═══════════════════════════════════════
            1) COMPACT HERO — Apple keynote lockup
        ═══════════════════════════════════════ */}
        <section className="relative px-6 pt-8 pb-6 md:pt-10 md:pb-8">
          {/* Hero vignette — soft edge darkening */}
          <div className="pointer-events-none absolute inset-0 -z-20 hero-vignette" />
          {/* Apple stage glow — centered top radial */}
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute left-1/2 top-[-200px] h-[600px] w-[600px] -translate-x-1/2 rounded-full" style={{
              background: isDark
                ? 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 65%)'
                : 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 60%)',
            }} />
          </div>

          {/* Premium typographic lockup — glass pill */}
          <div className="mx-auto max-w-6xl flex justify-center">
            <div className={[
              'inline-flex flex-col items-center px-8 py-5 rounded-3xl border backdrop-blur-2xl',
              isDark
                ? 'bg-white/[0.03] border-white/[0.06]'
                : 'bg-white/30 border-black/[0.04]',
            ].join(' ')}>
              <h1 className={[
                'text-5xl md:text-6xl font-semibold tracking-[0.16em] leading-none',
                isDark ? '' : 'text-slate-900',
              ].join(' ')}
                style={isDark ? {
                  background: 'linear-gradient(to bottom, #ffffff 0%, rgba(255,255,255,0.7) 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 10px 30px rgba(0,0,0,0.35))',
                } : {
                  filter: 'drop-shadow(0 4px 12px rgba(2,6,23,0.08))',
                }}
              >
                MEDİS
              </h1>
              <p className={`mt-2 text-xs md:text-sm tracking-[0.28em] uppercase ${
                isDark ? 'text-white/45' : 'text-slate-500/70'
              }`}>
                Merkezi Dijital Sağlık Sistemi
              </p>
            </div>
          </div>
        </section>

        {/* Subtle divider — hero/content separation */}
        <div className={`mx-8 h-px ${isDark ? 'bg-white/[0.06]' : 'bg-black/[0.04]'}`} />

        {/* Edit mode banner */}
        {editMode && (
          <div className="px-8 pt-4 pb-2">
            <div className={`px-5 py-3 rounded-2xl border flex items-center gap-3 ${
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
          </div>
        )}

        {/* ═══════════════════════════════════════
            2) MAIN CONTENT GRID
        ═══════════════════════════════════════ */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-8 pt-6 pb-10">

          {/* ── LEFT: Map Glass Panel ── */}
          <GlassCard isDark={isDark} hover={false} padding="p-0" className={[
            'flex flex-col h-[420px] md:h-[480px]',
            isDark ? 'hover:shadow-[0_0_80px_rgba(59,130,246,0.16),0_8px_40px_rgba(0,0,0,0.35)]' : '',
          ].join(' ')}
            style={isDark ? { backgroundColor: 'rgba(255,255,255,0.025)' } : undefined}
          >
            {/* Map header */}
            <div className={`flex items-center justify-between px-6 py-4 border-b shrink-0 ${
              isDark ? 'border-white/[0.06]' : 'border-black/[0.04]'
            }`}>
              <div className="flex items-center gap-2.5">
                <svg className="w-4.5 h-4.5" fill="none" stroke={isDark ? '#94a3b8' : '#64748b'} viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                <span className={`text-lg font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                  {editMode ? 'Pin Yerlestirme Modu' : 'Harita'}
                </span>
                {selectedDistrict && !editMode && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full" style={{
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
                    className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition-all border ${
                      editMode
                        ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                        : isDark
                          ? 'bg-white/5 border-white/10 text-slate-400 hover:bg-blue-500/10 hover:text-white hover:border-blue-500/20'
                          : 'bg-slate-900/5 border-black/10 text-slate-500 hover:bg-blue-500/10 hover:text-slate-900 hover:border-blue-500/20'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                    {editMode ? 'Pin Yonetimini Kapat' : 'Pin Yonetimi'}
                    {editMode && <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />}
                  </button>
                )}
                {/* Map mode toggle — pill style */}
                <div className={`inline-flex rounded-full p-1 border ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-900/5 border-black/10'}`}>
                  <button
                    onClick={() => setMapMode('svg')}
                    className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all ${
                      mapMode === 'svg'
                        ? isDark ? 'bg-white/15 text-white shadow-sm' : 'bg-white/70 text-slate-800 shadow-sm'
                        : isDark ? 'text-slate-500 hover:text-slate-300 hover:bg-white/10' : 'text-slate-400 hover:text-slate-600 hover:bg-white/40'
                    }`}
                  >
                    Harita
                  </button>
                  <button
                    onClick={() => setMapMode('satellite')}
                    className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all ${
                      mapMode === 'satellite'
                        ? isDark ? 'bg-white/15 text-white shadow-sm' : 'bg-white/70 text-slate-800 shadow-sm'
                        : isDark ? 'text-slate-500 hover:text-slate-300 hover:bg-white/10' : 'text-slate-400 hover:text-slate-600 hover:bg-white/40'
                    }`}
                  >
                    Uydu
                  </button>
                </div>
                {/* Expand button — sadece satellite */}
                {mapMode === 'satellite' && (
                  <button
                    onClick={() => setMapExpanded(true)}
                    className={`p-1.5 rounded-lg transition-all ${
                      isDark ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-700'
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

            {/* Map area */}
            <div className="flex-1 relative overflow-hidden" style={{ minHeight: 0 }}>
              {/* Nüfus overlay */}
              <div className={`absolute bottom-3 left-3 z-[100] flex items-center gap-2 px-3 py-2 rounded-xl backdrop-blur-md border shadow-lg ${
                isDark ? 'bg-[#0f1729]/80 border-white/10' : 'bg-white/80 border-slate-200/60'
              }`}>
                <div className="p-1.5 rounded-lg" style={{ backgroundColor: '#f59e0b20' }}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="#f59e0b" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <div className={`text-[9px] font-medium uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Nüfus</div>
                  <div className={`text-sm font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>2.265.800</div>
                </div>
              </div>

              {/* Kurum tipi filtre paneli */}
              <div className={`absolute top-3 left-3 z-[100] rounded-xl backdrop-blur-md border shadow-lg transition-all ${
                isDark ? 'bg-[#0f1729]/85 border-white/10' : 'bg-white/85 border-slate-200/60'
              }`}>
                <button onClick={() => setFilterOpen(p => !p)} className={`flex items-center gap-2 w-full px-3 py-2 ${filterOpen ? 'pb-1' : ''}`}>
                  <span className={`text-[9px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Kurum Tipi</span>
                  <svg className={`w-3 h-3 ml-auto transition-transform duration-200 ${filterOpen ? 'rotate-180' : ''} ${isDark ? 'text-slate-500' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {filterOpen && renderFilterGrid()}
              </div>

              {/* Map component */}
              {mapMode === 'svg' ? (
                <SanliurfaSvgMap
                  theme={theme}
                  selectedDistrict={selectedDistrict}
                  onDistrictClick={handleDistrictClick}
                  markers={filteredMarkers}
                />
              ) : isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Yukleniyor...</div>
                </div>
              ) : (
                <SanliurfaLeafletMap
                  theme={theme}
                  selectedDistrict={editMode ? null : selectedDistrict}
                  isPanelOpen={false}
                  onDistrictClick={handleDistrictClick}
                  markers={filteredMarkers}
                  editMode={editMode}
                  selectedMarkerId={selectedMarkerId}
                  onMapClick={handleMapClick}
                  onMarkerClick={handleMarkerClick}
                  mapExpanded={mapExpanded}
                />
              )}

              {/* Pin Editor overlay */}
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

            {/* Edit mode ring */}
            {editMode && (
              <div className="absolute inset-0 rounded-3xl pointer-events-none"
                style={{
                  boxShadow: isDark
                    ? 'inset 0 0 0 1px rgba(245,158,11,0.3)'
                    : 'inset 0 0 0 1px rgba(245,158,11,0.5)',
                }}
              />
            )}
          </GlassCard>

          {/* ── RIGHT: Sidebar Cards ── */}
          <div className="flex flex-col gap-5">
            {/* Weather Hero Card */}
            {renderWeatherHero()}

            {/* Two small placeholder glass cards */}
            <div className="grid grid-cols-2 gap-5">
              {rightPanelCards.map((card, i) => (
                <GlassCard key={i} isDark={isDark} padding="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`p-2.5 rounded-xl ${isDark ? 'bg-white/[0.10]' : 'bg-black/[0.05]'}`}>
                      <div className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                        {card.icon}
                      </div>
                    </div>
                  </div>
                  <div className={`text-[28px] font-semibold tracking-tight leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {card.value}
                  </div>
                  <div className={`text-sm font-medium mt-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {card.title}
                  </div>
                  <div className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    {card.subtitle}
                  </div>
                </GlassCard>
              ))}
            </div>

            {/* Large bottom placeholder glass card */}
            <GlassCard isDark={isDark} className="flex-1 min-h-[120px] flex flex-col items-center justify-center">
              <div className={`flex flex-col items-center gap-3 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                <svg className="w-8 h-8 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
                </svg>
                <span className="text-xs font-medium tracking-wide">Yakında</span>
              </div>
            </GlassCard>
          </div>

        </section>
      </div>
    </div>
  );
};

export default MapDashboard;

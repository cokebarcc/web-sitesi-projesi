import React, { useState, useCallback, useEffect } from 'react';
import { DISTRICTS, INSTITUTION_MARKERS, INSTITUTION_STYLES, getDistrictInstitutionCount } from '../../src/data/sanliurfaDistricts';
import type { InstitutionMarker, InstitutionType } from '../../src/data/sanliurfaDistricts';
import { loadInstitutions, saveInstitutions } from '../../src/services/mapInstitutionStorage';
import { loadKpiCards, saveKpiCards, DEFAULT_KPI_CARDS } from '../../src/services/kpiCardStorage';
import type { KpiCardData } from '../../src/services/kpiCardStorage';
import KpiCardEditor, { renderKpiIcon } from './KpiCardEditor';
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

  // ── KPI Kartları state ──
  const [kpiCards, setKpiCards] = useState<KpiCardData[]>(DEFAULT_KPI_CARDS);
  const [kpiEditorOpen, setKpiEditorOpen] = useState(false);

  // ── Aktif Talep verisi state ──
  const [activeDemandTotal, setActiveDemandTotal] = useState<number | null>(null);
  const [activeDemandDate, setActiveDemandDate] = useState<string | null>(null);

  // Firestore'dan pin verileri yükle
  useEffect(() => {
    loadInstitutions().then((data) => {
      setMarkers(data.length > 0 ? data : INSTITUTION_MARKERS);
      setIsLoading(false);
    });
  }, []);

  // Firestore'dan KPI kartlarını bir kez yükle
  const loadCards = useCallback(() => {
    loadKpiCards().then(setKpiCards);
  }, []);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  // Aktif Talep verisini Firestore'dan çek (en son yüklenen)
  useEffect(() => {
    import('../../src/services/activeDemandStorage').then(({ getActiveDemandFiles }) => {
      getActiveDemandFiles().then((files) => {
        if (files.length > 0) {
          // En son yüklenen dosya
          const latest = files[0]; // zaten uploadedAt'e göre desc sıralı
          // Tüm dosyalar arasından en güncel tarihi al ve toplam talebi hesapla
          const latestDate = latest.date;
          const filesForDate = files.filter(f => f.date === latestDate);
          const totalDemand = filesForDate.reduce((sum, f) => sum + f.totalDemand, 0);
          setActiveDemandTotal(totalDemand);
          setActiveDemandDate(latestDate);
        }
      });
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

  // KPI kartları kaydet (admin)
  const handleSaveKpiCards = useCallback(async (cards: KpiCardData[]) => {
    try {
      await saveKpiCards(cards, userEmail || '');
      setKpiCards(cards); // local state'i hemen güncelle
      setKpiEditorOpen(false);
    } catch (err) {
      console.error('KPI kartları kaydedilemedi:', err);
    }
  }, [userEmail]);

  // Aktif Talep tarihi formatla (2025-01-15 → 15.01.2025)
  const formatDemandDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-');
    return `${d}.${m}.${y}`;
  };

  // Sağ panel KPI verileri — Firestore'dan gelen kartlar + Aktif Talep canlı verisi
  const rightPanelCards = kpiCards.map(card => {
    // "Aktif Talep" kartını canlı veriyle besle
    if (card.id === 'kpi-2' || card.title.toLocaleLowerCase('tr').includes('aktif talep')) {
      return {
        title: 'Aktif Talep',
        value: activeDemandTotal !== null
          ? activeDemandTotal.toLocaleString('tr-TR')
          : card.value,
        subtitle: activeDemandDate
          ? `${formatDemandDate(activeDemandDate)} verisi`
          : card.subtitle,
        iconEl: renderKpiIcon(card.icon),
      };
    }
    return {
      title: card.title,
      value: card.value,
      subtitle: card.subtitle,
      iconEl: renderKpiIcon(card.icon),
    };
  });

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

  // Filter checkbox grid — premium chips
  function renderFilterGrid() {
    return (
      <div className={`flex flex-wrap gap-1 px-2 pb-1.5 pt-0.5 max-w-[260px] max-h-[300px] overflow-y-auto rounded-b-xl ${
        isDark ? '' : ''
      }`}>
        {pinFilterConfig.map(({ type, label }) => {
          const style = INSTITUTION_STYLES[type];
          const checked = visibleTypes.has(type);
          return (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={[
                'inline-flex items-center gap-1.5 rounded-full h-6 px-2.5 text-[9px] font-semibold transition-all border select-none',
                checked
                  ? isDark
                    ? 'border-white/[0.10] text-white/90'
                    : 'border-black/[0.06] text-white'
                  : isDark
                    ? 'bg-transparent border-white/[0.06] text-slate-500 hover:text-slate-300 hover:border-white/[0.12]'
                    : 'bg-transparent border-black/[0.05] text-slate-400 hover:text-slate-600 hover:border-black/[0.08]',
              ].join(' ')}
              style={checked ? { backgroundColor: style.bg, filter: 'saturate(0.65) brightness(0.92)' } : undefined}
              onMouseEnter={(e) => { if (checked) e.currentTarget.style.filter = 'saturate(1) brightness(1)'; }}
              onMouseLeave={(e) => { if (checked) e.currentTarget.style.filter = 'saturate(0.65) brightness(0.92)'; }}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: style.bg, filter: 'saturate(0.8)' }} />
              {label}
            </button>
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
        'relative overflow-hidden rounded-2xl h-[180px] shrink-0 group border',
        'transition-all duration-300 will-change-transform',
        isDark
          ? 'border-white/[0.10] shadow-[0_2px_4px_rgba(0,0,0,0.3),0_8px_24px_-4px_rgba(0,0,0,0.45)]'
          : 'border-black/[0.10] shadow-[0_1px_3px_rgba(0,0,0,0.06),0_6px_24px_-6px_rgba(0,0,0,0.10)]',
        isDark
          ? 'hover:-translate-y-px hover:shadow-[0_4px_8px_rgba(0,0,0,0.4),0_12px_32px_-4px_rgba(0,0,0,0.55)]'
          : 'hover:-translate-y-px hover:shadow-[0_2px_6px_rgba(0,0,0,0.08),0_10px_30px_-6px_rgba(0,0,0,0.14)]',
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

        {/* Dark overlay for better readability */}
        <div className={`absolute inset-0 z-[5] pointer-events-none ${isDark ? 'bg-black/20' : 'bg-black/10'}`} />

        {/* Inner highlight ring */}
        <div className={[
          'pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset z-20',
          isDark ? 'ring-white/[0.08]' : 'ring-white/30',
        ].join(' ')} />

        {/* Content */}
        <div className="relative z-10 p-5 h-full flex flex-col justify-between">
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
                <div className="text-4xl font-semibold text-white tracking-tight leading-none drop-shadow-lg">
                  {weather.temperature}°C
                </div>
                <div className="text-xs text-white/60 mt-0.5 font-medium">
                  {wi.label} · Hissedilen {weather.apparentTemperature}°
                </div>
              </div>

              {/* Glassmorphism pill chips — rounded-full */}
              <div className="flex flex-wrap gap-2 mt-3">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-[11px] text-white/85 backdrop-blur-md">
                  <svg className="w-3 h-3 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636" />
                  </svg>
                  <span className="font-semibold">%{weather.humidity}</span>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-[11px] text-white/85 backdrop-blur-md">
                  <svg className="w-3 h-3 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
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
  //  MAIN LAYOUT — 1080p above-the-fold, flex with min-h-0
  // ══════════════════════════════════════════════════════════════
  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden relative">

      {/* ── Content wrapper ── */}
      <div className="relative z-10 h-full flex flex-col px-4 lg:px-5 pt-2 pb-2 gap-2">

        {/* ═══════════════════════════════════════
            1) BRAND PLAQUE — compact, premium, connected to grid
        ═══════════════════════════════════════ */}
        <section className="flex-none flex items-center justify-center py-1">
          {/* Brand label — premium glass badge */}
          <div className={[
            'mx-auto px-10 py-5 rounded-3xl backdrop-blur-xl border text-center',
            isDark
              ? 'bg-slate-900/70 border-white/[0.12] shadow-[0_12px_40px_rgba(0,0,0,0.35)]'
              : 'bg-white/95 border-black/[0.06] shadow-[0_12px_40px_rgba(15,23,42,0.12)]',
          ].join(' ')}>
            <h1 className={`text-5xl font-bold leading-none tracking-[0.22em] ${
              isDark ? 'text-white/90' : 'text-slate-800'
            }`}>
              MEDİS
            </h1>
            <p className={`mt-2 text-xs tracking-[0.35em] uppercase font-medium ${
              isDark ? 'text-white/35' : 'text-slate-400'
            }`}>
              Merkezi Dijital Sağlık Sistemi
            </p>
          </div>
        </section>

        {/* Edit mode banner — compact */}
        {editMode && (
          <div className="flex-none">
            <div className={`px-4 py-1 rounded-lg border flex items-center gap-3 ${
              isDark ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200'
            }`}>
              <svg className="w-3.5 h-3.5 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
              <span className={`text-[11px] font-medium ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
                Pin Yonetim Modu Aktif
              </span>
              <span className={`text-[11px] ml-auto ${isDark ? 'text-amber-400/60' : 'text-amber-500/60'}`}>{markers.length} pin</span>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════
            2) MAIN GRID — 8/4 map-dominant, stack on md
        ═══════════════════════════════════════ */}
        <section className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4">

          {/* ── LEFT: Map Panel (8 cols) ── */}
          <GlassCard isDark={isDark} hover={false} padding="p-0" className="lg:col-span-8 min-h-0 h-full flex flex-col">
            {/* Map header — compact, same grid language */}
            <div className={`flex items-center justify-between px-3.5 py-1.5 border-b shrink-0 ${
              isDark ? 'border-white/[0.06]' : 'border-black/[0.06]'
            }`}>
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5" fill="none" stroke={isDark ? '#94a3b8' : '#64748b'} viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                <span className={`text-[13px] font-medium ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                  {editMode ? 'Pin Yerlestirme' : 'Harita'}
                </span>
                {selectedDistrict && !editMode && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full" style={{
                    backgroundColor: `${district?.color}20`,
                    color: district?.color,
                  }}>
                    {selectedDistrict}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {isAdmin && (
                  <button
                    onClick={handleToggleEditMode}
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition-all border ${
                      editMode
                        ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                        : isDark
                          ? 'bg-white/[0.05] border-white/[0.08] text-slate-300 hover:bg-white/[0.10] hover:text-white hover:border-white/[0.16]'
                          : 'bg-black/[0.03] border-black/[0.08] text-slate-600 hover:bg-black/[0.06] hover:text-slate-900 hover:border-black/[0.12]'
                    }`}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                    {editMode ? 'Kapat' : 'Pin'}
                    {editMode && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
                  </button>
                )}
                {/* Segmented control — same surface tokens */}
                <div className={`inline-flex rounded-full p-0.5 border ${
                  isDark ? 'bg-white/[0.03] border-white/[0.08]' : 'bg-black/[0.03] border-black/[0.06]'
                }`}>
                  <button onClick={() => setMapMode('svg')} className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium transition-all ${
                    mapMode === 'svg'
                      ? isDark ? 'bg-white/[0.12] text-white shadow-sm' : 'bg-white/80 text-slate-900 shadow-sm'
                      : isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'
                  }`}>Harita</button>
                  <button onClick={() => setMapMode('satellite')} className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium transition-all ${
                    mapMode === 'satellite'
                      ? isDark ? 'bg-white/[0.12] text-white shadow-sm' : 'bg-white/80 text-slate-900 shadow-sm'
                      : isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'
                  }`}>Uydu</button>
                </div>
                {mapMode === 'satellite' && (
                  <button onClick={() => setMapExpanded(true)} className={`p-1 rounded-lg transition-all ${isDark ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-700'}`} title="Büyüt">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Map area — constrained, fills card */}
            <div className="flex-1 relative overflow-hidden" style={{ minHeight: 0 }}>
              {/* Nüfus overlay */}
              <div className={`absolute bottom-2 left-2 z-[100] flex items-center gap-1.5 px-2 py-1 rounded-lg backdrop-blur-md border ${
                isDark ? 'bg-[rgba(12,18,35,0.80)] border-white/[0.08]' : 'bg-white/90 border-black/[0.08]'
              }`}>
                <div className="p-1 rounded" style={{ backgroundColor: '#f59e0b20' }}>
                  <svg className="w-3 h-3" fill="none" stroke="#f59e0b" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <div className={`text-[7px] font-medium uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Nüfus</div>
                  <div className={`text-[11px] font-bold tracking-tight ${isDark ? 'text-slate-50' : 'text-slate-900'}`}>2.265.800</div>
                </div>
              </div>

              {/* Filter panel — premium glass container */}
              <div className={`absolute top-2 left-2 z-[100] rounded-xl backdrop-blur-md border transition-all ${
                isDark ? 'bg-[rgba(12,18,35,0.88)] border-white/[0.08] shadow-[0_4px_12px_rgba(0,0,0,0.3)]' : 'bg-white/[0.92] border-black/[0.08] shadow-[0_2px_8px_rgba(0,0,0,0.06)]'
              }`}>
                <button onClick={() => setFilterOpen(p => !p)} className={`flex items-center gap-2 w-full px-2.5 py-1.5 ${filterOpen ? 'pb-0.5' : ''}`}>
                  <span className={`text-[8px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Kurum Tipi</span>
                  <svg className={`w-2.5 h-2.5 ml-auto transition-transform duration-200 ${filterOpen ? 'rotate-180' : ''} ${isDark ? 'text-slate-500' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {filterOpen && renderFilterGrid()}
              </div>

              {mapMode === 'svg' ? (
                <SanliurfaSvgMap theme={theme} selectedDistrict={selectedDistrict} onDistrictClick={handleDistrictClick} markers={filteredMarkers} />
              ) : isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Yukleniyor...</div>
                </div>
              ) : (
                <SanliurfaLeafletMap theme={theme} selectedDistrict={editMode ? null : selectedDistrict} isPanelOpen={false} onDistrictClick={handleDistrictClick} markers={filteredMarkers} editMode={editMode} selectedMarkerId={selectedMarkerId} onMapClick={handleMapClick} onMarkerClick={handleMarkerClick} mapExpanded={mapExpanded} />
              )}

              {editMode && editorMarker && (
                <div className="absolute top-2 right-2 z-[1000] w-[260px]">
                  <PinEditorPanel theme={theme} marker={editorMarker} onSave={handleSavePin} onDelete={selectedMarkerId ? handleDeletePin : undefined} onCancel={handleCancelEditor} />
                  {saving && <div className={`mt-1 text-center text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Kaydediliyor...</div>}
                </div>
              )}
            </div>

            {editMode && (
              <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{ boxShadow: isDark ? 'inset 0 0 0 1px rgba(245,158,11,0.3)' : 'inset 0 0 0 1px rgba(245,158,11,0.5)' }} />
            )}
          </GlassCard>

          {/* ── RIGHT: Sidebar Cards (5 cols xl, 4 cols lg) ── */}
          <aside className="lg:col-span-4 min-h-0 h-full flex flex-col gap-4">
            {/* Weather — h-[170px] */}
            {renderWeatherHero()}

            {/* KPI — 2 column, compact */}
            <div className="grid grid-cols-2 gap-3">
              {rightPanelCards.map((card, i) => (
                <GlassCard key={i} isDark={isDark} padding="p-4" hover={false}
                  className="relative"
                  style={!isDark ? { background: 'rgba(255,255,255,0.92)', borderColor: 'rgba(0,0,0,0.08)' } : undefined}>
                  {/* Admin kalem ikonu — sadece ilk kartta (düzenlenebilir) */}
                  {isAdmin && i === 0 && (
                    <button
                      onClick={() => setKpiEditorOpen(true)}
                      className={`absolute top-2 right-2 p-1 rounded-md transition-all duration-200 ${
                        isDark
                          ? 'text-slate-600 hover:text-sky-400 hover:bg-white/[0.08]'
                          : 'text-slate-300 hover:text-sky-500 hover:bg-sky-50'
                      }`}
                      title="Kartı Düzenle"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                    </button>
                  )}
                  <div className={`p-1.5 rounded-lg inline-block mb-1 ${isDark ? 'bg-white/[0.05]' : 'bg-black/[0.03]'}`}>
                    <div className={isDark ? 'text-slate-300' : 'text-slate-600'}>{card.iconEl}</div>
                  </div>
                  <div className={`text-lg font-semibold tracking-tight leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>{card.value}</div>
                  <div className={`text-[11px] font-medium mt-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{card.title}</div>
                  <div className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{card.subtitle}</div>
                </GlassCard>
              ))}
            </div>

            {/* Yakında — fills remaining, max-h capped, centered content */}
            <GlassCard isDark={isDark} hover={false} className="flex-1 min-h-0 max-h-[240px] flex flex-col items-center justify-center" padding="p-4"
              style={{
                background: isDark
                  ? 'linear-gradient(to bottom right, rgba(15,23,42,0.60), rgba(30,41,59,0.40))'
                  : undefined,
              }}>
              <div className={`flex flex-col items-center gap-1.5 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                <svg className="w-5 h-5 opacity-25" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
                </svg>
                <span className="text-[10px] font-medium tracking-wide">Yakında</span>
              </div>
            </GlassCard>
          </aside>

        </section>
      </div>

      {/* ── KPI Kart Düzenleme Modal (admin only) ── */}
      {kpiEditorOpen && isAdmin && (
        <KpiCardEditor
          cards={kpiCards}
          isDark={isDark}
          autoCardIds={new Set(['kpi-2'])}
          onSave={handleSaveKpiCards}
          onClose={() => setKpiEditorOpen(false)}
        />
      )}
    </div>
  );
};

export default MapDashboard;

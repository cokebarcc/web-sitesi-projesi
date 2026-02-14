import React, { useState, useEffect, useMemo } from 'react';
import FloatingSidebar from './FloatingSidebar';
import type { DetailedScheduleData, MuayeneMetrics, ScheduleVersion } from '../types';

interface WelcomeDashboardProps {
  userName?: string;
  onNavigate: (view: string) => void;
  userEmail?: string;
  onLogout: () => void;
  isAdmin?: boolean;
  hasModuleAccess: (module: string) => boolean;
  // Data props for KPI cards
  detailedScheduleData?: DetailedScheduleData[];
  muayeneByPeriod?: Record<string, Record<string, MuayeneMetrics>>;
  ameliyatByPeriod?: Record<string, Record<string, number>>;
  scheduleVersions?: Record<string, Record<string, ScheduleVersion>>;
  selectedHospital?: string;
  isDataLoaded?: boolean;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

const WelcomeDashboard: React.FC<WelcomeDashboardProps> = ({
  userName,
  onNavigate,
  userEmail,
  onLogout,
  isAdmin = false,
  hasModuleAccess,
  detailedScheduleData = [],
  muayeneByPeriod = {},
  ameliyatByPeriod = {},
  scheduleVersions = {},
  selectedHospital = '',
  isDataLoaded = false,
  theme = 'dark',
  onToggleTheme
}) => {
  const isDark = theme === 'dark';
  const [commandInput, setCommandInput] = useState('');
  const [isSparkleAnimating, setIsSparkleAnimating] = useState(true);

  // Sparkle animation toggle
  useEffect(() => {
    const interval = setInterval(() => {
      setIsSparkleAnimating(prev => !prev);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Time-based greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 6) return 'İyi Geceler';
    if (hour < 12) return 'Günaydın';
    if (hour < 18) return 'İyi Günler';
    return 'İyi Akşamlar';
  }, []);

  // KPI calculations
  const kpiData = useMemo(() => {
    const uniqueDoctors = new Set(detailedScheduleData.map(d => d.doctorName));
    const totalCapacity = detailedScheduleData.reduce((sum, d) => sum + (d.capacity || 0), 0);

    let totalMuayene = 0;
    let totalMHRS = 0;
    Object.values(muayeneByPeriod).forEach(period => {
      Object.values(period).forEach(metrics => {
        totalMuayene += metrics.toplam || 0;
        totalMHRS += metrics.mhrs || 0;
      });
    });

    let totalAmeliyat = 0;
    Object.values(ameliyatByPeriod).forEach(period => {
      Object.values(period).forEach(count => {
        totalAmeliyat += count || 0;
      });
    });

    const versionCount = Object.keys(scheduleVersions).reduce((count, hospital) => {
      return count + Object.keys(scheduleVersions[hospital] || {}).length;
    }, 0);

    const capacityRate = totalCapacity > 0 ? Math.round((totalMHRS / totalCapacity) * 100) : 0;

    return {
      doctorCount: uniqueDoctors.size,
      totalMuayene,
      totalAmeliyat,
      capacityRate: Math.min(capacityRate, 100),
      versionCount,
      hasData: detailedScheduleData.length > 0 || Object.keys(muayeneByPeriod).length > 0
    };
  }, [detailedScheduleData, muayeneByPeriod, ameliyatByPeriod, scheduleVersions]);

  // Data status for modules
  const dataStatus = useMemo(() => ({
    cetvel: detailedScheduleData.length > 0,
    muayene: Object.keys(muayeneByPeriod).length > 0,
    ameliyat: Object.keys(ameliyatByPeriod).length > 0,
    versions: Object.keys(scheduleVersions).length > 0
  }), [detailedScheduleData, muayeneByPeriod, ameliyatByPeriod, scheduleVersions]);

  // Format large numbers
  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toLocaleString('tr-TR');
  };

  const kpiCards = [
    {
      label: 'Toplam Hekim',
      value: kpiData.doctorCount,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      gradient: 'from-violet-500/20 to-indigo-500/20',
      borderColor: 'border-violet-400/20',
      iconColor: 'text-violet-400'
    },
    {
      label: 'Toplam Muayene',
      value: kpiData.totalMuayene,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
      gradient: 'from-cyan-500/20 to-sky-500/20',
      borderColor: 'border-cyan-400/20',
      iconColor: 'text-cyan-400'
    },
    {
      label: 'Kapasite Kullanımı',
      value: kpiData.capacityRate,
      suffix: '%',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
      gradient: 'from-emerald-500/20 to-teal-500/20',
      borderColor: 'border-emerald-400/20',
      iconColor: 'text-emerald-400'
    },
    {
      label: 'Yüklü Cetvel',
      value: kpiData.versionCount,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      gradient: 'from-amber-500/20 to-orange-500/20',
      borderColor: 'border-amber-400/20',
      iconColor: 'text-amber-400'
    }
  ];

  const moduleCards = [
    {
      id: 'data-upload',
      title: 'Veri Yükle',
      subtitle: 'Excel dosyalarından cetvel ve hekim verisi aktarın',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      ),
      gradient: 'from-violet-500/15 to-blue-500/15',
      borderColor: 'border-violet-400/20',
      hoverBorder: 'hover:border-violet-400/50',
      badge: dataStatus.cetvel ? `${detailedScheduleData.length} kayıt` : null,
      badgeColor: 'bg-violet-500/20 text-violet-300',
      onClick: () => onNavigate('detailed-schedule')
    },
    {
      id: 'dashboard',
      title: 'Verimlilik Analizi',
      subtitle: 'Hekim performans ve verimlilik raporları',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      gradient: 'from-cyan-500/15 to-sky-500/15',
      borderColor: 'border-cyan-400/20',
      hoverBorder: 'hover:border-cyan-400/50',
      badge: dataStatus.muayene ? 'Veri hazır' : null,
      badgeColor: 'bg-cyan-500/20 text-cyan-300',
      onClick: () => onNavigate('efficiency-analysis')
    },
    {
      id: 'change-analysis',
      title: 'Değişim Analizi',
      subtitle: 'Cetvel versiyonları arası karşılaştırma',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      ),
      gradient: 'from-rose-500/15 to-pink-500/15',
      borderColor: 'border-rose-400/20',
      hoverBorder: 'hover:border-rose-400/50',
      badge: dataStatus.versions ? `${kpiData.versionCount} versiyon` : null,
      badgeColor: 'bg-rose-500/20 text-rose-300',
      onClick: () => onNavigate('change-analysis')
    },
    {
      id: 'ai-chatbot',
      title: 'AI Asistan',
      subtitle: 'Yapay zekâ ile veri sorgulama ve analiz',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      gradient: 'from-[#5b9cff]/15 to-[#38bdf8]/15',
      borderColor: 'border-[#5b9cff]/20',
      hoverBorder: 'hover:border-[#5b9cff]/50',
      badge: null,
      badgeColor: 'bg-[#5b9cff]/20 text-[#5b9cff]',
      onClick: () => onNavigate('ai-chatbot')
    },
    {
      id: 'report',
      title: 'Sunum / Rapor',
      subtitle: 'PPTX, PDF ve Word formatında dışa aktarım',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      gradient: 'from-amber-500/15 to-orange-500/15',
      borderColor: 'border-amber-400/20',
      hoverBorder: 'hover:border-amber-400/50',
      badge: null,
      badgeColor: 'bg-amber-500/20 text-amber-300',
      onClick: () => onNavigate('presentation')
    },
    {
      id: 'goren',
      title: 'GÖREN Performans',
      subtitle: 'Kurum bazlı performans değerlendirmesi',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      ),
      gradient: 'from-emerald-500/15 to-teal-500/15',
      borderColor: 'border-emerald-400/20',
      hoverBorder: 'hover:border-emerald-400/50',
      badge: null,
      badgeColor: 'bg-emerald-500/20 text-emerald-300',
      onClick: () => onNavigate('goren-bh')
    }
  ];

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim()) return;
    onNavigate('ai-chatbot');
  };

  // Summary text
  const summaryText = useMemo(() => {
    const parts: string[] = [];
    if (kpiData.doctorCount > 0) parts.push(`${kpiData.doctorCount} hekim`);
    if (kpiData.totalMuayene > 0) parts.push(`${formatNumber(kpiData.totalMuayene)} muayene`);
    if (kpiData.versionCount > 0) parts.push(`${kpiData.versionCount} cetvel`);
    if (parts.length === 0) return 'Henüz veri yüklenmedi. Başlamak için bir modül seçin.';
    return `Sistemde ${parts.join(', ')} kaydı mevcut.`;
  }, [kpiData]);

  return (
    <div className={`min-h-screen relative overflow-hidden transition-colors duration-500 ${
      isDark
        ? 'bg-gradient-to-br from-[#0f1729] via-[#131d33] to-[#0f1729]'
        : 'bg-transparent'
    }`}>
      {/* Background Effects */}
      {isDark && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-gradient-radial from-[#5b9cff]/8 via-[#38bdf8]/4 to-transparent rounded-full blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: `linear-gradient(rgba(99,160,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(99,160,255,0.1) 1px, transparent 1px)`,
              backgroundSize: '50px 50px'
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.015]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
            }}
          />
        </div>
      )}

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center min-h-screen px-6 py-8">
        {/* Top Section: Sparkle + Welcome */}
        <div className="flex flex-col items-center mt-8 mb-8">
          {/* Sparkle Icon */}
          <div className={`mb-6 transition-all duration-1000 ${isSparkleAnimating ? 'scale-110 opacity-100' : 'scale-100 opacity-80'}`}>
            <div className="relative">
              <svg className="w-12 h-12 text-[#5b9cff]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
              </svg>
              <div className="absolute inset-0 blur-xl bg-[#5b9cff]/25 rounded-full animate-pulse" />
              <svg className="absolute -top-1.5 -right-1.5 w-3 h-3 text-[#38bdf8] animate-ping" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
              </svg>
            </div>
          </div>

          {/* Personalized Welcome */}
          <h1 className="text-4xl md:text-5xl font-bold mb-2 tracking-tight">
            <span
              className={`bg-gradient-to-r bg-clip-text text-transparent ${
                isDark
                  ? 'from-white via-[#a8b8d0] to-[#5b9cff]'
                  : ''
              }`}
              style={!isDark ? { backgroundImage: 'linear-gradient(to right, var(--text-1), var(--text-2), #3b82f6)' } : undefined}
            >
              {greeting}
            </span>
            {userName && (
              <span className={isDark ? 'text-[#556a85]' : ''} style={!isDark ? { color: 'var(--text-3)' } : undefined}>, {userName}</span>
            )}
          </h1>
          <p className={`text-sm mb-1 ${isDark ? 'text-[#7b8fad]' : ''}`} style={!isDark ? { color: 'var(--text-3)' } : undefined}>{summaryText}</p>
          {selectedHospital && (
            <p className="text-[#3d5170] text-xs">
              Seçili Hastane: <span className="text-[#5b9cff]">{selectedHospital}</span>
            </p>
          )}
        </div>

        {/* KPI Summary Cards */}
        {kpiData.hasData && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 w-full max-w-4xl">
            {kpiCards.map((card, i) => (
              <div
                key={i}
                className={`relative rounded-2xl p-5 bg-gradient-to-br ${card.gradient} border ${card.borderColor} backdrop-blur-xl transition-all duration-300 hover:scale-[1.03]`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2 rounded-lg bg-white/5 ${card.iconColor}`}>
                    {card.icon}
                  </div>
                </div>
                <div className="text-3xl font-bold mb-1" style={{ color: 'var(--text-1)' }}>
                  {formatNumber(card.value)}{card.suffix || ''}
                </div>
                <div className={`text-xs font-medium ${isDark ? 'text-[#7b8fad]' : ''}`} style={!isDark ? { color: 'var(--text-3)' } : undefined}>{card.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* No Data State */}
        {!kpiData.hasData && (
          <div className="mb-8 w-full max-w-4xl">
            <div className={`rounded-2xl p-6 backdrop-blur-xl text-center border ${
              isDark
                ? 'bg-gradient-to-br from-[#5b9cff]/5 to-transparent border-[#5b9cff]/10'
                : 'bg-white/60 border-blue-200/40 shadow-sm'
            }`}>
              <div className="flex items-center justify-center gap-2 mb-2">
                <svg className="w-5 h-5 text-[#5b9cff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className={`text-sm font-medium ${isDark ? 'text-[#a8b8d0]' : ''}`} style={!isDark ? { color: 'var(--text-2)' } : undefined}>Henüz veri yüklenmedi</span>
              </div>
              <p className={`text-xs ${isDark ? 'text-[#556a85]' : ''}`} style={!isDark ? { color: 'var(--text-3)' } : undefined}>
                Analiz yapabilmek için önce bir hastane seçip veri yükleyin
              </p>
            </div>
          </div>
        )}

        {/* Module Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-10 w-full max-w-4xl">
          {moduleCards.map((card) => (
            <button
              key={card.id}
              onClick={card.onClick}
              className={`
                group relative rounded-2xl text-left
                bg-gradient-to-br ${card.gradient}
                border ${card.borderColor} ${card.hoverBorder}
                backdrop-blur-xl
                transition-all duration-300 ease-out
                hover:scale-[1.03] hover:-translate-y-0.5
                overflow-hidden p-5
              `}
            >
              {/* Card glow on hover */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-white/5 to-transparent" />

              {/* Content */}
              <div className="relative z-10 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="transition-colors duration-300 module-card-icon" style={{ color: 'var(--text-2)' }}>
                    {card.icon}
                  </div>
                  {card.badge && (
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${card.badgeColor}`}>
                      {card.badge}
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-base mb-0.5" style={{ color: 'var(--text-1)' }}>
                    {card.title}
                  </h3>
                  <p className="text-xs leading-relaxed transition-colors line-clamp-2 module-card-subtitle" style={{ color: 'var(--text-3)' }}>
                    {card.subtitle}
                  </p>
                </div>
              </div>

              {/* Decorative corner */}
              <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-white/5 to-transparent rounded-bl-full" />
            </button>
          ))}
        </div>

        {/* Command Input */}
        <form onSubmit={handleCommandSubmit} className="w-full max-w-2xl mb-8">
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-[#5b9cff]/15 via-[#38bdf8]/10 to-[#5b9cff]/15 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div
              className={`relative flex items-center backdrop-blur-xl rounded-2xl border transition-all duration-300 ${
                isDark
                  ? 'bg-[#131d33]/80 border-[#2d4163]/40 group-hover:border-[#5b9cff]/30'
                  : 'bg-white/80 group-hover:border-blue-300/50 shadow-sm'
              }`}
              style={!isDark ? { borderColor: 'var(--border-2)' } : undefined}
            >
              <div className={`pl-5 ${isDark ? 'text-[#556a85]' : ''}`} style={!isDark ? { color: 'var(--text-3)' } : undefined}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>

              <input
                type="text"
                value={commandInput}
                onChange={(e) => setCommandInput(e.target.value)}
                placeholder="Ne yapmak istiyorsunuz? (Örn: 'Ocak ayı yeşil alan oranlarını getir')"
                className={`flex-1 bg-transparent px-4 py-4 outline-none text-sm command-input ${isDark ? 'text-[#e8edf5] placeholder-[#556a85]' : ''}`}
                style={!isDark ? { color: 'var(--text-1)' } : undefined}
              />

              <button
                type="submit"
                className="mr-3 p-2.5 bg-gradient-to-r from-[#5b9cff] to-[#38bdf8] rounded-xl text-white hover:from-[#4388f5] hover:to-[#2ea8e6] transition-all duration-300 hover:scale-105 shadow-lg shadow-[#5b9cff]/20"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 mt-3">
            <p className={`text-xs ${isDark ? 'text-[#3d5170]' : ''}`} style={!isDark ? { color: 'var(--text-3)' } : undefined}>
              AI asistanı kullanarak hızlıca işlem yapabilirsiniz
            </p>
            <span className={`text-xs ${isDark ? 'text-[#2d4163]' : ''}`} style={!isDark ? { color: 'var(--text-3)' } : undefined}>|</span>
            <p className={`text-xs ${isDark ? 'text-[#3d5170]' : ''}`} style={!isDark ? { color: 'var(--text-3)' } : undefined}>
              <kbd className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${isDark ? 'bg-[#1e2d48]/60 border border-[#2d4163]/50 text-[#556a85]' : ''}`} style={!isDark ? { background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text-3)' } : undefined}>Ctrl+K</kbd> ile hızlı arama
            </p>
          </div>
        </form>

        {/* System Status Bar */}
        <div className={`flex flex-wrap items-center justify-center gap-6 text-xs ${isDark ? 'text-[#556a85]' : ''}`} style={!isDark ? { color: 'var(--text-3)' } : undefined}>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span>Sistem Aktif</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>Güvenli Bağlantı</span>
          </div>
          {selectedHospital && (
            <div className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span>{selectedHospital}</span>
            </div>
          )}
          {kpiData.hasData && (
            <div className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-emerald-500/80">Veri Yüklü</span>
            </div>
          )}
        </div>
      </div>

      {/* Floating Sidebar */}
      <FloatingSidebar
        currentView="welcome"
        onNavigate={onNavigate}
        userEmail={userEmail}
        onLogout={onLogout}
        isAdmin={isAdmin}
        hasModuleAccess={hasModuleAccess}
        theme={theme}
        onToggleTheme={onToggleTheme}
      />

      {/* CSS for custom animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        .animate-float {
          animation: float 6s ease-in-out infinite;
        }

        .bg-gradient-radial {
          background: radial-gradient(ellipse at center, var(--tw-gradient-stops));
        }

        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .group:hover .module-card-icon {
          color: var(--text-1) !important;
        }

        .group:hover .module-card-subtitle {
          color: var(--text-2) !important;
        }

        .command-input::placeholder {
          color: var(--text-3);
        }
      `}</style>
    </div>
  );
};

export default WelcomeDashboard;

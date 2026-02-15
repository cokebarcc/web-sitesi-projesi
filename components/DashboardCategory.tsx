import React, { useState, useMemo } from 'react';
import { GlassCard, GlassButton } from './ui';
import { ViewType } from '../types';

interface DashboardCategoryProps {
  category: 'mhrs' | 'financial' | 'preparation' | 'support' | 'emergency';
  onBack: () => void;
  hasModuleAccess: (module: string) => boolean;
  onModuleSelect: (moduleId: string) => void;
  theme?: 'dark' | 'light';
}

interface ModuleDefinition {
  id: string;
  label: string;
  permission: string;
  icon: React.ReactNode;
}

const CATEGORY_MODULES: Record<string, ModuleDefinition[]> = {
  mhrs: [
    {
      id: 'detailed-schedule',
      label: 'Detaylı Cetveller',
      permission: 'detailedSchedule',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    },
    {
      id: 'physician-data',
      label: 'Hekim Verileri',
      permission: 'physicianData',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    },
    {
      id: 'change-analysis',
      label: 'Değişim Analizleri',
      permission: 'changeAnalysis',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    },
    {
      id: 'efficiency-analysis',
      label: 'Verimlilik Analizleri',
      permission: 'efficiencyAnalysis',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    },
    {
      id: 'ai-cetvel-planlama',
      label: 'AI Cetvel Planlama',
      permission: 'aiCetvelPlanlama',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    }
  ],
  financial: [
    {
      id: 'service-analysis',
      label: 'Hizmet Girişim',
      permission: 'serviceAnalysis',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    },
    {
      id: 'etik-kurul',
      label: 'Etik Kurul',
      permission: 'etikKurul',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
      </svg>
    },
    {
      id: 'hekim-islem-listesi',
      label: 'Hekim İşlem Listesi',
      permission: 'hekimIslemListesi',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    },
    {
      id: 'ek-liste-tanimlama',
      label: 'Ek Liste Tanımlama',
      permission: 'ekListeTanimlama',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    },
    {
      id: 'sut-mevzuati',
      label: 'SUT Mevzuatı',
      permission: 'sutMevzuati',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    },
    {
      id: 'gil',
      label: 'GİL',
      permission: 'gil',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    }
  ],
  preparation: [
    {
      id: 'analysis-module',
      label: 'Analiz Modülü',
      permission: 'analysisModule',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    },
    {
      id: 'schedule-planning',
      label: 'Cetvel Planlama',
      permission: 'schedulePlanning',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    },
    {
      id: 'performance-planning',
      label: 'AI Planlama',
      permission: 'performancePlanning',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    },
    {
      id: 'presentation',
      label: 'Sunum',
      permission: 'presentation',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
      </svg>
    }
  ],
  support: [
    {
      id: 'ai-chatbot',
      label: 'AI Sohbet',
      permission: 'aiChatbot',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    },
    {
      id: 'admin',
      label: 'Kullanıcı Yönetimi',
      permission: 'admin',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    }
  ],
  emergency: [
    {
      id: 'emergency-service',
      label: 'Acil Servis',
      permission: 'emergencyService',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    }
  ]
};

const CATEGORY_TITLES: Record<string, string> = {
  mhrs: 'MHRS Analiz Sistemleri',
  financial: 'Finansal Analiz',
  preparation: 'Planlama ve Hazırlama',
  support: 'Destek Sistemleri',
  emergency: 'Acil Servis'
};

const DashboardCategory: React.FC<DashboardCategoryProps> = ({
  category,
  onBack,
  hasModuleAccess,
  onModuleSelect,
  theme = 'dark'
}) => {
  const isDark = theme === 'dark';
  // Erişilebilir tab'ları filtrele
  const availableTabs = useMemo(() => {
    return CATEGORY_MODULES[category].filter(module => {
      if (module.id === 'admin') {
        // Admin paneli sadece admin'e açık - hasModuleAccess içinde kontrol ediliyor
        return hasModuleAccess('admin');
      }
      return hasModuleAccess(module.permission);
    });
  }, [category, hasModuleAccess]);

  // Tab'a tıklandığında doğrudan modülü aç
  const handleTabClick = (tabId: string) => {
    onModuleSelect(tabId);
  };

  if (availableTabs.length === 0) {
    return (
      <div>
        <GlassButton
          isDark={isDark}
          variant="secondary"
          size="sm"
          onClick={onBack}
          className="mb-6"
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          }
        >
          Dashboard'a Dön
        </GlassButton>

        <GlassCard isDark={isDark} hover={false} padding="p-12">
          <div className="text-center">
            <svg className={`w-14 h-14 mx-auto mb-4 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <h2 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Erişim Yok</h2>
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Bu kategorideki modüllere erişim yetkiniz bulunmamaktadır.
            </p>
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <GlassButton
          isDark={isDark}
          variant="secondary"
          size="sm"
          onClick={onBack}
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          }
        >
          Dashboard'a Dön
        </GlassButton>
        <h1 className={`text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {CATEGORY_TITLES[category]}
        </h1>
        <div className="w-[160px]"></div>
      </div>

      {/* Module Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {availableTabs.map(tab => (
          <GlassCard
            key={tab.id}
            isDark={isDark}
            hover={true}
            padding="p-5"
            onClick={() => handleTabClick(tab.id)}
            className="group cursor-pointer"
          >
            <div className="flex items-start gap-4">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                isDark ? 'bg-sky-500/10 text-sky-400 group-hover:bg-sky-500/20' : 'bg-sky-50 text-sky-600 group-hover:bg-sky-100'
              }`}>
                {tab.icon}
              </div>
              <div className="flex-1">
                <h3 className={`font-semibold text-sm mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {tab.label}
                </h3>
                <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Modülü görüntülemek için tıklayın
                </p>
              </div>
              <svg
                className={`w-5 h-5 shrink-0 mt-1 group-hover:translate-x-1 transition-all ${
                  isDark ? 'text-slate-600 group-hover:text-sky-400' : 'text-slate-300 group-hover:text-sky-500'
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
};

export default DashboardCategory;

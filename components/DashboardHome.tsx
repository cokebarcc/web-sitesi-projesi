import React from 'react';
import { GlassCard } from './ui';
import { AppUser } from '../src/types/user';

interface DashboardHomeProps {
  onNavigateToCategory: (category: 'mhrs' | 'financial' | 'preparation' | 'support' | 'emergency') => void;
  userPermissions: AppUser | null;
  theme?: 'dark' | 'light';
}

interface CategoryCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  color: 'indigo' | 'rose' | 'slate' | 'amber' | 'red';
  moduleCount: number;
  onClick: () => void;
  disabled: boolean;
  isDark: boolean;
}

const CategoryCard: React.FC<CategoryCardProps> = ({
  title,
  description,
  icon,
  color,
  moduleCount,
  onClick,
  disabled,
  isDark
}) => {
  const iconBgMap = {
    indigo: isDark ? 'bg-indigo-500/15' : 'bg-indigo-50',
    rose: isDark ? 'bg-rose-500/15' : 'bg-rose-50',
    slate: isDark ? 'bg-slate-500/15' : 'bg-slate-100',
    amber: isDark ? 'bg-amber-500/15' : 'bg-amber-50',
    red: isDark ? 'bg-red-500/15' : 'bg-red-50'
  };

  const iconColorMap = {
    indigo: isDark ? 'text-indigo-400' : 'text-indigo-600',
    rose: isDark ? 'text-rose-400' : 'text-rose-600',
    slate: isDark ? 'text-slate-400' : 'text-slate-700',
    amber: isDark ? 'text-amber-400' : 'text-amber-600',
    red: isDark ? 'text-red-400' : 'text-red-600'
  };

  return (
    <GlassCard
      isDark={isDark}
      variant="default"
      hover={!disabled}
      padding="p-8"
      onClick={disabled ? undefined : onClick}
      className={`group min-h-[220px] ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:scale-[1.02]'}`}
    >
      <div className="relative z-10 h-full flex flex-col justify-between">
        <div>
          <div className={`w-14 h-14 ${iconBgMap[color]} rounded-2xl flex items-center justify-center mb-5`}>
            <div className={iconColorMap[color]}>{icon}</div>
          </div>
          <h2 className={`text-xl font-bold uppercase tracking-tight mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {title}
          </h2>
          <p className={`text-sm font-medium leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {description}
          </p>
        </div>
        <div className="flex items-center justify-between mt-5">
          <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {moduleCount} Modül
          </span>
          <svg
            className={`w-6 h-6 ${isDark ? 'text-slate-600 group-hover:text-sky-400' : 'text-slate-300 group-hover:text-sky-500'} group-hover:translate-x-1 transition-all`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </div>
      </div>
    </GlassCard>
  );
};

const DashboardHome: React.FC<DashboardHomeProps> = ({
  onNavigateToCategory,
  userPermissions,
  theme = 'dark'
}) => {
  const isDark = theme === 'dark';
  // İzin kontrol fonksiyonları
  const hasModuleAccess = (module: keyof AppUser['permissions']['modules']): boolean => {
    if (!userPermissions) return false;
    if (userPermissions.role === 'admin') return true;
    return userPermissions.permissions.modules[module];
  };

  const canAccessCategory = (category: string): boolean => {
    if (!userPermissions) return false;
    if (userPermissions.role === 'admin') return true;

    switch (category) {
      case 'mhrs':
        return hasModuleAccess('detailedSchedule') ||
               hasModuleAccess('physicianData') ||
               hasModuleAccess('changeAnalysis') ||
               hasModuleAccess('efficiencyAnalysis');
      case 'financial':
        return hasModuleAccess('serviceAnalysis') ||
               hasModuleAccess('etikKurul') ||
               hasModuleAccess('hekimIslemListesi') ||
               hasModuleAccess('ekListeTanimlama') ||
               hasModuleAccess('sutMevzuati') ||
               hasModuleAccess('gil');
      case 'preparation':
        return hasModuleAccess('analysisModule') ||
               hasModuleAccess('performancePlanning') ||
               hasModuleAccess('presentation');
      case 'support':
        return hasModuleAccess('aiChatbot') ||
               (userPermissions.role as string) === 'admin'; // Admin paneli için
      case 'emergency':
        return hasModuleAccess('emergencyService');
      default:
        return false;
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-10">
        <h1 className={`text-3xl font-bold tracking-tight mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Dashboard
        </h1>
        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Analiz modüllerinizi seçin ve verilerinizi inceleyin
        </p>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <CategoryCard
          isDark={isDark}
          title="MHRS Analiz Sistemleri"
          description="Randevu kapasitesi, hekim verileri ve verimlilik analizleri"
          icon={
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
          color="indigo"
          moduleCount={4}
          onClick={() => onNavigateToCategory('mhrs')}
          disabled={!canAccessCategory('mhrs')}
        />

        <CategoryCard
          isDark={isDark}
          title="Finansal Analiz"
          description="SUT hizmet kodları ve girişim analizleri"
          icon={
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          color="rose"
          moduleCount={6}
          onClick={() => onNavigateToCategory('financial')}
          disabled={!canAccessCategory('financial')}
        />

        <CategoryCard
          isDark={isDark}
          title="Planlama ve Sunum"
          description="Veri analizi, AI planlama ve sunum araçları"
          icon={
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
          }
          color="slate"
          moduleCount={3}
          onClick={() => onNavigateToCategory('preparation')}
          disabled={!canAccessCategory('preparation')}
        />

        <CategoryCard
          isDark={isDark}
          title="Destek Sistemleri"
          description="AI Chatbot, GÖREN başarı takibi ve yönetim"
          icon={
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
          color="amber"
          moduleCount={3}
          onClick={() => onNavigateToCategory('support')}
          disabled={!canAccessCategory('support')}
        />

        <CategoryCard
          isDark={isDark}
          title="Acil Servis"
          description="Acil servis verileri, hasta yoğunluğu ve performans analizleri"
          icon={
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          color="red"
          moduleCount={1}
          onClick={() => onNavigateToCategory('emergency')}
          disabled={!canAccessCategory('emergency')}
        />
      </div>

      {/* Footer */}
      <div className={`mt-10 pt-6 border-t text-center ${isDark ? 'border-white/[0.06]' : 'border-black/[0.06]'}`}>
        <p className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          T.C. Sağlık Bakanlığı &bull; Şanlıurfa İl Sağlık Müdürlüğü
        </p>
        <p className={`text-xs mt-1.5 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
          MHRS Analiz ve Raporlama Sistemi
        </p>
      </div>
    </div>
  );
};

export default DashboardHome;

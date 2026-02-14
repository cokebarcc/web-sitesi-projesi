import React from 'react';
import { AppUser } from '../src/types/user';

interface DashboardHomeProps {
  onNavigateToCategory: (category: 'mhrs' | 'financial' | 'preparation' | 'support' | 'emergency') => void;
  userPermissions: AppUser | null;
}

interface CategoryCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  color: 'indigo' | 'rose' | 'slate' | 'amber' | 'red';
  moduleCount: number;
  onClick: () => void;
  disabled: boolean;
}

const CategoryCard: React.FC<CategoryCardProps> = ({
  title,
  description,
  icon,
  color,
  moduleCount,
  onClick,
  disabled
}) => {
  const colorMap = {
    indigo: 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200',
    rose: 'bg-rose-600 hover:bg-rose-700 shadow-rose-200',
    slate: 'bg-slate-900 hover:bg-slate-800 shadow-slate-200',
    amber: 'bg-amber-600 hover:bg-amber-700 shadow-amber-200',
    red: 'bg-red-600 hover:bg-red-700 shadow-red-200'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`group relative min-h-[280px] rounded-[48px] p-10 text-left transition-all
        ${disabled ? 'cursor-not-allowed opacity-50' : `${colorMap[color]} shadow-xl hover:scale-105`}`}
      style={disabled ? { backgroundColor: 'var(--surface-2)' } : undefined}
    >
      <div className="relative z-10 h-full flex flex-col justify-between">
        <div>
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-6">
            {icon}
          </div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-3">
            {title}
          </h2>
          <p className="text-sm text-white/80 font-medium leading-relaxed">
            {description}
          </p>
        </div>
        <div className="flex items-center justify-between mt-6">
          <span className="text-xs font-black text-white/60 uppercase tracking-wider">
            {moduleCount} Modül
          </span>
          <svg
            className="w-8 h-8 text-white/60 group-hover:text-white/100 group-hover:translate-x-2 transition-all"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </div>
      </div>
      <div className="absolute inset-0 bg-white/5 rounded-[48px] opacity-0 group-hover:opacity-100 transition-opacity"></div>
    </button>
  );
};

const DashboardHome: React.FC<DashboardHomeProps> = ({
  onNavigateToCategory,
  userPermissions
}) => {
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
    <div className="p-8">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-5xl font-black uppercase tracking-tight mb-4" style={{ color: 'var(--text-1)' }}>
          Dashboard
        </h1>
        <p className="text-lg font-medium" style={{ color: 'var(--text-3)' }}>
          Analiz modüllerinizi seçin ve verilerinizi inceleyin
        </p>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
        {/* MHRS Kategorisi */}
        <CategoryCard
          title="MHRS ANALİZ SİSTEMLERİ"
          description="Randevu kapasitesi, hekim verileri ve verimlilik analizleri"
          icon={
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
          color="indigo"
          moduleCount={4}
          onClick={() => onNavigateToCategory('mhrs')}
          disabled={!canAccessCategory('mhrs')}
        />

        {/* Finansal Kategorisi */}
        <CategoryCard
          title="FİNANSAL ANALİZ"
          description="SUT hizmet kodları ve girişim analizleri"
          icon={
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          color="rose"
          moduleCount={6}
          onClick={() => onNavigateToCategory('financial')}
          disabled={!canAccessCategory('financial')}
        />

        {/* Hazırlama Kategorisi */}
        <CategoryCard
          title="PLANLAMA VE SUNUM"
          description="Veri analizi, AI planlama ve sunum araçları"
          icon={
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
          }
          color="slate"
          moduleCount={3}
          onClick={() => onNavigateToCategory('preparation')}
          disabled={!canAccessCategory('preparation')}
        />

        {/* Destek Kategorisi */}
        <CategoryCard
          title="DESTEK SİSTEMLERİ"
          description="AI Chatbot, GÖREN başarı takibi ve yönetim"
          icon={
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
          color="amber"
          moduleCount={3}
          onClick={() => onNavigateToCategory('support')}
          disabled={!canAccessCategory('support')}
        />

        {/* Acil Servis Kategorisi */}
        <CategoryCard
          title="ACİL SERVİS"
          description="Acil servis verileri, hasta yoğunluğu ve performans analizleri"
          icon={
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
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
      <div className="mt-12 pt-8 border-t text-center" style={{ borderColor: 'var(--border-2)' }}>
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
          T.C. Sağlık Bakanlığı • Şanlıurfa İl Sağlık Müdürlüğü
        </p>
        <p className="text-xs mt-2" style={{ color: 'var(--text-2)' }}>
          MHRS Analiz ve Raporlama Sistemi
        </p>
      </div>
    </div>
  );
};

export default DashboardHome;

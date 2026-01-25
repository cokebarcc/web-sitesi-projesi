/**
 * GÖREN Özet Kartları
 *
 * Toplam puan, TR Rol Ortalaması, başarı oranı ve muaf gösterge sayısı
 */

import React, { useState } from 'react';
import { CalculationSummary } from '../types/goren.types';

interface GorenSummaryCardsProps {
  /** Hesaplama özeti */
  summary: CalculationSummary | null;
  /** Yükleme durumu */
  isLoading?: boolean;
  /** Muaf gösterge sayısı */
  muafCount?: number;
  /** Toplam gösterge sayısı (muaf için) */
  totalIndicators?: number;
  /** Admin mi? */
  isAdmin?: boolean;
  /** TR Rol Ortalaması değeri */
  trRolOrtalamasi?: number | null;
  /** TR Rol Ortalaması değiştiğinde */
  onTrRolOrtalamasiChange?: (value: number) => void;
}

export const GorenSummaryCards: React.FC<GorenSummaryCardsProps> = ({
  summary,
  isLoading = false,
  muafCount = 0,
  totalIndicators = 0,
  isAdmin = false,
  trRolOrtalamasi = null,
  onTrRolOrtalamasiChange
}) => {
  const [isEditingTrRol, setIsEditingTrRol] = useState(false);
  const [tempTrRolValue, setTempTrRolValue] = useState<string>('');

  // TR Rol düzenleme başlat
  const handleStartEdit = () => {
    setTempTrRolValue(trRolOrtalamasi?.toString() || '');
    setIsEditingTrRol(true);
  };

  // TR Rol kaydet
  const handleSaveTrRol = () => {
    const value = parseFloat(tempTrRolValue);
    if (!isNaN(value) && value >= 0 && onTrRolOrtalamasiChange) {
      onTrRolOrtalamasiChange(value);
    }
    setIsEditingTrRol(false);
  };

  // TR Rol iptal
  const handleCancelEdit = () => {
    setIsEditingTrRol(false);
    setTempTrRolValue('');
  };

  // Yükleme durumu
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="bg-[var(--glass-bg)] backdrop-blur-xl rounded-3xl border border-[var(--glass-border)] p-6 animate-pulse"
          >
            <div className="h-3 bg-gray-300 rounded w-24 mb-3" />
            <div className="h-8 bg-gray-300 rounded w-16 mb-2" />
            <div className="h-2 bg-gray-200 rounded w-32" />
          </div>
        ))}
      </div>
    );
  }

  // Veri yoksa boş kartlar
  if (!summary) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <SummaryCard
          title="TOPLAM PUAN"
          value="-"
          subtitle="Hesaplama için veri girin"
          color="indigo"
        />
        <TrRolOrtalamasiCard
          value={trRolOrtalamasi}
          isAdmin={isAdmin}
          isEditing={isEditingTrRol}
          tempValue={tempTrRolValue}
          onStartEdit={handleStartEdit}
          onSave={handleSaveTrRol}
          onCancel={handleCancelEdit}
          onTempValueChange={setTempTrRolValue}
        />
        <SummaryCard
          title="BAŞARI ORANI"
          value="-"
          subtitle="Performans yüzdesi"
          color="emerald"
        />
        <SummaryCard
          title="MUAF"
          value="-"
          subtitle="Muaf gösterge sayısı"
          color="violet"
        />
      </div>
    );
  }

  // Başarı oranına göre renk
  const getAchievementColor = (rate: number): 'indigo' | 'purple' | 'emerald' | 'amber' | 'rose' | 'orange' | 'violet' => {
    if (rate >= 80) return 'emerald';
    if (rate >= 60) return 'amber';
    if (rate >= 40) return 'orange';
    return 'rose';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {/* Toplam Puan */}
      <SummaryCard
        title="TOPLAM PUAN"
        value={summary.totalGP.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
        subtitle={`${summary.completedIndicators} göstergeden`}
        color="indigo"
        trend={summary.achievementRate >= 70 ? 'up' : summary.achievementRate >= 50 ? 'stable' : 'down'}
      />

      {/* TR Rol Ortalaması */}
      <TrRolOrtalamasiCard
        value={trRolOrtalamasi}
        isAdmin={isAdmin}
        isEditing={isEditingTrRol}
        tempValue={tempTrRolValue}
        onStartEdit={handleStartEdit}
        onSave={handleSaveTrRol}
        onCancel={handleCancelEdit}
        onTempValueChange={setTempTrRolValue}
      />

      {/* Başarı Oranı */}
      <SummaryCard
        title="BAŞARI ORANI"
        value={`%${summary.achievementRate.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}`}
        subtitle={getAchievementLabel(summary.achievementRate)}
        color={getAchievementColor(summary.achievementRate)}
        showProgress
        progressValue={summary.achievementRate}
      />

      {/* Muaf Gösterge */}
      <SummaryCard
        title="MUAF"
        value={`${muafCount}/${totalIndicators || summary.totalIndicators}`}
        subtitle={muafCount > 0
          ? `${muafCount} gösterge muaf tutuldu`
          : 'Muaf gösterge yok'
        }
        color="violet"
      />
    </div>
  );
};

// Başarı oranına göre etiket
const getAchievementLabel = (rate: number): string => {
  if (rate >= 90) return 'Mükemmel performans';
  if (rate >= 80) return 'Çok iyi performans';
  if (rate >= 70) return 'İyi performans';
  if (rate >= 60) return 'Orta performans';
  if (rate >= 50) return 'Geliştirilmeli';
  return 'Kritik seviye';
};

// TR Rol Ortalaması Kartı
interface TrRolOrtalamasiCardProps {
  value: number | null;
  isAdmin: boolean;
  isEditing: boolean;
  tempValue: string;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onTempValueChange: (value: string) => void;
}

const TrRolOrtalamasiCard: React.FC<TrRolOrtalamasiCardProps> = ({
  value,
  isAdmin,
  isEditing,
  tempValue,
  onStartEdit,
  onSave,
  onCancel,
  onTempValueChange
}) => {
  return (
    <div className="bg-purple-500/10 backdrop-blur-xl rounded-3xl border border-purple-500/20 p-6 relative">
      <div className="flex items-start justify-between">
        <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
          TR ROL ORTALAMASI
        </p>
        {isAdmin && !isEditing && (
          <button
            onClick={onStartEdit}
            className="text-purple-400 hover:text-purple-300 transition-colors"
            title="Düzenle"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="mt-2">
          <input
            type="number"
            value={tempValue}
            onChange={(e) => onTempValueChange(e.target.value)}
            className="w-full bg-purple-900/30 border border-purple-500/30 rounded-lg px-3 py-2 text-2xl font-black text-purple-400 focus:outline-none focus:border-purple-400"
            placeholder="0"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSave();
              if (e.key === 'Escape') onCancel();
            }}
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={onSave}
              className="flex-1 px-3 py-1.5 bg-purple-500 text-white text-xs font-bold rounded-lg hover:bg-purple-600 transition-colors"
            >
              Kaydet
            </button>
            <button
              onClick={onCancel}
              className="flex-1 px-3 py-1.5 bg-slate-600 text-white text-xs font-bold rounded-lg hover:bg-slate-500 transition-colors"
            >
              İptal
            </button>
          </div>
        </div>
      ) : (
        <>
          <h3 className="text-3xl font-black text-purple-400 mt-2">
            {value !== null ? value.toLocaleString('tr-TR', { maximumFractionDigits: 2 }) : '-'}
          </h3>
          <p className="text-[11px] text-[var(--text-muted)] mt-2">
            {value !== null ? 'Türkiye rol ortalaması' : 'Henüz belirlenmedi'}
          </p>
        </>
      )}
    </div>
  );
};

// Tek kart bileşeni
interface SummaryCardProps {
  title: string;
  value: string;
  subtitle: string;
  color: 'indigo' | 'purple' | 'emerald' | 'amber' | 'rose' | 'orange' | 'violet';
  trend?: 'up' | 'down' | 'stable';
  showProgress?: boolean;
  progressValue?: number;
}

const SummaryCard: React.FC<SummaryCardProps> = ({
  title,
  value,
  subtitle,
  color,
  trend,
  showProgress,
  progressValue = 0
}) => {
  const colorClasses = {
    indigo: {
      text: 'text-indigo-400',
      bg: 'bg-indigo-500/10',
      border: 'border-indigo-500/20',
      progress: 'bg-indigo-500'
    },
    purple: {
      text: 'text-purple-400',
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/20',
      progress: 'bg-purple-500'
    },
    emerald: {
      text: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      progress: 'bg-emerald-500'
    },
    amber: {
      text: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      progress: 'bg-amber-500'
    },
    rose: {
      text: 'text-rose-400',
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/20',
      progress: 'bg-rose-500'
    },
    orange: {
      text: 'text-orange-400',
      bg: 'bg-orange-500/10',
      border: 'border-orange-500/20',
      progress: 'bg-orange-500'
    },
    violet: {
      text: 'text-violet-400',
      bg: 'bg-violet-500/10',
      border: 'border-violet-500/20',
      progress: 'bg-violet-500'
    }
  };

  const classes = colorClasses[color];

  return (
    <div className={`${classes.bg} backdrop-blur-xl rounded-3xl border ${classes.border} p-6`}>
      <div className="flex items-start justify-between">
        <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
          {title}
        </p>
        {trend && (
          <span className={`${
            trend === 'up' ? 'text-emerald-400' :
            trend === 'down' ? 'text-rose-400' :
            'text-gray-400'
          }`}>
            {trend === 'up' && (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            )}
            {trend === 'down' && (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            )}
            {trend === 'stable' && (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
              </svg>
            )}
          </span>
        )}
      </div>

      <h3 className={`text-3xl font-black ${classes.text} mt-2`}>
        {value}
      </h3>

      <p className="text-[11px] text-[var(--text-muted)] mt-2">
        {subtitle}
      </p>

      {/* İlerleme çubuğu */}
      {showProgress && (
        <div className="mt-3">
          <div className="w-full h-2 bg-[var(--bg-3)] rounded-full overflow-hidden">
            <div
              className={`h-full ${classes.progress} rounded-full transition-all duration-500`}
              style={{ width: `${Math.min(progressValue, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default GorenSummaryCards;

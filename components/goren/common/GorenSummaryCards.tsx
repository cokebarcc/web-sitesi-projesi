/**
 * GÖREN Özet Kartları
 *
 * Toplam puan, maksimum puan, başarı oranı ve tamamlanan gösterge sayısı
 */

import React from 'react';
import { CalculationSummary } from '../types/goren.types';

interface GorenSummaryCardsProps {
  /** Hesaplama özeti */
  summary: CalculationSummary | null;
  /** Yükleme durumu */
  isLoading?: boolean;
}

export const GorenSummaryCards: React.FC<GorenSummaryCardsProps> = ({
  summary,
  isLoading = false
}) => {
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
        <SummaryCard
          title="MAKSİMUM PUAN"
          value="-"
          subtitle="Alınabilecek maksimum"
          color="purple"
        />
        <SummaryCard
          title="BAŞARI ORANI"
          value="-"
          subtitle="Performans yüzdesi"
          color="emerald"
        />
        <SummaryCard
          title="TAMAMLANAN"
          value="-"
          subtitle="Hesaplanan gösterge"
          color="amber"
        />
      </div>
    );
  }

  // Başarı oranına göre renk
  const getAchievementColor = (rate: number): 'indigo' | 'purple' | 'emerald' | 'amber' | 'rose' | 'orange' => {
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

      {/* Maksimum Puan */}
      <SummaryCard
        title="MAKSİMUM PUAN"
        value={summary.maxPossibleGP.toString()}
        subtitle="Alınabilecek maksimum"
        color="purple"
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

      {/* Tamamlanan Gösterge */}
      <SummaryCard
        title="TAMAMLANAN"
        value={`${summary.completedIndicators}/${summary.totalIndicators}`}
        subtitle={summary.incompleteIndicators > 0
          ? `${summary.incompleteIndicators} gösterge eksik`
          : 'Tüm göstergeler hesaplandı'
        }
        color={summary.incompleteIndicators === 0 ? 'emerald' : 'amber'}
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

// Tek kart bileşeni
interface SummaryCardProps {
  title: string;
  value: string;
  subtitle: string;
  color: 'indigo' | 'purple' | 'emerald' | 'amber' | 'rose' | 'orange';
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

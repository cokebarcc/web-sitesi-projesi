/**
 * GÖREN Özet Kartları — Premium Design System
 *
 * Toplam puan, TR Rol Ortalaması, başarı oranı ve muaf gösterge sayısı
 * Uses g-kpi-card tokens from goren-premium.css
 */

import React, { useState } from 'react';
import { CalculationSummary } from '../types/goren.types';
import { GlassCard } from '../../ui';

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
            className="g-kpi-card rounded-[20px] animate-pulse backdrop-blur-xl"
          >
            <div className="h-3 rounded-xl w-24 mb-3" style={{ background: 'var(--g-border)' }} />
            <div className="h-8 rounded-xl w-16 mb-2" style={{ background: 'var(--g-border)' }} />
            <div className="h-2 rounded-xl w-32" style={{ background: 'var(--g-border-light)' }} />
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
    <div className="g-kpi-card rounded-[20px] backdrop-blur-xl g-kpi-card--purple">
      <div className="flex items-start justify-between">
        <p className="g-text-meta">TR ROL ORTALAMASI</p>
        {isAdmin && !isEditing && (
          <button
            onClick={onStartEdit}
            style={{ color: 'var(--g-accent)' }}
            className="hover:opacity-80 transition-opacity"
            title="Düzenle"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        )}
      </div>

      {isEditing ? (
        <div style={{ marginTop: 'var(--g-space-2)' }}>
          <input
            type="number"
            value={tempValue}
            onChange={(e) => onTempValueChange(e.target.value)}
            className="g-num"
            style={{
              width: '100%',
              background: 'var(--g-surface-sunken)',
              border: '2px solid var(--g-accent)',
              borderRadius: 'var(--g-radius-md)',
              padding: 'var(--g-space-2) var(--g-space-3)',
              fontSize: '24px',
              fontWeight: 900,
              color: 'var(--g-text)',
              outline: 'none'
            }}
            placeholder="0"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSave();
              if (e.key === 'Escape') onCancel();
            }}
          />
          <div className="flex gap-2" style={{ marginTop: 'var(--g-space-2)' }}>
            <button
              onClick={onSave}
              className="g-btn g-btn-primary"
              style={{ flex: 1, height: '32px', fontSize: '12px' }}
            >
              Kaydet
            </button>
            <button
              onClick={onCancel}
              className="g-btn g-btn-secondary"
              style={{ flex: 1, height: '32px', fontSize: '12px' }}
            >
              İptal
            </button>
          </div>
        </div>
      ) : (
        <>
          <h3 className="g-num" style={{ fontSize: '30px', fontWeight: 900, color: 'var(--g-text)', marginTop: 'var(--g-space-2)' }}>
            {value !== null ? value.toLocaleString('tr-TR', { maximumFractionDigits: 2 }) : '-'}
          </h3>
          <p className="g-text-small" style={{ marginTop: 'var(--g-space-2)', color: 'var(--g-text-muted)' }}>
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
  // Map color to the g-kpi-card accent class
  const kpiAccentClass = `g-kpi-card--${color}`;

  // Progress bar gradient colors
  const progressColors: Record<string, string> = {
    indigo: 'linear-gradient(to right, #6366f1, #4f46e5)',
    purple: 'linear-gradient(to right, #7c3aed, #6d28d9)',
    emerald: 'linear-gradient(to right, #059669, #047857)',
    amber: 'linear-gradient(to right, #d97706, #b45309)',
    rose: 'linear-gradient(to right, #e11d48, #be123c)',
    orange: 'linear-gradient(to right, #ea580c, #c2410c)',
    violet: 'linear-gradient(to right, #8b5cf6, #7c3aed)'
  };

  // Value accent color
  const valueColors: Record<string, string> = {
    indigo: 'var(--g-accent)',
    purple: '#7c3aed',
    emerald: 'var(--g-success)',
    amber: 'var(--g-warning)',
    rose: 'var(--g-danger)',
    orange: '#ea580c',
    violet: '#8b5cf6'
  };

  return (
    <div className={`g-kpi-card rounded-[20px] backdrop-blur-xl ${kpiAccentClass}`}>
      <div className="flex items-start justify-between">
        <p className="g-text-meta">{title}</p>
        {trend && (
          <span style={{ color: trend === 'up' ? 'var(--g-success)' : trend === 'down' ? 'var(--g-danger)' : 'var(--g-text-muted)' }}>
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

      <h3 className="g-num" style={{ fontSize: '30px', fontWeight: 900, color: valueColors[color], marginTop: 'var(--g-space-2)' }}>
        {value}
      </h3>

      <p className="g-text-small" style={{ marginTop: 'var(--g-space-2)', color: 'var(--g-text-muted)' }}>
        {subtitle}
      </p>

      {/* İlerleme çubuğu */}
      {showProgress && (
        <div style={{ marginTop: 'var(--g-space-3)' }}>
          <div className="g-progress">
            <div
              className="g-progress-bar"
              style={{ width: `${Math.min(progressValue, 100)}%`, background: progressColors[color] }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default GorenSummaryCards;

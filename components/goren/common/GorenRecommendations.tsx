/**
 * GÖREN Puan İyileştirme Önerileri Bileşeni
 *
 * Tüm GÖREN modülleri (BH, İLÇESM, ADSH vb.) için gösterge verilerini
 * analiz ederek puan artırma önerilerini gösteren panel.
 */

import React, { useMemo, useState } from 'react';
import { BHTableRow } from '../../../src/services/gorenStorage';
import { IndicatorDefinition, CalculationSummary, InstitutionType, RecommendationsSummary } from '../types/goren.types';
import { generateRecommendations, generateGenericRecommendations } from '../../../utils/gorenRecommendations';

interface GorenRecommendationsProps {
  bhTableData: BHTableRow[];
  definitions: IndicatorDefinition[];
  summary: CalculationSummary | null;
  totalGP: number;
  moduleType?: InstitutionType;
}

// Öncelik renkleri
const PRIORITY_COLORS: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  critical: { bg: 'bg-gradient-to-br from-rose-100 to-pink-100 dark:from-rose-500/20 dark:to-pink-500/15', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-400 dark:border-rose-500/40', badge: 'bg-rose-200 dark:bg-rose-500/30 text-rose-800 dark:text-rose-200' },
  high: { bg: 'bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-500/20 dark:to-amber-500/15', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-400 dark:border-orange-500/40', badge: 'bg-orange-200 dark:bg-orange-500/30 text-orange-800 dark:text-orange-200' },
  medium: { bg: 'bg-gradient-to-br from-amber-100 to-yellow-100 dark:from-amber-500/20 dark:to-yellow-500/15', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-400 dark:border-amber-500/40', badge: 'bg-amber-200 dark:bg-amber-500/30 text-amber-800 dark:text-amber-200' },
  low: { bg: 'bg-gradient-to-br from-gray-100 to-slate-100 dark:from-gray-500/20 dark:to-slate-500/15', text: 'text-gray-700 dark:text-gray-300', border: 'border-gray-400 dark:border-gray-500/40', badge: 'bg-gray-200 dark:bg-gray-500/30 text-gray-800 dark:text-gray-200' }
};

const PRIORITY_LABELS: Record<string, string> = {
  critical: 'Kritik',
  high: 'Yüksek',
  medium: 'Orta',
  low: 'Düşük'
};

function formatGD(value: number | null, direction?: string): string {
  if (value === null) return '-';
  return value % 1 === 0 ? value.toString() : value.toFixed(2);
}

// Modül tipine göre gösterge kısaltma prefix'i
const MODULE_PREFIX: Record<InstitutionType, string> = {
  BH: 'BH',
  ILCESM: 'İLÇESM',
  ADSH: 'ADSH',
  ASH: 'ASH',
  ILSM: 'İLSM'
};

export const GorenRecommendations: React.FC<GorenRecommendationsProps> = ({
  bhTableData,
  definitions,
  summary,
  totalGP,
  moduleType = 'BH'
}) => {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const recommendationsSummary: RecommendationsSummary = useMemo(() => {
    if (moduleType === 'BH') {
      return generateRecommendations(bhTableData, definitions, totalGP);
    }
    return generateGenericRecommendations(bhTableData, definitions, totalGP, moduleType);
  }, [bhTableData, definitions, totalGP, moduleType]);

  const indicatorPrefix = MODULE_PREFIX[moduleType] || 'BH';

  const toggleRow = (code: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const maxPossibleGP = definitions.reduce((sum, d) => sum + d.maxPoints, 0);

  if (recommendationsSummary.recommendations.length === 0) {
    return null;
  }

  const displayedRecommendations = showAll
    ? recommendationsSummary.recommendations
    : recommendationsSummary.recommendations.slice(0, 10);

  return (
    <div className="g-section-card rounded-[20px] backdrop-blur-xl">
      {/* A) Başlık + Tahmini Puan Rozeti */}
      <div className="flex items-center justify-between" style={{ padding: 'var(--g-space-5) var(--g-space-6)', borderBottom: '1px solid var(--g-border)' }}>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center" style={{ width: '40px', height: '40px', borderRadius: 'var(--g-radius-md)', background: 'var(--g-warning-muted)', border: '1px solid var(--g-warning)' }}>
            <svg className="w-5 h-5" style={{ color: 'var(--g-warning)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div>
            <h3 className="g-title-section">Puan İyileştirme Önerileri</h3>
            <p className="g-text-small" style={{ color: 'var(--g-text-muted)' }}>{recommendationsSummary.recommendations.length} göstergede iyileştirme potansiyeli</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {recommendationsSummary.easyTargetGain > 0 && (
            <div className="g-badge" style={{ background: 'var(--g-success-light)', color: 'var(--g-success-text)', border: '1px solid var(--g-success)', padding: '6px 16px', fontSize: '13px' }}>
              <span className="font-bold">Kolay hedeflerle: {recommendationsSummary.easyTargetTotalGP} puan</span>
            </div>
          )}
          <div className="g-badge" style={{ background: 'var(--g-surface-muted)', color: 'var(--g-text-tertiary)', border: '1px solid var(--g-border)', padding: '6px 12px' }}>
            Tüm potansiyel: {recommendationsSummary.estimatedTotalGP}
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* B) Özet İstatistik Kartları */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MiniCard
            title="Kolay Hedefler"
            value={`+${recommendationsSummary.easyTargetGain}`}
            subtitle={`puan (${recommendationsSummary.easyTargets.length} gösterge)`}
            color="emerald"
          />
          <MiniCard
            title="Sıfır Puanlı"
            value={recommendationsSummary.zeroPointIndicators.toString()}
            subtitle="gösterge"
            color="rose"
          />
          <MiniCard
            title="Kısmi Puanlı"
            value={recommendationsSummary.partialPointIndicators.toString()}
            subtitle="gösterge"
            color="orange"
          />
          <MiniCard
            title="Toplam Potansiyel"
            value={`+${recommendationsSummary.totalPotentialGain}`}
            subtitle="puan (tüm öneriler)"
            color="amber"
          />
        </div>

        {/* E) Tahmini Puan Bar - 3 katmanlı */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--text-muted)]">Mevcut: <span className="font-bold text-[var(--text-1)]">{totalGP}</span></span>
            {recommendationsSummary.easyTargetGain > 0 && (
              <span className="text-[var(--text-muted)]">Kolay hedeflerle: <span className="font-bold text-emerald-400">{recommendationsSummary.easyTargetTotalGP}</span></span>
            )}
            <span className="text-[var(--text-muted)]">Maks: <span className="font-bold text-[var(--text-1)]">{maxPossibleGP}</span></span>
          </div>
          <div className="relative h-4 bg-[var(--surface-2)] rounded-full border border-[var(--border-1)] overflow-hidden backdrop-blur-xl">
            {/* Katman 3: Tüm potansiyel (en altta, soluk) */}
            <div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-amber-500/20 to-amber-400/20 rounded-full transition-all duration-500"
              style={{ width: `${maxPossibleGP > 0 ? (recommendationsSummary.estimatedTotalGP / maxPossibleGP) * 100 : 0}%` }}
            />
            {/* Katman 2: Kolay hedefler (ortada, belirgin yeşil) */}
            {recommendationsSummary.easyTargetGain > 0 && (
              <div
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-500/40 to-emerald-400/40 rounded-full transition-all duration-500"
                style={{ width: `${maxPossibleGP > 0 ? (recommendationsSummary.easyTargetTotalGP / maxPossibleGP) * 100 : 0}%` }}
              />
            )}
            {/* Katman 1: Mevcut puan (üstte, koyu) */}
            <div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full transition-all duration-500"
              style={{ width: `${maxPossibleGP > 0 ? (totalGP / maxPossibleGP) * 100 : 0}%` }}
            />
          </div>
          <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-indigo-500 inline-block" />
              Mevcut Puan
            </span>
            {recommendationsSummary.easyTargetGain > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-emerald-500/40 inline-block" />
                Kolay Hedefler
              </span>
            )}
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-amber-500/20 inline-block border border-amber-500/30" />
              Tüm Potansiyel
            </span>
          </div>
        </div>

        {/* C) Kolay Ulaşılabilir Hedefler */}
        {recommendationsSummary.easyTargets.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Kolay Ulaşılabilir Hedefler
              </h4>
              <span className="text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-200 dark:bg-emerald-500/25 px-2.5 py-1 rounded-lg font-semibold border border-emerald-300 dark:border-emerald-500/30">
                Toplam +{recommendationsSummary.easyTargetGain} puan
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {recommendationsSummary.easyTargets.slice(0, 6).map(et => (
                <div
                  key={et.indicatorCode}
                  className="p-4 rounded-[20px] bg-gradient-to-br from-emerald-100 to-teal-50 dark:from-emerald-500/15 dark:to-teal-500/10 border-2 border-emerald-300 dark:border-emerald-500/30 hover:border-emerald-500 dark:hover:border-emerald-500/50 transition-all shadow-md shadow-emerald-500/10 dark:shadow-emerald-500/5 hover:shadow-lg backdrop-blur-xl"
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs font-mono text-emerald-600/70 dark:text-emerald-400/70">{indicatorPrefix}-{et.sira}</span>
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">+{et.pointsGainable}p</span>
                  </div>
                  <p className="text-sm font-medium text-[var(--text-1)] mb-2 line-clamp-2">{et.indicatorName}</p>
                  <div className="text-xs text-[var(--text-muted)]">
                    <span className="text-rose-600 dark:text-rose-400">{formatGD(et.currentGD)}</span>
                    <span className="mx-1">&rarr;</span>
                    <span className="text-emerald-600 dark:text-emerald-400">{formatGD(et.targetGD)}</span>
                  </div>
                  <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-1">{et.nextTierCondition}</p>
                  {et.actionHint && (
                    <p className="text-xs text-cyan-700 dark:text-cyan-400 mt-1.5 flex items-center gap-1">
                      <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      {et.actionHint}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* D) Tüm Öneriler Listesi */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Tüm Öneriler ({recommendationsSummary.recommendations.length})
          </h4>
          <div className="space-y-1">
            {displayedRecommendations.map(rec => {
              const colors = PRIORITY_COLORS[rec.priority];
              const isExpanded = expandedRows.has(rec.indicatorCode);

              return (
                <div key={rec.indicatorCode} className="rounded-[20px] border border-[var(--border-1)] overflow-hidden">
                  {/* Ana satır */}
                  <button
                    onClick={() => toggleRow(rec.indicatorCode)}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[var(--surface-hover)] transition-colors text-left"
                  >
                    {/* Öncelik rozeti */}
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${colors.badge}`}>
                      {PRIORITY_LABELS[rec.priority]}
                    </span>

                    {/* Gösterge no + adı */}
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-mono text-[var(--text-muted)]">{indicatorPrefix}-{rec.sira}</span>
                      <span className="mx-2 text-sm text-[var(--text-1)] truncate">{rec.indicatorName}</span>
                    </div>

                    {/* GD değerleri */}
                    <div className="hidden md:flex items-center gap-1 text-xs shrink-0">
                      <span className="text-[var(--text-muted)]">{formatGD(rec.currentGD)}</span>
                      <span className="text-[var(--text-muted)]">&rarr;</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">{formatGD(rec.targetGD)}</span>
                    </div>

                    {/* Potansiyel puan */}
                    <span className={`px-2 py-1 rounded-lg text-xs font-bold ${colors.bg} ${colors.text}`}>
                      +{rec.pointsGainable}p
                    </span>

                    {/* Expand icon */}
                    <svg
                      className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Genişletilmiş detay */}
                  {isExpanded && (
                    <div className="px-4 py-3 border-t border-[var(--border-1)] bg-[var(--surface-2)] space-y-2">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div>
                          <span className="text-[var(--text-muted)]">Kategori</span>
                          <p className="font-medium text-[var(--text-1)]">{rec.categoryName}</p>
                        </div>
                        <div>
                          <span className="text-[var(--text-muted)]">Mevcut GP</span>
                          <p className="font-medium text-[var(--text-1)]">{rec.currentGP} / {rec.maxPoints}</p>
                        </div>
                        <div>
                          <span className="text-[var(--text-muted)]">Hedef GP</span>
                          <p className="font-medium text-emerald-600 dark:text-emerald-400">{rec.targetGP} / {rec.maxPoints}</p>
                        </div>
                        <div>
                          <span className="text-[var(--text-muted)]">Yön</span>
                          <p className="font-medium text-[var(--text-1)]">
                            {rec.direction === 'decrease' ? 'GD azaltılmalı' : 'GD artırılmalı'}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 p-3 rounded-[20px] bg-[var(--surface-2)] border border-[var(--border-1)]">
                        <p className="text-xs text-[var(--text-muted)] mb-1">Puanlama Kuralı:</p>
                        <p className="text-xs font-mono text-[var(--text-1)]">{rec.ruleDescription}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-100 to-teal-50 dark:from-emerald-500/15 dark:to-teal-500/10 border border-emerald-300 dark:border-emerald-500/30">
                        <p className="text-xs text-emerald-800 dark:text-emerald-300 font-semibold">{rec.nextTierCondition}</p>
                        {rec.actionHint && (
                          <p className="text-xs text-cyan-700 dark:text-cyan-400 mt-1.5 flex items-center gap-1">
                            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                            <span className="font-medium">{rec.actionHint}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Daha fazla göster */}
          {recommendationsSummary.recommendations.length > 10 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="w-full py-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
            >
              {showAll
                ? 'Daha az göster'
                : `Tümünü göster (${recommendationsSummary.recommendations.length - 10} daha)`
              }
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Mini özet kartı
const MiniCard: React.FC<{
  title: string;
  value: string;
  subtitle: string;
  color: 'amber' | 'rose' | 'orange' | 'emerald';
}> = ({ title, value, subtitle, color }) => {
  const colorTokens = {
    amber: { accent: 'var(--g-warning)', bg: 'var(--g-warning-light)', text: 'var(--g-warning-text)' },
    rose: { accent: 'var(--g-danger)', bg: 'var(--g-danger-light)', text: 'var(--g-danger-text)' },
    orange: { accent: '#ea580c', bg: 'var(--g-warning-light)', text: 'var(--g-warning-text)' },
    emerald: { accent: 'var(--g-success)', bg: 'var(--g-success-light)', text: 'var(--g-success-text)' }
  };

  const ct = colorTokens[color];

  return (
    <div className={`g-stat-card g-stat-card--${color}`} style={{ color: ct.text }}>
      <p className="g-text-meta" style={{ marginBottom: '4px', opacity: 0.8, color: ct.text }}>{title}</p>
      <p className="g-num" style={{ fontSize: '24px', fontWeight: 900 }}>{value}</p>
      <p className="g-text-small" style={{ opacity: 0.6, color: ct.text }}>{subtitle}</p>
    </div>
  );
};

export default GorenRecommendations;

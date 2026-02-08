/**
 * GÖREN BH Puan İyileştirme Önerileri Bileşeni
 *
 * BH gösterge tablosundaki mevcut veriler analiz edilerek,
 * puanları artırmak için yapılması gerekenleri gösteren panel.
 */

import React, { useMemo, useState } from 'react';
import { BHTableRow } from '../../../src/services/gorenStorage';
import { IndicatorDefinition, CalculationSummary, ScoreRecommendation } from '../types/goren.types';
import { generateRecommendations } from '../../../utils/gorenRecommendations';

interface GorenRecommendationsProps {
  bhTableData: BHTableRow[];
  definitions: IndicatorDefinition[];
  summary: CalculationSummary | null;
  totalGP: number;
}

// Öncelik renkleri
const PRIORITY_COLORS: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  critical: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30', badge: 'bg-rose-500/20 text-rose-300' },
  high: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30', badge: 'bg-orange-500/20 text-orange-300' },
  medium: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', badge: 'bg-amber-500/20 text-amber-300' },
  low: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30', badge: 'bg-slate-500/20 text-slate-300' }
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

export const GorenRecommendations: React.FC<GorenRecommendationsProps> = ({
  bhTableData,
  definitions,
  summary,
  totalGP
}) => {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const recommendationsSummary = useMemo(
    () => generateRecommendations(bhTableData, definitions, totalGP),
    [bhTableData, definitions, totalGP]
  );

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
    <div className="bg-[var(--glass-bg)] backdrop-blur-xl rounded-3xl border border-[var(--glass-border)] overflow-hidden">
      {/* A) Başlık + Tahmini Puan Rozeti */}
      <div className="px-6 py-5 border-b border-[var(--glass-border)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-[var(--text-1)]">Puan İyileştirme Önerileri</h3>
            <p className="text-xs text-[var(--text-muted)]">{recommendationsSummary.recommendations.length} göstergede iyileştirme potansiyeli</p>
          </div>
        </div>
        <div className="px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30">
          <span className="text-sm font-semibold text-emerald-400">
            Tüm öneriler uygulanırsa: {recommendationsSummary.estimatedTotalGP} puan
          </span>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* B) Özet İstatistik Kartları */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MiniCard
            title="İyileştirilebilir"
            value={`+${recommendationsSummary.totalPotentialGain}`}
            subtitle="puan"
            color="amber"
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
            title="Tahmini Başarı"
            value={`%${recommendationsSummary.estimatedAchievementRate.toFixed(0)}`}
            subtitle="oran"
            color="emerald"
          />
        </div>

        {/* E) Tahmini Puan Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--text-muted)]">Mevcut: <span className="font-bold text-[var(--text-1)]">{totalGP}</span></span>
            <span className="text-[var(--text-muted)]">Potansiyel: <span className="font-bold text-emerald-400">{recommendationsSummary.estimatedTotalGP}</span></span>
            <span className="text-[var(--text-muted)]">Maks: <span className="font-bold text-[var(--text-1)]">{maxPossibleGP}</span></span>
          </div>
          <div className="relative h-4 bg-[var(--glass-bg)] rounded-full border border-[var(--glass-border)] overflow-hidden">
            {/* Mevcut puan */}
            <div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full transition-all duration-500"
              style={{ width: `${maxPossibleGP > 0 ? (totalGP / maxPossibleGP) * 100 : 0}%` }}
            />
            {/* Potansiyel kazanım */}
            <div
              className="absolute top-0 h-full bg-gradient-to-r from-emerald-500/40 to-emerald-400/40 rounded-r-full transition-all duration-500"
              style={{
                left: `${maxPossibleGP > 0 ? (totalGP / maxPossibleGP) * 100 : 0}%`,
                width: `${maxPossibleGP > 0 ? (recommendationsSummary.totalPotentialGain / maxPossibleGP) * 100 : 0}%`
              }}
            />
          </div>
          <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-indigo-500 inline-block" />
              Mevcut Puan
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-emerald-500/40 inline-block" />
              Potansiyel Kazanım
            </span>
          </div>
        </div>

        {/* C) Hızlı Kazanımlar */}
        {recommendationsSummary.quickWins.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Hızlı Kazanımlar
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {recommendationsSummary.quickWins.map(qw => (
                <div
                  key={qw.indicatorCode}
                  className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 hover:border-emerald-500/40 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs font-mono text-emerald-400/70">BH-{qw.sira}</span>
                    <span className="text-sm font-bold text-emerald-400">+{qw.pointsGainable}p</span>
                  </div>
                  <p className="text-sm font-medium text-[var(--text-1)] mb-2 line-clamp-2">{qw.indicatorName}</p>
                  <div className="text-xs text-[var(--text-muted)]">
                    <span className="text-rose-400">{formatGD(qw.currentGD)}</span>
                    <span className="mx-1">&rarr;</span>
                    <span className="text-emerald-400">{formatGD(qw.targetGD)}</span>
                  </div>
                  <p className="text-xs text-emerald-400/80 mt-1">{qw.nextTierCondition}</p>
                  {qw.actionHint && (
                    <p className="text-xs text-cyan-400 mt-1.5 flex items-center gap-1">
                      <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      {qw.actionHint}
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
                <div key={rec.indicatorCode} className="rounded-xl border border-[var(--glass-border)] overflow-hidden">
                  {/* Ana satır */}
                  <button
                    onClick={() => toggleRow(rec.indicatorCode)}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors text-left"
                  >
                    {/* Öncelik rozeti */}
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${colors.badge}`}>
                      {PRIORITY_LABELS[rec.priority]}
                    </span>

                    {/* Gösterge no + adı */}
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-mono text-[var(--text-muted)]">BH-{rec.sira}</span>
                      <span className="mx-2 text-sm text-[var(--text-1)] truncate">{rec.indicatorName}</span>
                    </div>

                    {/* GD değerleri */}
                    <div className="hidden md:flex items-center gap-1 text-xs shrink-0">
                      <span className="text-[var(--text-muted)]">{formatGD(rec.currentGD)}</span>
                      <span className="text-[var(--text-muted)]">&rarr;</span>
                      <span className="text-emerald-400 font-medium">{formatGD(rec.targetGD)}</span>
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
                    <div className="px-4 py-3 border-t border-[var(--glass-border)] bg-white/[0.02] space-y-2">
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
                          <p className="font-medium text-emerald-400">{rec.targetGP} / {rec.maxPoints}</p>
                        </div>
                        <div>
                          <span className="text-[var(--text-muted)]">Yön</span>
                          <p className="font-medium text-[var(--text-1)]">
                            {rec.direction === 'decrease' ? 'GD azaltılmalı' : 'GD artırılmalı'}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 p-3 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)]">
                        <p className="text-xs text-[var(--text-muted)] mb-1">Puanlama Kuralı:</p>
                        <p className="text-xs font-mono text-[var(--text-1)]">{rec.ruleDescription}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                        <p className="text-xs text-emerald-400 font-medium">{rec.nextTierCondition}</p>
                        {rec.actionHint && (
                          <p className="text-xs text-cyan-400 mt-1.5 flex items-center gap-1">
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
              className="w-full py-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
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
  const colorMap = {
    amber: 'from-amber-500/10 to-amber-500/5 border-amber-500/20 text-amber-400',
    rose: 'from-rose-500/10 to-rose-500/5 border-rose-500/20 text-rose-400',
    orange: 'from-orange-500/10 to-orange-500/5 border-orange-500/20 text-orange-400',
    emerald: 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 text-emerald-400'
  };

  return (
    <div className={`p-4 rounded-2xl bg-gradient-to-br border ${colorMap[color]}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70 mb-1">{title}</p>
      <p className="text-2xl font-black">{value}</p>
      <p className="text-[10px] opacity-50">{subtitle}</p>
    </div>
  );
};

export default GorenRecommendations;

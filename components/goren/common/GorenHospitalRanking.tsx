/**
 * GÖREN Kurum Başarı Sıralaması - Podyum Tasarımı
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  loadAllHospitalsBHRanking,
  HospitalRankingEntry
} from '../../../src/services/gorenStorage';

interface GorenHospitalRankingProps {
  hospitals: { id: string; name: string }[];
  year: number;
  month: number;
  maxGP: number;
  currentInstitutionId?: string;
  moduleLabel?: string;
}

const MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

/* ========== CSS ANIMATIONS (inline style tag) ========== */
const AnimationStyles = () => (
  <style>{`
    @keyframes rankSlideIn {
      from { opacity: 0; transform: translateX(-40px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @keyframes rankBarGrow {
      from { width: 0%; }
    }
    @keyframes rankFadeUp {
      from { opacity: 0; transform: translateY(20px) scale(0.95); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes rankPulseGlow {
      0%, 100% { box-shadow: 0 0 20px rgba(99, 102, 241, 0.1); }
      50%      { box-shadow: 0 0 40px rgba(99, 102, 241, 0.25); }
    }
    @keyframes rankCountUp {
      from { opacity: 0; transform: scale(0.5); }
      to   { opacity: 1; transform: scale(1); }
    }
    @keyframes crownBounce {
      0%, 100% { transform: translateY(0) rotate(0deg); }
      25%      { transform: translateY(-4px) rotate(-3deg); }
      75%      { transform: translateY(-2px) rotate(3deg); }
    }
    @keyframes shimmer {
      0%   { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    .rank-slide-in { animation: rankSlideIn 0.5s ease-out both; }
    .rank-bar-grow { animation: rankBarGrow 1s ease-out both; }
    .rank-fade-up  { animation: rankFadeUp 0.6s ease-out both; }
    .rank-pulse    { animation: rankPulseGlow 3s ease-in-out infinite; }
    .rank-count-up { animation: rankCountUp 0.4s ease-out both; }
    .crown-bounce  { animation: crownBounce 2s ease-in-out infinite; }
    .shimmer-bg    {
      background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.05) 50%, transparent 100%);
      background-size: 200% 100%;
      animation: shimmer 3s ease-in-out infinite;
    }
  `}</style>
);

/* ========== HELPER FUNCTIONS ========== */

const getColor = (rate: number) => {
  if (rate >= 80) return { text: 'text-emerald-400', bg: 'bg-emerald-500', gradient: 'from-emerald-500 to-emerald-400' };
  if (rate >= 60) return { text: 'text-amber-400', bg: 'bg-amber-500', gradient: 'from-amber-500 to-yellow-400' };
  if (rate >= 40) return { text: 'text-orange-400', bg: 'bg-orange-500', gradient: 'from-orange-500 to-orange-400' };
  return { text: 'text-rose-400', bg: 'bg-rose-500', gradient: 'from-rose-500 to-rose-400' };
};

const getMedal = (rank: number) => {
  if (rank === 1) return { emoji: '🏆', label: '1.', color: 'from-amber-400 to-yellow-500' };
  if (rank === 2) return { emoji: '🥈', label: '2.', color: 'from-slate-300 to-slate-400' };
  if (rank === 3) return { emoji: '🥉', label: '3.', color: 'from-orange-400 to-amber-600' };
  return { emoji: '', label: `${rank}.`, color: '' };
};

/* ========== PODYUM ========== */

const VariantPodium: React.FC<{
  withData: HospitalRankingEntry[];
  noData: HospitalRankingEntry[];
  maxGP: number;
  currentInstitutionId?: string;
}> = ({ withData, noData, maxGP, currentInstitutionId }) => {
  const top3 = withData.slice(0, 3);
  const rest = withData.slice(3);

  // Podyum sıralama: 2 - 1 - 3
  const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;
  const podiumBaseHeights = ['h-20', 'h-28', 'h-16'];
  const cardSizes = ['w-48', 'w-56', 'w-44'];

  return (
    <div>
      {/* Podyum */}
      {top3.length >= 3 && (
        <div className="flex items-end justify-center gap-3 mb-8 pt-2 px-4">
          {podiumOrder.map((entry, i) => {
            const actualRank = i === 0 ? 2 : i === 1 ? 1 : 3;
            const medal = getMedal(actualRank);
            const color = getColor(entry.achievementRate);
            const isCurrent = entry.institutionId === currentInstitutionId;

            return (
              <div
                key={entry.institutionId}
                className={`flex flex-col items-center rank-fade-up ${cardSizes[i]}`}
                style={{ animationDelay: `${i * 150}ms` }}
              >
                {/* Kart */}
                <div className={`w-full rounded-2xl border border-white/10 p-4 text-center backdrop-blur-sm mb-0
                  bg-gradient-to-b from-white/[0.06] to-white/[0.02]
                  ${isCurrent ? 'ring-2 ring-indigo-400/60 rank-pulse' : ''}
                  hover:from-white/[0.08] hover:to-white/[0.04] transition-all duration-300`}
                >
                  {/* Taç / Madalya */}
                  <div className={`text-4xl mb-2 ${actualRank === 1 ? 'crown-bounce' : ''}`}>
                    {medal.emoji}
                  </div>

                  {/* Hastane */}
                  <p className={`${actualRank === 1 ? 'text-base' : 'text-sm'} font-bold text-white truncate mb-2`}>
                    {entry.institutionName}
                  </p>

                  {/* Yüzde */}
                  <div className={`${actualRank === 1 ? 'text-4xl' : 'text-3xl'} font-black ${color.text} rank-count-up mb-2`}
                    style={{ animationDelay: `${300 + i * 150}ms` }}
                  >
                    %{entry.achievementRate.toFixed(0)}
                  </div>

                  {/* Mini progress */}
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-2">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${color.gradient} rank-bar-grow`}
                      style={{ width: `${Math.min(entry.achievementRate, 100)}%`, animationDelay: `${400 + i * 100}ms` }}
                    />
                  </div>

                  <p className="text-xs text-slate-400">
                    <span className="font-bold text-slate-300">{entry.totalGP}</span> / {maxGP}
                  </p>

                  {isCurrent && (
                    <div className="mt-2">
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-300 font-bold uppercase tracking-widest">
                        Siz
                      </span>
                    </div>
                  )}
                </div>

                {/* Podyum Kaidesi */}
                <div className={`w-full ${podiumBaseHeights[i]} rounded-b-2xl shimmer-bg
                  ${actualRank === 1 ? 'bg-gradient-to-t from-amber-500/25 to-amber-400/5 border-x border-b border-amber-500/20'
                    : actualRank === 2 ? 'bg-gradient-to-t from-slate-400/20 to-slate-300/5 border-x border-b border-slate-400/15'
                    : 'bg-gradient-to-t from-orange-500/20 to-orange-400/5 border-x border-b border-orange-500/15'}`}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Geri kalan */}
      <div className="space-y-1">
        {rest.map((entry, index) => {
          const rank = index + 4;
          const isCurrent = entry.institutionId === currentInstitutionId;
          const color = getColor(entry.achievementRate);

          return (
            <div
              key={entry.institutionId}
              className={`rank-slide-in flex items-center gap-4 px-5 py-3 rounded-2xl transition-all
                ${isCurrent
                  ? 'bg-indigo-500/12 border border-indigo-500/25'
                  : 'bg-white/[0.02] border border-transparent hover:bg-white/[0.05]'}`}
              style={{ animationDelay: `${(index + 3) * 80}ms` }}
            >
              <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
                <span className="text-base font-bold text-slate-400">{rank}</span>
              </div>
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <span className={`text-base font-semibold truncate ${isCurrent ? 'text-indigo-200' : 'text-white'}`}>
                  {entry.institutionName}
                </span>
                {isCurrent && <span className="text-[9px] px-2 py-0.5 rounded-full bg-indigo-500/25 text-indigo-300 font-bold uppercase flex-shrink-0">Siz</span>}
              </div>
              <span className="text-base font-bold text-white hidden sm:inline">{entry.totalGP}<span className="text-sm text-slate-500"> / {maxGP}</span></span>
              <div className="w-36 sm:w-44 flex items-center gap-3">
                <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full bg-gradient-to-r ${color.gradient} rank-bar-grow`}
                    style={{ width: `${Math.min(entry.achievementRate, 100)}%`, animationDelay: `${(index + 3) * 80 + 200}ms` }}
                  />
                </div>
                <span className={`text-base font-bold w-14 text-right ${color.text}`}>%{entry.achievementRate.toFixed(0)}</span>
              </div>
            </div>
          );
        })}
        {noData.map(entry => (
          <div key={entry.institutionId} className="flex items-center gap-4 px-5 py-2.5 rounded-2xl opacity-40">
            <div className="w-9 h-9 rounded-xl bg-white/[0.02] flex items-center justify-center">
              <span className="text-base text-slate-600">-</span>
            </div>
            <span className="flex-1 text-base text-slate-600">{entry.institutionName}</span>
            <span className="text-sm text-slate-600 italic">Veri yok</span>
          </div>
        ))}
      </div>
    </div>
  );
};


/* ========== ANA BİLEŞEN ========== */

export const GorenHospitalRanking: React.FC<GorenHospitalRankingProps> = ({
  hospitals, year, month, maxGP, currentInstitutionId, moduleLabel = 'Başhekimlik'
}) => {
  const [rankings, setRankings] = useState<HospitalRankingEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const hospitalsKey = useMemo(() => hospitals.map(h => h.id).join(','), [hospitals]);

  useEffect(() => {
    if (hospitals.length === 0) return;
    let cancelled = false;
    setIsLoading(true);
    loadAllHospitalsBHRanking(hospitals, year, month, maxGP)
      .then(data => { if (!cancelled) { setRankings(data); setIsLoading(false); } })
      .catch(err => { console.error('[GOREN Ranking]', err); if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [hospitalsKey, year, month, maxGP]); // eslint-disable-line react-hooks/exhaustive-deps

  const hospitalsWithData = useMemo(() => rankings.filter(r => r.dataExists).length, [rankings]);
  const withData = useMemo(() => rankings.filter(r => r.dataExists), [rankings]);
  const noData = useMemo(() => rankings.filter(r => !r.dataExists), [rankings]);

  if (isLoading) {
    return (
      <div className="bg-gradient-to-br from-slate-900/80 via-indigo-950/40 to-slate-900/80 backdrop-blur-xl rounded-3xl border border-indigo-500/20 p-8 mb-6">
        <div className="flex items-center justify-center gap-3 py-8">
          <div className="animate-spin w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full" />
          <span className="text-base text-indigo-300 font-medium">Kurum sıralaması yükleniyor...</span>
        </div>
      </div>
    );
  }

  if (rankings.length === 0) return null;

  return (
    <>
      <AnimationStyles />
      <div className="bg-gradient-to-br from-slate-900/80 via-indigo-950/40 to-slate-900/80 backdrop-blur-xl rounded-3xl border border-indigo-500/20 mb-6 overflow-hidden">
        {/* Baslik */}
        <div className="px-8 py-5 flex items-center justify-between">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-4 hover:opacity-80 transition-opacity"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border border-indigo-400/30 flex items-center justify-center shadow-lg shadow-indigo-500/10">
              <svg className="w-6 h-6 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="text-left">
              <h3 className="text-lg font-bold text-white tracking-tight">{moduleLabel} Başarı Sıralaması</h3>
              <p className="text-sm text-indigo-300/70 mt-0.5">
                {MONTHS[month - 1]} {year} &middot; {moduleLabel} &middot; {hospitalsWithData}/{rankings.length} kurum
              </p>
            </div>
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className={`w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center transition-transform duration-300 ${isCollapsed ? '' : 'rotate-180'}`}
            >
              <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Icerik */}
        {!isCollapsed && (
          <div className="px-8 pb-8">
            {hospitalsWithData === 0 ? (
              <div className="text-center py-12">
                <svg className="w-16 h-16 text-slate-700 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p className="text-lg text-slate-500 font-medium">Bu dönem için henüz kurum verisi yüklenmemiş.</p>
              </div>
            ) : (
              <VariantPodium withData={withData} noData={noData} maxGP={maxGP} currentInstitutionId={currentInstitutionId} />
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default GorenHospitalRanking;

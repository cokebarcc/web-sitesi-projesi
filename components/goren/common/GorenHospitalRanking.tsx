/**
 * GÖREN Kurum Başarı Sıralaması - Profesyonel Podyum Tasarımı
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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

/* ========== CSS ANIMATIONS ========== */
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
    @keyframes shimmer {
      0%   { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    .rank-slide-in { animation: rankSlideIn 0.5s ease-out both; }
    .rank-bar-grow { animation: rankBarGrow 1s ease-out both; }
    .rank-fade-up  { animation: rankFadeUp 0.6s ease-out both; }
    .rank-pulse    { animation: rankPulseGlow 3s ease-in-out infinite; }
    .rank-count-up { animation: rankCountUp 0.4s ease-out both; }
    .shimmer-bg    {
      background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.05) 50%, transparent 100%);
      background-size: 200% 100%;
      animation: shimmer 3s ease-in-out infinite;
    }
  `}</style>
);

/* ========== RANK BADGE SVG ========== */
const RankBadge: React.FC<{ rank: number; size?: number }> = ({ rank, size = 48 }) => {
  // Renk paleti
  const colors = rank === 1
    ? { outer: '#f59e0b', inner: '#fbbf24', ring: '#d97706', text: '#78350f', glow: 'rgba(245,158,11,0.3)' }
    : rank === 2
    ? { outer: '#94a3b8', inner: '#cbd5e1', ring: '#64748b', text: '#1e293b', glow: 'rgba(148,163,184,0.3)' }
    : { outer: '#f97316', inner: '#fdba74', ring: '#c2410c', text: '#431407', glow: 'rgba(249,115,22,0.3)' };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Glow effect */}
        <circle cx="24" cy="24" r="22" fill={colors.glow} />
        {/* Outer ring */}
        <circle cx="24" cy="24" r="20" fill={colors.outer} />
        {/* Inner circle */}
        <circle cx="24" cy="24" r="16" fill={colors.inner} />
        {/* Highlight */}
        <ellipse cx="24" cy="18" rx="12" ry="8" fill="white" opacity="0.25" />
        {/* Ring border */}
        <circle cx="24" cy="24" r="20" stroke={colors.ring} strokeWidth="1.5" fill="none" />
        <circle cx="24" cy="24" r="16" stroke={colors.ring} strokeWidth="1" fill="none" />
        {/* Number */}
        <text x="24" y="25" textAnchor="middle" dominantBaseline="central"
          fontSize="18" fontWeight="800" fontFamily="system-ui, sans-serif" fill={colors.text}>
          {rank}
        </text>
      </svg>
    </div>
  );
};

/* ========== HELPER FUNCTIONS ========== */

const getColor = (rate: number) => {
  if (rate >= 80) return { text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500', gradient: 'from-emerald-500 to-emerald-400' };
  if (rate >= 60) return { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500', gradient: 'from-amber-500 to-yellow-400' };
  if (rate >= 40) return { text: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500', gradient: 'from-orange-500 to-orange-400' };
  return { text: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500', gradient: 'from-rose-500 to-rose-400' };
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
  const badgeSizes = [40, 52, 36];

  return (
    <div>
      {/* Podyum */}
      {top3.length >= 3 && (
        <div className="flex items-end justify-center gap-3 mb-8 pt-2 px-4">
          {podiumOrder.map((entry, i) => {
            const actualRank = i === 0 ? 2 : i === 1 ? 1 : 3;
            const color = getColor(entry.achievementRate);
            const isCurrent = entry.institutionId === currentInstitutionId;

            return (
              <div
                key={entry.institutionId}
                className={`flex flex-col items-center rank-fade-up ${cardSizes[i]}`}
                style={{ animationDelay: `${i * 150}ms` }}
              >
                {/* Kart */}
                <div className={`g-podium-card w-full mb-0 ${isCurrent ? 'g-podium-card--active rank-pulse' : ''}`}
                >
                  {/* Rank Badge */}
                  <div className="flex justify-center mb-2">
                    <RankBadge rank={actualRank} size={badgeSizes[i]} />
                  </div>

                  {/* Kurum Adı */}
                  <p className={`${actualRank === 1 ? 'text-base' : 'text-sm'} font-bold truncate mb-2`} style={{ color: 'var(--g-text)' }}>
                    {entry.institutionName}
                  </p>

                  {/* Yüzde */}
                  <div className={`${actualRank === 1 ? 'text-4xl' : 'text-3xl'} font-black ${color.text} rank-count-up mb-2`}
                    style={{ animationDelay: `${300 + i * 150}ms` }}
                  >
                    %{entry.achievementRate.toFixed(0)}
                  </div>

                  {/* Mini progress */}
                  <div className="g-progress w-full mb-2">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${color.gradient} rank-bar-grow`}
                      style={{ width: `${Math.min(entry.achievementRate, 100)}%`, animationDelay: `${400 + i * 100}ms` }}
                    />
                  </div>

                  <p className="g-text-small">
                    <span className="font-bold" style={{ color: 'var(--g-text)' }}>{entry.totalGP}</span> / {maxGP}
                  </p>

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
              className={`g-rank-row rank-slide-in ${isCurrent ? 'g-rank-row--active' : ''}`}
              style={{ animationDelay: `${(index + 3) * 80}ms` }}
            >
              <div className="flex items-center justify-center" style={{ width: '36px', height: '36px', borderRadius: 'var(--g-radius-md)', background: 'var(--g-surface-muted)', border: '1px solid var(--g-border)' }}>
                <span className="text-base font-bold" style={{ color: 'var(--g-text-secondary)' }}>{rank}</span>
              </div>
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <span className="text-base font-semibold truncate" style={{ color: isCurrent ? 'var(--g-accent-text)' : 'var(--g-text)' }}>
                  {entry.institutionName}
                </span>
              </div>
              <span className="g-num text-base font-bold hidden sm:inline" style={{ color: 'var(--g-text)' }}>{entry.totalGP}<span className="text-sm" style={{ color: 'var(--g-text-muted)' }}> / {maxGP}</span></span>
              <div className="w-36 sm:w-44 flex items-center gap-3">
                <div className="g-progress flex-1">
                  <div className={`g-progress-bar bg-gradient-to-r ${color.gradient} rank-bar-grow`}
                    style={{ width: `${Math.min(entry.achievementRate, 100)}%`, animationDelay: `${(index + 3) * 80 + 200}ms` }}
                  />
                </div>
                <span className={`g-num text-base font-bold w-14 text-right ${color.text}`}>%{entry.achievementRate.toFixed(0)}</span>
              </div>
            </div>
          );
        })}
        {noData.map(entry => (
          <div key={entry.institutionId} className="flex items-center gap-4 px-5 py-2.5 rounded-[20px] opacity-50">
            <div className="w-9 h-9 rounded-xl bg-[var(--surface-2)] flex items-center justify-center">
              <span className="text-base text-[var(--text-muted)]">-</span>
            </div>
            <span className="flex-1 text-base text-[var(--text-muted)]">{entry.institutionName}</span>
            <span className="text-sm text-[var(--text-muted)] italic">Veri yok</span>
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
  const [isExporting, setIsExporting] = useState(false);

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

  /* ========== PNG EXPORT — Canvas API ile beyaz zemin üzerinde profesyonel render ========== */
  const handleExportPng = useCallback(async () => {
    if (isExporting || withData.length === 0) return;
    setIsExporting(true);

    try {
      const DPR = 2;
      // Sabit boyut — tüm modüllerde aynı PNG boyutu
      const W = 1200;
      const H = 800;
      const PAD = 48;
      const HEADER_H = 100;
      const FOOTER_H = 44;
      const hasPodium = withData.length >= 3;
      const PODIUM_H = hasPodium ? 240 : 0;
      const GAP = hasPodium ? 20 : 0;
      const restCount = Math.max(withData.length - (hasPodium ? 3 : 0), 0) + noData.length;
      const tableArea = H - HEADER_H - PODIUM_H - GAP - FOOTER_H - PAD;
      const ROW_H = restCount > 0 ? Math.min(52, Math.floor(tableArea / restCount)) : 52;

      const canvas = document.createElement('canvas');
      canvas.width = W * DPR;
      canvas.height = H * DPR;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(DPR, DPR);

      // ---- Arka plan ----
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);

      // ---- Helper fonksiyonlar ----
      const drawRoundedRect = (x: number, y: number, w: number, h: number, r: number) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
      };

      const getRateColor = (rate: number): string => {
        if (rate >= 80) return '#10b981';
        if (rate >= 60) return '#f59e0b';
        if (rate >= 40) return '#f97316';
        return '#ef4444';
      };

      const getBadgeColors = (rank: number) => {
        if (rank === 1) return { bg: '#f59e0b', inner: '#fbbf24', text: '#78350f' };
        if (rank === 2) return { bg: '#94a3b8', inner: '#cbd5e1', text: '#1e293b' };
        return { bg: '#f97316', inner: '#fdba74', text: '#431407' };
      };

      const drawBadge = (cx: number, cy: number, rank: number, size: number) => {
        const c = getBadgeColors(rank);
        // Outer
        ctx.beginPath();
        ctx.arc(cx, cy, size, 0, Math.PI * 2);
        ctx.fillStyle = c.bg;
        ctx.fill();
        // Inner
        ctx.beginPath();
        ctx.arc(cx, cy, size * 0.78, 0, Math.PI * 2);
        ctx.fillStyle = c.inner;
        ctx.fill();
        // Highlight
        ctx.beginPath();
        ctx.ellipse(cx, cy - size * 0.22, size * 0.55, size * 0.3, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fill();
        // Border
        ctx.beginPath();
        ctx.arc(cx, cy, size, 0, Math.PI * 2);
        ctx.strokeStyle = c.bg === '#f59e0b' ? '#d97706' : c.bg === '#94a3b8' ? '#64748b' : '#c2410c';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // Number
        ctx.fillStyle = c.text;
        ctx.font = `800 ${Math.round(size * 0.9)}px system-ui, -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(rank), cx, cy + 1);
      };

      // ---- HEADER ----
      // Üst çizgi accent
      const grad = ctx.createLinearGradient(0, 0, W, 0);
      grad.addColorStop(0, '#6366f1');
      grad.addColorStop(1, '#8b5cf6');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, 4);

      // Başlık
      ctx.fillStyle = '#0f172a';
      ctx.font = '700 22px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`${moduleLabel} Başarı Sıralaması`, PAD, 28);

      // Alt başlık
      ctx.fillStyle = '#64748b';
      ctx.font = '500 14px system-ui, -apple-system, sans-serif';
      ctx.fillText(`${MONTHS[month - 1]} ${year}  ·  ${hospitalsWithData}/${rankings.length} kurum`, PAD, 58);

      // Ayırıcı çizgi
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD, HEADER_H - 10);
      ctx.lineTo(W - PAD, HEADER_H - 10);
      ctx.stroke();

      // ---- PODYUM (top 3) ----
      if (hasPodium) {
        const top3 = withData.slice(0, 3);
        const podiumY = HEADER_H;
        const podiumCards = [
          { entry: top3[1], rank: 2, x: W / 2 - 330, w: 200, h: 200 },
          { entry: top3[0], rank: 1, x: W / 2 - 110, w: 220, h: 220 },
          { entry: top3[2], rank: 3, x: W / 2 + 130, w: 200, h: 190 }
        ];

        podiumCards.forEach(({ entry, rank, x, w, h }) => {
          const cardY = podiumY + (220 - h);
          const rateColor = getRateColor(entry.achievementRate);

          // Kart gölge
          ctx.shadowColor = 'rgba(0,0,0,0.06)';
          ctx.shadowBlur = 12;
          ctx.shadowOffsetY = 4;

          // Kart arka plan
          drawRoundedRect(x, cardY, w, h, 12);
          ctx.fillStyle = '#f8fafc';
          ctx.fill();
          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Gölgeyi sıfırla
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetY = 0;

          // Badge
          const badgeSize = rank === 1 ? 22 : 18;
          drawBadge(x + w / 2, cardY + 30, rank, badgeSize);

          // Kurum adı
          ctx.fillStyle = '#0f172a';
          ctx.font = `700 ${rank === 1 ? 14 : 12}px system-ui, -apple-system, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          // Uzun isimleri kırp
          let name = entry.institutionName;
          const maxNameW = w - 20;
          while (ctx.measureText(name).width > maxNameW && name.length > 3) {
            name = name.slice(0, -1);
          }
          if (name !== entry.institutionName) name += '…';
          ctx.fillText(name, x + w / 2, cardY + 56);

          // Yüzde
          ctx.fillStyle = rateColor;
          ctx.font = `800 ${rank === 1 ? 36 : 30}px system-ui, -apple-system, sans-serif`;
          ctx.textBaseline = 'top';
          ctx.fillText(`%${entry.achievementRate.toFixed(0)}`, x + w / 2, cardY + 78);

          // Progress bar
          const barY = cardY + (rank === 1 ? 124 : 116);
          const barW = w - 40;
          const barX = x + 20;
          drawRoundedRect(barX, barY, barW, 6, 3);
          ctx.fillStyle = '#e2e8f0';
          ctx.fill();
          const fillW = Math.max(barW * Math.min(entry.achievementRate / 100, 1), 4);
          drawRoundedRect(barX, barY, fillW, 6, 3);
          ctx.fillStyle = rateColor;
          ctx.fill();

          // Puan
          ctx.fillStyle = '#64748b';
          ctx.font = '500 12px system-ui, -apple-system, sans-serif';
          ctx.textBaseline = 'top';
          ctx.fillText(`${entry.totalGP} / ${maxGP}`, x + w / 2, barY + 14);

        });
      }

      // ---- TABLO (4. sıra ve sonrası + veri yok) ----
      const tableStartY = HEADER_H + PODIUM_H + GAP;
      const rest = withData.slice(hasPodium ? 3 : 0);
      const allRows = [
        ...rest.map((e, i) => ({ entry: e, rank: (hasPodium ? i + 4 : i + 1), hasData: true })),
        ...noData.map(e => ({ entry: e, rank: 0, hasData: false }))
      ];

      allRows.forEach((row, i) => {
        const y = tableStartY + i * ROW_H;
        const isEven = i % 2 === 0;
        const isCurrent = row.entry.institutionId === currentInstitutionId;

        // Satır arka planı
        if (isCurrent) {
          drawRoundedRect(PAD, y, W - PAD * 2, ROW_H - 4, 8);
          ctx.fillStyle = '#eef2ff';
          ctx.fill();
          ctx.strokeStyle = '#a5b4fc';
          ctx.lineWidth = 1;
          ctx.stroke();
        } else if (isEven) {
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(PAD, y, W - PAD * 2, ROW_H - 4);
        }

        if (!row.hasData) {
          // Veri yok satırı
          ctx.fillStyle = '#cbd5e1';
          ctx.font = '500 13px system-ui, -apple-system, sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText('—', PAD + 20, y + ROW_H / 2 - 2);
          ctx.fillText(row.entry.institutionName, PAD + 50, y + ROW_H / 2 - 2);
          ctx.textAlign = 'right';
          ctx.font = '400 italic 12px system-ui, -apple-system, sans-serif';
          ctx.fillText('Veri yok', W - PAD - 10, y + ROW_H / 2 - 2);
          return;
        }

        const entry = row.entry;
        const rateColor = getRateColor(entry.achievementRate);
        const midY = y + ROW_H / 2 - 2;

        // Sıra numarası
        drawRoundedRect(PAD + 10, midY - 14, 28, 28, 6);
        ctx.fillStyle = '#f1f5f9';
        ctx.fill();
        ctx.fillStyle = '#475569';
        ctx.font = '700 13px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(row.rank), PAD + 24, midY);

        // Kurum adı
        ctx.fillStyle = isCurrent ? '#4338ca' : '#0f172a';
        ctx.font = `${isCurrent ? '700' : '500'} 14px system-ui, -apple-system, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        let rowName = entry.institutionName;
        const maxRowNameW = 360;
        while (ctx.measureText(rowName).width > maxRowNameW && rowName.length > 3) {
          rowName = rowName.slice(0, -1);
        }
        if (rowName !== entry.institutionName) rowName += '…';
        ctx.fillText(rowName, PAD + 50, midY);

        // Puan
        ctx.fillStyle = '#334155';
        ctx.font = '700 13px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(entry.totalGP), W - PAD - 180, midY);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '400 12px system-ui, -apple-system, sans-serif';
        ctx.fillText(`/ ${maxGP}`, W - PAD - 140, midY);

        // Progress bar
        const pBarX = W - PAD - 130;
        const pBarW = 80;
        drawRoundedRect(pBarX, midY - 4, pBarW, 8, 4);
        ctx.fillStyle = '#e2e8f0';
        ctx.fill();
        const pFillW = Math.max(pBarW * Math.min(entry.achievementRate / 100, 1), 3);
        drawRoundedRect(pBarX, midY - 4, pFillW, 8, 4);
        ctx.fillStyle = rateColor;
        ctx.fill();

        // Yüzde
        ctx.fillStyle = rateColor;
        ctx.font = '700 14px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`%${entry.achievementRate.toFixed(0)}`, W - PAD - 10, midY);
      });

      // ---- FOOTER ----
      const footerY = H - FOOTER_H + 10;
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD, footerY);
      ctx.lineTo(W - PAD, footerY);
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = '400 11px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`MEDİS GÖREN  ·  ${moduleLabel} Başarı Sıralaması  ·  ${MONTHS[month - 1]} ${year}`, W / 2, footerY + 14);

      // ---- İNDİR ----
      const link = document.createElement('a');
      link.download = `${moduleLabel}_Basari_Siralamasi_${MONTHS[month - 1]}_${year}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('[PNG Export Error]', err);
    } finally {
      setIsExporting(false);
    }
  }, [isExporting, withData, noData, maxGP, moduleLabel, month, year, hospitalsWithData, rankings.length, currentInstitutionId]);

  if (isLoading) {
    return (
      <div className="g-section-card rounded-[20px] backdrop-blur-xl" style={{ padding: 'var(--g-space-8)', marginBottom: 'var(--g-space-6)' }}>
        <div className="flex items-center justify-center gap-3 py-8">
          <div className="animate-spin w-6 h-6 border-2 border-t-transparent rounded-full" style={{ borderColor: 'var(--g-accent)', borderTopColor: 'transparent' }} />
          <span className="g-text-body" style={{ color: 'var(--g-accent)' }}>Kurum sıralaması yükleniyor...</span>
        </div>
      </div>
    );
  }

  if (rankings.length === 0) return null;

  return (
    <>
      <AnimationStyles />
      <div className="g-section-card rounded-[20px] backdrop-blur-xl" style={{ marginBottom: 'var(--g-space-6)' }}>
        {/* Baslik */}
        <div className="flex items-center justify-between" style={{ padding: 'var(--g-space-5) var(--g-space-8)' }}>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-4 hover:opacity-80 transition-opacity"
          >
            <div className="flex items-center justify-center" style={{ width: '48px', height: '48px', borderRadius: 'var(--g-radius-lg)', background: 'var(--g-accent-muted)', border: '1px solid var(--g-accent)' }}>
              <svg className="w-6 h-6" style={{ color: 'var(--g-accent)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="text-left">
              <h3 className="g-title-section">{moduleLabel} Başarı Sıralaması</h3>
              <p className="g-text-small" style={{ color: 'var(--g-accent-text)', marginTop: '2px', fontWeight: 500 }}>
                {MONTHS[month - 1]} {year} &middot; {moduleLabel} &middot; {hospitalsWithData}/{rankings.length} kurum
              </p>
            </div>
          </button>

          <div className="flex items-center gap-3">
            {/* PNG İndir Butonu */}
            {!isCollapsed && hospitalsWithData > 0 && (
              <button
                onClick={handleExportPng}
                disabled={isExporting}
                className="g-btn g-btn-secondary"
                title="PNG olarak indir"
              >
                {isExporting ? (
                  <div className="animate-spin w-4 h-4 border-2 border-[var(--text-3)] border-t-transparent rounded-full" />
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                )}
                <span className="hidden sm:inline">PNG</span>
              </button>
            )}

            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className={`g-btn g-btn-ghost transition-transform duration-300 ${isCollapsed ? '' : 'rotate-180'}`}
              style={{ width: '32px', height: '32px', padding: 0, borderRadius: 'var(--g-radius-md)' }}
            >
              <svg className="w-5 h-5" style={{ color: 'var(--g-text-tertiary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Icerik */}
        {!isCollapsed && (
          <div style={{ padding: '0 var(--g-space-8) var(--g-space-8)' }}>
            {hospitalsWithData === 0 ? (
              <div className="text-center py-12">
                <svg className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--g-text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p className="g-text-body" style={{ fontSize: '16px', color: 'var(--g-text-muted)' }}>Bu dönem için henüz kurum verisi yüklenmemiş.</p>
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

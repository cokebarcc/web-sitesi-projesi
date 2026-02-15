/**
 * GÖREN Gösterge Karşılaştırma Grafiği
 *
 * BH modülü için her göstergenin Dönem İçi ve TR Rol Ortalaması
 * değerlerini karşılaştırmalı olarak gösteren grafik bileşeni.
 */

import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell
} from 'recharts';
import { BHTableRow } from '../../../src/services/gorenStorage';


interface GorenIndicatorCompareChartProps {
  data: BHTableRow[];
  isLoading?: boolean;
}

export const GorenIndicatorCompareChart: React.FC<GorenIndicatorCompareChartProps> = ({
  data,
  isLoading = false
}) => {
  const [showAll, setShowAll] = useState(false);

  // Yükleme durumu
  if (isLoading) {
    return (
      <div className="g-section-card p-6">
        <div className="h-96 flex items-center justify-center">
          <div className="flex items-center gap-3 text-[var(--g-text-muted)]">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>Grafik yükleniyor...</span>
          </div>
        </div>
      </div>
    );
  }

  // Veri yoksa
  if (!data || data.length === 0) {
    return (
      <div className="g-section-card p-6">
        <div className="h-96 flex flex-col items-center justify-center text-[var(--g-text-muted)]">
          <svg className="w-12 h-12 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-sm">Gösterge verisi bulunamadı</p>
          <p className="text-xs mt-1 opacity-70">Veri yükledikçe grafik oluşacak</p>
        </div>
      </div>
    );
  }

  // Grafik verisini hazırla
  const chartData = data
    .filter(row => {
      // Sadece sayısal değeri olan satırları al
      const donemIci = typeof row.donemIci === 'number' ? row.donemIci : parseFloat(String(row.donemIci));
      const trRol = typeof row.trRolOrtalama === 'number' ? row.trRolOrtalama : parseFloat(String(row.trRolOrtalama));
      return !isNaN(donemIci) || !isNaN(trRol);
    })
    .map(row => {
      const donemIci = typeof row.donemIci === 'number' ? row.donemIci : parseFloat(String(row.donemIci));
      const trRol = typeof row.trRolOrtalama === 'number' ? row.trRolOrtalama : parseFloat(String(row.trRolOrtalama));

      // Gösterge adını kısalt (max 20 karakter)
      const shortName = row.gostergeAdi.length > 25
        ? row.gostergeAdi.substring(0, 22) + '...'
        : row.gostergeAdi;

      return {
        sira: row.sira,
        name: `${row.sira}`,
        fullName: row.gostergeAdi,
        shortName,
        donemIci: isNaN(donemIci) ? null : donemIci,
        trRolOrtalama: isNaN(trRol) ? null : trRol,
        // Karşılaştırma durumu
        isAboveAverage: !isNaN(donemIci) && !isNaN(trRol) && donemIci >= trRol
      };
    });

  // Gösterilecek veri sayısı
  const displayData = showAll ? chartData : chartData.slice(0, 15);

  // Tooltip özelleştirme
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0]?.payload;
      return (
        <div className="backdrop-blur-xl rounded-xl border p-4 shadow-xl max-w-xs" style={{ background: 'var(--g-surface)', borderColor: 'var(--g-border)' }}>
          <p className="text-[var(--g-text)] font-bold text-sm mb-1">#{dataPoint?.sira}</p>
          <p className="text-[var(--g-text-secondary)] text-xs mb-3">{dataPoint?.fullName}</p>
          <div className="space-y-2">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-[var(--g-text-tertiary)] text-xs">{entry.name}:</span>
                </div>
                <span className="text-[var(--g-text)] font-bold text-sm">
                  {entry.value !== null ? entry.value.toFixed(1) : '-'}
                </span>
              </div>
            ))}
          </div>
          {dataPoint?.donemIci !== null && dataPoint?.trRolOrtalama !== null && (
            <div className="mt-3 pt-2 border-t border-[var(--g-border)]">
              <div className="flex items-center gap-1 text-xs">
                {dataPoint.isAboveAverage ? (
                  <>
                    <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                    <span className="text-emerald-400 font-medium">TR ortalamasının üzerinde</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                    <span className="text-rose-400 font-medium">TR ortalamasının altında</span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  // Y ekseni için min/max değerleri hesapla
  const allValues = chartData.flatMap(d => [d.donemIci, d.trRolOrtalama].filter(v => v !== null)) as number[];
  const minValue = allValues.length > 0 ? Math.min(...allValues) : 0;
  const maxValue = allValues.length > 0 ? Math.max(...allValues) : 100;

  // 10'luk paydalarla yuvarla
  const yMin = Math.floor(minValue / 10) * 10 - 10;
  const yMax = Math.ceil(maxValue / 10) * 10 + 10;

  // 10'luk tick değerlerini oluştur
  const yTicks: number[] = [];
  for (let i = Math.max(0, yMin); i <= yMax; i += 10) {
    yTicks.push(i);
  }

  return (
    <div className="g-section-card p-6">
      {/* Başlık */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-[var(--g-text)]">Gösterge Karşılaştırması</h3>
          <p className="text-xs text-[var(--g-text-muted)] mt-1">
            Dönem İçi vs TR Rol Ortalaması ({displayData.length}/{chartData.length} gösterge)
          </p>
        </div>

        {/* Tümünü Göster / Gizle Butonu */}
        {chartData.length > 15 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="px-4 py-2 rounded-2xl text-xs font-medium transition-all"
            style={{ background: 'var(--g-surface-raised)', color: 'var(--g-text-secondary)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--g-surface-muted)'; e.currentTarget.style.color = 'var(--g-text)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--g-surface-raised)'; e.currentTarget.style.color = 'var(--g-text-secondary)'; }}
          >
            {showAll ? `İlk 15'i Göster` : `Tümünü Göster (${chartData.length})`}
          </button>
        )}
      </div>

      {/* Grafik */}
      <div className={showAll ? 'h-[600px]' : 'h-96'}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={displayData}
            margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            barGap={2}
            barCategoryGap="20%"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="name"
              stroke="#64748b"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              angle={-45}
              textAnchor="end"
              height={60}
              interval={0}
            />
            <YAxis
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              domain={[Math.max(0, yMin), yMax]}
              ticks={yTicks}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: '20px' }}
              formatter={(value: string) => (
                <span className="text-[var(--g-text-secondary)] text-xs">{value}</span>
              )}
            />

            {/* Dönem İçi - Her bar için renk */}
            <Bar
              dataKey="donemIci"
              name="Dönem İçi"
              radius={[4, 4, 0, 0]}
              maxBarSize={25}
            >
              {displayData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.isAboveAverage ? '#10b981' : '#f43f5e'}
                />
              ))}
            </Bar>

            {/* TR Rol Ortalaması */}
            <Bar
              dataKey="trRolOrtalama"
              name="TR Rol Ortalaması"
              fill="#f59e0b"
              radius={[4, 4, 0, 0]}
              maxBarSize={25}
              opacity={0.7}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Alt bilgi - Renk açıklaması */}
      <div className="mt-4 pt-4 flex items-center justify-between text-xs text-[var(--g-text-muted)]" style={{ borderTop: '1px solid var(--g-border)' }}>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-emerald-500" />
            <span>TR Ortalaması Üzeri</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-rose-500" />
            <span>TR Ortalaması Altı</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-amber-500 opacity-70" />
            <span>TR Rol Ortalaması</span>
          </div>
        </div>
        <span className="opacity-70">
          Gösterge numarasına göre sıralı
        </span>
      </div>
    </div>
  );
};

export default GorenIndicatorCompareChart;

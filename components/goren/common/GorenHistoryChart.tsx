/**
 * GÖREN Geçmiş Performans Grafiği
 *
 * BH modülü için geçmiş ayların toplam puanı ile TR Rol ortalamasını
 * karşılaştırmalı olarak gösteren grafik bileşeni.
 *
 * 3 farklı görüntüleme stili:
 * 1. Line Chart - Çizgi grafik
 * 2. Bar Chart - Çubuk grafik
 * 3. Area Chart - Alan grafik
 */

import React, { useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { BHHistoryData } from '../../../src/services/gorenStorage';

interface GorenHistoryChartProps {
  data: BHHistoryData[];
  isLoading?: boolean;
  institutionName?: string;
  moduleLabel?: string;
}

type ChartStyle = 'line' | 'bar' | 'area';

export const GorenHistoryChart: React.FC<GorenHistoryChartProps> = ({
  data,
  isLoading = false,
  institutionName = '',
  moduleLabel = 'Kurum'
}) => {
  const [chartStyle, setChartStyle] = useState<ChartStyle>('line');

  // Yükleme durumu
  if (isLoading) {
    return (
      <div className="g-section-card p-6">
        <div className="h-80 flex items-center justify-center">
          <div className="flex items-center gap-3 text-[var(--text-muted)]">
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
        <div className="h-80 flex flex-col items-center justify-center text-[var(--text-muted)]">
          <svg className="w-12 h-12 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-sm">Geçmiş dönem verisi bulunamadı</p>
          <p className="text-xs mt-1 opacity-70">Veri yükledikçe grafik oluşacak</p>
        </div>
      </div>
    );
  }

  // Grafik verisini hazırla (kısa ay adları)
  const chartData = data.map(item => ({
    ...item,
    shortLabel: item.monthLabel.split(' ')[0].substring(0, 3) + ' ' + item.year.toString().slice(-2),
    hastanetoplam: item.totalGP,
    trOrtalama: item.trRolOrtalamasi
  }));

  // Tooltip özelleştirme
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0]?.payload;
      return (
        <div className="backdrop-blur-xl rounded-xl border p-4 shadow-xl" style={{ background: 'var(--surface-1)', borderColor: 'var(--border-2)' }}>
          <p className="text-[var(--text-1)] font-bold text-sm mb-2">{dataPoint?.monthLabel}</p>
          <div className="space-y-1.5">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-[var(--text-3)] text-xs">{entry.name}:</span>
                <span className="text-[var(--text-1)] font-bold text-sm">
                  {entry.value !== null ? entry.value.toFixed(1) : '-'}
                </span>
              </div>
            ))}
          </div>
          {payload[0]?.payload?.hastanetoplam && payload[1]?.payload?.trOrtalama && (
            <div className="mt-3 pt-2 border-t border-[var(--border-2)]">
              <div className="flex items-center gap-1 text-xs">
                {payload[0].payload.hastanetoplam >= payload[1].payload.trOrtalama ? (
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

  // Ortak grafik özellikleri
  const commonProps = {
    data: chartData,
    margin: { top: 20, right: 30, left: 20, bottom: 20 }
  };

  // Ortak eksen özellikleri
  const xAxisProps = {
    dataKey: 'shortLabel',
    stroke: 'var(--g-text-muted, #64748b)',
    fontSize: 11,
    tickLine: false,
    axisLine: { stroke: 'var(--g-border, #334155)' }
  };

  // Y ekseni için min/max değerleri hesapla (5'lik paydalar için)
  const allValues = chartData.flatMap(d => [d.hastanetoplam, d.trOrtalama].filter(v => v !== null)) as number[];
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);

  // 5'lik paydalarla yuvarla
  const yMin = Math.floor(minValue / 5) * 5 - 5; // Biraz boşluk bırak
  const yMax = Math.ceil(maxValue / 5) * 5 + 5; // Biraz boşluk bırak

  // 5'lik tick değerlerini oluştur
  const yTicks: number[] = [];
  for (let i = Math.max(0, yMin); i <= yMax; i += 5) {
    yTicks.push(i);
  }

  const yAxisProps = {
    stroke: 'var(--g-text-muted, #64748b)',
    fontSize: 11,
    tickLine: false,
    axisLine: { stroke: 'var(--g-border, #334155)' },
    domain: [Math.max(0, yMin), yMax] as [number, number],
    ticks: yTicks
  };

  // Ortak grid özellikleri
  const gridProps = {
    strokeDasharray: '3 3',
    stroke: 'var(--g-border, #334155)',
    vertical: false
  };

  // Legend özelleştirme
  const legendProps = {
    wrapperStyle: { paddingTop: '20px' },
    formatter: (value: string) => (
      <span className="text-[var(--text-2)] text-xs">{value}</span>
    )
  };

  // TR Rol ortalaması varsa ortalama çizgisi ekle
  const avgTrRol = chartData.filter(d => d.trOrtalama !== null).length > 0
    ? chartData.filter(d => d.trOrtalama !== null).reduce((sum, d) => sum + (d.trOrtalama || 0), 0) / chartData.filter(d => d.trOrtalama !== null).length
    : null;

  return (
    <div className="g-section-card p-6">
      {/* Başlık ve Stil Seçici */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="g-title-section">Performans Trendi</h3>
          <p className="g-text-small" style={{ color: 'var(--g-text-muted)', marginTop: '4px' }}>
            {institutionName ? `${institutionName} - ` : ''}Son {data.length} aylık performans
          </p>
        </div>

        {/* Stil Seçici */}
        <div className="flex items-center gap-1 bg-[var(--surface-2)] rounded-xl p-1">
          <button
            onClick={() => setChartStyle('line')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              chartStyle === 'line'
                ? 'bg-indigo-500 text-white'
                : 'text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-3)]'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
          </button>
          <button
            onClick={() => setChartStyle('bar')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              chartStyle === 'bar'
                ? 'bg-indigo-500 text-white'
                : 'text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-3)]'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </button>
          <button
            onClick={() => setChartStyle('area')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              chartStyle === 'area'
                ? 'bg-indigo-500 text-white'
                : 'text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-3)]'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Grafik */}
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          {chartStyle === 'line' ? (
            <LineChart {...commonProps}>
              <CartesianGrid {...gridProps} />
              <XAxis {...xAxisProps} />
              <YAxis {...yAxisProps} />
              <Tooltip content={<CustomTooltip />} />
              <Legend {...legendProps} />

              {/* Kurum Puanı */}
              <Line
                type="monotone"
                dataKey="hastanetoplam"
                name={`${moduleLabel} Puanı`}
                stroke="#6366f1"
                strokeWidth={3}
                dot={{ fill: '#6366f1', strokeWidth: 2, r: 5 }}
                activeDot={{ r: 7, stroke: '#6366f1', strokeWidth: 2, fill: '#fff' }}
              />

              {/* TR Rol Ortalaması */}
              <Line
                type="monotone"
                dataKey="trOrtalama"
                name="TR Rol Ortalaması"
                stroke="#f59e0b"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#f59e0b', strokeWidth: 2, fill: '#fff' }}
              />
            </LineChart>
          ) : chartStyle === 'bar' ? (
            <BarChart {...commonProps}>
              <CartesianGrid {...gridProps} />
              <XAxis {...xAxisProps} />
              <YAxis {...yAxisProps} />
              <Tooltip content={<CustomTooltip />} />
              <Legend {...legendProps} />

              {/* Kurum Puanı */}
              <Bar
                dataKey="hastanetoplam"
                name={`${moduleLabel} Puanı`}
                fill="#6366f1"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />

              {/* TR Rol Ortalaması */}
              <Bar
                dataKey="trOrtalama"
                name="TR Rol Ortalaması"
                fill="#f59e0b"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />

              {/* Ortalama referans çizgisi */}
              {avgTrRol && (
                <ReferenceLine
                  y={avgTrRol}
                  stroke="#f59e0b"
                  strokeDasharray="8 4"
                  strokeWidth={2}
                  label={{
                    value: `Ort: ${avgTrRol.toFixed(0)}`,
                    position: 'right',
                    fill: '#f59e0b',
                    fontSize: 10
                  }}
                />
              )}
            </BarChart>
          ) : (
            <AreaChart {...commonProps}>
              <defs>
                <linearGradient id="colorHastane" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorTrRol" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...gridProps} />
              <XAxis {...xAxisProps} />
              <YAxis {...yAxisProps} />
              <Tooltip content={<CustomTooltip />} />
              <Legend {...legendProps} />

              {/* TR Rol Ortalaması (arka planda) */}
              <Area
                type="monotone"
                dataKey="trOrtalama"
                name="TR Rol Ortalaması"
                stroke="#f59e0b"
                strokeWidth={2}
                fill="url(#colorTrRol)"
              />

              {/* Kurum Puanı (ön planda) */}
              <Area
                type="monotone"
                dataKey="hastanetoplam"
                name={`${moduleLabel} Puanı`}
                stroke="#6366f1"
                strokeWidth={3}
                fill="url(#colorHastane)"
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Alt bilgi */}
      <div className="mt-4 pt-4 border-t border-[var(--border-2)] flex items-center justify-between text-xs text-[var(--text-muted)]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-1 rounded bg-indigo-500" />
            <span>{moduleLabel} Puanı</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-1 rounded bg-amber-500 opacity-70" style={{ borderStyle: 'dashed' }} />
            <span>TR Rol Ortalaması</span>
          </div>
        </div>
        <span className="opacity-70">
          {data.length} dönem gösteriliyor
        </span>
      </div>
    </div>
  );
};

export default GorenHistoryChart;

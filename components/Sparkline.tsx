import React, { useMemo } from 'react';

interface SparklineProps {
  values: (number | null)[];
  width?: number;
  height?: number;
  color?: string;
  showDots?: boolean;
  showTooltip?: boolean;
}

const Sparkline: React.FC<SparklineProps> = ({
  values,
  width = 120,
  height = 28,
  color = '#ef4444', // red-500
  showDots = true,
  showTooltip = false
}) => {
  // Null olmayan değerleri filtrele ve indekslerini tut
  const validData = useMemo(() => {
    return values
      .map((value, index) => ({ value, index }))
      .filter((d): d is { value: number; index: number } => d.value !== null);
  }, [values]);

  // Min/Max hesapla
  const { min, max, range } = useMemo(() => {
    if (validData.length === 0) return { min: 0, max: 100, range: 100 };
    const vals = validData.map(d => d.value);
    const minVal = Math.min(...vals);
    const maxVal = Math.max(...vals);
    const rangeVal = maxVal - minVal || 1;
    return { min: minVal, max: maxVal, range: rangeVal };
  }, [validData]);

  // Padding
  const padding = { top: 4, right: 4, bottom: 4, left: 4 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // X ve Y koordinatlarını hesapla
  const points = useMemo(() => {
    if (validData.length === 0) return [];

    const xStep = validData.length > 1 ? chartWidth / (validData.length - 1) : chartWidth / 2;

    return validData.map((d, i) => ({
      x: padding.left + (validData.length > 1 ? i * xStep : chartWidth / 2),
      y: padding.top + chartHeight - ((d.value - min) / range) * chartHeight,
      value: d.value,
      originalIndex: d.index
    }));
  }, [validData, chartWidth, chartHeight, min, range, padding]);

  // SVG path oluştur
  const pathD = useMemo(() => {
    if (points.length < 2) return '';
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  }, [points]);

  if (validData.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-xs" style={{ color: 'var(--text-3)' }}
        style={{ width, height }}
      >
        -
      </div>
    );
  }

  if (validData.length === 1) {
    // Tek nokta varsa sadece nokta göster
    return (
      <svg width={width} height={height}>
        <circle
          cx={width / 2}
          cy={height / 2}
          r={3}
          fill={color}
        />
      </svg>
    );
  }

  return (
    <svg width={width} height={height} className="overflow-visible">
      {/* Gradient tanımı */}
      <defs>
        <linearGradient id={`sparkline-gradient-${color.replace('#', '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0.05} />
        </linearGradient>
      </defs>

      {/* Alan dolgus (opsiyonel) */}
      {points.length > 1 && (
        <path
          d={`${pathD} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`}
          fill={`url(#sparkline-gradient-${color.replace('#', '')})`}
        />
      )}

      {/* Çizgi */}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Noktalar */}
      {showDots && points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={2}
          fill="white"
          stroke={color}
          strokeWidth={1.5}
        />
      ))}

      {/* Son nokta vurgulu */}
      {points.length > 0 && (
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r={3}
          fill={color}
        />
      )}
    </svg>
  );
};

export default Sparkline;

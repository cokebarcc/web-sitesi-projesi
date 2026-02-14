import React, { useState } from 'react';
import { SVG_PATHS, SVG_CONFIG, DISTRICTS, INSTITUTION_STYLES } from '../../src/data/sanliurfaDistricts';
import type { InstitutionMarker } from '../../src/data/sanliurfaDistricts';

interface SanliurfaSvgMapProps {
  theme: 'dark' | 'light';
  selectedDistrict: string | null;
  onDistrictClick: (districtName: string) => void;
  markers?: InstitutionMarker[];
}

// Lat/Lng → SVG koordinat dönüşümü (GeoJSON polygon verilerinden türetilmiş katsayılar)
function latLngToSvg(lat: number, lng: number): { x: number; y: number } {
  const x = 316.2240 * lng - 11944.3842;
  const y = -340.3930 * lat + 12961.9022;
  return { x, y };
}

const SanliurfaSvgMap: React.FC<SanliurfaSvgMapProps> = ({
  theme,
  selectedDistrict,
  onDistrictClick,
  markers = [],
}) => {
  const [hoveredDistrict, setHoveredDistrict] = useState<string | null>(null);
  const [hoveredMarker, setHoveredMarker] = useState<InstitutionMarker | null>(null);
  const isDark = theme === 'dark';

  const getPathStyle = (districtName: string) => {
    const isSelected = districtName === selectedDistrict;
    const isHovered = districtName === hoveredDistrict;
    const district = DISTRICTS[districtName];
    const baseColor = district?.color || '#6366f1';

    if (isSelected) {
      return {
        fill: baseColor,
        fillOpacity: 0.5,
        stroke: baseColor,
        strokeWidth: 2.5,
        filter: 'url(#glow)',
      };
    }
    if (isHovered) {
      return {
        fill: baseColor,
        fillOpacity: 0.35,
        stroke: baseColor,
        strokeWidth: 2,
        filter: 'url(#glow)',
      };
    }
    return {
      fill: isDark ? '#1e293b' : '#e2e8f0',
      fillOpacity: isDark ? 0.7 : 0.6,
      stroke: isDark ? '#334155' : '#94a3b8',
      strokeWidth: 1.2,
      filter: 'none',
    };
  };

  const getLabelStyle = (districtName: string) => {
    const isSelected = districtName === selectedDistrict;
    const isHovered = districtName === hoveredDistrict;
    const district = DISTRICTS[districtName];

    if (isSelected || isHovered) {
      return {
        fill: district?.color || '#fff',
        fontSize: isSelected ? '13px' : '12px',
        fontWeight: 700 as const,
        opacity: 1,
      };
    }
    return {
      fill: isDark ? '#cbd5e1' : '#334155',
      fontSize: '11px',
      fontWeight: 600 as const,
      opacity: 0.9,
    };
  };

  return (
    <div className="w-full h-full flex items-center justify-center p-4">
      <svg
        viewBox={SVG_CONFIG.viewBox}
        className="w-full h-full"
        style={{ filter: isDark ? 'drop-shadow(0 4px 24px rgba(0,0,0,0.4))' : 'drop-shadow(0 4px 24px rgba(0,0,0,0.1))' }}
      >
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* İlçe path'leri */}
        {Object.entries(SVG_PATHS).map(([name, path]) => {
          const style = getPathStyle(name);
          return (
            <path
              key={name}
              d={path}
              fill={style.fill}
              fillOpacity={style.fillOpacity}
              stroke={style.stroke}
              strokeWidth={style.strokeWidth}
              strokeLinejoin="round"
              style={{
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                filter: style.filter,
              }}
              onMouseEnter={() => setHoveredDistrict(name)}
              onMouseLeave={() => setHoveredDistrict(null)}
              onClick={() => onDistrictClick(name)}
            />
          );
        })}

        {/* İlçe isimleri */}
        {Object.entries(DISTRICTS).map(([name, district]) => {
          const labelStyle = getLabelStyle(name);
          return (
            <text
              key={`label-${name}`}
              x={district.svgLabelPos[0]}
              y={district.svgLabelPos[1]}
              textAnchor="middle"
              dominantBaseline="central"
              fill={labelStyle.fill}
              fontSize={labelStyle.fontSize}
              fontWeight={labelStyle.fontWeight}
              fontFamily="Inter, sans-serif"
              opacity={labelStyle.opacity}
              style={{
                pointerEvents: 'none',
                transition: 'all 0.3s ease',
                textShadow: isDark ? '0 1px 3px rgba(0,0,0,0.8)' : '0 1px 2px rgba(255,255,255,0.8)',
              }}
            >
              {name}
            </text>
          );
        })}

        {/* Kurum pinleri */}
        {markers.map((marker) => {
          const { x, y } = latLngToSvg(marker.lat, marker.lng);
          const style = INSTITUTION_STYLES[marker.type];
          const r = style.size * 0.3;
          const isHovered = hoveredMarker?.id === marker.id;
          return (
            <g
              key={marker.id}
              style={{ cursor: 'pointer' }}
              onMouseEnter={(e) => { e.stopPropagation(); setHoveredMarker(marker); setHoveredDistrict(null); }}
              onMouseLeave={() => setHoveredMarker(null)}
            >
              {/* Görünmez büyük hit area */}
              <circle cx={x} cy={y} r={r + 6} fill="transparent" />
              {/* Pin gölgesi */}
              <circle cx={x} cy={y + 1} r={r + 1} fill="rgba(0,0,0,0.3)" />
              {/* Pin dairesi */}
              <circle
                cx={x}
                cy={y}
                r={isHovered ? r + 2 : r}
                fill={style.bg}
                stroke="#fff"
                strokeWidth={isHovered ? 2 : 1.5}
                style={{ transition: 'all 0.15s ease' }}
              />
              {/* Pin etiketi */}
              <text
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#fff"
                fontSize={r * 1.1}
                fontWeight={700}
                fontFamily="Inter, sans-serif"
                style={{ pointerEvents: 'none' }}
              >
                {style.label}
              </text>
            </g>
          );
        })}

        {/* Tooltip — hover edilen pin bilgisi */}
        {hoveredMarker && (() => {
          const { x, y } = latLngToSvg(hoveredMarker.lat, hoveredMarker.lng);
          const tooltipW = Math.max(hoveredMarker.name.length * 6.5, 80);
          const tooltipH = 24;
          const tx = Math.min(Math.max(x - tooltipW / 2, 4), SVG_CONFIG.width - tooltipW - 4);
          const ty = y - 22;
          return (
            <g style={{ pointerEvents: 'none' }}>
              <rect
                x={tx}
                y={ty - tooltipH / 2}
                width={tooltipW}
                height={tooltipH}
                rx={4}
                fill={isDark ? 'rgba(15,23,42,0.92)' : 'rgba(255,255,255,0.95)'}
                stroke={isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'}
                strokeWidth={0.8}
              />
              <text
                x={tx + tooltipW / 2}
                y={ty}
                textAnchor="middle"
                dominantBaseline="central"
                fill={isDark ? '#e2e8f0' : '#1e293b'}
                fontSize="9"
                fontWeight={600}
                fontFamily="Inter, sans-serif"
              >
                {hoveredMarker.name}
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
};

export default SanliurfaSvgMap;

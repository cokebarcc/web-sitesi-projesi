import React, { useState } from 'react';
import { SVG_PATHS, SVG_CONFIG, DISTRICTS, INSTITUTION_STYLES, PROVINCE_BOUNDS } from '../../src/data/sanliurfaDistricts';
import type { InstitutionMarker } from '../../src/data/sanliurfaDistricts';

interface SanliurfaSvgMapProps {
  theme: 'dark' | 'light';
  selectedDistrict: string | null;
  onDistrictClick: (districtName: string) => void;
  markers?: InstitutionMarker[];
}

// Lat/Lng → SVG koordinat dönüşümü
function latLngToSvg(lat: number, lng: number): { x: number; y: number } {
  const [[minLat, minLng], [maxLat, maxLng]] = PROVINCE_BOUNDS;
  const x = ((lng - minLng) / (maxLng - minLng)) * SVG_CONFIG.width;
  const y = ((maxLat - lat) / (maxLat - minLat)) * SVG_CONFIG.height;
  return { x, y };
}

const SanliurfaSvgMap: React.FC<SanliurfaSvgMapProps> = ({
  theme,
  selectedDistrict,
  onDistrictClick,
  markers = [],
}) => {
  const [hoveredDistrict, setHoveredDistrict] = useState<string | null>(null);
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
          return (
            <g key={marker.id} style={{ pointerEvents: 'none' }}>
              {/* Pin gölgesi */}
              <circle cx={x} cy={y + 1} r={r + 1} fill="rgba(0,0,0,0.3)" />
              {/* Pin dairesi */}
              <circle cx={x} cy={y} r={r} fill={style.bg} stroke="#fff" strokeWidth={1.5} />
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
              >
                {style.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default SanliurfaSvgMap;

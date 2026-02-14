import React, { useState } from 'react';
import { SVG_PATHS, SVG_CONFIG, DISTRICTS } from '../../src/data/sanliurfaDistricts';

interface SanliurfaSvgMapProps {
  theme: 'dark' | 'light';
  selectedDistrict: string | null;
  onDistrictClick: (districtName: string) => void;
}

const SanliurfaSvgMap: React.FC<SanliurfaSvgMapProps> = ({
  theme,
  selectedDistrict,
  onDistrictClick,
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
      </svg>
    </div>
  );
};

export default SanliurfaSvgMap;

import React, { useState, useRef, useCallback, useEffect } from 'react';
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
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const isDark = theme === 'dark';

  // Zoom & Pan state
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: SVG_CONFIG.width, h: SVG_CONFIG.height });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);

  const getSvgScale = useCallback(() => {
    const el = containerRef.current;
    if (!el) return { sx: 1, sy: 1 };
    const rect = el.getBoundingClientRect();
    return { sx: viewBox.w / rect.width, sy: viewBox.h / rect.height };
  }, [viewBox]);

  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const { sx, sy } = getSvgScale();

    // Mouse pozisyonu SVG koordinatlarında
    const mx = viewBox.x + (e.clientX - rect.left) * sx;
    const my = viewBox.y + (e.clientY - rect.top) * sy;

    const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
    const newW = Math.min(Math.max(viewBox.w * factor, 100), SVG_CONFIG.width);
    const newH = Math.min(Math.max(viewBox.h * factor, 62.5), SVG_CONFIG.height);

    // Zoom merkezi mouse pozisyonunda tut
    const newX = mx - (mx - viewBox.x) * (newW / viewBox.w);
    const newY = my - (my - viewBox.y) * (newH / viewBox.h);

    setViewBox({ x: newX, y: newY, w: newW, h: newH });
  }, [viewBox, getSvgScale]);

  // Pan - mouse down
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, vx: viewBox.x, vy: viewBox.y };
  }, [viewBox]);

  // Pan - mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // Tooltip pozisyonunu güncelle
    if (hoveredMarker) {
      setTooltipPos({ x: e.clientX, y: e.clientY });
    }

    if (!isPanning || !panStart.current) return;
    const { sx, sy } = getSvgScale();
    const dx = (e.clientX - panStart.current.x) * sx;
    const dy = (e.clientY - panStart.current.y) * sy;
    setViewBox(prev => ({ ...prev, x: panStart.current!.vx - dx, y: panStart.current!.vy - dy }));
  }, [isPanning, getSvgScale, hoveredMarker]);

  // Pan - mouse up
  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    panStart.current = null;
  }, []);

  // Global mouseup listener
  useEffect(() => {
    const handler = () => { setIsPanning(false); panStart.current = null; };
    window.addEventListener('mouseup', handler);
    return () => window.removeEventListener('mouseup', handler);
  }, []);

  // Reset zoom
  const handleResetZoom = useCallback(() => {
    setViewBox({ x: 0, y: 0, w: SVG_CONFIG.width, h: SVG_CONFIG.height });
  }, []);

  const isZoomed = viewBox.w < SVG_CONFIG.width - 1 || viewBox.h < SVG_CONFIG.height - 1;
  // Zoom ölçeği — pinler ve label'lar sabit boyutta kalsın
  const zoomScale = viewBox.w / SVG_CONFIG.width;

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
        strokeWidth: 2.5 * zoomScale,
        filter: 'url(#glow)',
      };
    }
    if (isHovered) {
      return {
        fill: baseColor,
        fillOpacity: 0.35,
        stroke: baseColor,
        strokeWidth: 2 * zoomScale,
        filter: 'url(#glow)',
      };
    }
    return {
      fill: isDark ? '#1e293b' : '#e2e8f0',
      fillOpacity: isDark ? 0.7 : 0.6,
      stroke: isDark ? '#334155' : '#94a3b8',
      strokeWidth: 1.2 * zoomScale,
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
        fontSize: `${(isSelected ? 13 : 12) * zoomScale}px`,
        fontWeight: 700 as const,
        opacity: 1,
      };
    }
    return {
      fill: isDark ? '#cbd5e1' : '#334155',
      fontSize: `${11 * zoomScale}px`,
      fontWeight: 600 as const,
      opacity: 0.9,
    };
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center relative"
      style={{ overflow: 'hidden' }}
    >
      <svg
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        className="w-full h-full"
        style={{
          filter: isDark ? 'drop-shadow(0 4px 24px rgba(0,0,0,0.4))' : 'drop-shadow(0 4px 24px rgba(0,0,0,0.1))',
          cursor: isPanning ? 'grabbing' : 'grab',
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={3 * zoomScale} result="coloredBlur" />
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
                cursor: isPanning ? 'grabbing' : 'pointer',
                transition: 'all 0.3s ease',
                filter: style.filter,
              }}
              onMouseEnter={() => setHoveredDistrict(name)}
              onMouseLeave={() => setHoveredDistrict(null)}
              onClick={() => !isPanning && onDistrictClick(name)}
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
          const r = style.size * 0.3 * zoomScale;
          const isHovered = hoveredMarker?.id === marker.id;
          return (
            <g
              key={marker.id}
              style={{ cursor: 'pointer' }}
              onMouseEnter={(e) => {
                e.stopPropagation();
                setHoveredMarker(marker);
                setHoveredDistrict(null);
                setTooltipPos({ x: e.clientX, y: e.clientY });
              }}
              onMouseLeave={() => { setHoveredMarker(null); setTooltipPos(null); }}
            >
              {/* Görünmez büyük hit area */}
              <circle cx={x} cy={y} r={r + 6 * zoomScale} fill="transparent" />
              {/* Pin gölgesi */}
              <circle cx={x} cy={y + 1 * zoomScale} r={r + 1 * zoomScale} fill="rgba(0,0,0,0.3)" />
              {/* Pin dairesi */}
              <circle
                cx={x}
                cy={y}
                r={isHovered ? r + 2 * zoomScale : r}
                fill={style.bg}
                stroke="#fff"
                strokeWidth={(isHovered ? 2 : 1.5) * zoomScale}
                style={{ transition: 'all 0.15s ease' }}
              />
              {/* Pin etiketi */}
              <text
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#fff"
                fontSize={style.label.length > 2 ? r * 0.75 : r * 1.1}
                fontWeight={700}
                fontFamily="Inter, sans-serif"
                style={{ pointerEvents: 'none' }}
              >
                {style.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* HTML Tooltip — pin bilgisi */}
      {hoveredMarker && tooltipPos && (
        <div
          className={`fixed z-[9999] px-2.5 py-1.5 rounded-lg text-xs font-semibold shadow-lg pointer-events-none whitespace-nowrap ${
            isDark
              ? 'bg-slate-800/95 text-slate-100 border border-white/10'
              : 'bg-white/95 text-slate-800 border border-slate-200'
          }`}
          style={{
            left: tooltipPos.x + 12,
            top: tooltipPos.y - 28,
          }}
        >
          {hoveredMarker.name}
        </div>
      )}

      {/* Zoom reset butonu */}
      {isZoomed && (
        <button
          onClick={handleResetZoom}
          className={`absolute bottom-3 right-3 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
            isDark
              ? 'bg-white/10 hover:bg-white/15 text-slate-300 border border-white/10'
              : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 shadow-sm'
          }`}
        >
          Sıfırla
        </button>
      )}
    </div>
  );
};

export default SanliurfaSvgMap;

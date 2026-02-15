import React, { useCallback, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMapEvents, Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import type { GeoJSON as LeafletGeoJSON, Layer, LeafletMouseEvent } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { GEOJSON_DATA, PROVINCE_CENTER, PROVINCE_BOUNDS, DISTRICTS, INSTITUTION_STYLES } from '../../src/data/sanliurfaDistricts';
import type { InstitutionMarker } from '../../src/data/sanliurfaDistricts';
import MapResizeHandler from './MapResizeHandler';

// Tüm ilçelerde hover ve seçim için kullanılan sabit renk (Karaköprü rengi)
const HOVER_COLOR = '#00cec9';
// Bu zoom seviyesinden yukarı (yakınlaşınca) hover dolgusu görünmez
const FILL_MAX_ZOOM = 10;

// Kurum pin'i için DivIcon oluştur
function createInstitutionIcon(marker: InstitutionMarker, isHighlighted?: boolean): L.DivIcon {
  const style = INSTITUTION_STYLES[marker.type];
  const s = style.size;
  const baseFontSize = s >= 34 ? 15 : s >= 32 ? 14 : s >= 28 ? 13 : 12;
  const fontSize = style.label.length > 2 ? Math.round(s * 0.34) : baseFontSize;
  const fontWeight = 800;
  const ring = isHighlighted ? `0 0 0 3px #facc15, 0 0 12px rgba(250,204,21,0.5),` : '';

  return L.divIcon({
    className: 'institution-pin',
    iconSize: [s, s + 8], // extra 8px for pointer triangle
    iconAnchor: [s / 2, s + 8],
    tooltipAnchor: [0, -s - 4],
    html: `
      <div style="
        width:${s}px;height:${s}px;
        background:${style.bg};
        border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        color:#fff;font-size:${fontSize}px;font-weight:${fontWeight};
        box-shadow:${ring}0 2px 8px rgba(0,0,0,0.4),0 0 0 2px rgba(255,255,255,0.3);
        position:relative;
        font-family:system-ui,sans-serif;
        letter-spacing:0;
        line-height:1;
        cursor:${isHighlighted !== undefined ? 'pointer' : 'default'};
      ">${style.label}<div style="
        position:absolute;bottom:-7px;left:50%;transform:translateX(-50%);
        width:0;height:0;
        border-left:6px solid transparent;border-right:6px solid transparent;
        border-top:8px solid ${style.bg};
      "></div></div>
    `,
  });
}

interface SanliurfaLeafletMapProps {
  theme: 'dark' | 'light';
  selectedDistrict: string | null;
  isPanelOpen: boolean;
  onDistrictClick: (districtName: string) => void;
  // Pin yönetimi
  markers: InstitutionMarker[];
  editMode?: boolean;
  selectedMarkerId?: string | null;
  onMapClick?: (lat: number, lng: number) => void;
  onMarkerClick?: (marker: InstitutionMarker) => void;
  mapExpanded?: boolean;
}

// İl sınırları dışını karartmak için inverse mask oluştur
// Dünya çerçevesi (dış sınır) + her ilçe polygon'u delik olarak
function buildProvinceMask(): GeoJSON.FeatureCollection {
  // Dünya sınırları (saat yönünde) - dış polygon
  const worldOuter: [number, number][] = [
    [-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]
  ];

  // Her ilçe polygon'unu delik (hole) olarak ekle
  const holes: [number, number][][] = GEOJSON_DATA.features.map(
    (feature: any) => feature.geometry.coordinates[0] as [number, number][]
  );

  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: { name: 'mask' },
      geometry: {
        type: 'Polygon',
        coordinates: [worldOuter, ...holes],
      },
    }],
  };
}

// Zoom seviyesini ref'e yazan + zoom değişince stilleri güncelleyen bileşen
function ZoomTracker({ zoomRef, geojsonRef, getStyle }: {
  zoomRef: React.MutableRefObject<number>;
  geojsonRef: React.MutableRefObject<LeafletGeoJSON | null>;
  getStyle: (feature: GeoJSON.Feature<GeoJSON.Geometry, { name: string }> | undefined) => Record<string, unknown>;
}) {
  useMapEvents({
    zoomend: (e) => {
      const prevZoom = zoomRef.current;
      const newZoom = e.target.getZoom();
      zoomRef.current = newZoom;
      // Eşik geçişinde stilleri güncelle
      const crossedThreshold =
        (prevZoom <= FILL_MAX_ZOOM && newZoom > FILL_MAX_ZOOM) ||
        (prevZoom > FILL_MAX_ZOOM && newZoom <= FILL_MAX_ZOOM);
      if (crossedThreshold && geojsonRef.current) {
        geojsonRef.current.setStyle(getStyle as any);
      }
    },
  });
  return null;
}

// Edit modda haritaya tıklama olaylarını dinleyen bileşen
function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e: LeafletMouseEvent) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

const SanliurfaLeafletMap: React.FC<SanliurfaLeafletMapProps> = ({
  theme,
  selectedDistrict,
  isPanelOpen,
  onDistrictClick,
  markers,
  editMode = false,
  selectedMarkerId,
  onMapClick,
  onMarkerClick,
  mapExpanded,
}) => {
  const geojsonRef = useRef<LeafletGeoJSON | null>(null);
  const zoomRef = useRef<number>(9);
  const isDark = theme === 'dark';

  // Google Satellite — daha güncel uydu görüntüleri
  const tileUrl = 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}';

  // İl dışı mask verisi (bir kez hesapla)
  const maskData = useMemo(() => buildProvinceMask(), []);

  const getStyle = useCallback((feature: GeoJSON.Feature<GeoJSON.Geometry, { name: string }> | undefined) => {
    if (!feature) return {};
    const name = feature.properties.name;
    const isSelected = name === selectedDistrict;
    const isZoomedOut = zoomRef.current <= FILL_MAX_ZOOM;

    if (isSelected) {
      return {
        fill: true,
        fillColor: HOVER_COLOR,
        weight: 3,
        opacity: 1,
        color: HOVER_COLOR,
        fillOpacity: isZoomedOut ? 0.3 : 0,
      };
    }
    // Sınır çizgileri - dolgu görünmez ama interaktif (fill: true + fillOpacity: 0)
    return {
      fill: true,
      fillOpacity: 0,
      weight: 2,
      opacity: 0.8,
      color: '#ffffff',
    };
  }, [selectedDistrict, isDark]);

  const onEachFeature = useCallback((feature: GeoJSON.Feature<GeoJSON.Geometry, { name: string }>, layer: Layer) => {
    const name = feature.properties.name;

    layer.on({
      mouseover: (e: LeafletMouseEvent) => {
        if (editMode) return; // Edit modda hover efekti kapalı
        const target = e.target;
        const isZoomedOut = zoomRef.current <= FILL_MAX_ZOOM;
        target.setStyle({
          fill: true,
          fillColor: HOVER_COLOR,
          fillOpacity: isZoomedOut ? 0.25 : 0,
          weight: 2.5,
          color: HOVER_COLOR,
          opacity: 1,
        });
        target.bringToFront();
        // Label'ı büyüt ve renklendir
        const tooltip = target.getTooltip();
        if (tooltip) {
          const el = tooltip.getElement();
          if (el) {
            el.style.color = HOVER_COLOR;
            el.style.fontSize = '15px';
            el.style.fontWeight = '800';
            el.style.textShadow = `0 0 6px rgba(0,0,0,0.95), 0 0 12px rgba(0,0,0,0.7)`;
          }
        }
      },
      mouseout: (e: LeafletMouseEvent) => {
        if (editMode) return;
        if (geojsonRef.current) {
          geojsonRef.current.resetStyle(e.target);
        }
        // Label'ı eski haline döndür
        const tooltip = e.target.getTooltip();
        if (tooltip) {
          const el = tooltip.getElement();
          if (el) {
            el.style.color = '';
            el.style.fontSize = '';
            el.style.fontWeight = '';
            el.style.textShadow = '';
          }
        }
      },
      click: () => {
        if (!editMode) {
          onDistrictClick(name);
        }
      },
    });

    // Bazı ilçe isimlerini pin ile çakışmaması için kaydır
    const labelOffsets: Record<string, [number, number]> = {
      'Akçakale': [-60, 12],
      'Viranşehir': [0, -35],
    };
    layer.bindTooltip(name, {
      permanent: true,
      direction: 'center',
      className: `district-leaflet-label ${isDark ? 'dark' : 'light'}`,
      ...(labelOffsets[name] && { offset: L.point(labelOffsets[name][0], labelOffsets[name][1]) }),
    });
  }, [onDistrictClick, isDark, editMode]);

  // Kurum pin ikonlarını hesapla
  const markerIcons = useMemo(() =>
    markers.map(m => ({
      marker: m,
      icon: createInstitutionIcon(m, editMode ? m.id === selectedMarkerId : undefined),
    })),
  [markers, editMode, selectedMarkerId]);

  const selectedCenter = selectedDistrict ? DISTRICTS[selectedDistrict]?.center : undefined;

  return (
    <MapContainer
      center={PROVINCE_CENTER}
      zoom={9}
      bounds={PROVINCE_BOUNDS}
      boundsOptions={{ padding: [-20, -80] }}
      style={{ width: '100%', height: '100%', cursor: editMode ? 'crosshair' : '' }}
      zoomControl={false}
      attributionControl={false}
      minZoom={8}
    >
      <TileLayer
        url={tileUrl}
        attribution='&copy; Google'
        maxZoom={20}
      />
      {/* İl dışı karartma maskesi */}
      <GeoJSON
        key="province-mask"
        data={maskData as any}
        style={{
          fill: true,
          fillColor: '#000000',
          fillOpacity: 0.55,
          stroke: false,
          interactive: false,
        }}
      />
      <GeoJSON
        key={`geojson-${selectedDistrict}-${theme}-${editMode}`}
        ref={(ref) => { geojsonRef.current = ref as unknown as LeafletGeoJSON; }}
        data={GEOJSON_DATA}
        style={getStyle as any}
        onEachFeature={onEachFeature}
      />
      {/* Kurum pin'leri */}
      {markerIcons.map(({ marker, icon }, i) => (
        <Marker
          key={`inst-${marker.id || i}`}
          position={[marker.lat, marker.lng]}
          icon={icon}
          eventHandlers={editMode && onMarkerClick ? {
            click: (e) => {
              L.DomEvent.stopPropagation(e as any);
              onMarkerClick(marker);
            },
          } : undefined}
        >
          <Tooltip
            direction="top"
            offset={[0, -4]}
            className="institution-tooltip"
          >
            {marker.name}
          </Tooltip>
        </Marker>
      ))}
      {/* Edit modda haritaya tıklama dinleyici */}
      {editMode && onMapClick && (
        <MapClickHandler onMapClick={onMapClick} />
      )}
      <ZoomTracker zoomRef={zoomRef} geojsonRef={geojsonRef} getStyle={getStyle} />
      <MapResizeHandler
        isPanelOpen={isPanelOpen}
        selectedCenter={selectedCenter}
        mapExpanded={mapExpanded}
      />
    </MapContainer>
  );
};

export default SanliurfaLeafletMap;

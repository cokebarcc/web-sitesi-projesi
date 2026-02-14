import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { PROVINCE_BOUNDS } from '../../src/data/sanliurfaDistricts';

interface MapResizeHandlerProps {
  isPanelOpen: boolean;
  selectedCenter?: [number, number];
  mapExpanded?: boolean;
}

const MapResizeHandler: React.FC<MapResizeHandlerProps> = ({ isPanelOpen, selectedCenter, mapExpanded }) => {
  const map = useMap();

  // İlk yüklemede invalidateSize çağır
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
      map.fitBounds(PROVINCE_BOUNDS, { padding: [-20, -80] });
    }, 100);
    return () => clearTimeout(timer);
  }, [map]);

  // Expanded mod değiştiğinde haritayı yeniden boyutlandır
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize({ animate: false });
      map.fitBounds(PROVINCE_BOUNDS, { padding: mapExpanded ? [10, 10] : [-20, -80] });
    }, 50);
    return () => clearTimeout(timer);
  }, [mapExpanded, map]);

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize({ animate: true });
      if (isPanelOpen && selectedCenter) {
        map.flyTo(selectedCenter, 10, { duration: 0.8 });
      } else {
        map.flyToBounds(PROVINCE_BOUNDS, { duration: 0.8, padding: [-20, -80] });
      }
    }, 420);

    return () => clearTimeout(timer);
  }, [isPanelOpen, selectedCenter, map]);

  return null;
};

export default MapResizeHandler;

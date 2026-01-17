/**
 * useRadarLayer Hook
 * 기상 레이더 레이어 관리
 */
import { useEffect, useState, type MutableRefObject } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';

interface RadarFrame {
  path: string;
  time: number;
}

interface RadarApiData {
  radar?: {
    past?: RadarFrame[];
  };
}

export interface UseRadarLayerReturn {
  radarData: RadarApiData | null;
}

/**
 * Radar Layer Hook
 */
const useRadarLayer = (
  map: MutableRefObject<MapboxMap | null>,
  mapLoaded: boolean,
  showRadar: boolean
): UseRadarLayerReturn => {
  const [radarData, setRadarData] = useState<RadarApiData | null>(null);

  // Fetch radar data from RainViewer API
  useEffect(() => {
    const fetchRadarData = async (): Promise<void> => {
      try {
        const response = await fetch('https://api.rainviewer.com/public/weather-maps.json');
        const data: RadarApiData = await response.json();
        if (data?.radar?.past?.length && data.radar.past.length > 0) {
          setRadarData(data);
        }
      } catch (e) {
        console.error('Failed to fetch radar data:', e);
      }
    };
    fetchRadarData();
    const interval = setInterval(fetchRadarData, 300000); // 5분마다 갱신
    return () => clearInterval(interval);
  }, []);

  // Radar layer management
  useEffect(() => {
    if (!map?.current || !mapLoaded) return;

    const removeRadarLayer = (): void => {
      try {
        if (map.current?.getLayer('radar-layer')) map.current.removeLayer('radar-layer');
        if (map.current?.getSource('radar-source')) map.current.removeSource('radar-source');
      } catch { /* ignore */ }
    };

    if (showRadar && radarData?.radar?.past?.length && radarData.radar.past.length > 0) {
      const latestFrame = radarData.radar.past[radarData.radar.past.length - 1];
      // 프록시 API를 통해 CORS 문제 해결
      const proxyPath = `${latestFrame.path}/256/{z}/{x}/{y}/4/1_1.png`;
      const tileUrl = `/api/radar-tile?path=${proxyPath}`;

      removeRadarLayer();

      map.current.addSource('radar-source', {
        type: 'raster',
        tiles: [tileUrl],
        tileSize: 256
      });

      map.current.addLayer({
        id: 'radar-layer',
        type: 'raster',
        source: 'radar-source',
        paint: { 'raster-opacity': 0.6 }
      }, map.current.getLayer('runway') ? 'runway' : undefined);
    } else {
      removeRadarLayer();
    }
  }, [map, showRadar, radarData, mapLoaded]);

  return { radarData };
};

export default useRadarLayer;

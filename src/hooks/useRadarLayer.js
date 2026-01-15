/**
 * useRadarLayer Hook
 * 기상 레이더 레이어 관리
 */
import { useEffect, useState, useCallback } from 'react';

/**
 * Radar Layer Hook
 * @param {Object} map - Mapbox map ref
 * @param {boolean} mapLoaded - Map loaded state
 * @param {boolean} showRadar - Show radar toggle
 * @returns {Object} Radar data and controls
 */
const useRadarLayer = (map, mapLoaded, showRadar) => {
  const [radarData, setRadarData] = useState(null);

  // Fetch radar data from RainViewer API
  useEffect(() => {
    const fetchRadarData = async () => {
      try {
        const response = await fetch('https://api.rainviewer.com/public/weather-maps.json');
        const data = await response.json();
        if (data?.radar?.past?.length > 0) {
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

    const removeRadarLayer = () => {
      try {
        if (map.current.getLayer('radar-layer')) map.current.removeLayer('radar-layer');
        if (map.current.getSource('radar-source')) map.current.removeSource('radar-source');
      } catch (e) {}
    };

    if (showRadar && radarData?.radar?.past?.length > 0) {
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

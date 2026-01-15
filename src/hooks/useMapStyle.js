/**
 * useMapStyle Hook
 * 맵 스타일 및 뷰 모드 관리
 */
import { useEffect } from 'react';
import { MAP_STYLES } from '../constants/config';

/**
 * Map Style Hook
 * @param {Object} map - Mapbox map ref
 * @param {boolean} mapLoaded - Map loaded state
 * @param {Function} setMapLoaded - Set map loaded state
 * @param {boolean} isDarkMode - Dark mode toggle
 * @param {boolean} showSatellite - Satellite view toggle
 * @param {boolean} atcOnlyMode - ATC only mode
 * @param {boolean} radarBlackBackground - Radar black background
 * @param {boolean} is3DView - 3D view toggle
 * @param {boolean} showTerrain - Show terrain toggle
 * @param {boolean} show3DAltitude - Show 3D altitude toggle
 */
const useMapStyle = ({
  map,
  mapLoaded,
  setMapLoaded,
  isDarkMode,
  showSatellite,
  atcOnlyMode,
  radarBlackBackground,
  is3DView,
  showTerrain,
  show3DAltitude
}) => {
  // Handle style change
  useEffect(() => {
    if (!map?.current || !mapLoaded) return;

    // 레이더 모드 + 검은 배경이면 완전 검은 스타일 적용
    let newStyle;
    if (atcOnlyMode && radarBlackBackground) {
      newStyle = MAP_STYLES.black;
    } else {
      newStyle = showSatellite ? MAP_STYLES.satellite : (isDarkMode ? MAP_STYLES.dark : MAP_STYLES.light);
    }

    const center = map.current.getCenter();
    const zoom = map.current.getZoom();
    const pitch = map.current.getPitch();
    const bearing = map.current.getBearing();

    map.current.setStyle(newStyle);
    map.current.once('style.load', () => {
      map.current.setCenter(center);
      map.current.setZoom(zoom);
      map.current.setPitch(pitch);
      map.current.setBearing(bearing);

      // Add terrain source
      if (!map.current.getSource('mapbox-dem')) {
        map.current.addSource('mapbox-dem', {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 512,
          maxzoom: 14
        });
      }

      // 3D 고도 표시가 활성화되면 terrain을 비활성화하여 MSL 기준 절대 고도로 표시
      if (is3DView && showTerrain && !show3DAltitude) {
        map.current.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
      }

      // Add sky layer
      if (!map.current.getLayer('sky')) {
        map.current.addLayer({
          id: 'sky',
          type: 'sky',
          paint: {
            'sky-type': 'atmosphere',
            'sky-atmosphere-sun': [0.0, 90.0],
            'sky-atmosphere-sun-intensity': 15
          }
        });
      }

      // 검은 배경 모드가 아닐 때만 빌딩 추가 (composite source가 있는 스타일에서만)
      try {
        if (!(atcOnlyMode && radarBlackBackground) && !map.current.getLayer('3d-buildings') && map.current.getSource('composite')) {
          map.current.addLayer({
            id: '3d-buildings',
            source: 'composite',
            'source-layer': 'building',
            type: 'fill-extrusion',
            minzoom: 12,
            paint: {
              'fill-extrusion-color': '#aaa',
              'fill-extrusion-height': ['get', 'height'],
              'fill-extrusion-base': ['get', 'min_height'],
              'fill-extrusion-opacity': 0.6
            }
          });
        }
      } catch (e) {
        // 스타일에 composite source가 없으면 무시 (검은 배경 모드)
        console.debug('3D buildings skipped - no composite source');
      }

      // Add runway source and layer
      if (!map.current.getSource('runway')) {
        map.current.addSource('runway', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [[129.3505, 35.5890], [129.3530, 35.5978]]
            }
          }
        });
      }
      if (!map.current.getLayer('runway')) {
        map.current.addLayer({
          id: 'runway',
          type: 'line',
          source: 'runway',
          paint: { 'line-color': '#FFFFFF', 'line-width': 8 }
        });
      }

      setMapLoaded(false);
      setTimeout(() => setMapLoaded(true), 100);
    });
  }, [map, isDarkMode, showSatellite, atcOnlyMode, radarBlackBackground, mapLoaded, setMapLoaded, is3DView, showTerrain, show3DAltitude]);

  // Handle 2D/3D toggle
  useEffect(() => {
    if (!map?.current || !mapLoaded) return;
    if (is3DView) {
      map.current.easeTo({ pitch: 60, bearing: -30, duration: 1000 });
    } else {
      map.current.easeTo({ pitch: 0, bearing: 0, duration: 1000 });
      map.current.setTerrain(null);
    }
  }, [map, is3DView, mapLoaded]);

  // NOTE: 3D buildings visibility is managed by App.jsx to consider both is3DView and showBuildings
};

export default useMapStyle;

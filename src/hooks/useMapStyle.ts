/**
 * useMapStyle Hook
 * 맵 스타일 및 뷰 모드 관리
 */
import { useEffect, useRef, type MutableRefObject } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import { MAP_STYLES } from '../constants/config';
import { logger } from '../utils/logger';

export interface UseMapStyleOptions {
  map: MutableRefObject<MapboxMap | null>;
  mapLoaded: boolean;
  setMapLoaded: React.Dispatch<React.SetStateAction<boolean>>;
  isDarkMode: boolean;
  showSatellite: boolean;
  radarBlackBackground: boolean;
  is3DView: boolean;
  showTerrain: boolean;
  show3DAltitude: boolean;
}

const useMapStyle = ({
  map,
  mapLoaded,
  setMapLoaded,
  isDarkMode,
  showSatellite,
  radarBlackBackground,
  is3DView,
  showTerrain,
  show3DAltitude
}: UseMapStyleOptions): void => {
  const prevStyleRef = useRef<string | null>(null);

  // Handle base style change (dark/light/satellite) - NOT black background
  useEffect(() => {
    if (!map?.current || !mapLoaded) return;

    // 기본 스타일 선택 (검은 배경은 레이어로 처리)
    const newStyle = showSatellite
      ? MAP_STYLES.satellite as string
      : (isDarkMode ? MAP_STYLES.dark as string : MAP_STYLES.light as string);

    // 스타일이 같으면 스킵
    if (prevStyleRef.current === newStyle) return;
    prevStyleRef.current = newStyle;

    const center = map.current.getCenter();
    const zoom = map.current.getZoom();
    const pitch = map.current.getPitch();
    const bearing = map.current.getBearing();

    map.current.setStyle(newStyle);
    map.current.once('style.load', () => {
      if (!map.current) return;

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

      // 3D 빌딩 추가
      try {
        if (!map.current.getLayer('3d-buildings') && map.current.getSource('composite')) {
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
      } catch {
        logger.debug('MapStyle', '3D buildings skipped - no composite source');
      }

      // Add runway source and layer
      if (!map.current.getSource('runway')) {
        map.current.addSource('runway', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
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
  }, [map, isDarkMode, showSatellite, mapLoaded, setMapLoaded, is3DView, showTerrain, show3DAltitude]);

  // Handle black background toggle - 단순 오버레이 방식
  useEffect(() => {
    if (!map?.current || !mapLoaded) return;
    if (!map.current.isStyleLoaded()) return;

    const blackOverlayId = 'radar-black-overlay';

    // radarBlackBackground가 true면 검은 오버레이 표시
    if (radarBlackBackground) {
      if (!map.current.getLayer(blackOverlayId)) {
        // 맨 아래에 검은 오버레이 추가 (항적/항공기 레이어보다 아래)
        const layers = map.current.getStyle()?.layers;
        const firstLayerId = layers && layers.length > 0 ? layers[0].id : undefined;

        map.current.addLayer({
          id: blackOverlayId,
          type: 'background',
          paint: {
            'background-color': '#000000',
            'background-opacity': 0.95
          }
        }, firstLayerId); // firstLayerId 앞에 추가 = 맨 아래
      }
    } else {
      // 오버레이 제거
      if (map.current.getLayer(blackOverlayId)) {
        map.current.removeLayer(blackOverlayId);
      }
    }
  }, [map, radarBlackBackground, mapLoaded]);

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
};

export default useMapStyle;

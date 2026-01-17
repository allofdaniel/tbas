/**
 * useAtcRadarRings Hook
 * ATC 레이더 모드 링 및 베어링 라인 표시
 */
import { useEffect, useRef, type MutableRefObject } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';

// 울산공항 좌표 (RKPU)
const CENTER_LON = 129.3517;
const CENTER_LAT = 35.5935;

/**
 * 거리 링 좌표 생성
 */
const createCircleCoords = (centerLon: number, centerLat: number, radiusNm: number, segments = 128): [number, number][] => {
  const coords: [number, number][] = [];
  const radiusDeg = radiusNm / 60; // 1 degree ≈ 60 NM
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    coords.push([
      centerLon + radiusDeg * Math.cos(angle) / Math.cos(centerLat * Math.PI / 180),
      centerLat + radiusDeg * Math.sin(angle)
    ]);
  }
  return coords;
};

/**
 * ATC Radar Rings Hook
 */
const useAtcRadarRings = (
  map: MutableRefObject<MapboxMap | null>,
  mapLoaded: boolean,
  atcOnlyMode: boolean,
  radarRange: number,
  radarBlackBackground: boolean
): void => {
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 이전 타이머 정리
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    if (!map?.current || !mapLoaded) return;

    const safeRemoveLayer = (id: string): void => {
      try { if (map.current?.getLayer(id)) map.current.removeLayer(id); } catch { /* ignore */ }
    };
    const safeRemoveSource = (id: string): void => {
      try { if (map.current?.getSource(id)) map.current.removeSource(id); } catch { /* ignore */ }
    };

    const cleanupLayers = (): void => {
      for (let i = 1; i <= 15; i++) {
        safeRemoveLayer(`radar-ring-${i}`);
        safeRemoveLayer(`radar-ring-label-${i}`);
        safeRemoveSource(`radar-ring-${i}`);
        safeRemoveSource(`radar-ring-label-${i}`);
      }
      for (let i = 0; i < 36; i++) {
        safeRemoveLayer(`radar-bearing-${i}`);
        safeRemoveSource(`radar-bearing-${i}`);
      }
      safeRemoveLayer('radar-bearing-labels');
      safeRemoveSource('radar-bearing-labels');
    };

    const createLayers = (): void => {
      if (!map.current) return;

      // 스타일이 아직 로딩 중이면 재시도
      if (!map.current.isStyleLoaded()) {
        retryTimeoutRef.current = setTimeout(createLayers, 200);
        return;
      }

      // 먼저 기존 레이어 정리
      cleanupLayers();

      if (!atcOnlyMode) return;

      try {
        // radarRange에 따라 링 간격 결정
        const ringInterval = radarRange <= 100 ? 10 : (radarRange <= 200 ? 25 : 50);
        const numRings = Math.ceil(radarRange / ringInterval);

        for (let i = 1; i <= numRings; i++) {
          const radiusNm = i * ringInterval;
          if (radiusNm > radarRange) break;
          const isMajor = radiusNm % 50 === 0;
          const ringCoords = createCircleCoords(CENTER_LON, CENTER_LAT, radiusNm);

          map.current?.addSource(`radar-ring-${i}`, {
            type: 'geojson',
            data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: ringCoords } }
          });
          map.current?.addLayer({
            id: `radar-ring-${i}`,
            type: 'line',
            source: `radar-ring-${i}`,
            paint: {
              'line-color': '#00FF00',
              'line-width': isMajor ? 1.5 : 0.5,
              'line-opacity': isMajor ? 0.8 : 0.4
            }
          });

          // 링 라벨
          const labelLon = CENTER_LON;
          const labelLat = CENTER_LAT + radiusNm / 60;
          map.current?.addSource(`radar-ring-label-${i}`, {
            type: 'geojson',
            data: {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [labelLon, labelLat] },
              properties: { label: `${radiusNm}` }
            }
          });
          map.current?.addLayer({
            id: `radar-ring-label-${i}`,
            type: 'symbol',
            source: `radar-ring-label-${i}`,
            layout: {
              'text-field': ['get', 'label'],
              'text-size': isMajor ? 12 : 10,
              'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
              'text-anchor': 'center'
            },
            paint: {
              'text-color': '#00FF00',
              'text-halo-color': '#000000',
              'text-halo-width': 1,
              'text-opacity': isMajor ? 1 : 0.7
            }
          });
        }

        // 베어링 라인
        interface BearingLabelFeature {
          type: 'Feature';
          geometry: { type: 'Point'; coordinates: [number, number] };
          properties: { label: string };
        }
        const bearingLabelFeatures: BearingLabelFeature[] = [];
        for (let i = 0; i < 36; i++) {
          const bearing = i * 10;
          const angle = (90 - bearing) * Math.PI / 180;
          const maxRadius = radarRange / 60;

          const endLon = CENTER_LON + maxRadius * Math.cos(angle) / Math.cos(CENTER_LAT * Math.PI / 180);
          const endLat = CENTER_LAT + maxRadius * Math.sin(angle);

          map.current?.addSource(`radar-bearing-${i}`, {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: [[CENTER_LON, CENTER_LAT], [endLon, endLat]] }
            }
          });
          map.current?.addLayer({
            id: `radar-bearing-${i}`,
            type: 'line',
            source: `radar-bearing-${i}`,
            paint: {
              'line-color': '#00FF00',
              'line-width': bearing % 30 === 0 ? 1 : 0.3,
              'line-opacity': bearing % 30 === 0 ? 0.7 : 0.3,
              'line-dasharray': bearing % 30 === 0 ? [1, 0] : [2, 4]
            }
          });

          if (bearing % 30 === 0) {
            const labelRadius = (radarRange + 10) / 60;
            const labelLon = CENTER_LON + labelRadius * Math.cos(angle) / Math.cos(CENTER_LAT * Math.PI / 180);
            const labelLat = CENTER_LAT + labelRadius * Math.sin(angle);
            bearingLabelFeatures.push({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [labelLon, labelLat] },
              properties: { label: `${bearing.toString().padStart(3, '0')}°` }
            });
          }
        }

        // 베어링 라벨 레이어
        map.current?.addSource('radar-bearing-labels', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: bearingLabelFeatures }
        });
        map.current?.addLayer({
          id: 'radar-bearing-labels',
          type: 'symbol',
          source: 'radar-bearing-labels',
          layout: {
            'text-field': ['get', 'label'],
            'text-size': 12,
            'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
            'text-anchor': 'center'
          },
          paint: {
            'text-color': '#00FF00',
            'text-halo-color': '#000000',
            'text-halo-width': 1
          }
        });
      } catch (e) {
        console.warn('Radar rings creation error:', e);
      }
    };

    createLayers();

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [map, atcOnlyMode, radarRange, mapLoaded, radarBlackBackground]);
};

export default useAtcRadarRings;

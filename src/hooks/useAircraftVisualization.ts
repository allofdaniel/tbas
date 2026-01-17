import { useEffect, type MutableRefObject } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import { ftToM, createRibbonSegment } from '../utils/geometry';
import { AIRCRAFT_CATEGORY_COLORS } from '../utils/colors';
import type { AircraftData, AircraftTrails } from './useAircraftData';

interface LabelOffset {
  x: number;
  y: number;
}

interface GeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: string;
    coordinates: unknown;
  };
  properties: Record<string, unknown>;
}

interface FeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

/**
 * useAircraftVisualization - 항공기 시각화 레이어 관리 훅
 * - 3D/2D 항공기 표시
 * - 항공기 라벨
 * - 헤딩 예측선
 * - 항적 표시
 */
export default function useAircraftVisualization(
  map: MutableRefObject<MapboxMap | null>,
  mapLoaded: boolean,
  aircraft: AircraftData[],
  aircraftTrails: AircraftTrails,
  showAircraft: boolean,
  showAircraftTrails: boolean,
  show3DAircraft: boolean,
  is3DView: boolean,
  show3DAltitude: boolean,
  trailDuration: number,
  headingPrediction: number,
  selectedAircraft: AircraftData | null,
  labelOffset: LabelOffset
): void {
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // 헬퍼: 소스가 있으면 데이터 업데이트, 없으면 생성
    const updateOrCreateSource = (id: string, data: FeatureCollection): boolean => {
      const source = map.current?.getSource(id) as { setData: (data: FeatureCollection) => void } | undefined;
      if (source) {
        source.setData(data);
        return true; // 소스 존재함
      }
      return false; // 소스 없음
    };

    const emptyFeatureCollection: FeatureCollection = { type: 'FeatureCollection', features: [] };

    // 항공기 표시 끄기 - 빈 데이터로 업데이트
    if (!showAircraft || aircraft.length === 0) {
      ['aircraft-3d', 'aircraft-2d', 'aircraft-labels', 'aircraft-trails-2d', 'aircraft-trails-3d', 'aircraft-trails-arrows'].forEach(id => {
        const source = map.current?.getSource(id) as { setData: (data: FeatureCollection) => void } | undefined;
        if (source) source.setData(emptyFeatureCollection);
      });
      return;
    }

    const flyingAircraft = aircraft.filter(ac => !ac.on_ground && ac.altitude_ft > 100);

    // Aircraft shape 생성 함수
    const createAircraftShape = (lon: number, lat: number, heading: number, size = 0.002): number[][][] => {
      const rad = -(heading || 0) * Math.PI / 180;
      const cos = Math.cos(rad), sin = Math.sin(rad);
      const points: [number, number][] = [
        [0, size * 1.5],
        [-size * 0.5, -size],
        [0, -size * 0.3],
        [size * 0.5, -size],
      ];
      const rotated = points.map(([x, y]) => [
        lon + (x * cos - y * sin),
        lat + (x * sin + y * cos)
      ]);
      rotated.push(rotated[0]);
      return [rotated];
    };

    // 3D Aircraft 데이터 - 항상 표시 (고도에 맞게)
    const features3d: GeoJSONFeature[] = (show3DAircraft && flyingAircraft.length > 0) ?
      flyingAircraft.map(ac => {
        const altM = ftToM(ac.altitude_ft);
        return {
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: createAircraftShape(ac.lon, ac.lat, ac.track, 0.008) },
          properties: { color: AIRCRAFT_CATEGORY_COLORS[ac.category] || '#00BCD4', height: altM + 150, base: altM }
        };
      }) : [];

    // 2D Aircraft 데이터 - 3D 항공기가 꺼져있을 때만 표시
    const features2d: GeoJSONFeature[] = (!show3DAircraft) && flyingAircraft.length > 0 ?
      flyingAircraft.map(ac => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [ac.lon, ac.lat] },
        properties: { callsign: ac.callsign, color: AIRCRAFT_CATEGORY_COLORS[ac.category] || '#00BCD4', rotation: ac.track || 0 }
      })) : [];

    // Label 데이터 - 항공기 정보 표시 (선택된 항공기는 확장 라벨)
    const labelFeatures: GeoJSONFeature[] = flyingAircraft.map(ac => {
      const isEmergency = ['7700', '7600', '7500'].includes(ac.squawk);
      const vsIndicator = ac.vertical_rate > 100 ? '↑' : ac.vertical_rate < -100 ? '↓' : '';
      const isSelected = selectedAircraft?.hex === ac.hex;

      // 선택된 항공기는 확장 라벨, 아니면 기본 라벨
      let label: string;
      if (isSelected) {
        // 확장 라벨: 모든 정보 표시
        const route = (ac.origin || ac.destination) ? `${ac.origin || '???'}→${ac.destination || '???'}` : '';
        label = `${ac.callsign || ac.hex} [${ac.icao_type || ac.type || '?'}]` +
          `${ac.registration ? ` ${ac.registration}` : ''}` +
          `${route ? `\n${route}` : ''}` +
          `\nALT ${(ac.altitude_ft || 0).toLocaleString()}ft  GS ${ac.ground_speed || 0}kt` +
          `\nHDG ${Math.round(ac.track || 0)}°  VS ${ac.vertical_rate > 0 ? '+' : ''}${ac.vertical_rate || 0}fpm` +
          `\nSQK ${ac.squawk || '----'}`;
      } else {
        // 기본 라벨: 콜사인, 고도, 속도, 스쿽
        label = `${ac.callsign || ac.hex}\n${ac.altitude_ft || 0} ${ac.ground_speed || 0}kt${vsIndicator}\n${ac.squawk || '----'}`;
      }

      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [ac.lon, ac.lat] },
        properties: {
          label,
          hex: ac.hex,
          color: isEmergency ? '#ff0000' : (isSelected ? '#ffff00' : '#00ff88')
        }
      };
    });

    // 헤딩 지시선 3D 리본 (항공기 앞에 예측 시간 기반) - 고도에 맞게 표시
    const headingRibbonFeatures: GeoJSONFeature[] = [];
    if (headingPrediction > 0) {
      flyingAircraft.forEach(ac => {
        const heading = (ac.track || 0) * Math.PI / 180;
        const speedKt = ac.ground_speed || 0;
        const distanceNm = (speedKt / 3600) * headingPrediction;
        const distanceDeg = distanceNm * 0.0166;
        const lineLength = Math.max(0.005, distanceDeg);
        const endLon = ac.lon + Math.sin(heading) * lineLength;
        const endLat = ac.lat + Math.cos(heading) * lineLength;

        // 리본 생성 - createRibbonSegment는 (coord1, coord2, width) 형식
        const ribbon = createRibbonSegment(
          [ac.lon, ac.lat, ac.altitude_m],
          [endLon, endLat, ac.altitude_m],
          0.0008 // 항적과 동일한 너비
        );
        if (ribbon && ribbon.coordinates) {
          headingRibbonFeatures.push({
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: ribbon.coordinates },
            properties: {
              color: '#00ffff', // 시안색 (청록색)
              height: ac.altitude_m + 50,
              base: ac.altitude_m - 50,
              hex: ac.hex
            }
          });
        }
      });
    }

    // 3D Aircraft 업데이트 또는 생성
    const data3d: FeatureCollection = { type: 'FeatureCollection', features: features3d };
    if (!updateOrCreateSource('aircraft-3d', data3d)) {
      map.current?.addSource('aircraft-3d', { type: 'geojson', data: data3d as GeoJSON.FeatureCollection });
      map.current?.addLayer({
        id: 'aircraft-3d',
        type: 'fill-extrusion',
        source: 'aircraft-3d',
        paint: {
          'fill-extrusion-color': ['get', 'color'],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': ['get', 'base'],
          'fill-extrusion-opacity': 0.9
        }
      });
    }

    // 2D Aircraft 업데이트 또는 생성
    const data2d: FeatureCollection = { type: 'FeatureCollection', features: features2d };
    if (!updateOrCreateSource('aircraft-2d', data2d)) {
      map.current?.addSource('aircraft-2d', { type: 'geojson', data: data2d as GeoJSON.FeatureCollection });
      map.current?.addLayer({
        id: 'aircraft-2d',
        type: 'symbol',
        source: 'aircraft-2d',
        layout: {
          'icon-image': 'airport-15',
          'icon-size': ['interpolate', ['linear'], ['zoom'], 6, 1.5, 10, 2.5, 14, 3.5],
          'icon-rotate': ['get', 'rotation'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true
        },
        paint: { 'icon-color': ['get', 'color'] }
      });
    }

    // Labels 업데이트 또는 생성 - 사용자 드래그로 오프셋 조절 가능
    type AnchorType = 'center' | 'left' | 'right' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    const getAnchorFromOffset = (x: number, y: number): AnchorType => {
      if (x >= 0 && y <= 0) return 'bottom-left';
      if (x < 0 && y <= 0) return 'bottom-right';
      if (x >= 0 && y > 0) return 'top-left';
      return 'top-right';
    };
    const currentAnchor: AnchorType = getAnchorFromOffset(labelOffset.x, labelOffset.y);

    const labelData: FeatureCollection = { type: 'FeatureCollection', features: labelFeatures };
    if (!updateOrCreateSource('aircraft-labels', labelData)) {
      map.current?.addSource('aircraft-labels', { type: 'geojson', data: labelData as GeoJSON.FeatureCollection });
      map.current?.addLayer({
        id: 'aircraft-labels', type: 'symbol', source: 'aircraft-labels',
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 10,
          'text-anchor': currentAnchor,
          'text-offset': [labelOffset.x, labelOffset.y],
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
          'text-allow-overlap': true,
          'text-ignore-placement': true
        },
        paint: { 'text-color': ['get', 'color'], 'text-halo-color': 'rgba(0, 0, 0, 0.9)', 'text-halo-width': 2 }
      });
    } else if (map.current?.getLayer('aircraft-labels')) {
      // 라벨 위치가 변경되면 레이아웃 업데이트
      map.current.setLayoutProperty('aircraft-labels', 'text-anchor', currentAnchor);
      map.current.setLayoutProperty('aircraft-labels', 'text-offset', [labelOffset.x, labelOffset.y]);
    }

    // 헤딩 지시선 레이어 (3D 리본) - headingPrediction이 0이면 표시 안함
    const headingData: FeatureCollection = { type: 'FeatureCollection', features: headingRibbonFeatures };
    if (!updateOrCreateSource('aircraft-heading-lines', headingData)) {
      map.current?.addSource('aircraft-heading-lines', { type: 'geojson', data: headingData as GeoJSON.FeatureCollection });
      map.current?.addLayer({
        id: 'aircraft-heading-lines',
        type: 'fill-extrusion',
        source: 'aircraft-heading-lines',
        paint: {
          'fill-extrusion-color': ['get', 'color'],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': ['get', 'base'],
          'fill-extrusion-opacity': 0.85
        }
      });
    }

    // Aircraft trails - 항상 3D 리본 형태로 고도에 맞게 표시 + opacity 그라디언트
    const trail3dFeatures: GeoJSONFeature[] = [];

    const now = Date.now();

    if (showAircraftTrails && Object.keys(aircraftTrails).length > 0) {
      Object.entries(aircraftTrails).forEach(([hex, trail]) => {
        if (trail.length < 1) return;
        const ac = aircraft.find(a => a.hex === hex);
        if (!ac || ac.on_ground) return;

        // 현재 항공기 위치를 마지막 점으로 추가하여 끊김 방지
        const extendedTrail = [...trail];
        const lastTrail = trail[trail.length - 1];
        if (lastTrail && (lastTrail.lat !== ac.lat || lastTrail.lon !== ac.lon)) {
          extendedTrail.push({ lat: ac.lat, lon: ac.lon, altitude_m: ac.altitude_m, timestamp: now });
        }

        if (extendedTrail.length < 2) return;

        // 세그먼트별로 opacity 계산하여 리본 생성 (오래된 것 = 연하게)
        // 점선 효과: 2개 그리고 1개 건너뛰기
        for (let i = 0; i < extendedTrail.length - 1; i++) {
          // 점선 효과 - 매 3번째 세그먼트 건너뛰기
          if (i % 3 === 2) continue;

          const p1 = extendedTrail[i];
          const p2 = extendedTrail[i + 1];
          // 세그먼트의 중간 시간으로 opacity 계산
          const segTime = (p1.timestamp + p2.timestamp) / 2;
          const age = now - segTime;
          // 0 (가장 최신) ~ trailDuration (가장 오래됨) -> 1.0 ~ 0.3 opacity
          const opacity = Math.max(0.3, 1.0 - (age / trailDuration) * 0.7);

          // 항상 3D 리본 형태로 표시 (고도에 맞게)
          const colorWithAlpha = `rgba(0, 255, 136, ${opacity})`; // TRAIL_COLOR with opacity

          const ribbon = createRibbonSegment([p1.lon, p1.lat, p1.altitude_m || 100], [p2.lon, p2.lat, p2.altitude_m || 100], 0.001);
          if (ribbon) trail3dFeatures.push({
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: ribbon.coordinates },
            properties: { height: ribbon.avgAlt + 30, base: Math.max(0, ribbon.avgAlt - 30), color: colorWithAlpha }
          });
        }
      });
    }

    // 3D Trails 업데이트 또는 생성 - 항상 고도에 맞게 표시
    const trail3dData: FeatureCollection = { type: 'FeatureCollection', features: trail3dFeatures };
    if (!updateOrCreateSource('aircraft-trails-3d', trail3dData)) {
      map.current?.addSource('aircraft-trails-3d', { type: 'geojson', data: trail3dData as GeoJSON.FeatureCollection });
      map.current?.addLayer({ id: 'aircraft-trails-3d', type: 'fill-extrusion', source: 'aircraft-trails-3d', paint: {
        'fill-extrusion-color': ['get', 'color'],
        'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-base': ['get', 'base'],
        'fill-extrusion-opacity': 0.9
      } });
    }

    // 2D Trails 레이어는 더 이상 사용하지 않음 (빈 데이터로 유지)
    const emptyTrail2dData: FeatureCollection = { type: 'FeatureCollection', features: [] };
    if (!updateOrCreateSource('aircraft-trails-2d', emptyTrail2dData)) {
      map.current?.addSource('aircraft-trails-2d', { type: 'geojson', data: emptyTrail2dData as GeoJSON.FeatureCollection });
    }

    // 화살표 레이어 제거 (더 이상 사용하지 않음)
    const emptyArrowData: FeatureCollection = { type: 'FeatureCollection', features: [] };
    updateOrCreateSource('aircraft-trails-arrows', emptyArrowData);

  }, [aircraft, aircraftTrails, showAircraft, showAircraftTrails, show3DAircraft, is3DView, show3DAltitude, mapLoaded, trailDuration, headingPrediction, selectedAircraft, labelOffset, map]);
}

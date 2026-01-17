/**
 * useAtcSectors Hook
 * ATC 섹터 3D 시각화 관리
 */
import { useEffect, type MutableRefObject } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import { ftToM } from '../utils/geometry';

interface SectorData {
  id: string;
  name: string;
  coordinates?: [number, number][];
  center?: [number, number];
  radius_nm?: number;
  floor_ft?: number;
  ceiling_ft?: number;
  color?: string;
}

interface AtcData {
  ACC?: SectorData[];
  TMA?: SectorData[];
  CTR?: SectorData[];
}

/**
 * 원형 폴리곤 좌표 생성
 */
const createCircleCoords = (center: [number, number], radiusNm: number, segments = 64): [number, number][][] => {
  const coords: [number, number][] = [];
  const radiusDeg = radiusNm / 60; // 1 degree ≈ 60 NM
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    coords.push([
      center[0] + radiusDeg * Math.cos(angle),
      center[1] + radiusDeg * Math.sin(angle) * Math.cos(center[1] * Math.PI / 180)
    ]);
  }
  return [coords];
};

/**
 * ATC Sectors Hook
 */
const useAtcSectors = (
  map: MutableRefObject<MapboxMap | null>,
  mapLoaded: boolean,
  atcData: AtcData | null,
  selectedAtcSectors: Set<string>
): void => {
  useEffect(() => {
    if (!map?.current || !mapLoaded || !atcData) return;
    if (!map.current.isStyleLoaded()) return;

    // Get all sectors and current selected set
    const allSectors: SectorData[] = [...(atcData.ACC || []), ...(atcData.TMA || []), ...(atcData.CTR || [])];
    const selectedIds = Array.from(selectedAtcSectors);

    // Remove only unselected sectors (not all)
    allSectors.forEach(sector => {
      if (!selectedAtcSectors.has(sector.id)) {
        const sourceId = `atc-sector-${sector.id}`;
        const layerId = `atc-layer-${sector.id}`;
        const outlineId = `atc-outline-${sector.id}`;
        const labelSourceId = `atc-label-source-${sector.id}`;
        const labelLayerId = `atc-label-${sector.id}`;
        try {
          if (map.current?.getLayer(labelLayerId)) map.current.removeLayer(labelLayerId);
          if (map.current?.getSource(labelSourceId)) map.current.removeSource(labelSourceId);
          if (map.current?.getLayer(outlineId)) map.current.removeLayer(outlineId);
          if (map.current?.getLayer(layerId)) map.current.removeLayer(layerId);
          if (map.current?.getSource(sourceId)) map.current.removeSource(sourceId);
        } catch { /* ignore */ }
      }
    });

    if (selectedAtcSectors.size === 0) return;

    // Add layers only for newly selected sectors (skip if already exists)
    selectedIds.forEach(sectorId => {
      // Skip if layer already exists
      if (map.current?.getLayer(`atc-layer-${sectorId}`)) return;
      let sectorData: SectorData | null = null;

      for (const acc of atcData.ACC || []) {
        if (acc.id === sectorId) { sectorData = acc; break; }
      }
      if (!sectorData) {
        for (const tma of atcData.TMA || []) {
          if (tma.id === sectorId) { sectorData = tma; break; }
        }
      }
      if (!sectorData) {
        for (const ctr of atcData.CTR || []) {
          if (ctr.id === sectorId) { sectorData = ctr; break; }
        }
      }

      if (!sectorData) return;

      // Get coordinates
      let coordinates: [number, number][][];
      if (sectorData.coordinates) {
        coordinates = [sectorData.coordinates];
      } else if (sectorData.center && sectorData.radius_nm) {
        coordinates = createCircleCoords(sectorData.center, sectorData.radius_nm);
      } else {
        return;
      }

      const sourceId = `atc-sector-${sectorId}`;
      const layerId = `atc-layer-${sectorId}`;
      const outlineId = `atc-outline-${sectorId}`;
      const floorFt = sectorData.floor_ft || 0;
      const ceilingFt = sectorData.ceiling_ft || 10000;
      const color = sectorData.color || '#4ECDC4';

      // Add source
      map.current?.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: coordinates },
          properties: { name: sectorData.name, floor: floorFt, ceiling: ceilingFt }
        }
      });

      // Add 3D extrusion layer
      map.current?.addLayer({
        id: layerId,
        type: 'fill-extrusion',
        source: sourceId,
        paint: {
          'fill-extrusion-color': color,
          'fill-extrusion-height': ftToM(ceilingFt),
          'fill-extrusion-base': ftToM(floorFt),
          'fill-extrusion-opacity': 0.3
        }
      });

      // Add outline layer
      map.current?.addLayer({
        id: outlineId,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': color,
          'line-width': 2,
          'line-opacity': 0.8
        }
      });

      // Calculate center for label
      let centerLon: number | undefined, centerLat: number | undefined;
      if (sectorData.center) {
        [centerLon, centerLat] = sectorData.center;
      } else if (sectorData.coordinates && sectorData.coordinates.length > 0) {
        const coords = sectorData.coordinates;
        centerLon = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
        centerLat = coords.reduce((sum, c) => sum + c[1], 0) / coords.length;
      }

      // Add label source and layer
      if (centerLon && centerLat) {
        const labelSourceId = `atc-label-source-${sectorId}`;
        const labelLayerId = `atc-label-${sectorId}`;

        // Extract short name (e.g., "T13" from "T13 - Osan TMA")
        const shortName = sectorData.name.split(' - ')[0] || sectorData.name;

        map.current?.addSource(labelSourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [centerLon, centerLat] },
            properties: { name: shortName }
          }
        });

        map.current?.addLayer({
          id: labelLayerId,
          type: 'symbol',
          source: labelSourceId,
          layout: {
            'text-field': ['get', 'name'],
            'text-size': 12,
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-anchor': 'center',
            'text-allow-overlap': true
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': color,
            'text-halo-width': 2
          }
        });
      }
    });

  }, [map, mapLoaded, selectedAtcSectors, atcData]);
};

export default useAtcSectors;

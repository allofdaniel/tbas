/**
 * useChartOverlay Hook
 * 차트 오버레이 레이어 관리 (멀티 공항 지원)
 */
import { useEffect, useRef, type MutableRefObject } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';

type ChartBounds = [[number, number], [number, number], [number, number], [number, number]];

interface ChartData {
  file: string;
  bounds?: ChartBounds;
}

export type AllChartBounds = Record<string, Record<string, ChartData>>;

/**
 * Chart Overlay Hook
 */
const useChartOverlay = (
  map: MutableRefObject<MapboxMap | null>,
  mapLoaded: boolean,
  activeCharts: Record<string, boolean>,
  chartOpacities: Record<string, number>,
  allChartBounds: AllChartBounds,
  selectedAirport: string
): void => {
  const prevLayersRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!map?.current || !mapLoaded) return;

    const safeRemove = (type: 'Layer' | 'Source', id: string): void => {
      try {
        const method = type === 'Layer' ? 'getLayer' : 'getSource';
        const removeMethod = type === 'Layer' ? 'removeLayer' : 'removeSource';
        if ((map.current as unknown as Record<string, (id: string) => unknown>)?.[method](id)) {
          (map.current as unknown as Record<string, (id: string) => void>)?.[removeMethod](id);
        }
      } catch { /* ignore */ }
    };

    // Get charts for selected airport
    const airportCharts = allChartBounds?.[selectedAirport] || {};
    const currentLayers = new Set<string>();

    // Process all charts for selected airport
    Object.entries(airportCharts).forEach(([chartId, chartData]) => {
      const layerId = `chart-${chartId}`;
      const sourceId = `chart-source-${chartId}`;
      const isActive = activeCharts[chartId];
      const bounds = chartData?.bounds;

      if (isActive && bounds) {
        currentLayers.add(layerId);
        try {
          // Remove existing layer/source first if they exist (for style changes)
          if (map.current?.getLayer(layerId)) map.current.removeLayer(layerId);
          if (map.current?.getSource(sourceId)) map.current.removeSource(sourceId);

          // Add source and layer
          map.current?.addSource(sourceId, {
            type: 'image',
            url: chartData.file,
            coordinates: bounds
          });

          // Find a suitable layer to insert before, or add on top
          const beforeLayer = map.current?.getLayer('runway') ? 'runway' : undefined;
          map.current?.addLayer({
            id: layerId,
            type: 'raster',
            source: sourceId,
            paint: { 'raster-opacity': chartOpacities[chartId] || 0.7 }
          }, beforeLayer);
        } catch (e) {
          console.warn(`Failed to add chart overlay ${chartId}:`, e);
        }
      } else {
        safeRemove('Layer', layerId);
        safeRemove('Source', sourceId);
      }
    });

    // Clean up layers from previously selected airport that are no longer needed
    prevLayersRef.current.forEach(layerId => {
      if (!currentLayers.has(layerId)) {
        const sourceId = layerId.replace('chart-', 'chart-source-');
        safeRemove('Layer', layerId);
        safeRemove('Source', sourceId);
      }
    });

    prevLayersRef.current = currentLayers;
  }, [map, activeCharts, chartOpacities, allChartBounds, selectedAirport, mapLoaded]);
};

export default useChartOverlay;

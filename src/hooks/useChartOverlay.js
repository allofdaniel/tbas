/**
 * useChartOverlay Hook
 * 차트 오버레이 레이어 관리
 */
import { useEffect } from 'react';
import { PROCEDURE_CHARTS } from '../constants/config';

/**
 * Chart Overlay Hook
 * @param {Object} map - Mapbox map ref
 * @param {boolean} mapLoaded - Map loaded state
 * @param {Object} activeCharts - Active charts state
 * @param {Object} chartOpacities - Chart opacities state
 * @param {Object} chartBounds - Chart bounds data
 */
const useChartOverlay = (map, mapLoaded, activeCharts, chartOpacities, chartBounds) => {
  useEffect(() => {
    if (!map?.current || !mapLoaded || Object.keys(chartBounds).length === 0) return;

    const safeRemove = (type, id) => {
      try {
        if (map.current[`get${type}`](id)) map.current[`remove${type}`](id);
      } catch (e) {}
    };

    Object.keys(PROCEDURE_CHARTS).forEach((chartId) => {
      const layerId = `chart-${chartId}`;
      const sourceId = `chart-source-${chartId}`;
      const isActive = activeCharts[chartId];
      const bounds = chartBounds[chartId]?.bounds;

      if (isActive && bounds) {
        try {
          // Remove existing layer/source first if they exist (for style changes)
          if (map.current.getLayer(layerId)) map.current.removeLayer(layerId);
          if (map.current.getSource(sourceId)) map.current.removeSource(sourceId);

          // Add source and layer
          map.current.addSource(sourceId, {
            type: 'image',
            url: PROCEDURE_CHARTS[chartId].file,
            coordinates: bounds
          });

          // Find a suitable layer to insert before, or add on top
          const beforeLayer = map.current.getLayer('runway') ? 'runway' : undefined;
          map.current.addLayer({
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
  }, [map, activeCharts, chartOpacities, chartBounds, mapLoaded]);
};

export default useChartOverlay;

/**
 * ChartLayer Component
 * DO-278A 요구사항 추적: SRS-UI-010
 *
 * AIP 차트 이미지 오버레이 레이어
 */

import { useEffect, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { useMapContext } from '../../contexts/MapContext';
import { AIRPORT_COORDINATES } from '@/config/airports';

const CHART_SOURCE_PREFIX = 'chart-source-';
const CHART_LAYER_PREFIX = 'chart-layer-';

// Chart types and their typical display properties
const CHART_TYPE_CONFIG: Record<string, { zIndex: number; defaultOpacity: number; scale: number }> = {
  ADC: { zIndex: 1, defaultOpacity: 0.7, scale: 0.015 }, // Aerodrome Chart - small area
  PDC: { zIndex: 2, defaultOpacity: 0.7, scale: 0.01 },  // Parking/Docking
  AOC: { zIndex: 0, defaultOpacity: 0.5, scale: 0.03 },  // Obstacle Chart - larger area
  SID: { zIndex: 3, defaultOpacity: 0.6, scale: 0.2 },   // SID - large area
  STAR: { zIndex: 3, defaultOpacity: 0.6, scale: 0.2 },  // STAR - large area
  IAC: { zIndex: 4, defaultOpacity: 0.7, scale: 0.1 },   // Approach Chart
  VAC: { zIndex: 4, defaultOpacity: 0.7, scale: 0.08 },  // Visual Approach
  GMC: { zIndex: 2, defaultOpacity: 0.7, scale: 0.008 }, // Ground Movement
  OTHER: { zIndex: 5, defaultOpacity: 0.6, scale: 0.05 },
};

export interface ChartData {
  id: string;
  airport: string;
  chart_type: string;
  name: string;
  runway?: string;
  image_url: string;
  local_path?: string;
  effective_date: string;
  // Georeferencing data (optional, for properly positioned charts)
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

export interface ChartIndex {
  version: string;
  effective_date: string;
  airports: Record<string, {
    charts: ChartData[];
    count: number;
  }>;
}

interface ChartLayerProps {
  airport: string;
  version?: string;
  chartTypes?: string[];
  opacity?: number;
  chartsApiUrl?: string;
  onChartLoad?: (charts: ChartData[]) => void;
}

/**
 * 차트 레이어 컴포넌트
 */
export function ChartLayer({
  airport,
  version,
  chartTypes,
  opacity = 0.7,
  chartsApiUrl = '/api/charts',
  onChartLoad,
}: ChartLayerProps) {
  const { mapRef, isMapLoaded } = useMapContext();
  const [charts, setCharts] = useState<ChartData[]>([]);
  const [activeCharts, setActiveCharts] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Calculate bounds for a chart based on airport ARP and chart type
   */
  const calculateChartBounds = useCallback((chart: ChartData): [number, number, number, number] => {
    // If chart has explicit bounds, use them
    if (chart.bounds) {
      return [
        chart.bounds.west,
        chart.bounds.south,
        chart.bounds.east,
        chart.bounds.north,
      ];
    }

    // Otherwise, calculate based on airport center and chart type scale
    const airportCoords = AIRPORT_COORDINATES[chart.airport];
    if (!airportCoords) {
      // Fallback to approximate center of Korea
      return [127.0, 35.0, 128.0, 36.0];
    }

    const config = CHART_TYPE_CONFIG[chart.chart_type] || CHART_TYPE_CONFIG.OTHER;
    const scale = config.scale;

    // Create bounds around the airport
    // Note: This is approximate. Proper georeferencing requires actual chart corner coordinates
    return [
      airportCoords.lon - scale,      // west
      airportCoords.lat - scale * 0.7, // south (aspect ratio adjustment)
      airportCoords.lon + scale,      // east
      airportCoords.lat + scale * 0.7, // north
    ];
  }, []);

  /**
   * Load charts for the specified airport
   */
  const loadCharts = useCallback(async () => {
    if (!airport) return;

    setLoading(true);
    setError(null);

    try {
      // Try to fetch from API
      const url = version
        ? `${chartsApiUrl}/${airport}?version=${version}`
        : `${chartsApiUrl}/${airport}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to load charts: ${response.statusText}`);
      }

      const data = await response.json();
      const chartList = data.charts || [];

      // Filter by chart types if specified
      const filtered = chartTypes
        ? chartList.filter((c: ChartData) => chartTypes.includes(c.chart_type))
        : chartList;

      setCharts(filtered);
      onChartLoad?.(filtered);
    } catch (err) {
      console.error('Failed to load charts:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');

      // For development: use placeholder data
      if (process.env.NODE_ENV === 'development') {
        setCharts([]);
      }
    } finally {
      setLoading(false);
    }
  }, [airport, version, chartTypes, chartsApiUrl, onChartLoad]);

  /**
   * Add a chart to the map
   */
  const addChartToMap = useCallback((chart: ChartData) => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    const sourceId = `${CHART_SOURCE_PREFIX}${chart.id}`;
    const layerId = `${CHART_LAYER_PREFIX}${chart.id}`;

    // Skip if already exists
    if (map.getSource(sourceId)) return;

    try {
      const bounds = calculateChartBounds(chart);
      const config = CHART_TYPE_CONFIG[chart.chart_type] || CHART_TYPE_CONFIG.OTHER;

      // Add image source
      map.addSource(sourceId, {
        type: 'image',
        url: chart.image_url,
        coordinates: [
          [bounds[0], bounds[3]], // top-left
          [bounds[2], bounds[3]], // top-right
          [bounds[2], bounds[1]], // bottom-right
          [bounds[0], bounds[1]], // bottom-left
        ],
      });

      // Add raster layer
      map.addLayer({
        id: layerId,
        type: 'raster',
        source: sourceId,
        paint: {
          'raster-opacity': opacity * config.defaultOpacity,
          'raster-fade-duration': 0,
        },
      });

      setActiveCharts((prev) => new Set([...prev, chart.id]));
    } catch (err) {
      console.error(`Failed to add chart ${chart.id}:`, err);
    }
  }, [mapRef, isMapLoaded, calculateChartBounds, opacity]);

  /**
   * Remove a chart from the map
   */
  const removeChartFromMap = useCallback((chartId: string) => {
    const map = mapRef.current;
    if (!map) return;

    const sourceId = `${CHART_SOURCE_PREFIX}${chartId}`;
    const layerId = `${CHART_LAYER_PREFIX}${chartId}`;

    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }
    if (map.getSource(sourceId)) {
      map.removeSource(sourceId);
    }

    setActiveCharts((prev) => {
      const next = new Set(prev);
      next.delete(chartId);
      return next;
    });
  }, [mapRef]);

  /**
   * Load charts when airport changes
   */
  useEffect(() => {
    loadCharts();
  }, [loadCharts]);

  /**
   * Add charts to map when loaded
   */
  useEffect(() => {
    if (!isMapLoaded || charts.length === 0) return;

    // Add all charts
    charts.forEach((chart) => {
      addChartToMap(chart);
    });

    // Cleanup
    return () => {
      charts.forEach((chart) => {
        removeChartFromMap(chart.id);
      });
    };
  }, [charts, isMapLoaded, addChartToMap, removeChartFromMap]);

  /**
   * Update opacity when changed
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapLoaded) return;

    activeCharts.forEach((chartId) => {
      const layerId = `${CHART_LAYER_PREFIX}${chartId}`;
      if (map.getLayer(layerId)) {
        const chart = charts.find((c) => c.id === chartId);
        const config = CHART_TYPE_CONFIG[chart?.chart_type || 'OTHER'] || CHART_TYPE_CONFIG.OTHER;
        map.setPaintProperty(layerId, 'raster-opacity', opacity * config.defaultOpacity);
      }
    });
  }, [opacity, activeCharts, charts, mapRef, isMapLoaded]);

  return null;
}

/**
 * Chart selector panel component
 */
export function ChartSelectorPanel({
  airport,
  onVersionChange,
  onChartTypeToggle,
  selectedTypes,
}: {
  airport: string;
  onVersionChange?: (version: string) => void;
  onChartTypeToggle?: (type: string, enabled: boolean) => void;
  selectedTypes?: string[];
}) {
  const [versions, setVersions] = useState<string[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>('');

  // Chart type labels
  const chartTypeLabels: Record<string, string> = {
    ADC: 'Aerodrome Chart',
    PDC: 'Parking/Docking',
    AOC: 'Obstacle Chart',
    SID: 'SID (Departure)',
    STAR: 'STAR (Arrival)',
    IAC: 'Instrument Approach',
    VAC: 'Visual Approach',
    GMC: 'Ground Movement',
  };

  return (
    <div
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: '12px',
        borderRadius: '8px',
        color: '#fff',
        fontSize: '12px',
        minWidth: '200px',
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: '12px' }}>
        AIP Charts - {airport}
      </div>

      {/* Version selector */}
      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', marginBottom: '4px', color: '#aaa' }}>
          Version
        </label>
        <select
          value={selectedVersion}
          onChange={(e) => {
            setSelectedVersion(e.target.value);
            onVersionChange?.(e.target.value);
          }}
          style={{
            width: '100%',
            padding: '6px',
            borderRadius: '4px',
            border: 'none',
            backgroundColor: '#333',
            color: '#fff',
          }}
        >
          <option value="">Current</option>
          {versions.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {/* Chart type toggles */}
      <div>
        <label style={{ display: 'block', marginBottom: '8px', color: '#aaa' }}>
          Chart Types
        </label>
        {Object.entries(chartTypeLabels).map(([type, label]) => (
          <label
            key={type}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '6px',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={selectedTypes?.includes(type) ?? true}
              onChange={(e) => onChartTypeToggle?.(type, e.target.checked)}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default ChartLayer;

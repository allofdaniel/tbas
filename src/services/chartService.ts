/**
 * Chart Service
 * DO-278A 요구사항 추적: SRS-SVC-010
 *
 * AIP 차트 데이터 API 서비스
 */

import type { ChartData, ChartIndex } from '@/presentation/components/map/ChartLayer';
import { AIRPORT_COORDINATES } from '@/config/airports';

// Default chart data server URL (can be configured via environment)
const CHARTS_BASE_URL = import.meta.env.VITE_CHARTS_API_URL || '/api/charts';

// Cache for loaded chart indices
const chartIndexCache: Map<string, ChartIndex> = new Map();

/**
 * Chart type scale factors for automatic bounds calculation
 * These define the approximate coverage area for each chart type
 */
const CHART_TYPE_SCALES: Record<string, { latScale: number; lonScale: number }> = {
  ADC: { latScale: 0.015, lonScale: 0.02 },      // Aerodrome Chart - small area
  PDC: { latScale: 0.01, lonScale: 0.012 },      // Parking/Docking - very small
  GMC: { latScale: 0.008, lonScale: 0.01 },      // Ground Movement - airport only
  AOC: { latScale: 0.05, lonScale: 0.06 },       // Obstacle Chart - larger area
  'AOC-A': { latScale: 0.05, lonScale: 0.06 },
  'AOC-B': { latScale: 0.08, lonScale: 0.1 },
  SID: { latScale: 0.6, lonScale: 0.8 },         // SID - very large area
  STAR: { latScale: 0.6, lonScale: 0.8 },        // STAR - very large area
  IAC: { latScale: 0.15, lonScale: 0.2 },        // Approach Chart - medium area
  VAC: { latScale: 0.1, lonScale: 0.12 },        // Visual Approach
  BIRD: { latScale: 0.08, lonScale: 0.1 },       // Bird concentration
  OTHER: { latScale: 0.05, lonScale: 0.06 },
};

/**
 * Precise georeferencing data for charts (from QGIS)
 * These override the automatic calculation for better accuracy
 */
export const CHART_GEOREF: Record<string, Record<string, { north: number; south: number; east: number; west: number }>> = {
  RKPU: {
    ADC: { north: 35.6045, south: 35.5825, east: 129.3618, west: 129.3418 },
    SID: { north: 36.2, south: 35.0, east: 130.0, west: 128.5 },
    STAR: { north: 36.2, south: 35.0, east: 130.0, west: 128.5 },
    IAC: { north: 35.8, south: 35.4, east: 129.6, west: 129.1 },
    VAC: { north: 35.75, south: 35.45, east: 129.55, west: 129.15 },
  },
  // More airports can be added as QGIS georeferencing is completed
};

/**
 * Calculate chart bounds from ARP coordinates and chart type
 */
export function calculateChartBounds(
  airport: string,
  chartType: string,
  runway?: string
): { north: number; south: number; east: number; west: number } | null {
  // First, check for precise georeferencing data
  const georef = CHART_GEOREF[airport];
  if (georef) {
    const key = runway ? `${chartType}_RWY${runway}` : chartType;
    if (georef[key]) return georef[key];
    if (georef[chartType]) return georef[chartType];
  }

  // Fall back to automatic calculation using ARP
  const arp = AIRPORT_COORDINATES[airport];
  if (!arp) return null;

  const scale = CHART_TYPE_SCALES[chartType] || CHART_TYPE_SCALES.OTHER;

  return {
    north: arp.lat + scale.latScale,
    south: arp.lat - scale.latScale,
    east: arp.lon + scale.lonScale,
    west: arp.lon - scale.lonScale,
  };
}

/**
 * Get available AIP versions
 */
export async function getAvailableVersions(): Promise<string[]> {
  try {
    const response = await fetch(`${CHARTS_BASE_URL}/versions`);
    if (!response.ok) {
      throw new Error('Failed to fetch versions');
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to get versions:', error);
    return [];
  }
}

/**
 * Get chart index for a specific version
 */
export async function getChartIndex(version?: string): Promise<ChartIndex | null> {
  const cacheKey = version || 'current';

  if (chartIndexCache.has(cacheKey)) {
    return chartIndexCache.get(cacheKey)!;
  }

  try {
    const url = version
      ? `${CHARTS_BASE_URL}/index?version=${version}`
      : `${CHARTS_BASE_URL}/index`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch chart index');
    }

    const index = await response.json() as ChartIndex;
    chartIndexCache.set(cacheKey, index);
    return index;
  } catch (error) {
    console.error('Failed to get chart index:', error);
    return null;
  }
}

/**
 * Get charts for a specific airport
 */
export async function getAirportCharts(
  airport: string,
  version?: string,
  chartTypes?: string[]
): Promise<ChartData[]> {
  try {
    // Try direct API call first
    let url = `${CHARTS_BASE_URL}/${airport}`;
    if (chartTypes && chartTypes.length > 0) {
      url += `?type=${chartTypes.join(',')}`;
    }

    const response = await fetch(url);
    if (response.ok) {
      const result = await response.json();
      const chartsData = result.data?.charts || [];

      // Apply georeferencing and convert local_url to image_url
      return chartsData.map((chart: ChartData) => {
        // Use local_url if available
        if ((chart as unknown as { local_url?: string }).local_url) {
          chart.image_url = (chart as unknown as { local_url: string }).local_url;
        }

        const bounds = calculateChartBounds(chart.airport, chart.chart_type, chart.runway);
        if (bounds) {
          return { ...chart, bounds };
        }
        return chart;
      });
    }

    // Fallback to index-based loading
    const index = await getChartIndex(version);
    if (!index || !index.airports[airport]) {
      return [];
    }

    let charts = index.airports[airport].charts;

    // Apply georeferencing data (precise or calculated)
    charts = charts.map((chart) => {
      const bounds = calculateChartBounds(chart.airport, chart.chart_type, chart.runway);
      if (bounds) {
        return { ...chart, bounds };
      }
      return chart;
    });

    // Filter by chart types
    if (chartTypes && chartTypes.length > 0) {
      charts = charts.filter((c) => chartTypes.includes(c.chart_type));
    }

    return charts;
  } catch (error) {
    console.error('Failed to get airport charts:', error);
    return [];
  }
}

/**
 * Get chart image URL
 */
export function getChartImageUrl(chart: ChartData): string {
  if (chart.local_path) {
    return `${CHARTS_BASE_URL}/images/${chart.local_path}`;
  }
  return chart.image_url;
}

/**
 * Preload chart images for faster display
 */
export async function preloadChartImages(charts: ChartData[]): Promise<void> {
  const promises = charts.map((chart) => {
    return new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`Failed to load: ${chart.image_url}`));
      img.src = getChartImageUrl(chart);
    });
  });

  await Promise.allSettled(promises);
}

/**
 * Mock chart data for development/testing
 * This simulates what the crawler would produce
 */
export function getMockChartData(airport: string): ChartData[] {
  const mockCharts: ChartData[] = [];
  const chartTypes = ['ADC', 'SID', 'STAR', 'IAC', 'VAC'];
  const runways = ['18', '36'];

  chartTypes.forEach((type, idx) => {
    if (['SID', 'STAR', 'IAC'].includes(type)) {
      // Multiple charts for different runways
      runways.forEach((rwy) => {
        mockCharts.push({
          id: `${airport}_${type}_${rwy}_2026-01-08`,
          airport,
          chart_type: type,
          name: `${airport} ${type} RWY ${rwy}`,
          runway: rwy,
          image_url: `https://aim.koca.go.kr/eaipPub/Package/2026-01-08/html/eAIP/graphics/${airport}_${type}_${rwy}.gif`,
          effective_date: '2026-01-08',
        });
      });
    } else {
      mockCharts.push({
        id: `${airport}_${type}_2026-01-08`,
        airport,
        chart_type: type,
        name: `${airport} ${type}`,
        image_url: `https://aim.koca.go.kr/eaipPub/Package/2026-01-08/html/eAIP/graphics/${airport}_${type}.gif`,
        effective_date: '2026-01-08',
      });
    }
  });

  return mockCharts;
}

export default {
  getAvailableVersions,
  getChartIndex,
  getAirportCharts,
  getChartImageUrl,
  preloadChartImages,
  getMockChartData,
};

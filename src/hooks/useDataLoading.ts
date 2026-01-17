import { useState, useEffect } from 'react';
import { generateColor } from '../utils/colors';

export interface AviationData {
  procedures?: {
    SID?: Record<string, unknown>;
    STAR?: Record<string, unknown>;
    APPROACH?: Record<string, unknown>;
  };
  waypoints?: unknown[];
  obstacles?: unknown[];
  airspace?: unknown;
  [key: string]: unknown;
}

export interface ProcColors {
  SID: Record<string, string>;
  STAR: Record<string, string>;
  APPROACH: Record<string, string>;
}

export interface KoreaAirspaceData {
  waypoints?: unknown[];
  routes?: unknown[];
  navaids?: unknown[];
  airspaces?: unknown[];
  metadata?: {
    airac?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface UseDataLoadingReturn {
  data: AviationData | null;
  sidVisible: Record<string, boolean>;
  setSidVisible: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  starVisible: Record<string, boolean>;
  setStarVisible: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  apchVisible: Record<string, boolean>;
  setApchVisible: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  procColors: ProcColors;
  chartBounds: Record<string, unknown>;
  allChartBounds: Record<string, Record<string, unknown>>;
  chartOpacities: Record<string, number>;
  setChartOpacities: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  atcData: unknown;
  koreaAirspaceData: KoreaAirspaceData | null;
}

/**
 * useDataLoading - 정적 데이터 로딩 훅
 */
export default function useDataLoading(): UseDataLoadingReturn {
  const [data, setData] = useState<AviationData | null>(null);
  const [sidVisible, setSidVisible] = useState<Record<string, boolean>>({});
  const [starVisible, setStarVisible] = useState<Record<string, boolean>>({});
  const [apchVisible, setApchVisible] = useState<Record<string, boolean>>({});
  const [procColors, setProcColors] = useState<ProcColors>({ SID: {}, STAR: {}, APPROACH: {} });

  const [chartBounds, setChartBounds] = useState<Record<string, unknown>>({});
  const [allChartBounds, setAllChartBounds] = useState<Record<string, Record<string, unknown>>>({});
  const [chartOpacities, setChartOpacities] = useState<Record<string, number>>({});

  const [atcData, setAtcData] = useState<unknown>(null);
  const [koreaAirspaceData, setKoreaAirspaceData] = useState<KoreaAirspaceData | null>(null);

  // Load aviation data
  useEffect(() => {
    fetch('/aviation_data.json')
      .then((res) => res.json())
      .then((json: AviationData) => {
        setData(json);
        const sidKeys = Object.keys(json.procedures?.SID || {});
        const starKeys = Object.keys(json.procedures?.STAR || {});
        const apchKeys = Object.keys(json.procedures?.APPROACH || {});
        setSidVisible(Object.fromEntries(sidKeys.map((k) => [k, false])));
        setStarVisible(Object.fromEntries(starKeys.map((k) => [k, false])));
        setApchVisible(Object.fromEntries(apchKeys.map((k) => [k, false])));
        setProcColors({
          SID: Object.fromEntries(sidKeys.map((k, i) => [k, generateColor(i, sidKeys.length, 120)])),
          STAR: Object.fromEntries(starKeys.map((k, i) => [k, generateColor(i, starKeys.length, 30)])),
          APPROACH: Object.fromEntries(apchKeys.map((k, i) => [k, generateColor(i, apchKeys.length, 200)])),
        });
      });
  }, []);

  // Load all chart bounds (multi-airport) + merge RKPU manual charts
  useEffect(() => {
    Promise.all([
      fetch('/charts/all_chart_bounds.json').then(res => res.ok ? res.json() : {}),
      fetch('/charts/chart_bounds.json').then(res => res.ok ? res.json() : {})
    ]).then(([allBounds, rkpuManualBounds]: [Record<string, Record<string, unknown>>, Record<string, unknown>]) => {
      // RKPU 수동 피팅 차트를 allBounds에 병합 (기존 RKPU 덮어쓰기)
      const rkpuCharts: Record<string, unknown> = {};
      Object.entries(rkpuManualBounds).forEach(([chartId, bounds]) => {
        // chart_bounds.json 형식: { chartId: { bounds: [[lon,lat],...] } }
        // 파일 경로 추가
        rkpuCharts[chartId] = {
          bounds: (bounds as { bounds: unknown }).bounds,
          file: `/charts/${chartId}.png`,
          type: chartId.startsWith('sid') ? 'SID' :
                chartId.startsWith('star') ? 'STAR' :
                chartId.startsWith('apch') ? 'IAC' : 'OTHER',
          name: chartId.replace(/_/g, ' ').toUpperCase(),
          method: 'manual'
        };
      });

      // RKPU 수동 차트로 덮어쓰기
      if (Object.keys(rkpuCharts).length > 0) {
        allBounds['RKPU'] = rkpuCharts;
        console.log(`Merged ${Object.keys(rkpuCharts).length} manual RKPU charts`);
      }

      setAllChartBounds(allBounds);
      setChartBounds(rkpuManualBounds);

      const opacities: Record<string, number> = {};
      Object.values(allBounds).forEach(airport => {
        Object.keys(airport).forEach(chartId => {
          opacities[chartId] = 0.7;
        });
      });
      setChartOpacities(opacities);
      console.log(`Loaded chart bounds for ${Object.keys(allBounds).length} airports`);
    }).catch((err) => console.warn('Failed to load chart bounds:', err));
  }, []);

  // Load ATC sectors
  useEffect(() => {
    fetch('/atc_sectors.json')
      .then((res) => res.json())
      .then((data) => setAtcData(data))
      .catch((err) => console.warn('Failed to load ATC sectors:', err));
  }, []);

  // Load Korea airspace data
  useEffect(() => {
    fetch('/data/korea_airspace.json')
      .then((res) => res.json())
      .then((data: KoreaAirspaceData) => {
        setKoreaAirspaceData(data);
        console.log(`Loaded Korea airspace: ${data.waypoints?.length} waypoints, ${data.routes?.length} routes, ${data.navaids?.length} navaids, ${data.airspaces?.length} airspaces (AIRAC ${data.metadata?.airac})`);
      })
      .catch((err) => console.warn('Failed to load Korea airspace data:', err));
  }, []);

  return {
    data,
    sidVisible,
    setSidVisible,
    starVisible,
    setStarVisible,
    apchVisible,
    setApchVisible,
    procColors,
    chartBounds,
    allChartBounds,
    chartOpacities,
    setChartOpacities,
    atcData,
    koreaAirspaceData,
  };
}

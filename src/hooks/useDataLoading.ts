import { useState, useEffect } from 'react';
import { generateColor } from '../utils/colors';
import { logger } from '../utils/logger';

// ============================================
// 항공 데이터 타입 정의
// ============================================

export interface Waypoint {
  name: string;
  lat: number;
  lon: number;
  type?: string;
}

export interface Obstacle {
  name?: string;
  lat: number;
  lon: number;
  elevation_ft: number;
  type?: string;
}

export interface ProcedurePoint {
  name: string;
  lat: number;
  lon: number;
  alt_restriction?: string;
  speed_restriction?: string;
}

export interface Procedure {
  name: string;
  runway?: string;
  type: 'SID' | 'STAR' | 'APPROACH';
  points: ProcedurePoint[];
}

export interface AviationData {
  procedures?: {
    SID?: Record<string, Procedure>;
    STAR?: Record<string, Procedure>;
    APPROACH?: Record<string, Procedure>;
  };
  waypoints?: Waypoint[];
  obstacles?: Obstacle[];
  airspace?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ProcColors {
  SID: Record<string, string>;
  STAR: Record<string, string>;
  APPROACH: Record<string, string>;
}

// ============================================
// 한국 공역 데이터 타입 정의
// ============================================

export interface KoreaWaypoint {
  name: string;
  lat: number;
  lon: number;
  type: string;
}

export interface KoreaNavaid {
  ident: string;
  name: string;
  type: string;
  lat: number;
  lon: number;
  freq_mhz: string | null;
}

export interface RoutePoint {
  name: string;
  full_name?: string;
  lat: number;
  lon: number;
  mea_ft?: number;
}

export interface KoreaRoute {
  name: string;
  type: string;
  points: RoutePoint[];
}

export interface KoreaAirspace {
  name: string;
  type: string;
  category: string;
  boundary: [number, number][]; // [lon, lat][]
  lower_limit_ft?: number;
  upper_limit_ft?: number;
}

export interface KoreaAirspaceMetadata {
  source?: string;
  airac?: string;
  extracted?: string;
  url?: string;
  navigraph_cycle?: string;
  navigraph_db?: string;
  airports_count?: number;
  navaids_count?: number;
  waypoints_count?: number;
  routes_count?: number;
  airspaces_count?: number;
  gates_count?: number;
  sids_count?: number;
  stars_count?: number;
  iaps_count?: number;
  holdings_count?: number;
  msa_count?: number;
  markers_count?: number;
  terminal_waypoints_count?: number;
  frequencies_count?: number;
  enroute_comms_count?: number;
}

export interface KoreaRunway {
  id: string;
  lat: number;
  lon: number;
  length_m: number;
  width_m: number;
  heading_mag: number | null;
  heading_true: number | null;
  elevation_ft: number;
  surface: string;
  lights: boolean;
  ils_ident: string | null;
  ils_cat: string | null;
}

export interface KoreaILS {
  runway: string;
  ident: string;
  freq: string;
  category: string;
  course: number | null;
  gs_angle: number;
  gs_elev: number;
  llz_lat: number;
  llz_lon: number;
  gs_lat: number;
  gs_lon: number;
}

export interface KoreaComm {
  type: string;
  callsign: string;
  freq: string;
}

export interface KoreaAirport {
  icao: string;
  iata: string | null;
  name: string;
  city: string;
  lat: number;
  lon: number;
  elevation_ft: number;
  mag_var: number;
  transition_alt: number;
  transition_level: number;
  type: 'civil' | 'military' | 'joint';
  ifr: boolean;
  runways: KoreaRunway[];
  ils: KoreaILS[];
  comms: KoreaComm[];
  gates?: KoreaGate[];
  frequencies?: KoreaFrequency[];
}

export interface KoreaGate {
  id: string;
  name: string | null;
  lat: number;
  lon: number;
}

export interface KoreaFrequency {
  type: string;
  freq: number;
  callsign: string | null;
  sector: string | null;
}

export interface KoreaHolding {
  waypoint: string;
  name: string;
  lat: number;
  lon: number;
  inbound_course: number;
  turn: string;
  leg_time: number | null;
  leg_length: number | null;
  speed: number | null;
  min_alt: number | null;
  max_alt: number | null;
}

export interface KoreaEnrouteComm {
  type: string;
  callsign: string;
  freq: number;
  fir: string;
  lat: number;
  lon: number;
}

export interface KoreaProcedureLeg {
  seq: number;
  wpt: string | null;
  path: string | null;
  course: number | null;
  dist: number | null;
  alt_desc: string | null;
  alt1: number | null;
  alt2: number | null;
  spd_lim: number | null;
  turn: string | null;
}

export interface KoreaProcedures {
  sids: Record<string, Record<string, KoreaProcedureLeg[]>>;
  stars: Record<string, Record<string, KoreaProcedureLeg[]>>;
  iaps: Record<string, Record<string, KoreaProcedureLeg[]>>;
}

export interface KoreaMSASector {
  bearing: number;
  altitude: number;
}

export interface KoreaMSA {
  airport: string;
  center: string;
  radius: number;
  sectors: KoreaMSASector[];
}

export interface KoreaMarker {
  airport: string;
  runway: string;
  llz: string;
  type: string;
  id: string | null;
  lat: number;
  lon: number;
}

export interface KoreaTerminalWaypoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
  type: string;
  region: string;
}

export interface KoreaAirspaceData {
  waypoints?: KoreaWaypoint[];
  routes?: KoreaRoute[];
  navaids?: KoreaNavaid[];
  airspaces?: KoreaAirspace[];
  airports?: KoreaAirport[];
  holdings?: KoreaHolding[];
  enrouteComms?: KoreaEnrouteComm[];
  procedures?: KoreaProcedures;
  msa?: KoreaMSA[];
  markers?: KoreaMarker[];
  terminalWaypoints?: KoreaTerminalWaypoint[];
  metadata?: KoreaAirspaceMetadata;
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
        logger.debug('DataLoading', `Merged ${Object.keys(rkpuCharts).length} manual RKPU charts`);
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
      logger.debug('DataLoading', `Loaded chart bounds for ${Object.keys(allBounds).length} airports`);
    }).catch((err) => logger.warn('DataLoading', 'Failed to load chart bounds', { error: (err as Error).message }));
  }, []);

  // Load ATC sectors
  useEffect(() => {
    fetch('/atc_sectors.json')
      .then((res) => res.json())
      .then((data) => setAtcData(data))
      .catch((err) => logger.warn('DataLoading', 'Failed to load ATC sectors', { error: (err as Error).message }));
  }, []);

  // Load Korea airspace data
  useEffect(() => {
    fetch('/data/korea_airspace.json')
      .then((res) => res.json())
      .then((data: KoreaAirspaceData) => {
        setKoreaAirspaceData(data);
        const m = data.metadata;
        logger.info('DataLoading', `Loaded Korea airspace: ${data.airports?.length || 0} airports, ${data.waypoints?.length} waypoints, ${data.routes?.length} routes, ${data.navaids?.length} navaids, ${data.airspaces?.length} airspaces, ${data.holdings?.length || 0} holdings, ${m?.sids_count || 0} SID legs, ${m?.stars_count || 0} STAR legs, ${m?.iaps_count || 0} IAP legs, ${data.terminalWaypoints?.length || 0} terminal WPTs (AIRAC ${m?.airac}, Navigraph ${m?.navigraph_cycle || 'N/A'})`);
      })
      .catch((err) => logger.warn('DataLoading', 'Failed to load Korea airspace data', { error: (err as Error).message }));
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

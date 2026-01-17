import { useState, useEffect, useCallback, useRef } from 'react';
import { ftToM } from '../utils/geometry';
import { getAircraftApiUrl, getAircraftTraceUrl, AIRCRAFT_UPDATE_INTERVAL } from '../constants/config';
import type { AviationData } from './useDataLoading';

export interface AircraftData {
  hex: string;
  callsign: string;
  type: string;
  category: string;
  lat: number;
  lon: number;
  altitude_ft: number;
  altitude_m: number;
  ground_speed: number;
  track: number;
  on_ground: boolean;
  vertical_rate: number;
  squawk: string;
  emergency: string;
  registration: string;
  icao_type: string;
  operator: string;
  origin: string;
  destination: string;
  nav_altitude: number | null;
  nav_heading: number | null;
  ias: number;
  tas: number;
  mach: number;
  mag_heading: number;
  true_heading: number;
  timestamp: number;
}

export interface TrailPoint {
  lat: number;
  lon: number;
  altitude_m: number;
  altitude_ft?: number;
  timestamp: number;
}

export interface AircraftTrails {
  [hex: string]: TrailPoint[];
}

export interface DataWithAirport extends AviationData {
  airport?: { lat: number; lon: number };
}

export interface UseAircraftDataReturn {
  aircraft: AircraftData[];
  setAircraft: React.Dispatch<React.SetStateAction<AircraftData[]>>;
  aircraftTrails: AircraftTrails;
  setAircraftTrails: React.Dispatch<React.SetStateAction<AircraftTrails>>;
  tracesLoaded: Set<string>;
  setTracesLoaded: React.Dispatch<React.SetStateAction<Set<string>>>;
}

/**
 * useAircraftData - 항공기 데이터 로딩 및 관리 훅
 * - ADS-B 데이터 폴링
 * - 항적 히스토리 로딩
 * - 항공기 상태 관리
 * - 429 에러 시 백오프 처리
 */
export default function useAircraftData(
  data: DataWithAirport | null,
  mapLoaded: boolean,
  showAircraft: boolean,
  trailDuration: number
): UseAircraftDataReturn {
  const [aircraft, setAircraft] = useState<AircraftData[]>([]);
  const [aircraftTrails, setAircraftTrails] = useState<AircraftTrails>({});
  const [tracesLoaded, setTracesLoaded] = useState<Set<string>>(new Set());
  const aircraftIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // tracesLoaded를 ref로도 유지하여 fetchAircraftData의 dependency 순환 방지
  const tracesLoadedRef = useRef<Set<string>>(new Set());
  // 429 에러 백오프
  const backoffRef = useRef<number>(0);
  const lastErrorTimeRef = useRef<number>(0);

  // 개별 항공기의 과거 위치 히스토리 로드
  const loadAircraftTrace = useCallback(async (hex: string): Promise<TrailPoint[] | null> => {
    try {
      const response = await fetch(getAircraftTraceUrl(hex));

      // 429 Too Many Requests 또는 다른 에러 상태 처리
      if (!response.ok) {
        if (response.status === 429) {
          console.warn(`Aircraft trace API 429 for ${hex}: rate limited`);
        }
        return null;
      }

      // Content-Type 확인 (HTML 에러 페이지 감지)
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.warn(`Aircraft trace for ${hex}: invalid content-type (${contentType})`);
        return null;
      }

      // 텍스트로 먼저 읽어서 유효성 검사
      const text = await response.text();
      if (!text || text.length < 2 || text.startsWith('<!') || text.startsWith('You')) {
        console.warn(`Aircraft trace for ${hex}: invalid response (HTML or rate limit message)`);
        return null;
      }

      const result = JSON.parse(text);
      const ac = result.ac?.[0];
      if (!ac || !ac.trace) return null;

      // trace 배열: [timestamp, lat, lon, altitude(feet?), ...]
      const tracePoints: TrailPoint[] = [];
      const now = Date.now();
      ac.trace.forEach((point: number[]) => {
        if (point && point.length >= 4) {
          const timestamp = point[0] * 1000; // 초 -> 밀리초
          if (now - timestamp <= trailDuration) {
            tracePoints.push({
              lat: point[1],
              lon: point[2],
              altitude_m: ftToM(point[3] || 0),
              timestamp
            });
          }
        }
      });
      return tracePoints;
    } catch (e) {
      // JSON 파싱 에러 등을 조용히 처리
      console.warn(`Failed to load trace for ${hex}:`, (e as Error).message);
      return null;
    }
  }, [trailDuration]);

  const fetchAircraftData = useCallback(async () => {
    if (!data?.airport) return;

    // 백오프 중이면 스킵
    if (backoffRef.current > 0 && Date.now() - lastErrorTimeRef.current < backoffRef.current) {
      console.log(`Aircraft API: backing off for ${Math.round(backoffRef.current / 1000)}s`);
      return;
    }

    try {
      const { lat, lon } = data.airport;
      const response = await fetch(getAircraftApiUrl(lat, lon, 100));

      // 429 Too Many Requests 처리
      if (response.status === 429) {
        lastErrorTimeRef.current = Date.now();
        backoffRef.current = Math.min((backoffRef.current || 15000) * 2, 120000); // 최대 2분
        console.warn(`Aircraft API 429: backing off for ${backoffRef.current / 1000}s`);
        return;
      }

      // 성공 시 백오프 리셋
      backoffRef.current = 0;

      const result = await response.json();
      const aircraftData = result.ac || [];

      const processed: AircraftData[] = aircraftData
        .filter((ac: Record<string, unknown>) => ac.lat && ac.lon)
        .map((ac: Record<string, unknown>) => ({
          hex: ac.hex as string,
          callsign: (ac.flight as string)?.trim() || (ac.hex as string),
          type: (ac.t as string) || 'Unknown',
          category: (ac.category as string) || 'A0',
          lat: ac.lat as number,
          lon: ac.lon as number,
          altitude_ft: (ac.alt_baro as number) || (ac.alt_geom as number) || 0,
          altitude_m: ftToM((ac.alt_baro as number) || (ac.alt_geom as number) || 0),
          ground_speed: (ac.gs as number) || 0,
          track: (ac.track as number) || 0,
          on_ground: ac.alt_baro === 'ground' || !!ac.ground,
          vertical_rate: (ac.baro_rate as number) || (ac.geom_rate as number) || 0,
          squawk: (ac.squawk as string) || '',
          emergency: (ac.emergency as string) || '',
          registration: (ac.r as string) || '',
          icao_type: (ac.t as string) || '',
          operator: (ac.ownOp as string) || '',
          origin: (ac.orig as string) || '',
          destination: (ac.dest as string) || '',
          nav_altitude: (ac.nav_altitude_mcp as number) || (ac.nav_altitude_fms as number) || null,
          nav_heading: (ac.nav_heading as number) || null,
          ias: (ac.ias as number) || 0,
          tas: (ac.tas as number) || 0,
          mach: (ac.mach as number) || 0,
          mag_heading: (ac.mag_heading as number) || (ac.track as number) || 0,
          true_heading: (ac.true_heading as number) || (ac.track as number) || 0,
          timestamp: Date.now(),
        }));

      // 새로운 항공기들의 trace 로드 (이미 로드한 항공기 제외)
      const newAircraft = processed.filter(ac => !tracesLoadedRef.current.has(ac.hex) && !ac.on_ground);
      if (newAircraft.length > 0) {
        // 처음 로드 시에도 5개로 제한 (외부 접속 성능 최적화)
        const isFirstLoad = tracesLoadedRef.current.size === 0;
        const maxLoad = isFirstLoad ? 5 : 3;
        const toLoad = newAircraft.slice(0, maxLoad);

        // 병렬로 trace 로드 (처음에는 모두, 이후에는 일부)
        const tracePromises = toLoad.map(ac => loadAircraftTrace(ac.hex).then(trace => ({ hex: ac.hex, trace })));
        const traces = await Promise.all(tracePromises);

        // ref와 state 모두 업데이트 (ref는 fetchAircraftData 내부용, state는 외부 노출용)
        toLoad.forEach(ac => tracesLoadedRef.current.add(ac.hex));
        setTracesLoaded(prev => {
          const next = new Set(prev);
          toLoad.forEach(ac => next.add(ac.hex));
          return next;
        });

        setAircraftTrails(prev => {
          const trails = { ...prev };
          traces.forEach(({ hex, trace }) => {
            if (trace && trace.length > 0) {
              trails[hex] = trace;
            }
          });
          return trails;
        });
      }

      setAircraftTrails(prev => {
        const trails = { ...prev };
        processed.forEach(ac => {
          if (!trails[ac.hex]) trails[ac.hex] = [];
          const trail = trails[ac.hex];
          const last = trail[trail.length - 1];
          if (!last || last.lat !== ac.lat || last.lon !== ac.lon) {
            trail.push({ lat: ac.lat, lon: ac.lon, altitude_m: ac.altitude_m, altitude_ft: ac.altitude_ft, timestamp: ac.timestamp });
          }
          while (trail.length > 0 && Date.now() - trail[0].timestamp > trailDuration) trail.shift();
        });
        const activeHexes = new Set(processed.map(ac => ac.hex));
        Object.keys(trails).forEach(hex => { if (!activeHexes.has(hex)) delete trails[hex]; });
        return trails;
      });
      setAircraft(processed);
    } catch (e) { console.error('Aircraft fetch failed:', e); }
  }, [data?.airport, trailDuration, loadAircraftTrace]);

  useEffect(() => {
    if (!showAircraft || !data?.airport || !mapLoaded) return;
    fetchAircraftData();
    aircraftIntervalRef.current = setInterval(fetchAircraftData, AIRCRAFT_UPDATE_INTERVAL);
    return () => {
      if (aircraftIntervalRef.current) clearInterval(aircraftIntervalRef.current);
    };
  }, [showAircraft, data?.airport, mapLoaded, fetchAircraftData]);

  return {
    aircraft,
    setAircraft,
    aircraftTrails,
    setAircraftTrails,
    tracesLoaded,
    setTracesLoaded
  };
}

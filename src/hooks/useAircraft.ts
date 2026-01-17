/**
 * useAircraft Hook
 * 항공기 데이터 페칭, 추적 및 트레일 관리
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import {
  AIRCRAFT_UPDATE_INTERVAL,
  getAircraftApiUrl,
  getAircraftTraceUrl,
  TRAIL_DURATION_OPTIONS,
  DEFAULT_TRAIL_DURATION,
} from '../constants/config';
import { ftToM } from '../utils/geometry';

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

export interface LabelOffset {
  x: number;
  y: number;
}

export interface AirportInfo {
  lat: number;
  lon: number;
}

export interface UseAircraftOptions {
  airport?: AirportInfo | null;
  enabled?: boolean;
  mapLoaded?: boolean;
}

export interface UseAircraftReturn {
  showAircraft: boolean;
  setShowAircraft: React.Dispatch<React.SetStateAction<boolean>>;
  showAircraftTrails: boolean;
  setShowAircraftTrails: React.Dispatch<React.SetStateAction<boolean>>;
  show3DAircraft: boolean;
  setShow3DAircraft: React.Dispatch<React.SetStateAction<boolean>>;
  aircraft: AircraftData[];
  aircraftTrails: AircraftTrails;
  selectedAircraft: AircraftData | null;
  followedAircraft: string | null;
  selectAircraft: (ac: AircraftData | null) => void;
  followAircraft: (hex: string) => void;
  unfollowAircraft: () => void;
  trailDuration: number;
  setTrailDuration: React.Dispatch<React.SetStateAction<number>>;
  headingPrediction: number;
  setHeadingPrediction: React.Dispatch<React.SetStateAction<number>>;
  labelOffset: LabelOffset;
  setLabelOffset: React.Dispatch<React.SetStateAction<LabelOffset>>;
  isDraggingLabel: boolean;
  setIsDraggingLabel: React.Dispatch<React.SetStateAction<boolean>>;
  handleLabelDrag: (e: MouseEvent, rect: DOMRect) => void;
  TRAIL_DURATION_OPTIONS: typeof TRAIL_DURATION_OPTIONS;
  fetchAircraftData: () => Promise<void>;
  loadAircraftTrace: (hex: string) => Promise<TrailPoint[] | null>;
}

/**
 * 항공기 데이터 관리 훅
 */
export const useAircraft = (options: UseAircraftOptions = {}): UseAircraftReturn => {
  const { airport = null, enabled = true, mapLoaded = false } = options;

  // 항공기 표시 상태
  const [showAircraft, setShowAircraft] = useState(true);
  const [showAircraftTrails, setShowAircraftTrails] = useState(true);
  const [show3DAircraft, setShow3DAircraft] = useState(true);

  // 항공기 데이터
  const [aircraft, setAircraft] = useState<AircraftData[]>([]);
  const [aircraftTrails, setAircraftTrails] = useState<AircraftTrails>({});
  const [tracesLoaded, setTracesLoaded] = useState<Set<string>>(new Set());
  const [selectedAircraft, setSelectedAircraft] = useState<AircraftData | null>(null);
  const [followedAircraft, setFollowedAircraft] = useState<string | null>(null);

  // 트레일 설정
  const [trailDuration, setTrailDuration] = useState(DEFAULT_TRAIL_DURATION);
  const [headingPrediction, setHeadingPrediction] = useState(0);
  const [labelOffset, setLabelOffset] = useState<LabelOffset>({ x: 0, y: 0 });
  const [isDraggingLabel, setIsDraggingLabel] = useState(false);

  // Refs
  const aircraftIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * 개별 항공기의 과거 위치 히스토리 로드
   */
  const loadAircraftTrace = useCallback(async (hex: string): Promise<TrailPoint[] | null> => {
    try {
      const response = await fetch(getAircraftTraceUrl(hex));
      const result = await response.json();
      const ac = result.ac?.[0];
      if (!ac || !ac.trace) return null;

      const tracePoints: TrailPoint[] = [];
      const now = Date.now();
      ac.trace.forEach((point: number[]) => {
        if (point && point.length >= 4) {
          const timestamp = point[0] * 1000;
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
      console.error(`Failed to load trace for ${hex}:`, e);
      return null;
    }
  }, [trailDuration]);

  /**
   * 항공기 데이터 가져오기
   */
  const fetchAircraftData = useCallback(async (): Promise<void> => {
    if (!airport) return;

    try {
      const { lat, lon } = airport;
      const response = await fetch(getAircraftApiUrl(lat, lon, 100));
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

      // 새로운 항공기들의 trace 로드
      const newAircraft = processed.filter(ac => !tracesLoaded.has(ac.hex) && !ac.on_ground);
      if (newAircraft.length > 0) {
        const isFirstLoad = tracesLoaded.size === 0;
        const maxLoad = isFirstLoad ? newAircraft.length : 10;
        const toLoad = newAircraft.slice(0, maxLoad);

        const tracePromises = toLoad.map(ac =>
          loadAircraftTrace(ac.hex).then(trace => ({ hex: ac.hex, trace }))
        );
        const traces = await Promise.all(tracePromises);

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

      // 트레일 업데이트
      setAircraftTrails(prev => {
        const trails = { ...prev };
        processed.forEach(ac => {
          if (!trails[ac.hex]) trails[ac.hex] = [];
          const trail = trails[ac.hex];
          const last = trail[trail.length - 1];
          if (!last || last.lat !== ac.lat || last.lon !== ac.lon) {
            trail.push({
              lat: ac.lat,
              lon: ac.lon,
              altitude_m: ac.altitude_m,
              altitude_ft: ac.altitude_ft,
              timestamp: ac.timestamp
            });
          }
          while (trail.length > 0 && Date.now() - trail[0].timestamp > trailDuration) {
            trail.shift();
          }
        });
        const activeHexes = new Set(processed.map(ac => ac.hex));
        Object.keys(trails).forEach(hex => {
          if (!activeHexes.has(hex)) delete trails[hex];
        });
        return trails;
      });

      setAircraft(processed);
    } catch (e) {
      console.error('Aircraft fetch failed:', e);
    }
  }, [airport, trailDuration, tracesLoaded, loadAircraftTrace]);

  // 자동 업데이트
  useEffect(() => {
    if (!showAircraft || !airport || !mapLoaded || !enabled) return;

    fetchAircraftData();
    aircraftIntervalRef.current = setInterval(fetchAircraftData, AIRCRAFT_UPDATE_INTERVAL);

    return () => {
      if (aircraftIntervalRef.current) clearInterval(aircraftIntervalRef.current);
    };
  }, [showAircraft, airport, mapLoaded, enabled, fetchAircraftData]);

  /**
   * 항공기 선택
   */
  const selectAircraft = useCallback((ac: AircraftData | null) => {
    setSelectedAircraft(ac);
  }, []);

  /**
   * 항공기 팔로우
   */
  const followAircraft = useCallback((hex: string) => {
    setFollowedAircraft(hex);
  }, []);

  /**
   * 팔로우 해제
   */
  const unfollowAircraft = useCallback(() => {
    setFollowedAircraft(null);
  }, []);

  /**
   * 라벨 드래그 핸들러
   */
  const handleLabelDrag = useCallback((e: MouseEvent, rect: DOMRect) => {
    if (!isDraggingLabel) return;
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 4;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 4;
    setLabelOffset({
      x: Math.max(-2, Math.min(2, x)),
      y: Math.max(-2, Math.min(2, y))
    });
  }, [isDraggingLabel]);

  return {
    showAircraft,
    setShowAircraft,
    showAircraftTrails,
    setShowAircraftTrails,
    show3DAircraft,
    setShow3DAircraft,
    aircraft,
    aircraftTrails,
    selectedAircraft,
    followedAircraft,
    selectAircraft,
    followAircraft,
    unfollowAircraft,
    trailDuration,
    setTrailDuration,
    headingPrediction,
    setHeadingPrediction,
    labelOffset,
    setLabelOffset,
    isDraggingLabel,
    setIsDraggingLabel,
    handleLabelDrag,
    TRAIL_DURATION_OPTIONS,
    fetchAircraftData,
    loadAircraftTrace,
  };
};

export default useAircraft;

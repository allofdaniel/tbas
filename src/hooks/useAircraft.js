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

/**
 * 항공기 데이터 관리 훅
 * @param {Object} options - 옵션
 * @param {Object} options.airport - 공항 정보 { lat, lon }
 * @param {boolean} options.enabled - 활성화 여부
 * @param {boolean} options.mapLoaded - 맵 로드 완료 여부
 * @returns {Object} 항공기 상태 및 함수들
 */
export const useAircraft = (options = {}) => {
  const { airport = null, enabled = true, mapLoaded = false } = options;

  // 항공기 표시 상태
  const [showAircraft, setShowAircraft] = useState(true);
  const [showAircraftTrails, setShowAircraftTrails] = useState(true);
  const [show3DAircraft, setShow3DAircraft] = useState(true);

  // 항공기 데이터
  const [aircraft, setAircraft] = useState([]);
  const [aircraftTrails, setAircraftTrails] = useState({});
  const [tracesLoaded, setTracesLoaded] = useState(new Set());
  const [selectedAircraft, setSelectedAircraft] = useState(null);
  const [followedAircraft, setFollowedAircraft] = useState(null);

  // 트레일 설정
  const [trailDuration, setTrailDuration] = useState(DEFAULT_TRAIL_DURATION);
  const [headingPrediction, setHeadingPrediction] = useState(0);
  const [labelOffset, setLabelOffset] = useState({ x: 0, y: 0 });
  const [isDraggingLabel, setIsDraggingLabel] = useState(false);

  // Refs
  const aircraftIntervalRef = useRef(null);

  /**
   * 개별 항공기의 과거 위치 히스토리 로드
   */
  const loadAircraftTrace = useCallback(async (hex) => {
    try {
      const response = await fetch(getAircraftTraceUrl(hex));
      const result = await response.json();
      const ac = result.ac?.[0];
      if (!ac || !ac.trace) return null;

      const tracePoints = [];
      const now = Date.now();
      ac.trace.forEach(point => {
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
  const fetchAircraftData = useCallback(async () => {
    if (!airport) return;

    try {
      const { lat, lon } = airport;
      const response = await fetch(getAircraftApiUrl(lat, lon, 100));
      const result = await response.json();
      const aircraftData = result.ac || [];

      const processed = aircraftData.filter(ac => ac.lat && ac.lon).map(ac => ({
        hex: ac.hex,
        callsign: ac.flight?.trim() || ac.hex,
        type: ac.t || 'Unknown',
        category: ac.category || 'A0',
        lat: ac.lat,
        lon: ac.lon,
        altitude_ft: ac.alt_baro || ac.alt_geom || 0,
        altitude_m: ftToM(ac.alt_baro || ac.alt_geom || 0),
        ground_speed: ac.gs || 0,
        track: ac.track || 0,
        on_ground: ac.alt_baro === 'ground' || ac.ground,
        vertical_rate: ac.baro_rate || ac.geom_rate || 0,
        squawk: ac.squawk || '',
        emergency: ac.emergency || '',
        registration: ac.r || '',
        icao_type: ac.t || '',
        operator: ac.ownOp || '',
        origin: ac.orig || '',
        destination: ac.dest || '',
        nav_altitude: ac.nav_altitude_mcp || ac.nav_altitude_fms || null,
        nav_heading: ac.nav_heading || null,
        ias: ac.ias || 0,
        tas: ac.tas || 0,
        mach: ac.mach || 0,
        mag_heading: ac.mag_heading || ac.track || 0,
        true_heading: ac.true_heading || ac.track || 0,
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

    return () => clearInterval(aircraftIntervalRef.current);
  }, [showAircraft, airport, mapLoaded, enabled, fetchAircraftData]);

  /**
   * 항공기 선택
   */
  const selectAircraft = useCallback((ac) => {
    setSelectedAircraft(ac);
  }, []);

  /**
   * 항공기 팔로우
   */
  const followAircraft = useCallback((hex) => {
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
  const handleLabelDrag = useCallback((e, rect) => {
    if (!isDraggingLabel) return;
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 4;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 4;
    setLabelOffset({
      x: Math.max(-2, Math.min(2, x)),
      y: Math.max(-2, Math.min(2, y))
    });
  }, [isDraggingLabel]);

  return {
    // 표시 상태
    showAircraft,
    setShowAircraft,
    showAircraftTrails,
    setShowAircraftTrails,
    show3DAircraft,
    setShow3DAircraft,

    // 항공기 데이터
    aircraft,
    aircraftTrails,
    selectedAircraft,
    followedAircraft,

    // 선택/팔로우
    selectAircraft,
    followAircraft,
    unfollowAircraft,

    // 트레일 설정
    trailDuration,
    setTrailDuration,
    headingPrediction,
    setHeadingPrediction,
    labelOffset,
    setLabelOffset,
    isDraggingLabel,
    setIsDraggingLabel,
    handleLabelDrag,

    // 상수
    TRAIL_DURATION_OPTIONS,

    // 함수
    fetchAircraftData,
    loadAircraftTrace,
  };
};

export default useAircraft;

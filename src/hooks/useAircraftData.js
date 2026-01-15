import { useState, useEffect, useCallback, useRef } from 'react';
import { ftToM } from '../utils/geometry';
import { getAircraftApiUrl, getAircraftTraceUrl, AIRCRAFT_UPDATE_INTERVAL } from '../constants/config';

/**
 * useAircraftData - 항공기 데이터 로딩 및 관리 훅
 * - ADS-B 데이터 폴링
 * - 항적 히스토리 로딩
 * - 항공기 상태 관리
 * - 429 에러 시 백오프 처리
 */
export default function useAircraftData(data, mapLoaded, showAircraft, trailDuration) {
  const [aircraft, setAircraft] = useState([]);
  const [aircraftTrails, setAircraftTrails] = useState({});
  const [tracesLoaded, setTracesLoaded] = useState(new Set());
  const aircraftIntervalRef = useRef(null);
  // tracesLoaded를 ref로도 유지하여 fetchAircraftData의 dependency 순환 방지
  const tracesLoadedRef = useRef(new Set());
  // 429 에러 백오프
  const backoffRef = useRef(0);
  const lastErrorTimeRef = useRef(0);

  // 개별 항공기의 과거 위치 히스토리 로드
  const loadAircraftTrace = useCallback(async (hex) => {
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
      const tracePoints = [];
      const now = Date.now();
      ac.trace.forEach(point => {
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
      console.warn(`Failed to load trace for ${hex}:`, e.message);
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

      const processed = aircraftData.filter(ac => ac.lat && ac.lon).map(ac => ({
        hex: ac.hex, callsign: ac.flight?.trim() || ac.hex, type: ac.t || 'Unknown',
        category: ac.category || 'A0', lat: ac.lat, lon: ac.lon,
        altitude_ft: ac.alt_baro || ac.alt_geom || 0, altitude_m: ftToM(ac.alt_baro || ac.alt_geom || 0),
        ground_speed: ac.gs || 0, track: ac.track || 0, on_ground: ac.alt_baro === 'ground' || ac.ground,
        // 추가 ADS-B 정보
        vertical_rate: ac.baro_rate || ac.geom_rate || 0, // ft/min
        squawk: ac.squawk || '',
        emergency: ac.emergency || '',
        registration: ac.r || '',
        icao_type: ac.t || '',
        operator: ac.ownOp || '',
        origin: ac.orig || '', // 출발 공항 (있으면)
        destination: ac.dest || '', // 도착 공항 (있으면)
        nav_altitude: ac.nav_altitude_mcp || ac.nav_altitude_fms || null,
        nav_heading: ac.nav_heading || null,
        ias: ac.ias || 0, // indicated airspeed
        tas: ac.tas || 0, // true airspeed
        mach: ac.mach || 0,
        mag_heading: ac.mag_heading || ac.track || 0,
        true_heading: ac.true_heading || ac.track || 0,
        timestamp: Date.now(),
      }));

      // 새로운 항공기들의 trace 로드 (이미 로드한 항공기 제외)
      // 새로고침 시 모든 비행중인 항공기의 이전 항적을 로드
      // tracesLoadedRef를 사용하여 dependency 순환 방지
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
    // tracesLoaded를 dependency에서 제거 (tracesLoadedRef 사용으로 interval 재시작 루프 방지)
  }, [data?.airport, trailDuration, loadAircraftTrace]);

  useEffect(() => {
    if (!showAircraft || !data?.airport || !mapLoaded) return;
    fetchAircraftData();
    aircraftIntervalRef.current = setInterval(fetchAircraftData, AIRCRAFT_UPDATE_INTERVAL);
    return () => clearInterval(aircraftIntervalRef.current);
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

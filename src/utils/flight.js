/**
 * Flight Utility Functions
 * 비행 관련 유틸리티 함수 모음
 */

import { isPointInPolygon } from './geometry';

/**
 * 비행 단계 감지
 * @param {Object} aircraft - 항공기 객체
 * @param {Object} airportData - 공항 데이터 { lat, lon }
 * @returns {Object} { phase, phase_kr, color, icon }
 */
export const detectFlightPhase = (aircraft, airportData) => {
  if (!aircraft) return { phase: 'unknown', phase_kr: '알 수 없음', color: '#9E9E9E' };

  const alt = aircraft.altitude_ft || 0;
  const gs = aircraft.ground_speed || 0;
  const vs = aircraft.vertical_rate || 0;
  const onGround = aircraft.on_ground;

  // 공항 좌표 (기본값: RKPU)
  const airportLat = airportData?.lat || 35.5934;
  const airportLon = airportData?.lon || 129.3518;

  // 공항과의 거리 계산 (NM)
  const distToAirport = Math.sqrt(
    Math.pow((aircraft.lat - airportLat) * 60, 2) +
    Math.pow((aircraft.lon - airportLon) * 60 * Math.cos(airportLat * Math.PI / 180), 2)
  );

  // 비행 단계 판정
  if (onGround || (alt < 100 && gs < 30)) {
    return { phase: 'ground', phase_kr: '지상', color: '#9E9E9E', icon: '🛬' };
  }

  if (alt < 500 && vs > 300 && gs > 60) {
    return { phase: 'takeoff', phase_kr: '이륙', color: '#4CAF50', icon: '🛫' };
  }

  if (alt < 500 && vs < -300 && gs > 60 && distToAirport < 5) {
    return { phase: 'landing', phase_kr: '착륙', color: '#FF9800', icon: '🛬' };
  }

  if (alt < 10000 && vs > 200 && distToAirport < 30) {
    return { phase: 'departure', phase_kr: '출발', color: '#8BC34A', icon: '↗️' };
  }

  if (alt < 10000 && vs < -200 && distToAirport < 30) {
    return { phase: 'approach', phase_kr: '접근', color: '#FF5722', icon: '↘️' };
  }

  if (alt >= 10000 || distToAirport > 30) {
    if (Math.abs(vs) < 300) {
      return { phase: 'cruise', phase_kr: '순항', color: '#2196F3', icon: '✈️' };
    } else if (vs > 0) {
      return { phase: 'climb', phase_kr: '상승', color: '#03A9F4', icon: '↗️' };
    } else {
      return { phase: 'descent', phase_kr: '강하', color: '#00BCD4', icon: '↘️' };
    }
  }

  return { phase: 'enroute', phase_kr: '비행중', color: '#2196F3', icon: '✈️' };
};

/**
 * 섹터 내 포함 여부 확인
 * @param {Object} sector - 섹터 객체
 * @param {Array} point - [lon, lat]
 * @param {number} alt - 고도
 * @returns {boolean}
 */
const checkSectorContains = (sector, point, alt) => {
  if (!sector?.coordinates) return false;

  // Check altitude limits
  const floor = sector.floor_ft || 0;
  const ceiling = sector.ceiling_ft || 60000;
  if (alt < floor || alt > ceiling) return false;

  // Check if point is in polygon
  const coords = sector.coordinates;
  if (coords.length === 0) return false;

  // Handle nested polygon format [[[ ]]]
  const polygon = Array.isArray(coords[0][0]) ? coords[0] : coords;
  return isPointInPolygon(point, polygon);
};

/**
 * 현재 공역 감지
 * @param {Object} aircraft - 항공기 객체
 * @param {Object} atcSectors - ATC 섹터 데이터
 * @returns {Array} 현재 위치한 공역 목록
 */
export const detectCurrentAirspace = (aircraft, atcSectors) => {
  if (!aircraft || !atcSectors) return [];

  const results = [];
  const alt = aircraft.altitude_ft || 0;
  const point = [aircraft.lon, aircraft.lat];

  // Check each sector type
  ['CTR', 'TMA', 'ACC', 'FIR'].forEach(sectorType => {
    const sectors = atcSectors[sectorType];
    if (!sectors) return;

    const sectorList = Array.isArray(sectors) ? sectors : [sectors];

    sectorList.forEach(sector => {
      if (!sector) return;

      // For nested arrays (like ACC which has multiple sub-sectors)
      if (Array.isArray(sector) && sector[0]?.coordinates) {
        sector.forEach(subSector => {
          if (checkSectorContains(subSector, point, alt)) {
            results.push({
              type: sectorType,
              ...subSector
            });
          }
        });
      } else if (sector.coordinates) {
        if (checkSectorContains(sector, point, alt)) {
          results.push({
            type: sectorType,
            ...sector
          });
        }
      }
    });
  });

  return results;
};

/**
 * 가장 가까운 Waypoint 찾기
 * @param {Object} aircraft - 항공기 객체
 * @param {Array} waypoints - Waypoint 배열
 * @param {number} limit - 반환할 최대 개수
 * @returns {Array} 가장 가까운 waypoint들
 */
export const findNearestWaypoints = (aircraft, waypoints, limit = 5) => {
  if (!aircraft || !waypoints) return [];

  const results = waypoints.map(wp => {
    const dist = Math.sqrt(
      Math.pow((wp.lat - aircraft.lat) * 60, 2) +
      Math.pow((wp.lon - aircraft.lon) * 60 * Math.cos(aircraft.lat * Math.PI / 180), 2)
    );

    // 진행 방향 기준으로 앞에 있는지 확인
    const bearing = Math.atan2(
      (wp.lon - aircraft.lon) * Math.cos(aircraft.lat * Math.PI / 180),
      wp.lat - aircraft.lat
    ) * 180 / Math.PI;

    const trackDiff = Math.abs(((bearing - (aircraft.track || 0) + 180) % 360) - 180);
    const isAhead = trackDiff < 90;

    // 예상 도착 시간 계산 (분)
    const gs = aircraft.ground_speed || 200; // knots
    const etaMinutes = gs > 0 ? (dist / gs) * 60 : null;

    return {
      ...wp,
      distance_nm: dist,
      isAhead,
      etaMinutes,
      bearing
    };
  })
  .filter(wp => wp.isAhead && wp.distance_nm < 100) // 100NM 이내, 진행방향
  .sort((a, b) => a.distance_nm - b.distance_nm)
  .slice(0, limit);

  return results;
};

/**
 * 현재 절차(SID/STAR/APCH) 감지
 * @param {Object} aircraft - 항공기 객체
 * @param {Object} procedures - 절차 데이터
 * @param {string} flightPhase - 현재 비행 단계
 * @returns {Object|null} 가장 가까운 절차 정보
 */
export const detectCurrentProcedure = (aircraft, procedures, flightPhase) => {
  if (!aircraft || !procedures) return null;

  const alt = aircraft.altitude_ft || 0;

  // 비행 단계에 따라 확인할 절차 유형 결정
  let procedureTypes = [];
  if (flightPhase === 'departure' || flightPhase === 'takeoff') {
    procedureTypes = ['SID'];
  } else if (flightPhase === 'approach' || flightPhase === 'landing') {
    procedureTypes = ['APPROACH', 'STAR'];
  } else {
    procedureTypes = ['SID', 'STAR', 'APPROACH'];
  }

  let closestProcedure = null;
  let minDistance = Infinity;

  procedureTypes.forEach(type => {
    const procs = procedures[type];
    if (!procs) return;

    Object.entries(procs).forEach(([name, proc]) => {
      if (!proc.segments) return;

      proc.segments.forEach(segment => {
        if (!segment.coordinates) return;

        // 세그먼트의 각 점과의 거리 확인
        segment.coordinates.forEach(coord => {
          const dist = Math.sqrt(
            Math.pow((coord[1] - aircraft.lat) * 60, 2) +
            Math.pow((coord[0] - aircraft.lon) * 60 * Math.cos(aircraft.lat * Math.PI / 180), 2)
          );

          if (dist < minDistance && dist < 3) { // 3NM 이내
            minDistance = dist;
            closestProcedure = {
              type,
              name: proc.display_name || name,
              segment: segment.segment_name,
              distance_nm: dist
            };
          }
        });
      });
    });
  });

  return closestProcedure;
};

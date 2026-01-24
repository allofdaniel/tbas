/**
 * Flight Utility Functions
 * 비행 관련 유틸리티 함수 모음
 */

import { isPointInPolygon, calculateDistance, calculateBearing, mToNm, type Coordinate, type PolygonCoordinates } from './geometry';

export interface Aircraft {
  lat: number;
  lon: number;
  altitude_ft?: number;
  ground_speed?: number;
  vertical_rate?: number;
  on_ground?: boolean;
  track?: number;
  [key: string]: unknown;
}

export interface AirportData {
  lat?: number;
  lon?: number;
}

export interface FlightPhase {
  phase: string;
  phase_kr: string;
  color: string;
  icon?: string;
}

export interface Sector {
  coordinates?: PolygonCoordinates | PolygonCoordinates[];
  floor_ft?: number;
  ceiling_ft?: number;
  name?: string;
  [key: string]: unknown;
}

export interface AtcSectors {
  CTR?: Sector | Sector[];
  TMA?: Sector | Sector[];
  ACC?: Sector | Sector[];
  FIR?: Sector | Sector[];
  [key: string]: Sector | Sector[] | undefined;
}

export interface Waypoint {
  lat: number;
  lon: number;
  name?: string;
  [key: string]: unknown;
}

export interface NearestWaypoint extends Waypoint {
  distance_nm: number;
  isAhead: boolean;
  etaMinutes: number | null;
  bearing: number;
}

export interface ProcedureSegment {
  segment_name?: string;
  coordinates?: Coordinate[];
  [key: string]: unknown;
}

export interface Procedure {
  display_name?: string;
  segments?: ProcedureSegment[];
  [key: string]: unknown;
}

export interface Procedures {
  SID?: Record<string, Procedure>;
  STAR?: Record<string, Procedure>;
  APPROACH?: Record<string, Procedure>;
  [key: string]: Record<string, Procedure> | undefined;
}

export interface DetectedProcedure {
  type: string;
  name: string;
  segment?: string;
  distance_nm: number;
}

/**
 * 비행 단계 감지
 */
export const detectFlightPhase = (aircraft: Aircraft | null | undefined, airportData?: AirportData): FlightPhase => {
  if (!aircraft) return { phase: 'unknown', phase_kr: '알 수 없음', color: '#9E9E9E' };

  const alt = aircraft.altitude_ft || 0;
  const gs = aircraft.ground_speed || 0;
  const vs = aircraft.vertical_rate || 0;
  const onGround = aircraft.on_ground;

  // 공항 좌표 (기본값: RKPU)
  const airportLat = airportData?.lat || 35.5934;
  const airportLon = airportData?.lon || 129.3518;

  // 공항과의 거리 계산 (NM) - Haversine 공식 사용
  const distToAirportMeters = calculateDistance(aircraft.lat, aircraft.lon, airportLat, airportLon);
  const distToAirport = mToNm(distToAirportMeters);

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
 */
const checkSectorContains = (sector: Sector, point: Coordinate, alt: number): boolean => {
  if (!sector?.coordinates) return false;

  // Check altitude limits
  const floor = sector.floor_ft || 0;
  const ceiling = sector.ceiling_ft || 60000;
  if (alt < floor || alt > ceiling) return false;

  // Check if point is in polygon
  const coords = sector.coordinates;
  if (!Array.isArray(coords) || coords.length === 0) return false;

  // Handle nested polygon format [[[ ]]]
  const polygon = Array.isArray(coords[0]) && Array.isArray((coords[0] as unknown[])[0])
    ? (coords[0] as PolygonCoordinates)
    : (coords as PolygonCoordinates);
  return isPointInPolygon(point, polygon);
};

interface AirspaceResult extends Sector {
  type: string;
}

/**
 * 현재 공역 감지
 */
export const detectCurrentAirspace = (
  aircraft: Aircraft | null | undefined,
  atcSectors: AtcSectors | null | undefined
): AirspaceResult[] => {
  if (!aircraft || !atcSectors) return [];

  const results: AirspaceResult[] = [];
  const alt = aircraft.altitude_ft || 0;
  const point: Coordinate = [aircraft.lon, aircraft.lat];

  // Check each sector type
  (['CTR', 'TMA', 'ACC', 'FIR'] as const).forEach(sectorType => {
    const sectors = atcSectors[sectorType];
    if (!sectors) return;

    const sectorList = Array.isArray(sectors) ? sectors : [sectors];

    sectorList.forEach(sector => {
      if (!sector) return;

      // For nested arrays (like ACC which has multiple sub-sectors)
      if (Array.isArray(sector) && (sector as Sector[])[0]?.coordinates) {
        (sector as Sector[]).forEach(subSector => {
          if (checkSectorContains(subSector, point, alt)) {
            results.push({
              type: sectorType,
              ...subSector
            });
          }
        });
      } else if ((sector as Sector).coordinates) {
        if (checkSectorContains(sector as Sector, point, alt)) {
          results.push({
            type: sectorType,
            ...(sector as Sector)
          });
        }
      }
    });
  });

  return results;
};

/**
 * 가장 가까운 Waypoint 찾기
 */
export const findNearestWaypoints = (
  aircraft: Aircraft | null | undefined,
  waypoints: Waypoint[] | null | undefined,
  limit: number = 5
): NearestWaypoint[] => {
  if (!aircraft || !waypoints) return [];

  const results = waypoints.map(wp => {
    // Haversine 공식으로 정확한 거리 계산 (미터 -> NM)
    const distMeters = calculateDistance(aircraft.lat, aircraft.lon, wp.lat, wp.lon);
    const dist = mToNm(distMeters);

    // 정확한 방위각 계산 (geometry.ts의 calculateBearing 사용)
    const bearing = calculateBearing(aircraft.lat, aircraft.lon, wp.lat, wp.lon);

    // 진행 방향 기준으로 앞에 있는지 확인
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
 */
export const detectCurrentProcedure = (
  aircraft: Aircraft | null | undefined,
  procedures: Procedures | null | undefined,
  flightPhase: string
): DetectedProcedure | null => {
  if (!aircraft || !procedures) return null;

  // 비행 단계에 따라 확인할 절차 유형 결정
  let procedureTypes: string[] = [];
  if (flightPhase === 'departure' || flightPhase === 'takeoff') {
    procedureTypes = ['SID'];
  } else if (flightPhase === 'approach' || flightPhase === 'landing') {
    procedureTypes = ['APPROACH', 'STAR'];
  } else {
    procedureTypes = ['SID', 'STAR', 'APPROACH'];
  }

  let closestProcedure: DetectedProcedure | null = null;
  let minDistance = Infinity;

  procedureTypes.forEach(type => {
    const procs = procedures[type];
    if (!procs) return;

    Object.entries(procs).forEach(([name, proc]) => {
      if (!proc.segments) return;

      proc.segments.forEach(segment => {
        if (!segment.coordinates) return;

        // 세그먼트의 각 점과의 거리 확인 (Haversine 공식 사용)
        segment.coordinates.forEach(coord => {
          const distMeters = calculateDistance(aircraft.lat, aircraft.lon, coord[1], coord[0]);
          const dist = mToNm(distMeters);

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

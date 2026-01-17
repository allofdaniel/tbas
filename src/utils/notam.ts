/**
 * NOTAM Utility Functions
 * NOTAM 관련 유틸리티 함수 모음
 */

import { parseNotamDateString } from './format';
import { AIRPORT_COORDINATES } from '../constants/airports';

export interface NotamCoordinates {
  lat: number;
  lon: number;
  radiusNM: number;
  lowerAlt: number;
  upperAlt: number;
}

export interface Notam {
  notam_number?: string;
  full_text?: string;
  location?: string;
  effective_start?: string;
  effective_end?: string;
  [key: string]: unknown;
}

export type NotamValidity = 'active' | 'future' | false;

/**
 * NOTAM Q-line 좌표 파싱
 */
export const parseNotamCoordinates = (fullText: string | null | undefined): NotamCoordinates | null => {
  if (!fullText) return null;
  // Q-line format: Q) FIR/QCODE/TRAFFIC/PURPOSE/SCOPE/LOWER/UPPER/COORD
  const qLineMatch = fullText.match(/Q\)\s*\S+\/\S+\/\S+\/\S+\/\S+\/(\d{3})\/(\d{3})\/(\d{4})([NS])(\d{5})([EW])(\d{3})/);
  if (!qLineMatch) return null;

  const [, lowerAlt, upperAlt, latDeg, latDir, lonDeg, lonDir, radiusNM] = qLineMatch;

  // Parse latitude: DDMM format
  const latDegrees = parseInt(latDeg.substring(0, 2), 10);
  const latMinutes = parseInt(latDeg.substring(2, 4), 10);
  let lat = latDegrees + latMinutes / 60;
  if (latDir === 'S') lat = -lat;

  // Parse longitude: DDDMM format
  const lonDegrees = parseInt(lonDeg.substring(0, 3), 10);
  const lonMinutes = parseInt(lonDeg.substring(3, 5), 10);
  let lon = lonDegrees + lonMinutes / 60;
  if (lonDir === 'W') lon = -lon;

  return {
    lat,
    lon,
    radiusNM: parseInt(radiusNM, 10),
    lowerAlt: parseInt(lowerAlt, 10) * 100, // FL to feet
    upperAlt: parseInt(upperAlt, 10) * 100,
  };
};

/**
 * NOTAM 표시 좌표 가져오기
 * Q-line 우선, 직접 좌표 필드, 없으면 공항 좌표 사용
 */
export const getNotamDisplayCoords = (notam: Notam): NotamCoordinates | null => {
  // First try to parse from Q-line
  const qCoords = parseNotamCoordinates(notam.full_text);
  if (qCoords) return qCoords;

  // Check for direct q_lat/q_lon fields (from local demo data)
  const qLat = notam.q_lat as number | undefined;
  const qLon = notam.q_lon as number | undefined;
  if (qLat !== undefined && qLon !== undefined) {
    return {
      lat: qLat,
      lon: qLon,
      radiusNM: (notam.q_radius as number) || 5,
      lowerAlt: 0,
      upperAlt: 5000,
    };
  }

  // Fallback: use airport coordinates from database
  const airportCoords = notam.location ? AIRPORT_COORDINATES[notam.location] : null;
  if (airportCoords) {
    return {
      lat: airportCoords.lat,
      lon: airportCoords.lon,
      radiusNM: 5, // Default 5 NM radius for airport NOTAMs
      lowerAlt: 0,
      upperAlt: 5000, // Default 5000 ft
    };
  }

  return null;
};

/**
 * NOTAM 타입 파싱 (N=New, R=Replace, C=Cancel)
 */
export const getNotamType = (fullText: string | null | undefined): 'N' | 'R' | 'C' => {
  if (!fullText) return 'N';
  // Look for NOTAMN, NOTAMR, NOTAMC in the text
  if (fullText.includes('NOTAMC')) return 'C'; // Cancel - cancels another NOTAM
  if (fullText.includes('NOTAMR')) return 'R'; // Replace - replaces another NOTAM
  return 'N'; // New - default
};

/**
 * 취소/교체된 NOTAM 참조 추출
 */
export const getCancelledNotamRef = (fullText: string | null | undefined): string | null => {
  if (!fullText) return null;
  // Pattern: NOTAMC or NOTAMR followed by the reference (e.g., "NOTAMC A1045/24")
  const match = fullText.match(/NOTAM[CR]\s+([A-Z]\d{4}\/\d{2})/);
  return match ? match[1] : null;
};

interface ExtractedDates {
  start: Date | null;
  end: Date | null;
}

/**
 * NOTAM 전문에서 시작/종료 날짜 추출
 */
export const extractDatesFromFullText = (fullText: string | null | undefined): ExtractedDates => {
  if (!fullText) return { start: null, end: null };

  // Item B: start date B) YYMMDDHHMM
  const startMatch = fullText.match(/B\)\s*(\d{10})/);
  const start = startMatch ? parseNotamDateString(startMatch[1]) : null;

  // Item C: end date C) YYMMDDHHMM or PERM or EST
  const endMatch = fullText.match(/C\)\s*(\d{10}|PERM)/);
  let end: Date | null = null;
  if (endMatch) {
    if (endMatch[1] === 'PERM') {
      end = new Date(2099, 11, 31); // Permanent = far future
    } else {
      end = parseNotamDateString(endMatch[1]);
    }
  }

  return { start, end };
};

/**
 * NOTAM 유효성 확인
 */
export const getNotamValidity = (notam: Notam, cancelledSet: Set<string> = new Set()): NotamValidity => {
  // Skip NOTAMC (cancel) type - these just cancel other NOTAMs
  const notamType = getNotamType(notam.full_text);
  if (notamType === 'C') return false;

  // Check if this NOTAM has been cancelled by another NOTAM
  if (notam.notam_number && cancelledSet.has(notam.notam_number)) return false;

  const now = new Date();
  let startDate: Date | null = null;
  let endDate: Date | null = null;

  // Try to get dates from effective_start/effective_end fields first
  if (notam.effective_start && notam.effective_start.length >= 10) {
    startDate = parseNotamDateString(notam.effective_start);
  }

  if (notam.effective_end && notam.effective_end.length >= 10 &&
      !notam.effective_end.includes('PERM') && !notam.effective_end.includes('EST')) {
    endDate = parseNotamDateString(notam.effective_end);
  } else if (notam.effective_end?.includes('PERM')) {
    endDate = new Date(2099, 11, 31); // Permanent
  }

  // Fallback: extract dates from full_text if effective_start/end not available
  if (!startDate || !endDate) {
    const extracted = extractDatesFromFullText(notam.full_text);
    if (!startDate && extracted.start) startDate = extracted.start;
    if (!endDate && extracted.end) endDate = extracted.end;
  }

  // If still no start date, we can't determine validity - assume active to show on map
  if (!startDate) {
    // Check if there's at least some date info in full_text to avoid showing ancient NOTAMs
    if (notam.full_text && notam.full_text.includes('B)')) {
      return 'active'; // Has B) field but couldn't parse - show anyway
    }
    return false;
  }

  // Check if already expired
  if (endDate && now > endDate) return false;

  // Check if future NOTAM
  if (startDate && now < startDate) return 'future';

  // Currently active
  return 'active';
};

/**
 * NOTAM 활성 여부 확인 (하위 호환용)
 */
export const isNotamActive = (notam: Notam, cancelledSet: Set<string> = new Set()): boolean => {
  const validity = getNotamValidity(notam, cancelledSet);
  return validity === 'active' || validity === 'future';
};

/**
 * 취소된 NOTAM 세트 빌드
 */
export const buildCancelledNotamSet = (notams: Notam[] | null | undefined): Set<string> => {
  const cancelledSet = new Set<string>();
  if (!notams) return cancelledSet;

  notams.forEach(n => {
    const type = getNotamType(n.full_text);
    if (type === 'C' || type === 'R') {
      const ref = getCancelledNotamRef(n.full_text);
      if (ref) cancelledSet.add(ref);
    }
  });

  return cancelledSet;
};

/**
 * NOTAM 반경 원형 폴리곤 생성
 */
export const createNotamCircle = (
  lon: number,
  lat: number,
  radiusNM: number,
  numPoints: number = 32
): [number, number][][] => {
  const coords: [number, number][] = [];
  // 1 NM = 1.852 km, convert to degrees (roughly)
  const radiusDeg = (radiusNM * 1.852) / 111.32; // approximate for latitude
  for (let i = 0; i <= numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    const latOffset = radiusDeg * Math.sin(angle);
    const lonOffset = (radiusDeg * Math.cos(angle)) / Math.cos(lat * Math.PI / 180);
    coords.push([lon + lonOffset, lat + latOffset]);
  }
  return [coords];
};

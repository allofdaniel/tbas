/**
 * Format Utility Functions
 * 포맷팅 관련 유틸리티 함수 모음
 */

/**
 * UTC 시간 포맷
 */
export const formatUTC = (date: Date): string => {
  return date.toISOString().slice(11, 19) + 'Z';
};

/**
 * KST 시간 포맷 (한국 표준시)
 * toLocaleString 사용으로 정확한 timezone 변환
 */
export const formatKST = (date: Date): string => {
  return date.toLocaleTimeString('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }) + ' KST';
};

/**
 * 날짜 포맷 (YYYY-MM-DD)
 */
export const formatDate = (date: Date): string => {
  return date.toISOString().slice(0, 10);
};

/**
 * 시간 포맷 (HH:MM)
 */
export const formatTime = (date: Date): string => {
  return date.toTimeString().slice(0, 5);
};

/**
 * 고도 포맷 (ft)
 */
export const formatAltitude = (altitude: number | null | undefined | string): string => {
  if (altitude === null || altitude === undefined || altitude === 'ground') {
    return 'GND';
  }
  return `${Math.round(Number(altitude)).toLocaleString()}ft`;
};

/**
 * 속도 포맷 (kt)
 */
export const formatSpeed = (speed: number | null | undefined): string => {
  if (speed === null || speed === undefined) return '-';
  return `${Math.round(speed)}kt`;
};

/**
 * 거리 포맷 (NM)
 */
export const formatDistanceNM = (distanceMeters: number): string => {
  const nm = distanceMeters / 1852;
  if (nm < 10) return `${nm.toFixed(1)}NM`;
  return `${Math.round(nm)}NM`;
};

/**
 * 콜사인 포맷 (항공사 코드 + 편명)
 */
export const formatCallsign = (callsign: string | null | undefined): string => {
  if (!callsign) return '-';
  return callsign.replace(/^([A-Z]{3})(\d+)/, '$1 $2');
};

/**
 * ICAO 코드를 IATA 코드로 변환
 */
export const ICAO_TO_IATA: Record<string, string> = {
  KAL: 'KE', // 대한항공
  AAR: 'OZ', // 아시아나
  JNA: 'LJ', // 진에어
  JJA: '7C', // 제주항공
  TWB: 'TW', // 티웨이
  ABL: 'BX', // 에어부산
  EOK: 'ZE', // 이스타
  ASV: 'RF', // 에어서울
  ANA: 'NH',
  JAL: 'JL',
  CPA: 'CX',
  CSN: 'CZ',
  CES: 'MU',
  CCA: 'CA',
  HVN: 'VN',
  THA: 'TG',
  SIA: 'SQ',
  MAS: 'MH',
  EVA: 'BR',
  CAL: 'CI',
  UAL: 'UA',
  AAL: 'AA',
  DAL: 'DL',
  AFR: 'AF',
  BAW: 'BA',
  DLH: 'LH',
  KLM: 'KL',
  QFA: 'QF',
  UAE: 'EK',
  ETD: 'EY',
  FDX: 'FX',
  UPS: '5X',
  GTI: 'GT',
};

/**
 * ICAO 항공사 코드를 IATA로 변환
 */
export const icaoToIata = (icao: string): string => {
  return ICAO_TO_IATA[icao] || icao;
};

/**
 * 편명에서 항공사 코드 추출
 */
export const extractAirlineCode = (callsign: string | null | undefined): string | null => {
  if (!callsign) return null;
  const match = callsign.match(/^([A-Z]{3})/);
  return match?.[1] ?? null;
};

/**
 * METAR 시간 파싱
 */
export const parseMetarTime = (metar: string | null | undefined): string | null => {
  if (!metar) return null;
  const match = metar.match(/\d{6}Z/);
  if (match) {
    const time = match[0];
    const day = time.slice(0, 2);
    const hour = time.slice(2, 4);
    const min = time.slice(4, 6);
    return `${day}일 ${hour}:${min}Z`;
  }
  return null;
};

/**
 * NOTAM 날짜 파싱 (YYMMDDHHMM 형식)
 * 날짜 유효성 검증 포함
 */
export const parseNotamDateString = (dateStr: string | null | undefined): Date | null => {
  if (!dateStr || dateStr.length < 10) return null;

  try {
    const yy = parseInt(dateStr.substring(0, 2), 10);
    const month = parseInt(dateStr.substring(2, 4), 10);
    const day = parseInt(dateStr.substring(4, 6), 10);
    const hour = parseInt(dateStr.substring(6, 8), 10);
    const min = parseInt(dateStr.substring(8, 10), 10);

    // 유효성 검증
    if (isNaN(yy) || isNaN(month) || isNaN(day) || isNaN(hour) || isNaN(min)) {
      return null;
    }
    if (month < 1 || month > 12) return null;
    if (day < 1 || day > 31) return null;
    if (hour < 0 || hour > 23) return null;
    if (min < 0 || min > 59) return null;

    // 연도 처리: 50 이상이면 1900년대, 아니면 2000년대
    const year = yy >= 50 ? 1900 + yy : 2000 + yy;

    const date = new Date(Date.UTC(year, month - 1, day, hour, min));

    // Date 객체가 유효한지 확인 (예: 2월 30일 같은 잘못된 날짜 필터링)
    if (isNaN(date.getTime())) return null;

    return date;
  } catch {
    return null;
  }
};

/**
 * 시간 차이 포맷 (상대 시간)
 */
export const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const absDiff = Math.abs(diff);

  const minutes = Math.floor(absDiff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (diff < 0) {
    // 과거
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    return `${days}일 전`;
  } else {
    // 미래
    if (minutes < 60) return `${minutes}분 후`;
    if (hours < 24) return `${hours}시간 후`;
    return `${days}일 후`;
  }
};

/**
 * 캐시 나이 포맷
 */
export const formatCacheAge = (ageMs: number | null | undefined): string => {
  if (!ageMs) return '-';
  const seconds = Math.floor(ageMs / 1000);
  const minutes = Math.floor(seconds / 60);

  if (minutes < 1) return `${seconds}초 전`;
  return `${minutes}분 전`;
};

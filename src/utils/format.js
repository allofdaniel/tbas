/**
 * Format Utility Functions
 * 포맷팅 관련 유틸리티 함수 모음
 */

/**
 * UTC 시간 포맷
 * @param {Date} date - Date 객체
 * @returns {string} HH:MM:SS Z 형식
 */
export const formatUTC = (date) => {
  return date.toISOString().slice(11, 19) + 'Z';
};

/**
 * KST 시간 포맷
 * @param {Date} date - Date 객체
 * @returns {string} HH:MM:SS KST 형식
 */
export const formatKST = (date) => {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(11, 19) + ' KST';
};

/**
 * 날짜 포맷 (YYYY-MM-DD)
 * @param {Date} date - Date 객체
 * @returns {string}
 */
export const formatDate = (date) => {
  return date.toISOString().slice(0, 10);
};

/**
 * 시간 포맷 (HH:MM)
 * @param {Date} date - Date 객체
 * @returns {string}
 */
export const formatTime = (date) => {
  return date.toTimeString().slice(0, 5);
};

/**
 * 고도 포맷 (ft)
 * @param {number} altitude - 고도 값
 * @returns {string}
 */
export const formatAltitude = (altitude) => {
  if (altitude === null || altitude === undefined || altitude === 'ground') {
    return 'GND';
  }
  return `${Math.round(altitude).toLocaleString()}ft`;
};

/**
 * 속도 포맷 (kt)
 * @param {number} speed - 속도 값
 * @returns {string}
 */
export const formatSpeed = (speed) => {
  if (speed === null || speed === undefined) return '-';
  return `${Math.round(speed)}kt`;
};

/**
 * 거리 포맷 (NM)
 * @param {number} distanceMeters - 거리 (미터)
 * @returns {string}
 */
export const formatDistanceNM = (distanceMeters) => {
  const nm = distanceMeters / 1852;
  if (nm < 10) return `${nm.toFixed(1)}NM`;
  return `${Math.round(nm)}NM`;
};

/**
 * 콜사인 포맷 (항공사 코드 + 편명)
 * @param {string} callsign - 원본 콜사인
 * @returns {string}
 */
export const formatCallsign = (callsign) => {
  if (!callsign) return '-';
  return callsign.replace(/^([A-Z]{3})(\d+)/, '$1 $2');
};

/**
 * ICAO 코드를 IATA 코드로 변환
 */
export const ICAO_TO_IATA = {
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
 * @param {string} icao - ICAO 코드 (예: KAL)
 * @returns {string} IATA 코드 또는 원본
 */
export const icaoToIata = (icao) => {
  return ICAO_TO_IATA[icao] || icao;
};

/**
 * 편명에서 항공사 코드 추출
 * @param {string} callsign - 콜사인
 * @returns {string|null} 항공사 코드
 */
export const extractAirlineCode = (callsign) => {
  if (!callsign) return null;
  const match = callsign.match(/^([A-Z]{3})/);
  return match ? match[1] : null;
};

/**
 * METAR 시간 파싱
 * @param {string} metar - METAR 문자열
 * @returns {string|null} 시간 문자열
 */
export const parseMetarTime = (metar) => {
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
 * @param {string} dateStr - NOTAM 날짜 문자열
 * @returns {Date|null}
 */
export const parseNotamDateString = (dateStr) => {
  if (!dateStr || dateStr.length !== 10) return null;

  try {
    const year = 2000 + parseInt(dateStr.substring(0, 2), 10);
    const month = parseInt(dateStr.substring(2, 4), 10) - 1;
    const day = parseInt(dateStr.substring(4, 6), 10);
    const hour = parseInt(dateStr.substring(6, 8), 10);
    const min = parseInt(dateStr.substring(8, 10), 10);

    return new Date(Date.UTC(year, month, day, hour, min));
  } catch {
    return null;
  }
};

/**
 * 시간 차이 포맷 (상대 시간)
 * @param {Date} date - 대상 날짜
 * @returns {string}
 */
export const formatRelativeTime = (date) => {
  const now = new Date();
  const diff = date - now;
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
 * @param {number} ageMs - 나이 (밀리초)
 * @returns {string}
 */
export const formatCacheAge = (ageMs) => {
  if (!ageMs) return '-';
  const seconds = Math.floor(ageMs / 1000);
  const minutes = Math.floor(seconds / 60);

  if (minutes < 1) return `${seconds}초 전`;
  return `${minutes}분 전`;
};

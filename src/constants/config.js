/**
 * Configuration Constants
 * 앱 설정 및 API 관련 상수
 */

// 환경 설정
export const IS_PRODUCTION = import.meta.env.PROD;

// Mapbox 설정
export const MAPBOX_ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || 'pk.eyJ1IjoiYWxsb2ZkYW5pZWwiLCJhIjoiY21pbzY5ejhkMDJvZzNjczVwMmlhYTljaiJ9.eSoww-z9bQuolQ4fQHqZOg';

// 항공기 업데이트 간격 (밀리초)
export const AIRCRAFT_UPDATE_INTERVAL = 2000;

// NOTAM 캐시 설정
export const NOTAM_CACHE_DURATION = 10 * 60 * 1000; // 10분

// 트레일 색상
export const TRAIL_COLOR = '#39FF14';

// 트레일 지속 시간 옵션
export const TRAIL_DURATION_OPTIONS = [
  { label: '1분', value: 60000 },
  { label: '5분', value: 300000 },
  { label: '10분', value: 600000 },
  { label: '30분', value: 1800000 },
  { label: '1시간', value: 3600000 },
];

// 기본 트레일 지속 시간
export const DEFAULT_TRAIL_DURATION = 300000; // 5분

/**
 * 항공기 API URL 생성
 * @param {number} lat - 위도
 * @param {number} lon - 경도
 * @param {number} radius - 반경 (NM)
 * @returns {string} API URL
 */
export const getAircraftApiUrl = (lat, lon, radius = 100) => {
  // 프로덕션: Vercel API 프록시, 로컬: Vite 프록시
  return `/api/aircraft?lat=${lat}&lon=${lon}&radius=${radius}`;
};

/**
 * 항공기 궤적 API URL 생성
 * @param {string} hex - 항공기 HEX 코드
 * @returns {string} API URL
 */
export const getAircraftTraceUrl = (hex) => {
  // 프로덕션: Vercel API 프록시, 로컬: Vite 프록시
  return `/api/aircraft-trace?hex=${hex}`;
};

/**
 * 날씨 API URL 생성
 * @param {string} icao - 공항 ICAO 코드
 * @returns {string} API URL
 */
export const getWeatherApiUrl = (icao) => {
  if (IS_PRODUCTION) return `/api/weather?icao=${icao}`;
  return `https://aviationweather.gov/api/data/metar?ids=${icao}&format=json`;
};

// 항공기 3D 모델 매핑
export const AIRCRAFT_MODEL_MAP = {
  'A380': '/A380.glb', 'A388': '/A380.glb', 'A330': '/A380.glb', 'A350': '/A380.glb',
  'B77W': '/b777.glb', 'B77L': '/b777.glb', 'B772': '/b777.glb', 'B773': '/b777.glb',
  'B789': '/b777.glb', 'B788': '/b777.glb', 'B787': '/b777.glb',
  'B737': '/b737.glb', 'B738': '/b737.glb', 'B739': '/b737.glb', 'B38M': '/b737.glb', 'B39M': '/b737.glb',
  'A320': '/b737.glb', 'A321': '/b737.glb', 'A319': '/b737.glb', 'A20N': '/b737.glb', 'A21N': '/b737.glb',
  'H145': '/helicopter.glb', 'H155': '/helicopter.glb', 'H160': '/helicopter.glb',
  'EC35': '/helicopter.glb', 'EC45': '/helicopter.glb', 'EC55': '/helicopter.glb',
  'S76': '/helicopter.glb', 'AS65': '/helicopter.glb', 'B412': '/helicopter.glb',
  'default_heli': '/helicopter.glb', 'default_jet': '/b737.glb', 'default': '/b737.glb',
};

// 맵 스타일 설정
export const MAP_STYLES = {
  dark: 'mapbox://styles/mapbox/dark-v11',
  light: 'mapbox://styles/mapbox/light-v11',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  black: { version: 8, name: 'Radar Black', sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#000000' } }] }
};

// 절차 차트 정보
export const PROCEDURE_CHARTS = {
  'sid_rwy18_rnav': { name: 'RNAV SID', file: '/charts/sid_rwy18_rnav.png', runway: '18', type: 'SID' },
  'sid_rwy18_conv': { name: 'Conventional SID', file: '/charts/sid_rwy18_conv.png', runway: '18', type: 'SID' },
  'star_rwy18': { name: 'STAR', file: '/charts/star_rwy18.png', runway: '18', type: 'STAR' },
  'apch_rnp_y_rwy18': { name: 'RNP Y', file: '/charts/apch_rnp_y_rwy18.png', runway: '18', type: 'APCH' },
  'apch_rnp_z_rwy18': { name: 'RNP Z (AR)', file: '/charts/apch_rnp_z_rwy18.png', runway: '18', type: 'APCH' },
  'apch_vor_rwy18': { name: 'VOR', file: '/charts/apch_vor_rwy18.png', runway: '18', type: 'APCH' },
  'sid_rwy36_rnav': { name: 'RNAV SID', file: '/charts/sid_rwy36_rnav.png', runway: '36', type: 'SID' },
  'sid_rwy36_conv': { name: 'Conventional SID', file: '/charts/sid_rwy36_conv.png', runway: '36', type: 'SID' },
  'star_rwy36': { name: 'STAR', file: '/charts/star_rwy36.png', runway: '36', type: 'STAR' },
  'apch_ils_y_rwy36': { name: 'ILS Y', file: '/charts/apch_ils_y_rwy36.png', runway: '36', type: 'APCH' },
  'apch_ils_z_rwy36': { name: 'ILS Z', file: '/charts/apch_ils_z_rwy36.png', runway: '36', type: 'APCH' },
  'apch_rnp_rwy36': { name: 'RNP', file: '/charts/apch_rnp_rwy36.png', runway: '36', type: 'APCH' },
  'apch_vor_rwy36': { name: 'VOR', file: '/charts/apch_vor_rwy36.png', runway: '36', type: 'APCH' },
};

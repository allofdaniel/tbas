/**
 * Utils Index
 * 유틸리티 함수 모음 인덱스
 */

// Geometry utilities
export {
  ftToM,
  mToFt,
  nmToM,
  mToNm,
  createCirclePolygon,
  createObstacleShape,
  createRibbonSegment,
  calculateDistance,
  calculateBearing,
  isPointInPolygon,
} from './geometry';

// Color utilities
export {
  generateColor,
  altitudeToColor,
  altitudeToColorHex,
  getAircraftColor,
  getProcedureColor,
  AIRCRAFT_CATEGORY_COLORS,
  AIRCRAFT_COLORS,
  OBSTACLE_COLORS,
  FLIGHT_PHASE_COLORS,
  FLIGHT_CATEGORY_COLORS,
} from './colors';

// Format utilities
export {
  formatUTC,
  formatKST,
  formatDate,
  formatTime,
  formatAltitude,
  formatSpeed,
  formatDistanceNM,
  formatCallsign,
  icaoToIata,
  extractAirlineCode,
  parseMetarTime,
  parseNotamDateString,
  formatRelativeTime,
  formatCacheAge,
  ICAO_TO_IATA,
} from './format';

// Flight utilities
export {
  detectFlightPhase,
  detectCurrentAirspace,
  findNearestWaypoints,
  detectCurrentProcedure,
} from './flight';

// NOTAM utilities
export {
  parseNotamCoordinates,
  getNotamDisplayCoords,
  getNotamType,
  getCancelledNotamRef,
  extractDatesFromFullText,
  getNotamValidity,
  isNotamActive,
  buildCancelledNotamSet,
  createNotamCircle,
} from './notam';

/**
 * Constants Index
 * 상수 모음 인덱스
 */

// Airport constants
export {
  AIRPORT_DATABASE,
  COUNTRY_INFO,
  AIRPORT_TYPE_LABELS,
  AIRPORT_COORDINATES,
  KOREA_AIRPORTS,
  getAirportInfo,
  getAirportName,
  getAirportCoordinates,
} from './airports';

export type {
  AirportInfo,
  CountryInfo,
  AirportCoordinate,
  DetailedAirportInfo,
} from './airports';

// Config constants
export {
  IS_PRODUCTION,
  MAPBOX_ACCESS_TOKEN,
  AIRCRAFT_UPDATE_INTERVAL,
  NOTAM_CACHE_DURATION,
  TRAIL_COLOR,
  TRAIL_DURATION_OPTIONS,
  DEFAULT_TRAIL_DURATION,
  getAircraftApiUrl,
  getAircraftTraceUrl,
  getWeatherApiUrl,
  AIRCRAFT_MODEL_MAP,
  MAP_STYLES,
  PROCEDURE_CHARTS,
} from './config';

export type {
  TrailDurationOption,
  MapStyleSpec,
  ProcedureChart,
} from './config';

// Aircraft constants
export {
  ICAO_TO_IATA as AIRCRAFT_ICAO_TO_IATA,
  AIRCRAFT_SILHOUETTE,
  AIRCRAFT_COLORS as AIRCRAFT_TYPE_COLORS,
  getAircraftImage,
  getAircraftColor as getAircraftTypeColor,
} from './aircraft';

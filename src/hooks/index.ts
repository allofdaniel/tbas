/**
 * Hooks Index
 * 커스텀 훅 모음 인덱스
 */

// 기본 훅
export { useWeather } from './useWeather';
export { useNotam } from './useNotam';
export { useAircraft } from './useAircraft';

// 맵 관련 훅
export { default as useMapInit } from './useMapInit';
export { default as useMapStyle } from './useMapStyle';

// 데이터 관련 훅
export { default as useDataLoading } from './useDataLoading';
export { default as useWeatherData } from './useWeatherData';

// 레이어 관련 훅
export { default as useRadarLayer } from './useRadarLayer';
export { default as useChartOverlay } from './useChartOverlay';
export { default as useAtcRadarRings } from './useAtcRadarRings';
export { default as useAtcSectors } from './useAtcSectors';
export { default as useKoreaAirspace } from './useKoreaAirspace';
export { default as useWeatherLayers } from './useWeatherLayers';
export { default as useAirspaceLayers } from './useAirspaceLayers';

// 항공기 관련 훅
export { default as useAircraftVisualization } from './useAircraftVisualization';
export { default as useAircraftData } from './useAircraftData';
export { default as useSelectedAircraft } from './useSelectedAircraft';
export { default as useAircraftClickHandler } from './useAircraftClickHandler';

// NOTAM 관련 훅
export { default as useNotamLayer } from './useNotamLayer';
export { default as useNotamData } from './useNotamData';

// 절차 관련 훅
export { default as useProcedureRendering } from './useProcedureRendering';

// Global data 훅
export { default as useGlobalData } from './useGlobalData';
export { default as useGlobalLayers } from './useGlobalLayers';

// 유틸리티 훅
export { default as useWindowHeight } from './useWindowHeight';

/**
 * Color Utility Functions
 * 색상 관련 유틸리티 함수 모음
 */

/**
 * 인덱스 기반 HSL 색상 생성
 */
export const generateColor = (index: number, total: number, hueOffset: number = 0): string => {
  const hue = (index / total) * 360 + hueOffset;
  return `hsl(${hue % 360}, 70%, 50%)`;
};

/**
 * 고도에 따른 색상 반환
 */
export const altitudeToColor = (altFt: number): string => {
  if (altFt <= 0) return 'rgb(128, 128, 128)';
  if (altFt < 1000) return 'rgb(0, 200, 0)';
  if (altFt < 3000) return 'rgb(0, 255, 100)';
  if (altFt < 5000) return 'rgb(100, 255, 100)';
  if (altFt < 8000) return 'rgb(255, 255, 0)';
  if (altFt < 15000) return 'rgb(255, 200, 0)';
  if (altFt < 25000) return 'rgb(255, 100, 0)';
  if (altFt < 35000) return 'rgb(255, 50, 50)';
  return 'rgb(200, 0, 200)';
};

/**
 * 고도에 따른 색상 반환 (Three.js용 - 0x 형식)
 */
export const altitudeToColorHex = (altFt: number): number => {
  if (altFt <= 0) return 0x808080;
  if (altFt < 1000) return 0x00c800;
  if (altFt < 3000) return 0x00ff64;
  if (altFt < 5000) return 0x64ff64;
  if (altFt < 8000) return 0xffff00;
  if (altFt < 15000) return 0xffc800;
  if (altFt < 25000) return 0xff6400;
  if (altFt < 35000) return 0xff3232;
  return 0xc800c8;
};

/**
 * 항공기 카테고리에 따른 색상
 */
export const AIRCRAFT_CATEGORY_COLORS: Record<string, string> = {
  A0: '#00BCD4', // Light (< 15,500 lbs)
  A1: '#4CAF50', // Small (15,500-75,000 lbs)
  A2: '#8BC34A', // Large (75,000-300,000 lbs)
  A3: '#CDDC39', // High Performance
  A4: '#FFEB3B', // Rotorcraft
  A5: '#FF9800', // Glider/Sailplane
  A6: '#F44336', // Lighter than Air
  A7: '#E91E63', // Parachute
};

/**
 * 항공기 타입에 따른 색상
 */
export const AIRCRAFT_COLORS: Record<string, string> = {
  // 여객기
  A320: '#4fc3f7',
  A321: '#4fc3f7',
  A319: '#4fc3f7',
  A20N: '#4fc3f7',
  A21N: '#4fc3f7',
  B737: '#4fc3f7',
  B738: '#4fc3f7',
  B739: '#4fc3f7',
  B38M: '#4fc3f7',
  B39M: '#4fc3f7',
  // 와이드바디
  A330: '#64b5f6',
  A350: '#64b5f6',
  A380: '#64b5f6',
  A388: '#64b5f6',
  B777: '#64b5f6',
  B77W: '#64b5f6',
  B787: '#64b5f6',
  B789: '#64b5f6',
  B788: '#64b5f6',
  // 화물기
  B74F: '#ff9800',
  B77F: '#ff9800',
  B748: '#ff9800',
  // 군용기
  F15: '#f44336',
  F16: '#f44336',
  F35: '#f44336',
  C130: '#f44336',
  C17: '#f44336',
  // 헬기
  H145: '#9c27b0',
  H155: '#9c27b0',
  H160: '#9c27b0',
  EC35: '#9c27b0',
  EC45: '#9c27b0',
  S76: '#9c27b0',
  // 비즈니스제트
  G650: '#00bcd4',
  GLEX: '#00bcd4',
  CL35: '#00bcd4',
  // 기본값
  default: '#8bc34a',
};

/**
 * 장애물 타입에 따른 색상
 */
export const OBSTACLE_COLORS: Record<string, string> = {
  Tower: '#F44336',
  Building: '#FF5722',
  Natural: '#4CAF50',
  Tree: '#8BC34A',
  Navaid: '#9C27B0',
  Antenna: '#FF9800',
  Mast: '#E91E63',
  Chimney: '#795548',
  Unknown: '#607D8B',
};

/**
 * 비행 단계별 색상
 */
export const FLIGHT_PHASE_COLORS: Record<string, string> = {
  ground: '#9E9E9E',
  takeoff: '#4CAF50',
  departure: '#8BC34A',
  climb: '#03A9F4',
  cruise: '#2196F3',
  descent: '#00BCD4',
  approach: '#FF5722',
  landing: '#FF9800',
  enroute: '#2196F3',
  unknown: '#9E9E9E',
};

/**
 * 비행 카테고리 색상 (VFR/IFR)
 */
export const FLIGHT_CATEGORY_COLORS: Record<string, string> = {
  VFR: '#4CAF50',
  MVFR: '#2196F3',
  IFR: '#F44336',
  LIFR: '#9C27B0',
};

/**
 * 항공기 타입으로 색상 가져오기
 */
export const getAircraftColor = (type: string | undefined): string => {
  if (!type) return AIRCRAFT_COLORS.default;
  return AIRCRAFT_COLORS[type] || AIRCRAFT_COLORS.default;
};

/**
 * 절차 색상 생성
 */
export const getProcedureColor = (type: string, index: number): string => {
  const baseHue: Record<string, number> = {
    SID: 120,    // 녹색 계열
    STAR: 200,   // 파란색 계열
    APPROACH: 0, // 빨간색 계열
  };

  const hue = (baseHue[type] || 0) + (index * 30) % 60;
  return `hsl(${hue}, 70%, 50%)`;
};

/**
 * Aircraft Constants
 * 항공기 관련 상수 및 유틸리티
 */

// ICAO → IATA 항공사 코드 변환 (한국 및 주요 항공사)
export const ICAO_TO_IATA: Record<string, string> = {
  'KAL': 'KE', 'AAR': 'OZ', 'JNA': 'LJ', 'JJA': '7C', 'TWB': 'TW', 'ABL': 'BX', 'EOK': 'ZE', 'ASV': 'RF',
  'ANA': 'NH', 'JAL': 'JL', 'CPA': 'CX', 'CSN': 'CZ', 'CES': 'MU', 'CCA': 'CA', 'HVN': 'VN', 'THA': 'TG',
  'SIA': 'SQ', 'MAS': 'MH', 'EVA': 'BR', 'CAL': 'CI', 'UAL': 'UA', 'AAL': 'AA', 'DAL': 'DL',
  'AFR': 'AF', 'BAW': 'BA', 'DLH': 'LH', 'KLM': 'KL', 'QFA': 'QF', 'UAE': 'EK', 'ETD': 'EY',
  'FDX': 'FX', 'UPS': '5X', 'GTI': 'GT', // 화물기
};

// 기종별 실루엣 SVG (inline data URL - 외부 의존성 없음)
export const AIRCRAFT_SILHOUETTE = `data:image/svg+xml,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40" fill="#64b5f6">
    <path d="M95 20L85 17V15L50 12V8L48 6H46L44 8V12L15 14V16L5 18V20L5 22L15 24V26L44 28V32L46 34H48L50 32V28L85 25V23L95 20Z"/>
    <circle cx="20" cy="20" r="3" fill="#333"/>
    <circle cx="70" cy="20" r="3" fill="#333"/>
  </svg>
`)}`;

// 기종 그룹별 색상
export const AIRCRAFT_COLORS: Record<string, string> = {
  'B7': '#4fc3f7', // 보잉 737
  'B77': '#29b6f6', // 보잉 777
  'B78': '#03a9f4', // 보잉 787
  'B74': '#0288d1', // 보잉 747
  'A3': '#ab47bc', // 에어버스 A3xx
  'A38': '#7b1fa2', // 에어버스 A380
  'AT': '#66bb6a', // ATR
  'DH': '#43a047', // Dash
  'E': '#ffa726', // 엠브라에르
  'C': '#ef5350', // 세스나/비즈젯
};

/**
 * 기종 코드로 실루엣 이미지 가져오기
 */
export const getAircraftImage = (_typeCode?: string): string => {
  return AIRCRAFT_SILHOUETTE;
};

/**
 * 기종 코드로 색상 가져오기
 */
export const getAircraftColor = (typeCode: string | undefined): string => {
  if (!typeCode) return '#64b5f6';
  const code = typeCode.toUpperCase();
  for (const [prefix, color] of Object.entries(AIRCRAFT_COLORS)) {
    if (code.startsWith(prefix)) return color;
  }
  return '#64b5f6';
};

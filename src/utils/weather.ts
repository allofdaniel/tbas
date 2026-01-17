/**
 * Weather Utilities
 * 날씨 데이터 파싱 및 처리 유틸리티
 */

export interface MetarData {
  obsTime?: string;
  wdir?: number | 'VRB';
  wspd?: number;
  wgst?: number;
  wspdMs?: number;
  visib?: number;
  visibM?: number;
  temp?: number;
  dewp?: number;
  lRvr?: number;
  rRvr?: number;
  ceiling?: number;
  cloud?: number;
  humidity?: number;
  rain?: number;
  fltCat?: string;
  altim?: number;
  rawOb?: string;
  [key: string]: unknown;
}

export interface ParsedMetar {
  wind: string;
  windMs?: string;
  visibility: string;
  temp: string;
  rvr: string;
  ceiling: string;
  cloud: string;
  humidity?: string;
  rain?: string;
}

/**
 * METAR 관측 시간 파싱
 */
export const parseMetarTime = (metar: MetarData | null | undefined): string => {
  if (!metar?.obsTime) return '';
  try {
    // Format: YYYYMMDDHHMM
    const d = metar.obsTime.slice(6, 8);
    const h = metar.obsTime.slice(8, 10);
    const min = metar.obsTime.slice(10, 12);
    return `${parseInt(d)}일 ${h}${min}L`;
  } catch {
    return metar.obsTime || '';
  }
};

/**
 * METAR 데이터 파싱
 */
export const parseMetar = (metar: MetarData | null | undefined): ParsedMetar | null => {
  if (!metar) return null;
  const result: ParsedMetar = { wind: '', visibility: '', temp: '', rvr: '', ceiling: '', cloud: '' };

  // Wind
  if (metar.wdir !== undefined && metar.wspd !== undefined) {
    result.wind = `${String(metar.wdir).padStart(3, '0')}°/${metar.wspd}kt`;
    if (metar.wgst) result.wind += `G${metar.wgst}`;
    if (metar.wspdMs) result.windMs = `${metar.wspdMs}m/s`;
  }

  // Visibility
  if (metar.visib !== undefined) {
    result.visibility = metar.visib >= 10 ? '10km+' : `${metar.visib}km`;
  }

  // Temperature
  if (metar.temp !== undefined) {
    result.temp = `${metar.temp}°C`;
    if (metar.dewp !== undefined) result.temp += `/${metar.dewp}°C`;
  }

  // RVR (Runway Visual Range)
  if (metar.lRvr || metar.rRvr) {
    const rvrs: string[] = [];
    if (metar.lRvr) rvrs.push(`L${metar.lRvr}m`);
    if (metar.rRvr) rvrs.push(`R${metar.rRvr}m`);
    result.rvr = `RVR ${rvrs.join('/')}`;
  }

  // Ceiling
  if (metar.ceiling) result.ceiling = `CIG ${metar.ceiling}ft`;

  // Cloud
  if (metar.cloud !== undefined && metar.cloud !== null) result.cloud = `${metar.cloud}/10`;

  // Humidity
  if (metar.humidity) result.humidity = `${metar.humidity}%`;

  // Rain
  if (metar.rain) result.rain = `${metar.rain}mm`;

  return result;
};

/**
 * UTC 시간 포맷
 */
export const formatUTC = (date: Date): string => date.toISOString().slice(11, 19) + 'Z';

/**
 * KST (한국 표준시) 시간 포맷
 */
export const formatKST = (date: Date): string =>
  new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(11, 19) + 'L';

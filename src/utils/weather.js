/**
 * Weather Utilities
 * 날씨 데이터 파싱 및 처리 유틸리티
 */

/**
 * METAR 관측 시간 파싱
 * @param {Object} metar - METAR 데이터 객체
 * @returns {string} 포맷된 시간 문자열 (예: "11일 1430L")
 */
export const parseMetarTime = (metar) => {
  if (!metar?.obsTime) return '';
  try {
    // Format: YYYYMMDDHHMM
    const y = metar.obsTime.slice(0, 4);
    const m = metar.obsTime.slice(4, 6);
    const d = metar.obsTime.slice(6, 8);
    const h = metar.obsTime.slice(8, 10);
    const min = metar.obsTime.slice(10, 12);
    return `${parseInt(d)}일 ${h}${min}L`;
  } catch (e) {}
  return metar.obsTime;
};

/**
 * METAR 데이터 파싱
 * @param {Object} metar - METAR 데이터 객체
 * @returns {Object|null} 파싱된 날씨 정보
 */
export const parseMetar = (metar) => {
  if (!metar) return null;
  const result = { wind: '', visibility: '', temp: '', rvr: '', ceiling: '', cloud: '' };

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
    const rvrs = [];
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
 * @param {Date} date - Date 객체
 * @returns {string} UTC 시간 문자열 (예: "05:30:00Z")
 */
export const formatUTC = (date) => date.toISOString().slice(11, 19) + 'Z';

/**
 * KST (한국 표준시) 시간 포맷
 * @param {Date} date - Date 객체
 * @returns {string} KST 시간 문자열 (예: "14:30:00L")
 */
export const formatKST = (date) => new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(11, 19) + 'L';

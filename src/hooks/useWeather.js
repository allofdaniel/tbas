/**
 * useWeather Hook
 * 날씨 데이터 페칭 및 상태 관리
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { IS_PRODUCTION } from '../constants/config';

/**
 * 날씨 데이터 관리 훅
 * @param {Object} options - 옵션
 * @param {boolean} options.autoFetch - 자동 페칭 여부
 * @param {number} options.refreshInterval - 새로고침 간격 (ms)
 * @returns {Object} 날씨 상태 및 함수들
 */
export const useWeather = (options = {}) => {
  const { autoFetch = false, refreshInterval = 5 * 60 * 1000 } = options;

  // METAR/TAF 데이터
  const [weatherData, setWeatherData] = useState(null);
  const weatherIntervalRef = useRef(null);

  // Aviation weather layers visibility
  const [showRadar, setShowRadar] = useState(false);
  const [showSatelliteWx, setShowSatelliteWx] = useState(false);
  const [showLightning, setShowLightning] = useState(false);
  const [showSigmet, setShowSigmet] = useState(false);

  // Weather data states
  const [radarData, setRadarData] = useState(null);
  const [satelliteWxData, setSatelliteWxData] = useState(null);
  const [lightningData, setLightningData] = useState(null);
  const [sigmetData, setSigmetData] = useState(null);
  const [llwsData, setLlwsData] = useState(null);

  // Loading/Error states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getBaseUrl = () => IS_PRODUCTION ? '/api/weather' : 'https://rkpu-viewer.vercel.app/api/weather';

  /**
   * METAR/TAF 데이터 가져오기
   */
  const fetchWeatherData = useCallback(async () => {
    try {
      setLoading(true);
      const cacheBuster = `&_t=${Date.now()}`;
      const baseUrl = getBaseUrl();
      const metarUrl = `${baseUrl}?type=metar${cacheBuster}`;
      const tafUrl = `${baseUrl}?type=taf${cacheBuster}`;

      const [metarRes, tafRes] = await Promise.all([
        fetch(metarUrl),
        fetch(tafUrl)
      ]);

      const [metarJson, tafJson] = await Promise.all([
        metarRes.json(),
        tafRes.json()
      ]);

      const metarData = metarJson?.[0] || null;
      const tafData = tafJson?.[0] || null;

      setWeatherData({ metar: metarData, taf: tafData });
      setError(null);
    } catch (e) {
      console.error('Weather fetch failed:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 레이더 데이터 가져오기
   */
  const fetchRadarData = useCallback(async () => {
    try {
      const baseUrl = getBaseUrl();
      const response = await fetch(`${baseUrl}?type=radar`);
      const data = await response.json();
      setRadarData(data);
    } catch (e) {
      console.error('Radar fetch failed:', e);
    }
  }, []);

  /**
   * 위성 데이터 가져오기
   */
  const fetchSatelliteData = useCallback(async () => {
    try {
      const baseUrl = getBaseUrl();
      const response = await fetch(`${baseUrl}?type=satellite`);
      const data = await response.json();
      setSatelliteWxData(data);
    } catch (e) {
      console.error('Satellite fetch failed:', e);
    }
  }, []);

  /**
   * 낙뢰 데이터 가져오기
   */
  const fetchLightningData = useCallback(async () => {
    try {
      const baseUrl = getBaseUrl();
      const response = await fetch(`${baseUrl}?type=lightning`);
      const data = await response.json();
      setLightningData(data);
    } catch (e) {
      console.error('Lightning fetch failed:', e);
    }
  }, []);

  /**
   * SIGMET/LLWS 데이터 가져오기
   */
  const fetchSigmetData = useCallback(async () => {
    try {
      const baseUrl = getBaseUrl();
      const [sigmetRes, llwsRes] = await Promise.all([
        fetch(`${baseUrl}?type=sigmet`),
        fetch(`${baseUrl}?type=llws`)
      ]);
      const [sigmet, llws] = await Promise.all([
        sigmetRes.json(),
        llwsRes.json()
      ]);
      setSigmetData(sigmet);
      setLlwsData(llws);
    } catch (e) {
      console.error('SIGMET/LLWS fetch failed:', e);
    }
  }, []);

  // Auto fetch on mount if enabled
  useEffect(() => {
    if (autoFetch) {
      fetchWeatherData();
      weatherIntervalRef.current = setInterval(fetchWeatherData, refreshInterval);
      return () => clearInterval(weatherIntervalRef.current);
    }
  }, [autoFetch, refreshInterval, fetchWeatherData]);

  // Radar layer toggle
  useEffect(() => {
    if (showRadar) {
      fetchRadarData();
      const interval = setInterval(fetchRadarData, 60000);
      return () => clearInterval(interval);
    }
  }, [showRadar, fetchRadarData]);

  // Satellite layer toggle
  useEffect(() => {
    if (showSatelliteWx) {
      fetchSatelliteData();
    }
  }, [showSatelliteWx, fetchSatelliteData]);

  // Lightning layer toggle
  useEffect(() => {
    if (showLightning) {
      fetchLightningData();
      const interval = setInterval(fetchLightningData, 30000);
      return () => clearInterval(interval);
    }
  }, [showLightning, fetchLightningData]);

  // SIGMET layer toggle
  useEffect(() => {
    if (showSigmet) {
      fetchSigmetData();
    }
  }, [showSigmet, fetchSigmetData]);

  /**
   * METAR 파싱
   */
  const parseMetar = useCallback((metar) => {
    if (!metar) return null;
    const result = { wind: '', visibility: '', temp: '', rvr: '', ceiling: '', cloud: '' };

    if (metar.wdir !== undefined && metar.wspd !== undefined) {
      result.wind = `${String(metar.wdir).padStart(3, '0')}°/${metar.wspd}kt`;
      if (metar.wgst) result.wind += `G${metar.wgst}`;
      if (metar.wspdMs) result.windMs = `${metar.wspdMs}m/s`;
    }
    if (metar.visib !== undefined) {
      result.visibility = metar.visib >= 10 ? '10km+' : `${metar.visib}km`;
    }
    if (metar.temp !== undefined) {
      result.temp = `${metar.temp}°C`;
      if (metar.dewp !== undefined) result.temp += `/${metar.dewp}°C`;
    }
    if (metar.lRvr || metar.rRvr) {
      const rvrs = [];
      if (metar.lRvr) rvrs.push(`L${metar.lRvr}m`);
      if (metar.rRvr) rvrs.push(`R${metar.rRvr}m`);
      result.rvr = `RVR ${rvrs.join('/')}`;
    }
    if (metar.ceiling) result.ceiling = `CIG ${metar.ceiling}ft`;
    if (metar.cloud !== undefined && metar.cloud !== null) result.cloud = `${metar.cloud}/10`;
    if (metar.humidity) result.humidity = `${metar.humidity}%`;
    if (metar.rain) result.rain = `${metar.rain}mm`;

    return result;
  }, []);

  /**
   * METAR 시간 파싱
   */
  const parseMetarTime = useCallback((metar) => {
    if (!metar?.obsTime) return '';
    try {
      const d = metar.obsTime.slice(6, 8);
      const h = metar.obsTime.slice(8, 10);
      const min = metar.obsTime.slice(10, 12);
      return `${parseInt(d)}일 ${h}${min}L`;
    } catch (e) {
      return metar.obsTime;
    }
  }, []);

  return {
    // METAR/TAF
    weatherData,
    fetchWeatherData,
    parseMetar,
    parseMetarTime,

    // Layer visibility states
    showRadar,
    setShowRadar,
    showSatelliteWx,
    setShowSatelliteWx,
    showLightning,
    setShowLightning,
    showSigmet,
    setShowSigmet,

    // Layer data
    radarData,
    satelliteWxData,
    lightningData,
    sigmetData,
    llwsData,

    // Fetch functions
    fetchRadarData,
    fetchSatelliteData,
    fetchLightningData,
    fetchSigmetData,

    // Status
    loading,
    error,
  };
};

export default useWeather;

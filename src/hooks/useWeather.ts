/**
 * useWeather Hook
 * 날씨 데이터 페칭 및 상태 관리
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { IS_PRODUCTION } from '../constants/config';
import type { MetarData, ParsedMetar } from '../utils/weather';

export interface WeatherData {
  metar: MetarData | null;
  taf: unknown | null;
}

export interface UseWeatherOptions {
  autoFetch?: boolean;
  refreshInterval?: number;
}

export interface UseWeatherReturn {
  weatherData: WeatherData | null;
  fetchWeatherData: () => Promise<void>;
  parseMetar: (metar: MetarData | null) => ParsedMetar | null;
  parseMetarTime: (metar: MetarData | null) => string;
  showRadar: boolean;
  setShowRadar: React.Dispatch<React.SetStateAction<boolean>>;
  showSatelliteWx: boolean;
  setShowSatelliteWx: React.Dispatch<React.SetStateAction<boolean>>;
  showLightning: boolean;
  setShowLightning: React.Dispatch<React.SetStateAction<boolean>>;
  showSigmet: boolean;
  setShowSigmet: React.Dispatch<React.SetStateAction<boolean>>;
  radarData: unknown;
  satelliteWxData: unknown;
  lightningData: unknown;
  sigmetData: unknown;
  llwsData: unknown;
  fetchRadarData: () => Promise<void>;
  fetchSatelliteData: () => Promise<void>;
  fetchLightningData: () => Promise<void>;
  fetchSigmetData: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

export const useWeather = (options: UseWeatherOptions = {}): UseWeatherReturn => {
  const { autoFetch = false, refreshInterval = 5 * 60 * 1000 } = options;

  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const weatherIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [showRadar, setShowRadar] = useState(false);
  const [showSatelliteWx, setShowSatelliteWx] = useState(false);
  const [showLightning, setShowLightning] = useState(false);
  const [showSigmet, setShowSigmet] = useState(false);

  const [radarData, setRadarData] = useState<unknown>(null);
  const [satelliteWxData, setSatelliteWxData] = useState<unknown>(null);
  const [lightningData, setLightningData] = useState<unknown>(null);
  const [sigmetData, setSigmetData] = useState<unknown>(null);
  const [llwsData, setLlwsData] = useState<unknown>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getBaseUrl = () => IS_PRODUCTION ? '/api/weather' : 'https://rkpu-viewer.vercel.app/api/weather';

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
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

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

  useEffect(() => {
    if (autoFetch) {
      fetchWeatherData();
      weatherIntervalRef.current = setInterval(fetchWeatherData, refreshInterval);
      return () => {
        if (weatherIntervalRef.current) clearInterval(weatherIntervalRef.current);
      };
    }
  }, [autoFetch, refreshInterval, fetchWeatherData]);

  useEffect(() => {
    if (showRadar) {
      fetchRadarData();
      const interval = setInterval(fetchRadarData, 60000);
      return () => clearInterval(interval);
    }
  }, [showRadar, fetchRadarData]);

  useEffect(() => {
    if (showSatelliteWx) {
      fetchSatelliteData();
    }
  }, [showSatelliteWx, fetchSatelliteData]);

  useEffect(() => {
    if (showLightning) {
      fetchLightningData();
      const interval = setInterval(fetchLightningData, 30000);
      return () => clearInterval(interval);
    }
  }, [showLightning, fetchLightningData]);

  useEffect(() => {
    if (showSigmet) {
      fetchSigmetData();
    }
  }, [showSigmet, fetchSigmetData]);

  const parseMetar = useCallback((metar: MetarData | null): ParsedMetar | null => {
    if (!metar) return null;
    const result: ParsedMetar = { wind: '', visibility: '', temp: '', rvr: '', ceiling: '', cloud: '' };

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
      const rvrs: string[] = [];
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

  const parseMetarTime = useCallback((metar: MetarData | null): string => {
    if (!metar?.obsTime) return '';
    try {
      const d = metar.obsTime.slice(6, 8);
      const h = metar.obsTime.slice(8, 10);
      const min = metar.obsTime.slice(10, 12);
      return `${parseInt(d)}일 ${h}${min}L`;
    } catch {
      return metar.obsTime || '';
    }
  }, []);

  return {
    weatherData,
    fetchWeatherData,
    parseMetar,
    parseMetarTime,
    showRadar,
    setShowRadar,
    showSatelliteWx,
    setShowSatelliteWx,
    showLightning,
    setShowLightning,
    showSigmet,
    setShowSigmet,
    radarData,
    satelliteWxData,
    lightningData,
    sigmetData,
    llwsData,
    fetchRadarData,
    fetchSatelliteData,
    fetchLightningData,
    fetchSigmetData,
    loading,
    error,
  };
};

export default useWeather;

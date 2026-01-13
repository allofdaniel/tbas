import { useState, useCallback, useEffect, useRef } from 'react';
import { IS_PRODUCTION } from '../constants/config';

/**
 * useWeatherData - 기상 데이터 관리 훅
 * - METAR/TAF 데이터 fetching
 * - 레이더/위성/낙뢰/SIGMET/LLWS 데이터
 * - 자동 갱신 관리
 */
export default function useWeatherData(airport, showRadar, showSatelliteWx, showLightning, showSigmet, showWxPanel) {
  // METAR/TAF data
  const [weatherData, setWeatherData] = useState(null);
  const weatherIntervalRef = useRef(null);

  // Aviation weather layers
  const [radarData, setRadarData] = useState(null);
  const [satelliteWxData, setSatelliteWxData] = useState(null);
  const [lightningData, setLightningData] = useState(null);
  const [sigmetData, setSigmetData] = useState(null);
  const [llwsData, setLlwsData] = useState(null);

  const fetchWeatherData = useCallback(async () => {
    try {
      // Use proxy API to avoid CORS issues with KMA API
      // Add cache buster to ensure fresh data from KMA AMOS
      const cacheBuster = `&_t=${Date.now()}`;
      const metarUrl = IS_PRODUCTION ? `/api/weather?type=metar${cacheBuster}` : `https://rkpu-viewer.vercel.app/api/weather?type=metar${cacheBuster}`;
      const tafUrl = IS_PRODUCTION ? `/api/weather?type=taf${cacheBuster}` : `https://rkpu-viewer.vercel.app/api/weather?type=taf${cacheBuster}`;

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
    } catch (e) {
      console.error('Weather fetch failed:', e);
    }
  }, []);

  // Fetch METAR/TAF when airport is available
  useEffect(() => {
    if (!airport) return;
    fetchWeatherData();
    weatherIntervalRef.current = setInterval(fetchWeatherData, 5 * 60 * 1000);
    return () => clearInterval(weatherIntervalRef.current);
  }, [airport, fetchWeatherData]);

  // Fetch radar data
  useEffect(() => {
    const baseUrl = IS_PRODUCTION ? '/api/weather' : 'https://rkpu-viewer.vercel.app/api/weather';

    if (showRadar) {
      fetch(`${baseUrl}?type=radar`).then(r => r.json()).then(setRadarData).catch(console.error);
      const interval = setInterval(() => {
        fetch(`${baseUrl}?type=radar`).then(r => r.json()).then(setRadarData).catch(console.error);
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [showRadar]);

  // Fetch satellite weather data
  useEffect(() => {
    const baseUrl = IS_PRODUCTION ? '/api/weather' : 'https://rkpu-viewer.vercel.app/api/weather';

    if (showSatelliteWx) {
      fetch(`${baseUrl}?type=satellite`).then(r => r.json()).then(setSatelliteWxData).catch(console.error);
    }
  }, [showSatelliteWx]);

  // Fetch lightning data
  useEffect(() => {
    const baseUrl = IS_PRODUCTION ? '/api/weather' : 'https://rkpu-viewer.vercel.app/api/weather';

    if (showLightning) {
      fetch(`${baseUrl}?type=lightning`).then(r => r.json()).then(setLightningData).catch(console.error);
      const interval = setInterval(() => {
        fetch(`${baseUrl}?type=lightning`).then(r => r.json()).then(setLightningData).catch(console.error);
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [showLightning]);

  // Fetch SIGMET/LLWS data
  useEffect(() => {
    const baseUrl = IS_PRODUCTION ? '/api/weather' : 'https://rkpu-viewer.vercel.app/api/weather';

    if (showSigmet || showWxPanel) {
      fetch(`${baseUrl}?type=sigmet`).then(r => r.json()).then(setSigmetData).catch(console.error);
      fetch(`${baseUrl}?type=llws`).then(r => r.json()).then(setLlwsData).catch(console.error);
    }
  }, [showSigmet, showWxPanel]);

  return {
    weatherData,
    radarData,
    setRadarData,
    satelliteWxData,
    lightningData,
    sigmetData,
    llwsData,
    fetchWeatherData,
  };
}

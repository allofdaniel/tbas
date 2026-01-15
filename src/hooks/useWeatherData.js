import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * useWeatherData - 기상 데이터 관리 훅
 * - METAR/TAF 데이터 fetching
 * - 레이더/위성/낙뢰/SIGMET/LLWS 데이터
 * - 자동 갱신 관리
 *
 * 모든 API 호출은 /api/weather 프록시를 통해 수행됨 (vite.config.ts 참조)
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
      // Always use proxy to avoid CORS issues (works in both dev and prod)
      const cacheBuster = `&_t=${Date.now()}`;
      const metarUrl = `/api/weather?type=metar${cacheBuster}`;
      const tafUrl = `/api/weather?type=taf${cacheBuster}`;

      let metarData = null;
      let tafData = null;
      let usedFallback = false;

      try {
        const [metarRes, tafRes] = await Promise.all([
          fetch(metarUrl),
          fetch(tafUrl)
        ]);

        // Check if responses are valid JSON (Vite returns HTML for missing routes)
        const metarContentType = metarRes.headers.get('content-type');
        const tafContentType = tafRes.headers.get('content-type');

        if (!metarContentType?.includes('application/json') || !tafContentType?.includes('application/json')) {
          throw new Error('Response is not JSON');
        }

        // Check for empty responses
        const metarText = await metarRes.text();
        const tafText = await tafRes.text();

        if (!metarText || !tafText || metarText.length < 2 || tafText.length < 2) {
          throw new Error('Empty response from weather API');
        }

        const metarJson = JSON.parse(metarText);
        const tafJson = JSON.parse(tafText);

        metarData = metarJson?.[0] || null;
        tafData = tafJson?.[0] || null;
      } catch (apiError) {
        console.log('Weather API failed, trying local fallback:', apiError.message);
        // Fallback to local mock data
        try {
          const fallbackRes = await fetch('/data/weather.json');
          if (fallbackRes.ok) {
            const fallbackJson = await fallbackRes.json();
            metarData = fallbackJson?.metar?.[0] || null;
            tafData = fallbackJson?.taf?.[0] || null;
            usedFallback = true;
            console.log('Using local demo weather data');
          }
        } catch (fallbackError) {
          console.error('Weather fallback also failed:', fallbackError.message);
        }
      }

      if (metarData || tafData) {
        setWeatherData({ metar: metarData, taf: tafData, source: usedFallback ? 'local-demo' : 'api' });
      }
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

  // Fetch radar data - always use proxy
  useEffect(() => {
    if (showRadar) {
      fetch('/api/weather?type=radar').then(r => r.json()).then(setRadarData).catch(console.error);
      const interval = setInterval(() => {
        fetch('/api/weather?type=radar').then(r => r.json()).then(setRadarData).catch(console.error);
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [showRadar]);

  // Fetch satellite weather data
  useEffect(() => {
    if (showSatelliteWx) {
      fetch('/api/weather?type=satellite').then(r => r.json()).then(setSatelliteWxData).catch(console.error);
    }
  }, [showSatelliteWx]);

  // Fetch lightning data
  useEffect(() => {
    if (showLightning) {
      fetch('/api/weather?type=lightning').then(r => r.json()).then(setLightningData).catch(console.error);
      const interval = setInterval(() => {
        fetch('/api/weather?type=lightning').then(r => r.json()).then(setLightningData).catch(console.error);
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [showLightning]);

  // Fetch SIGMET/LLWS data
  useEffect(() => {
    if (showSigmet || showWxPanel) {
      fetch('/api/weather?type=sigmet').then(r => r.json()).then(setSigmetData).catch(console.error);
      fetch('/api/weather?type=llws').then(r => r.json()).then(setLlwsData).catch(console.error);
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

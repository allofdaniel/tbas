import { useState, useCallback, useEffect, useRef } from 'react';
import type { MetarData } from '../utils/weather';
import { logger } from '../utils/logger';

interface AirportInfo {
  lat: number;
  lon: number;
}

export interface WeatherDataState {
  metar: MetarData | null;
  taf: unknown | null;
  source?: string;
}

export interface UseWeatherDataReturn {
  weatherData: WeatherDataState | null;
  radarData: unknown;
  setRadarData: React.Dispatch<React.SetStateAction<unknown>>;
  satelliteWxData: unknown;
  lightningData: unknown;
  sigmetData: unknown;
  llwsData: unknown;
  fetchWeatherData: () => Promise<void>;
}

/**
 * useWeatherData - 기상 데이터 관리 훅
 * - METAR/TAF 데이터 fetching
 * - 레이더/위성/낙뢰/SIGMET/LLWS 데이터
 * - 자동 갱신 관리
 *
 * 모든 API 호출은 /api/weather 프록시를 통해 수행됨 (vite.config.ts 참조)
 */
export default function useWeatherData(
  airport: AirportInfo | null,
  showRadar: boolean,
  showSatelliteWx: boolean,
  showLightning: boolean,
  showSigmet: boolean,
  showWxPanel: boolean
): UseWeatherDataReturn {
  // METAR/TAF data
  const [weatherData, setWeatherData] = useState<WeatherDataState | null>(null);
  const weatherIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Aviation weather layers
  const [radarData, setRadarData] = useState<unknown>(null);
  const [satelliteWxData, setSatelliteWxData] = useState<unknown>(null);
  const [lightningData, setLightningData] = useState<unknown>(null);
  const [sigmetData, setSigmetData] = useState<unknown>(null);
  const [llwsData, setLlwsData] = useState<unknown>(null);

  const fetchWeatherData = useCallback(async (): Promise<void> => {
    try {
      // Always use proxy to avoid CORS issues (works in both dev and prod)
      const cacheBuster = `&_t=${Date.now()}`;
      const metarUrl = `/api/weather?type=metar${cacheBuster}`;
      const tafUrl = `/api/weather?type=taf${cacheBuster}`;

      let metarData: MetarData | null = null;
      let tafData: unknown = null;
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
        logger.debug('Weather', 'API failed, trying local fallback', { error: (apiError as Error).message });
        // Fallback to local mock data
        try {
          const fallbackRes = await fetch('/data/weather.json');
          if (fallbackRes.ok) {
            const fallbackJson = await fallbackRes.json();
            metarData = fallbackJson?.metar?.[0] || null;
            tafData = fallbackJson?.taf?.[0] || null;
            usedFallback = true;
            logger.info('Weather', 'Using local demo weather data');
          }
        } catch (fallbackError) {
          logger.error('Weather', 'Fallback also failed', fallbackError as Error);
        }
      }

      if (metarData || tafData) {
        setWeatherData({ metar: metarData, taf: tafData, source: usedFallback ? 'local-demo' : 'api' });
      }
    } catch (e) {
      logger.error('Weather', 'Fetch failed', e as Error);
    }
  }, []);

  // Fetch METAR/TAF when airport is available
  useEffect(() => {
    if (!airport) return;
    fetchWeatherData();
    weatherIntervalRef.current = setInterval(fetchWeatherData, 5 * 60 * 1000);
    return () => {
      if (weatherIntervalRef.current) clearInterval(weatherIntervalRef.current);
    };
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

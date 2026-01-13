/**
 * Weather Context
 * DO-278A 요구사항 추적: SRS-CTX-003
 *
 * 기상 데이터 공유를 위한 React Context
 */

import React, { createContext, useContext, useMemo } from 'react';
import type { MetarData, TafData, SigmetData, LightningStrike } from '@/types';
import type { UpperWindData, LlwsData, RadarData, SatelliteData } from '@/domain/repositories/IWeatherRepository';
import { useWeather } from '../hooks/useWeather';
import { WEATHER_UPDATE_INTERVAL } from '@/config/constants';

interface WeatherRisk {
  level: 'low' | 'moderate' | 'high' | 'severe';
  factors: string[];
}

interface WeatherContextValue {
  metar: MetarData | null;
  taf: TafData | null;
  sigmets: SigmetData[];
  airmets: SigmetData[];
  upperWind: UpperWindData | null;
  llws: LlwsData[];
  radar: RadarData | null;
  satellite: SatelliteData | null;
  lightning: LightningStrike[];
  weatherRisk: WeatherRisk | null;
  isLoading: boolean;
  error: Error | null;
  lastUpdate: Date | null;
  refreshWeather: () => Promise<void>;
  refreshRadar: () => Promise<void>;
  refreshSatellite: () => Promise<void>;
  refreshLightning: () => Promise<void>;
}

const WeatherContext = createContext<WeatherContextValue | null>(null);

interface WeatherProviderProps {
  children: React.ReactNode;
  icao?: string;
  updateInterval?: number;
  autoUpdate?: boolean;
}

/**
 * Weather Context Provider
 */
export function WeatherProvider({
  children,
  icao = 'RKPU',
  updateInterval = WEATHER_UPDATE_INTERVAL,
  autoUpdate = true,
}: WeatherProviderProps) {
  const weatherData = useWeather({
    icao,
    updateInterval,
    autoUpdate,
  });

  const value = useMemo<WeatherContextValue>(() => weatherData, [weatherData]);

  return (
    <WeatherContext.Provider value={value}>
      {children}
    </WeatherContext.Provider>
  );
}

/**
 * Weather Context Hook
 */
export function useWeatherContext(): WeatherContextValue {
  const context = useContext(WeatherContext);
  if (!context) {
    throw new Error('useWeatherContext must be used within a WeatherProvider');
  }
  return context;
}

export default WeatherContext;

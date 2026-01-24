/**
 * Weather Repository Implementation
 * DO-278A 요구사항 추적: SRS-REPO-003
 *
 * IWeatherRepository 인터페이스 구현
 */

import type {
  IWeatherRepository,
  RadarData,
  SatelliteData,
  LlwsData,
  UpperWindData as RepoUpperWindData,
} from '@/domain/repositories/IWeatherRepository';
import type {
  MetarData,
  TafData,
  SigmetData,
  LightningStrike,
} from '@/types';
import {
  WeatherApiClient,
  getWeatherApiClient,
} from '../api/clients/WeatherApiClient';

/**
 * 기상 Repository 구현체
 */
export class WeatherRepository implements IWeatherRepository {
  private apiClient: WeatherApiClient;

  constructor(apiClient?: WeatherApiClient) {
    this.apiClient = apiClient || getWeatherApiClient();
  }

  /**
   * METAR 데이터 조회
   */
  async fetchMetar(icao: string): Promise<MetarData | null> {
    const metars = await this.apiClient.fetchMetar(icao);
    if (!metars || metars.length === 0) return null;

    // API 응답을 MetarData로 변환
    const metar = metars[0];
    if (!metar) return null;
    return {
      icaoId: metar.icao || icao,
      obsTime: metar.obsTime || new Date().toISOString(),
      temp: metar.temp,
      dewp: metar.dewpoint,
      wdir: metar.windDirection,
      wspd: metar.windSpeed,
      visib: metar.visibility,
      ceiling: metar.ceiling,
      fltCat: this.determineFlightCategory(metar),
      rawOb: metar.rawMetar,
    };
  }

  /**
   * TAF 데이터 조회
   */
  async fetchTaf(icao: string): Promise<TafData | null> {
    const tafs = await this.apiClient.fetchTaf(icao);
    if (!tafs || tafs.length === 0) return null;

    const taf = tafs[0];
    if (!taf) return null;
    return {
      icaoId: taf.icao || icao,
      rawTAF: taf.rawTaf || '',
      validTimeFrom: taf.validFrom?.toISOString() || new Date().toISOString(),
      validTimeTo: taf.validTo?.toISOString() || new Date().toISOString(),
      issueTime: taf.issueTime,
    };
  }

  /**
   * SIGMET 데이터 조회
   */
  async fetchSigmet(): Promise<SigmetData[]> {
    return this.apiClient.fetchSigmet();
  }

  /**
   * AIRMET 데이터 조회
   */
  async fetchAirmet(): Promise<SigmetData[]> {
    return this.apiClient.fetchAirmet();
  }

  /**
   * 상층풍 데이터 조회
   */
  async fetchUpperWind(): Promise<RepoUpperWindData | null> {
    const data = await this.apiClient.fetchUpperWind();
    if (!data) return null;

    return {
      time: data.time || new Date().toISOString(),
      grid: (data.grid || []).map((point) => ({
        lat: point.lat,
        lon: point.lon,
        name: point.name,
        levels: Object.entries(point.levels).reduce(
          (acc, [level, levelData]) => ({
            ...acc,
            [level]: {
              altitude_m: levelData.altitude_m,
              wind_dir: levelData.windDirection,
              wind_spd_kt: levelData.windSpeed,
            },
          }),
          {} as Record<string, { altitude_m: number; wind_dir: number; wind_spd_kt: number }>
        ),
      })),
      source: data.source || 'Open-Meteo',
    };
  }

  /**
   * 레이더 이미지 URL 조회
   */
  async fetchRadar(): Promise<RadarData | null> {
    const data = await this.apiClient.fetchRadar();
    if (!data) return null;

    return {
      composite: data.composite,
      echoTop: data.echoTop,
      vil: data.vil,
      time: data.time,
      bounds: data.bounds as [[number, number], [number, number]],
    };
  }

  /**
   * 위성 이미지 URL 조회
   */
  async fetchSatellite(): Promise<SatelliteData | null> {
    const data = await this.apiClient.fetchSatellite();
    if (!data) return null;

    return {
      vis: data.vis,
      ir: data.ir,
      wv: data.wv,
      enhir: data.enhir,
      time: data.time,
      bounds: data.bounds as [[number, number], [number, number]],
    };
  }

  /**
   * 낙뢰 데이터 조회
   */
  async fetchLightning(): Promise<LightningStrike[]> {
    const data = await this.apiClient.fetchLightning();
    if (!data?.strikes) return [];

    return data.strikes.map((s) => ({
      lat: s.lat,
      lon: s.lon,
      time: s.time,
      amplitude: s.amplitude ?? undefined,
      type: s.type as 'CG' | 'IC' | undefined,
    }));
  }

  /**
   * LLWS 데이터 조회
   */
  async fetchLlws(): Promise<LlwsData[]> {
    return this.apiClient.fetchLLWS();
  }

  /**
   * 비행 카테고리 결정 헬퍼
   */
  private determineFlightCategory(metar: {
    visibility?: number;
    ceiling?: number;
  }): 'VFR' | 'MVFR' | 'IFR' | 'LIFR' {
    const vis = metar.visibility ?? 10;
    const ceil = metar.ceiling ?? 10000;

    if (vis < 1 || ceil < 500) return 'LIFR';
    if (vis < 3 || ceil < 1000) return 'IFR';
    if (vis < 5 || ceil < 3000) return 'MVFR';
    return 'VFR';
  }

  /**
   * 캐시 클리어
   */
  clearCache(): void {
    this.apiClient.clearCache();
  }
}

/**
 * 싱글톤 인스턴스
 */
let weatherRepositoryInstance: WeatherRepository | null = null;

export function getWeatherRepository(): WeatherRepository {
  if (!weatherRepositoryInstance) {
    weatherRepositoryInstance = new WeatherRepository();
  }
  return weatherRepositoryInstance;
}

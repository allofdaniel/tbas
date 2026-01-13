/**
 * Get Weather Use Case
 * DO-278A 요구사항 추적: SRS-WX-UC-001
 *
 * 특정 공항의 기상 데이터(METAR, TAF)를 조회합니다.
 */

import type { IWeatherRepository } from '@/domain/repositories/IWeatherRepository';
import type { MetarData, TafData, WeatherRiskAssessment, WeatherRiskLevel } from '@/types';

/**
 * Use Case 입력 파라미터
 */
export interface GetWeatherInput {
  icao: string;
  includeMetar?: boolean;
  includeTaf?: boolean;
}

/**
 * Use Case 출력 결과
 */
export interface GetWeatherOutput {
  icao: string;
  metar: MetarData | null;
  taf: TafData | null;
  riskAssessment: WeatherRiskAssessment;
  fetchedAt: number;
}

/**
 * GetWeather Use Case
 *
 * METAR와 TAF 데이터를 조회하고 비행 위험도를 평가합니다.
 */
export class GetWeatherUseCase {
  constructor(private readonly weatherRepository: IWeatherRepository) {}

  /**
   * Use Case 실행
   * @param input 조회 조건
   * @returns 기상 데이터 및 위험도 평가
   */
  async execute(input: GetWeatherInput): Promise<GetWeatherOutput> {
    const { icao, includeMetar = true, includeTaf = true } = input;

    // 병렬로 METAR, TAF 조회
    const [metar, taf] = await Promise.all([
      includeMetar ? this.weatherRepository.fetchMetar(icao) : Promise.resolve(null),
      includeTaf ? this.weatherRepository.fetchTaf(icao) : Promise.resolve(null),
    ]);

    // 기상 위험도 평가
    const riskAssessment = this.assessWeatherRisk(metar);

    return {
      icao,
      metar,
      taf,
      riskAssessment,
      fetchedAt: Date.now(),
    };
  }

  /**
   * 기상 위험도 평가
   * @param metar METAR 데이터
   * @returns 위험도 평가 결과
   */
  private assessWeatherRisk(metar: MetarData | null): WeatherRiskAssessment {
    if (!metar) {
      return { level: 'low', factors: ['No weather data available'] };
    }

    const factors: string[] = [];
    let level: WeatherRiskLevel = 'low';

    // Flight Category 기반 평가
    if (metar.fltCat === 'LIFR') {
      level = 'severe';
      factors.push('LIFR conditions');
    } else if (metar.fltCat === 'IFR') {
      level = level === 'low' ? 'high' : level;
      factors.push('IFR conditions');
    } else if (metar.fltCat === 'MVFR') {
      level = level === 'low' ? 'moderate' : level;
      factors.push('MVFR conditions');
    }

    // 시정 평가
    const visibility = metar.visib ?? metar.visibility ?? 10;
    if (visibility < 1) {
      level = 'severe';
      factors.push(`Very low visibility: ${visibility} SM`);
    } else if (visibility < 3) {
      level = level === 'low' ? 'high' : level;
      factors.push(`Low visibility: ${visibility} SM`);
    } else if (visibility < 5) {
      level = level === 'low' ? 'moderate' : level;
      factors.push(`Reduced visibility: ${visibility} SM`);
    }

    // 운고 평가
    const ceiling = metar.ceiling;
    if (ceiling !== undefined) {
      if (ceiling < 200) {
        level = 'severe';
        factors.push(`Very low ceiling: ${ceiling} ft`);
      } else if (ceiling < 500) {
        level = level === 'low' ? 'high' : level;
        factors.push(`Low ceiling: ${ceiling} ft`);
      } else if (ceiling < 1000) {
        level = level === 'low' ? 'moderate' : level;
        factors.push(`Moderate ceiling: ${ceiling} ft`);
      }
    }

    // 바람 평가
    const windSpeed = metar.wspd ?? metar.windSpeed ?? 0;
    const windGust = metar.wgst ?? metar.windGust ?? 0;
    if (windSpeed > 25 || windGust > 35) {
      level = level === 'low' || level === 'moderate' ? 'high' : level;
      factors.push(`Strong winds: ${windSpeed} kt, gust ${windGust} kt`);
    } else if (windSpeed > 15 || windGust > 25) {
      level = level === 'low' ? 'moderate' : level;
      factors.push(`Moderate winds: ${windSpeed} kt`);
    }

    if (factors.length === 0) {
      factors.push('Good weather conditions');
    }

    return { level, factors };
  }
}

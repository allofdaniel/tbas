/**
 * Get Radar Data Use Case
 * DO-278A 요구사항 추적: SRS-WX-UC-003
 *
 * 레이더, 위성, 낙뢰 이미지 데이터를 조회합니다.
 */

import type { IWeatherRepository, RadarData, SatelliteData } from '@/domain/repositories/IWeatherRepository';
import type { LightningStrike } from '@/types';

/**
 * Use Case 입력 파라미터
 */
export interface GetRadarDataInput {
  includeRadar?: boolean;
  includeSatellite?: boolean;
  includeLightning?: boolean;
}

/**
 * Use Case 출력 결과
 */
export interface GetRadarDataOutput {
  radar: RadarData | null;
  satellite: SatelliteData | null;
  lightning: LightningStrike[];
  hasActiveConvection: boolean;
  fetchedAt: number;
}

/**
 * GetRadarData Use Case
 *
 * 레이더/위성 이미지와 낙뢰 데이터를 조회합니다.
 */
export class GetRadarDataUseCase {
  constructor(private readonly weatherRepository: IWeatherRepository) {}

  /**
   * Use Case 실행
   * @param input 조회 조건
   * @returns 레이더/위성/낙뢰 데이터
   */
  async execute(input: GetRadarDataInput = {}): Promise<GetRadarDataOutput> {
    const {
      includeRadar = true,
      includeSatellite = false,
      includeLightning = true,
    } = input;

    // 병렬 조회
    const [radar, satellite, lightning] = await Promise.all([
      includeRadar ? this.weatherRepository.fetchRadar() : Promise.resolve(null),
      includeSatellite ? this.weatherRepository.fetchSatellite() : Promise.resolve(null),
      includeLightning ? this.weatherRepository.fetchLightning() : Promise.resolve([]),
    ]);

    // 활성 대류 여부 확인 (최근 30분 이내 낙뢰)
    const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
    const recentLightning = lightning.filter((strike) => {
      const strikeTime = new Date(strike.time).getTime();
      return strikeTime > thirtyMinutesAgo;
    });

    const hasActiveConvection = recentLightning.length > 0;

    return {
      radar,
      satellite,
      lightning,
      hasActiveConvection,
      fetchedAt: Date.now(),
    };
  }
}

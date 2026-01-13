/**
 * Get SIGMET Use Case
 * DO-278A 요구사항 추적: SRS-WX-UC-002
 *
 * SIGMET/AIRMET 정보를 조회합니다.
 */

import type { IWeatherRepository } from '@/domain/repositories/IWeatherRepository';
import type { SigmetData, Coordinate } from '@/types';

/**
 * Use Case 입력 파라미터
 */
export interface GetSigmetInput {
  filterActive?: boolean;
  filterByLocation?: Coordinate;
  radiusNM?: number;
}

/**
 * Use Case 출력 결과
 */
export interface GetSigmetOutput {
  sigmets: SigmetData[];
  activeCount: number;
  hasSevereWeather: boolean;
  fetchedAt: number;
}

/**
 * GetSigmet Use Case
 *
 * SIGMET/AIRMET 데이터를 조회하고 심각한 기상 여부를 판단합니다.
 */
export class GetSigmetUseCase {
  constructor(private readonly weatherRepository: IWeatherRepository) {}

  /**
   * Use Case 실행
   * @param input 조회 조건
   * @returns SIGMET 데이터 및 분석 결과
   */
  async execute(input: GetSigmetInput = {}): Promise<GetSigmetOutput> {
    const { filterActive = true, filterByLocation, radiusNM = 100 } = input;

    // SIGMET 데이터 조회
    let sigmets = await this.weatherRepository.fetchSigmet();

    // 활성 필터링
    if (filterActive) {
      const now = new Date();
      sigmets = sigmets.filter((sigmet) => {
        if (!sigmet.validFrom || !sigmet.validTo) return true;
        const from = new Date(sigmet.validFrom);
        const to = new Date(sigmet.validTo);
        return now >= from && now <= to;
      });
    }

    // 위치 기반 필터링
    if (filterByLocation) {
      sigmets = sigmets.filter((sigmet) => {
        const coords = sigmet.coords ?? sigmet.polygon;
        if (!coords || coords.length === 0) return true;
        return this.isNearLocation(coords, filterByLocation, radiusNM);
      });
    }

    // 심각한 기상 여부 확인
    const hasSevereWeather = sigmets.some(
      (s) =>
        s.type === 'SEVERE_TURBULENCE' ||
        s.type === 'VOLCANIC_ASH' ||
        s.type === 'THUNDERSTORM'
    );

    return {
      sigmets,
      activeCount: sigmets.length,
      hasSevereWeather,
      fetchedAt: Date.now(),
    };
  }

  /**
   * 좌표들이 특정 위치 근처에 있는지 확인
   */
  private isNearLocation(
    coords: Coordinate[],
    location: Coordinate,
    radiusNM: number
  ): boolean {
    // 간단한 거리 체크 (정밀도보다 속도 우선)
    const radiusDeg = radiusNM / 60; // NM to degrees (rough approximation)

    return coords.some((coord) => {
      const latDiff = Math.abs(coord.lat - location.lat);
      const lonDiff = Math.abs(coord.lon - location.lon);
      return latDiff < radiusDeg && lonDiff < radiusDeg;
    });
  }
}

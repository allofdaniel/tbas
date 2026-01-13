/**
 * Get Nearby Aircraft Use Case
 * DO-278A 요구사항 추적: SRS-ACF-UC-001
 *
 * 특정 위치 주변의 항공기 목록을 조회합니다.
 */

import type { IAircraftRepository } from '@/domain/repositories/IAircraftRepository';
import type { AircraftPosition, Coordinate } from '@/types';
import { createAircraft, Aircraft } from '@/domain/entities/Aircraft';

/**
 * Use Case 입력 파라미터
 */
export interface GetNearbyAircraftInput {
  center: Coordinate;
  radiusNM: number;
}

/**
 * Use Case 출력 결과
 */
export interface GetNearbyAircraftOutput {
  aircraft: Aircraft[];
  totalCount: number;
  fetchedAt: number;
}

/**
 * GetNearbyAircraft Use Case
 *
 * 주어진 좌표를 중심으로 반경 내의 모든 항공기를 조회합니다.
 */
export class GetNearbyAircraftUseCase {
  constructor(private readonly aircraftRepository: IAircraftRepository) {}

  /**
   * Use Case 실행
   * @param input 조회 조건
   * @returns 항공기 목록
   */
  async execute(input: GetNearbyAircraftInput): Promise<GetNearbyAircraftOutput> {
    const { center, radiusNM } = input;

    // Repository에서 항공기 위치 데이터 조회
    const positions: AircraftPosition[] = await this.aircraftRepository.fetchNearby({
      center,
      radiusNM,
    });

    // 위치 데이터를 Aircraft 엔티티로 변환
    const aircraft: Aircraft[] = positions
      .filter((pos) => pos.lat !== undefined && pos.lon !== undefined)
      .map((position) => createAircraft(position));

    return {
      aircraft,
      totalCount: aircraft.length,
      fetchedAt: Date.now(),
    };
  }
}

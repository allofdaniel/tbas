/**
 * Track Aircraft Use Case
 * DO-278A 요구사항 추적: SRS-ACF-UC-002
 *
 * 특정 항공기를 추적하고 상세 정보와 항적을 조회합니다.
 */

import type { IAircraftRepository } from '@/domain/repositories/IAircraftRepository';
import type { AircraftDetails, AircraftTrailPoint } from '@/types';
import { Aircraft, updateAircraftPosition, filterAbnormalJumps } from '@/domain/entities/Aircraft';

/**
 * Use Case 입력 파라미터
 */
export interface TrackAircraftInput {
  hex: string;
  includeDetails?: boolean;
  includeTrace?: boolean;
  includePhoto?: boolean;
}

/**
 * Use Case 출력 결과
 */
export interface TrackAircraftOutput {
  hex: string;
  details: AircraftDetails | null;
  trail: AircraftTrailPoint[];
  photoUrl: string | null;
  trackedAt: number;
}

/**
 * TrackAircraft Use Case
 *
 * 특정 항공기의 상세 정보, 항적, 사진을 조회합니다.
 */
export class TrackAircraftUseCase {
  constructor(private readonly aircraftRepository: IAircraftRepository) {}

  /**
   * Use Case 실행
   * @param input 추적 대상 항공기 정보
   * @returns 항공기 추적 결과
   */
  async execute(input: TrackAircraftInput): Promise<TrackAircraftOutput> {
    const {
      hex,
      includeDetails = true,
      includeTrace = true,
      includePhoto = false,
    } = input;

    // 병렬로 데이터 조회
    const [details, rawTrail, photoUrl] = await Promise.all([
      includeDetails
        ? this.aircraftRepository.fetchDetails(hex)
        : Promise.resolve(null),
      includeTrace
        ? this.aircraftRepository.fetchTrace(hex)
        : Promise.resolve([]),
      includePhoto
        ? this.aircraftRepository.fetchPhotoUrl(hex)
        : Promise.resolve(null),
    ]);

    // 비정상 점프 필터링된 항적
    const trail = filterAbnormalJumps(rawTrail);

    return {
      hex,
      details,
      trail,
      photoUrl,
      trackedAt: Date.now(),
    };
  }

  /**
   * 항공기 위치 업데이트 (기존 Aircraft 엔티티에 새 위치 적용)
   * @param aircraft 기존 항공기 엔티티
   * @param newPosition 새 위치 데이터
   * @returns 업데이트된 항공기 엔티티
   */
  updatePosition(
    aircraft: Aircraft,
    newPosition: Parameters<typeof updateAircraftPosition>[1]
  ): Aircraft {
    return updateAircraftPosition(aircraft, newPosition);
  }
}

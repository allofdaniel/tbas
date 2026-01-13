/**
 * Calculate ETA Use Case
 * DO-278A 요구사항 추적: SRS-ACF-UC-003
 *
 * 항공기의 목적지까지 예상 도착 시간을 계산합니다.
 */

import type { Coordinate } from '@/types';
import { Aircraft, calculateDistanceNM, calculateETA } from '@/domain/entities/Aircraft';

/**
 * Use Case 입력 파라미터
 */
export interface CalculateETAInput {
  aircraft: Aircraft;
  destination: Coordinate;
}

/**
 * Use Case 출력 결과
 */
export interface CalculateETAOutput {
  hex: string;
  distanceNM: number;
  etaMinutes: number | null;
  etaTime: Date | null;
  groundSpeedKt: number;
}

/**
 * CalculateETA Use Case
 *
 * 항공기의 현재 위치, 속도를 기반으로 목적지까지 ETA를 계산합니다.
 */
export class CalculateETAUseCase {
  /**
   * Use Case 실행
   * @param input 항공기 및 목적지 정보
   * @returns ETA 계산 결과
   */
  execute(input: CalculateETAInput): CalculateETAOutput {
    const { aircraft, destination } = input;

    const distanceNM = calculateDistanceNM(aircraft.position, destination);
    const etaMinutes = calculateETA(aircraft, destination);
    const groundSpeedKt = aircraft.position.ground_speed ?? 0;

    let etaTime: Date | null = null;
    if (etaMinutes !== null) {
      etaTime = new Date(Date.now() + etaMinutes * 60 * 1000);
    }

    return {
      hex: aircraft.hex,
      distanceNM,
      etaMinutes,
      etaTime,
      groundSpeedKt,
    };
  }
}

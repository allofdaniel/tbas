/**
 * Get Upper Wind Use Case
 * DO-278A 요구사항 추적: SRS-WX-UC-004
 *
 * 상층풍 데이터를 조회합니다.
 */

import type { IWeatherRepository, UpperWindData, UpperWindGridPoint } from '@/domain/repositories/IWeatherRepository';
import type { Coordinate } from '@/types';

/**
 * Use Case 입력 파라미터
 */
export interface GetUpperWindInput {
  location?: Coordinate;
  levels?: string[]; // e.g., ['FL100', 'FL180', 'FL240']
}

/**
 * Use Case 출력 결과
 */
export interface GetUpperWindOutput {
  data: UpperWindData | null;
  nearestPoint: UpperWindGridPoint | null;
  fetchedAt: number;
}

/**
 * GetUpperWind Use Case
 *
 * 상층풍 데이터를 조회하고 특정 위치에 가장 가까운 격자점을 찾습니다.
 */
export class GetUpperWindUseCase {
  constructor(private readonly weatherRepository: IWeatherRepository) {}

  /**
   * Use Case 실행
   * @param input 조회 조건
   * @returns 상층풍 데이터
   */
  async execute(input: GetUpperWindInput = {}): Promise<GetUpperWindOutput> {
    const { location } = input;

    // 상층풍 데이터 조회
    const data = await this.weatherRepository.fetchUpperWind();

    // 가장 가까운 격자점 찾기
    let nearestPoint: UpperWindGridPoint | null = null;
    if (data && location) {
      nearestPoint = this.findNearestPoint(data.grid, location);
    }

    return {
      data,
      nearestPoint,
      fetchedAt: Date.now(),
    };
  }

  /**
   * 특정 위치에 가장 가까운 격자점 찾기
   */
  private findNearestPoint(
    grid: UpperWindGridPoint[],
    location: Coordinate
  ): UpperWindGridPoint | null {
    if (grid.length === 0) return null;

    let minDistance = Infinity;
    let nearest: UpperWindGridPoint | null = null;

    for (const point of grid) {
      const distance = Math.sqrt(
        Math.pow(point.lat - location.lat, 2) +
        Math.pow(point.lon - location.lon, 2)
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearest = point;
      }
    }

    return nearest;
  }
}

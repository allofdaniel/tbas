/**
 * Get Waypoints Use Case
 * DO-278A 요구사항 추적: SRS-GIS-UC-002
 *
 * 웨이포인트 및 NAVAID 데이터를 조회합니다.
 */

import type { IGISRepository } from '@/domain/repositories/IGISRepository';
import type { Waypoint, Coordinate } from '@/types';

/**
 * Use Case 입력 파라미터
 */
export interface GetWaypointsInput {
  types?: ('waypoint' | 'navaid' | 'airport')[];
  filterByLocation?: Coordinate;
  radiusNM?: number;
  searchQuery?: string;
}

/**
 * Use Case 출력 결과
 */
export interface GetWaypointsOutput {
  waypoints: Waypoint[];
  byType: {
    waypoints: Waypoint[];
    navaids: Waypoint[];
    airports: Waypoint[];
  };
  totalCount: number;
  fetchedAt: number;
}

/**
 * GetWaypoints Use Case
 *
 * 웨이포인트, NAVAID, 공항 데이터를 조회합니다.
 */
export class GetWaypointsUseCase {
  constructor(private readonly gisRepository: IGISRepository) {}

  /**
   * Use Case 실행
   * @param input 조회 조건
   * @returns 웨이포인트 데이터
   */
  async execute(input: GetWaypointsInput = {}): Promise<GetWaypointsOutput> {
    const { types, filterByLocation, radiusNM = 50, searchQuery } = input;

    // 웨이포인트 데이터 조회
    let waypoints = await this.gisRepository.getWaypoints();

    // 타입 필터링
    if (types && types.length > 0) {
      waypoints = waypoints.filter((w) => types.includes(w.type));
    }

    // 위치 필터링
    if (filterByLocation) {
      const radiusDeg = radiusNM / 60;
      waypoints = waypoints.filter((waypoint) => {
        const latDiff = Math.abs(waypoint.lat - filterByLocation.lat);
        const lonDiff = Math.abs(waypoint.lon - filterByLocation.lon);
        return latDiff < radiusDeg && lonDiff < radiusDeg;
      });
    }

    // 검색 쿼리 필터링
    if (searchQuery) {
      const query = searchQuery.toUpperCase();
      waypoints = waypoints.filter(
        (w) =>
          w.ident.toUpperCase().includes(query) ||
          (w.name && w.name.toUpperCase().includes(query))
      );
    }

    // 타입별 분류
    const byType = {
      waypoints: waypoints.filter((w) => w.type === 'waypoint'),
      navaids: waypoints.filter((w) => w.type === 'navaid'),
      airports: waypoints.filter((w) => w.type === 'airport'),
    };

    return {
      waypoints,
      byType,
      totalCount: waypoints.length,
      fetchedAt: Date.now(),
    };
  }

  /**
   * 웨이포인트 ID로 조회
   * @param ident 웨이포인트 식별자
   */
  async findByIdent(ident: string): Promise<Waypoint | null> {
    const waypoints = await this.gisRepository.getWaypoints();
    return waypoints.find((w) => w.ident.toUpperCase() === ident.toUpperCase()) ?? null;
  }
}

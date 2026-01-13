/**
 * Get Routes Use Case
 * DO-278A 요구사항 추적: SRS-GIS-UC-003
 *
 * 항로 데이터를 조회합니다.
 */

import type { IGISRepository } from '@/domain/repositories/IGISRepository';
import type { Route, Coordinate } from '@/types';

/**
 * Use Case 입력 파라미터
 */
export interface GetRoutesInput {
  types?: ('ATS' | 'RNAV' | 'OTHER')[];
  filterByLocation?: Coordinate;
  radiusNM?: number;
  searchQuery?: string;
}

/**
 * Use Case 출력 결과
 */
export interface GetRoutesOutput {
  routes: Route[];
  byType: {
    ATS: Route[];
    RNAV: Route[];
    OTHER: Route[];
  };
  totalCount: number;
  fetchedAt: number;
}

/**
 * GetRoutes Use Case
 *
 * 항로 데이터를 조회합니다.
 */
export class GetRoutesUseCase {
  constructor(private readonly gisRepository: IGISRepository) {}

  /**
   * Use Case 실행
   * @param input 조회 조건
   * @returns 항로 데이터
   */
  async execute(input: GetRoutesInput = {}): Promise<GetRoutesOutput> {
    const { types, filterByLocation, radiusNM = 50, searchQuery } = input;

    // 항로 데이터 조회
    let routes = await this.gisRepository.getRoutes();

    // 타입 필터링
    if (types && types.length > 0) {
      routes = routes.filter((r) => types.includes(r.type));
    }

    // 위치 필터링 (항로의 포인트 중 하나라도 범위 내에 있으면 포함)
    if (filterByLocation) {
      const radiusDeg = radiusNM / 60;
      routes = routes.filter((route) => {
        return route.points.some((point) => {
          const latDiff = Math.abs(point.lat - filterByLocation.lat);
          const lonDiff = Math.abs(point.lon - filterByLocation.lon);
          return latDiff < radiusDeg && lonDiff < radiusDeg;
        });
      });
    }

    // 검색 쿼리 필터링
    if (searchQuery) {
      const query = searchQuery.toUpperCase();
      routes = routes.filter((r) => r.name.toUpperCase().includes(query));
    }

    // 타입별 분류
    const byType = {
      ATS: routes.filter((r) => r.type === 'ATS'),
      RNAV: routes.filter((r) => r.type === 'RNAV'),
      OTHER: routes.filter((r) => r.type === 'OTHER'),
    };

    return {
      routes,
      byType,
      totalCount: routes.length,
      fetchedAt: Date.now(),
    };
  }

  /**
   * 항로 이름으로 조회
   * @param name 항로 이름
   */
  async findByName(name: string): Promise<Route | null> {
    const routes = await this.gisRepository.getRoutes();
    return routes.find((r) => r.name.toUpperCase() === name.toUpperCase()) ?? null;
  }
}

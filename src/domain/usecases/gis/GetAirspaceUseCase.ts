/**
 * Get Airspace Use Case
 * DO-278A 요구사항 추적: SRS-GIS-UC-001
 *
 * 공역 데이터를 조회합니다.
 */

import type { IGISRepository } from '@/domain/repositories/IGISRepository';
import type { Airspace, AirspaceType, Coordinate } from '@/types';

/**
 * Use Case 입력 파라미터
 */
export interface GetAirspaceInput {
  types?: AirspaceType[];
  filterByLocation?: Coordinate;
  radiusNM?: number;
  altitudeFloor?: number;
  altitudeCeiling?: number;
}

/**
 * Use Case 출력 결과
 */
export interface GetAirspaceOutput {
  airspaces: Airspace[];
  byType: Record<AirspaceType, Airspace[]>;
  totalCount: number;
  fetchedAt: number;
}

/**
 * GetAirspace Use Case
 *
 * 공역 데이터를 조회하고 유형별로 분류합니다.
 */
export class GetAirspaceUseCase {
  constructor(private readonly gisRepository: IGISRepository) {}

  /**
   * Use Case 실행
   * @param input 조회 조건
   * @returns 공역 데이터
   */
  async execute(input: GetAirspaceInput = {}): Promise<GetAirspaceOutput> {
    const {
      types,
      filterByLocation,
      radiusNM = 50,
      altitudeFloor,
      altitudeCeiling,
    } = input;

    // 공역 데이터 조회
    let airspaces = await this.gisRepository.getAirspaces();

    // 타입 필터링
    if (types && types.length > 0) {
      airspaces = airspaces.filter((a) => types.includes(a.type));
    }

    // 위치 필터링
    if (filterByLocation) {
      airspaces = airspaces.filter((airspace) => {
        const coords = airspace.coordinates ?? airspace.polygon;
        if (!coords || coords.length === 0) return true;
        return this.isNearLocation(coords, filterByLocation, radiusNM);
      });
    }

    // 고도 필터링
    if (altitudeFloor !== undefined || altitudeCeiling !== undefined) {
      airspaces = airspaces.filter((airspace) => {
        const floor = airspace.floorFt ?? airspace.lowerLimit ?? 0;
        const ceiling = airspace.ceilingFt ?? airspace.upperLimit ?? 99999;

        if (altitudeFloor !== undefined && ceiling < altitudeFloor) return false;
        if (altitudeCeiling !== undefined && floor > altitudeCeiling) return false;
        return true;
      });
    }

    // 타입별 분류
    const byType = this.groupByType(airspaces);

    return {
      airspaces,
      byType,
      totalCount: airspaces.length,
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
    const radiusDeg = radiusNM / 60;
    return coords.some((coord) => {
      const latDiff = Math.abs(coord.lat - location.lat);
      const lonDiff = Math.abs(coord.lon - location.lon);
      return latDiff < radiusDeg && lonDiff < radiusDeg;
    });
  }

  /**
   * 공역을 타입별로 그룹화
   */
  private groupByType(airspaces: Airspace[]): Record<AirspaceType, Airspace[]> {
    const result: Record<string, Airspace[]> = {};

    for (const airspace of airspaces) {
      if (!result[airspace.type]) {
        result[airspace.type] = [];
      }
      result[airspace.type].push(airspace);
    }

    return result as Record<AirspaceType, Airspace[]>;
  }
}

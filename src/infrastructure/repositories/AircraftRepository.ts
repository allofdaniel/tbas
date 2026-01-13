/**
 * Aircraft Repository Implementation
 * DO-278A 요구사항 추적: SRS-REPO-002
 *
 * IAircraftRepository 인터페이스 구현
 */

import type {
  IAircraftRepository,
  FetchAircraftOptions,
} from '@/domain/repositories/IAircraftRepository';
import type {
  AircraftPosition,
  AircraftTrailPoint,
  AircraftDetails,
} from '@/types';
import {
  AircraftApiClient,
  getAircraftApiClient,
} from '../api/clients/AircraftApiClient';

/**
 * 항공기 Repository 구현체
 */
export class AircraftRepository implements IAircraftRepository {
  private apiClient: AircraftApiClient;

  constructor(apiClient?: AircraftApiClient) {
    this.apiClient = apiClient || getAircraftApiClient();
  }

  /**
   * 반경 내 항공기 위치 조회
   */
  async fetchNearby(options: FetchAircraftOptions): Promise<AircraftPosition[]> {
    return this.apiClient.fetchNearby(options.center, options.radiusNM);
  }

  /**
   * 특정 항공기 항적 조회
   */
  async fetchTrace(hex: string): Promise<AircraftTrailPoint[]> {
    return this.apiClient.fetchTrace(hex);
  }

  /**
   * 항공기 상세 정보 조회
   */
  async fetchDetails(hex: string): Promise<AircraftDetails | null> {
    const position = await this.apiClient.fetchDetails(hex);
    if (!position) return null;

    // AircraftPosition을 AircraftDetails로 변환
    return {
      hex: position.hex,
      registration: position.r,
      type: position.t,
    };
  }

  /**
   * 항공기 사진 URL 조회
   */
  async fetchPhotoUrl(hex: string, registration?: string): Promise<string | null> {
    if (!registration) return null;
    return this.apiClient.fetchPhotoUrl(registration);
  }

  /**
   * 캐시 클리어
   */
  clearCache(): void {
    this.apiClient.clearCache();
  }
}

/**
 * 싱글톤 인스턴스
 */
let aircraftRepositoryInstance: AircraftRepository | null = null;

export function getAircraftRepository(): AircraftRepository {
  if (!aircraftRepositoryInstance) {
    aircraftRepositoryInstance = new AircraftRepository();
  }
  return aircraftRepositoryInstance;
}

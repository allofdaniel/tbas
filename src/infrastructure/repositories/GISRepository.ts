/**
 * GIS Repository Implementation
 * DO-278A 요구사항 추적: SRS-REPO-004
 *
 * IGISRepository 인터페이스 구현
 */

import type {
  IGISRepository,
  AviationData,
  KoreaAirspaceData,
  AtcSectorData,
} from '@/domain/repositories/IGISRepository';
import type {
  Waypoint,
  Route,
  Airspace,
  FlightProcedure,
  Coordinate,
} from '@/types';
import { GISApiClient, getGISApiClient } from '../api/clients/GISApiClient';

/**
 * GIS Repository 구현체
 */
export class GISRepository implements IGISRepository {
  private apiClient: GISApiClient;

  constructor(apiClient?: GISApiClient) {
    this.apiClient = apiClient || getGISApiClient();
  }

  /**
   * 공항 항공 데이터 로드
   */
  async loadAviationData(icao: string): Promise<AviationData | null> {
    try {
      const [waypoints, routes, airspaces, sids, stars, approaches, navaids, obstacles] =
        await Promise.all([
          this.apiClient.getWaypoints('local'),
          this.apiClient.getRoutes('local'),
          this.apiClient.getAirspaces('local'),
          this.apiClient.getProcedures('SID'),
          this.apiClient.getProcedures('STAR'),
          this.apiClient.getProcedures('APPROACH'),
          this.apiClient.getNavaids('local'),
          this.apiClient.getObstacles(),
        ]);

      // 공항 정보 구성
      const airport = {
        icao,
        name: icao === 'RKPU' ? 'Ulsan Airport' : icao,
        country: 'KOR',
        type: 'general' as const,
        lat: 35.5934,
        lon: 129.3518,
      };

      // 절차를 Record 형태로 변환
      const proceduresByType = {
        SID: {} as Record<string, FlightProcedure>,
        STAR: {} as Record<string, FlightProcedure>,
        APPROACH: {} as Record<string, FlightProcedure>,
      };

      sids.forEach((p) => (proceduresByType.SID[p.name] = p));
      stars.forEach((p) => (proceduresByType.STAR[p.name] = p));
      approaches.forEach((p) => (proceduresByType.APPROACH[p.name] = p));

      return {
        airport,
        waypoints,
        routes,
        airspaces,
        navaids: navaids.map((n) => ({
          ...n,
          type: 'navaid' as const,
        })),
        obstacles: obstacles.map((o) => ({
          type: o.type,
          lat: o.lat,
          lon: o.lon,
          elevation_amsl_ft: o.heightMsl,
          height_agl_ft: o.heightAgl,
        })),
        procedures: proceduresByType,
      };
    } catch (error) {
      console.error('Failed to load aviation data:', error);
      return null;
    }
  }

  /**
   * 전국 공역 데이터 로드
   */
  async loadKoreaAirspace(): Promise<KoreaAirspaceData | null> {
    try {
      const [waypoints, routes, airspaces, navaids] = await Promise.all([
        this.apiClient.getWaypoints('national'),
        this.apiClient.getRoutes('national'),
        this.apiClient.getAirspaces('national'),
        this.apiClient.getNavaids('national'),
      ]);

      return {
        metadata: {
          source: 'eAIP Korea',
          airac: new Date().toISOString().slice(0, 10),
          extracted: new Date().toISOString(),
          url: 'https://aim.koca.go.kr',
        },
        waypoints,
        routes,
        airspaces,
        navaids: navaids.map((n) => ({
          ...n,
          type: 'navaid' as const,
        })),
      };
    } catch (error) {
      console.error('Failed to load Korea airspace:', error);
      return null;
    }
  }

  /**
   * ATC 섹터 데이터 로드
   */
  async loadAtcSectors(): Promise<AtcSectorData | null> {
    const airspaces = await this.getAirspaces();

    const ctr = airspaces.filter((a) => a.type === 'CTR');
    const tma = airspaces.filter((a) => a.type === 'TMA');
    const acc = airspaces.filter((a) => a.type === 'ACC');
    const fir = airspaces.find((a) => a.type === 'FIR');

    return {
      CTR: ctr.length === 1 ? ctr[0] : ctr,
      TMA: tma.length === 1 ? tma[0] : tma,
      ACC: acc,
      FIR: fir,
    };
  }

  /**
   * 웨이포인트 목록 조회
   */
  async getWaypoints(): Promise<Waypoint[]> {
    return this.apiClient.getWaypoints('local');
  }

  /**
   * 항로 목록 조회
   */
  async getRoutes(): Promise<Route[]> {
    return this.apiClient.getRoutes('local');
  }

  /**
   * 공역 목록 조회
   */
  async getAirspaces(): Promise<Airspace[]> {
    return this.apiClient.getAirspaces('local');
  }

  /**
   * 비행절차 목록 조회
   */
  async getProcedures(_icao: string): Promise<{
    SID: FlightProcedure[];
    STAR: FlightProcedure[];
    APPROACH: FlightProcedure[];
  }> {
    const [sids, stars, approaches] = await Promise.all([
      this.apiClient.getProcedures('SID'),
      this.apiClient.getProcedures('STAR'),
      this.apiClient.getProcedures('APPROACH'),
    ]);

    return {
      SID: sids,
      STAR: stars,
      APPROACH: approaches,
    };
  }

  /**
   * 장애물 목록 조회
   */
  async getObstacles(): Promise<
    Array<{
      id: string;
      name?: string;
      type: string;
      lat: number;
      lon: number;
      heightAgl: number;
      heightMsl: number;
      lighting?: boolean;
    }>
  > {
    return this.apiClient.getObstacles();
  }

  /**
   * 활주로 목록 조회
   */
  async getRunways(): Promise<
    Array<{
      id: string;
      name: string;
      heading: number;
      length: number;
      width: number;
      surface?: string;
      threshold: Coordinate;
      end: Coordinate;
      elevation?: number;
    }>
  > {
    return this.apiClient.getRunways();
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
let gisRepositoryInstance: GISRepository | null = null;

export function getGISRepository(): GISRepository {
  if (!gisRepositoryInstance) {
    gisRepositoryInstance = new GISRepository();
  }
  return gisRepositoryInstance;
}

/**
 * Get Procedures Use Case
 * DO-278A 요구사항 추적: SRS-GIS-UC-004
 *
 * 비행절차(SID, STAR, APPROACH) 데이터를 조회합니다.
 */

import type { IGISRepository } from '@/domain/repositories/IGISRepository';
import type { FlightProcedure, ProcedureType } from '@/types';

/**
 * Use Case 입력 파라미터
 */
export interface GetProceduresInput {
  icao: string;
  types?: ProcedureType[];
  runway?: string;
}

/**
 * Use Case 출력 결과
 */
export interface GetProceduresOutput {
  icao: string;
  procedures: FlightProcedure[];
  byType: {
    SID: FlightProcedure[];
    STAR: FlightProcedure[];
    APPROACH: FlightProcedure[];
  };
  runways: string[];
  totalCount: number;
  fetchedAt: number;
}

/**
 * GetProcedures Use Case
 *
 * 특정 공항의 비행절차 데이터를 조회합니다.
 */
export class GetProceduresUseCase {
  constructor(private readonly gisRepository: IGISRepository) {}

  /**
   * Use Case 실행
   * @param input 조회 조건
   * @returns 비행절차 데이터
   */
  async execute(input: GetProceduresInput): Promise<GetProceduresOutput> {
    const { icao, types, runway } = input;

    // 비행절차 데이터 조회
    const procedureData = await this.gisRepository.getProcedures(icao);

    // 모든 절차를 하나의 배열로 변환
    let allProcedures: FlightProcedure[] = [
      ...procedureData.SID,
      ...procedureData.STAR,
      ...procedureData.APPROACH,
    ];

    // 타입 필터링
    if (types && types.length > 0) {
      allProcedures = allProcedures.filter((p) => types.includes(p.type));
    }

    // 활주로 필터링
    if (runway) {
      allProcedures = allProcedures.filter((p) => p.runway === runway);
    }

    // 타입별 분류
    const byType = {
      SID: allProcedures.filter((p) => p.type === 'SID'),
      STAR: allProcedures.filter((p) => p.type === 'STAR'),
      APPROACH: allProcedures.filter((p) => p.type === 'APPROACH'),
    };

    // 활주로 목록 추출
    const runways = [...new Set(allProcedures.map((p) => p.runway))].sort();

    return {
      icao,
      procedures: allProcedures,
      byType,
      runways,
      totalCount: allProcedures.length,
      fetchedAt: Date.now(),
    };
  }

  /**
   * 특정 절차 조회
   * @param icao 공항 코드
   * @param procedureName 절차 이름
   */
  async findByName(icao: string, procedureName: string): Promise<FlightProcedure | null> {
    const procedureData = await this.gisRepository.getProcedures(icao);
    const allProcedures = [
      ...procedureData.SID,
      ...procedureData.STAR,
      ...procedureData.APPROACH,
    ];

    return (
      allProcedures.find(
        (p) => p.name.toUpperCase() === procedureName.toUpperCase()
      ) ?? null
    );
  }
}

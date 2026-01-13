/**
 * GetAirspaceUseCase 테스트
 * DO-278A 요구사항 추적: SRS-GIS-UC-001-TEST
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetAirspaceUseCase } from '@/domain/usecases/gis/GetAirspaceUseCase';
import type { IGISRepository } from '@/domain/repositories/IGISRepository';
import type { Airspace } from '@/types';

describe('GetAirspaceUseCase', () => {
  let mockRepository: IGISRepository;
  let useCase: GetAirspaceUseCase;

  const mockAirspaces: Airspace[] = [
    {
      id: 'CTR-RKPU',
      name: 'RKPU CTR',
      type: 'CTR',
      floorFt: 0,
      ceilingFt: 3000,
      coordinates: [
        { lat: 35.59, lon: 129.35 },
        { lat: 35.60, lon: 129.36 },
        { lat: 35.58, lon: 129.37 },
      ],
    },
    {
      id: 'TMA-RKPU',
      name: 'RKPU TMA',
      type: 'TMA',
      floorFt: 3000,
      ceilingFt: 14500,
      coordinates: [
        { lat: 35.55, lon: 129.30 },
        { lat: 35.65, lon: 129.40 },
        { lat: 35.50, lon: 129.35 },
      ],
    },
    {
      id: 'P-518',
      name: 'PROHIBITED AREA 518',
      type: 'P',
      floorFt: 0,
      ceilingFt: 50000,
      coordinates: [
        { lat: 36.00, lon: 129.50 },
        { lat: 36.10, lon: 129.60 },
      ],
    },
  ];

  beforeEach(() => {
    mockRepository = {
      loadAviationData: vi.fn().mockResolvedValue(null),
      loadKoreaAirspace: vi.fn().mockResolvedValue(null),
      loadAtcSectors: vi.fn().mockResolvedValue(null),
      getWaypoints: vi.fn().mockResolvedValue([]),
      getRoutes: vi.fn().mockResolvedValue([]),
      getAirspaces: vi.fn().mockResolvedValue(mockAirspaces),
      getProcedures: vi.fn().mockResolvedValue({ SID: [], STAR: [], APPROACH: [] }),
    };
    useCase = new GetAirspaceUseCase(mockRepository);
  });

  it('should return all airspaces', async () => {
    const result = await useCase.execute();

    expect(result.airspaces).toHaveLength(3);
    expect(result.totalCount).toBe(3);
    expect(result.fetchedAt).toBeTypeOf('number');
  });

  it('should group airspaces by type', async () => {
    const result = await useCase.execute();

    expect(result.byType['CTR']).toHaveLength(1);
    expect(result.byType['TMA']).toHaveLength(1);
    expect(result.byType['P']).toHaveLength(1);
  });

  it('should filter by airspace type', async () => {
    const result = await useCase.execute({
      types: ['CTR', 'TMA'],
    });

    expect(result.airspaces).toHaveLength(2);
    expect(result.airspaces.every((a) => ['CTR', 'TMA'].includes(a.type))).toBe(true);
  });

  it('should filter by location', async () => {
    const result = await useCase.execute({
      filterByLocation: { lat: 35.59, lon: 129.35 },
      radiusNM: 10,
    });

    // CTR과 TMA는 근처에 있고, P-518은 멀리 있음
    expect(result.airspaces.some((a) => a.type === 'CTR')).toBe(true);
    expect(result.airspaces.some((a) => a.type === 'TMA')).toBe(true);
  });

  it('should filter by altitude floor', async () => {
    const result = await useCase.execute({
      altitudeFloor: 10000,
    });

    // FL100 이상에서 유효한 공역만
    expect(result.airspaces.every((a) => (a.ceilingFt ?? 0) >= 10000)).toBe(true);
  });

  it('should filter by altitude ceiling', async () => {
    const result = await useCase.execute({
      altitudeCeiling: 5000,
    });

    // FL50 이하에서 시작하는 공역만
    expect(result.airspaces.every((a) => (a.floorFt ?? 0) <= 5000)).toBe(true);
  });

  it('should combine multiple filters', async () => {
    const result = await useCase.execute({
      types: ['CTR', 'TMA'],
      altitudeFloor: 0,
      altitudeCeiling: 5000,
    });

    expect(
      result.airspaces.every(
        (a) =>
          ['CTR', 'TMA'].includes(a.type) &&
          (a.floorFt ?? 0) <= 5000 &&
          (a.ceilingFt ?? 0) >= 0
      )
    ).toBe(true);
  });

  it('should return empty byType for missing types', async () => {
    const result = await useCase.execute({
      types: ['CTR'],
    });

    expect(result.byType['TMA']).toBeUndefined();
    expect(result.byType['P']).toBeUndefined();
  });

  it('should handle empty airspace list', async () => {
    (mockRepository.getAirspaces as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await useCase.execute();

    expect(result.airspaces).toHaveLength(0);
    expect(result.totalCount).toBe(0);
  });

  it('should handle airspaces without coordinates', async () => {
    const airspacesWithoutCoords: Airspace[] = [
      {
        id: 'TEST',
        name: 'Test Airspace',
        type: 'CTR',
        floorFt: 0,
        ceilingFt: 3000,
      },
    ];
    (mockRepository.getAirspaces as ReturnType<typeof vi.fn>).mockResolvedValue(
      airspacesWithoutCoords
    );

    const result = await useCase.execute({
      filterByLocation: { lat: 35.59, lon: 129.35 },
    });

    // 좌표가 없는 공역은 필터링에서 통과
    expect(result.airspaces).toHaveLength(1);
  });
});

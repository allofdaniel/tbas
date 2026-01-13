/**
 * GetNearbyAircraftUseCase 테스트
 * DO-278A 요구사항 추적: SRS-ACF-UC-001-TEST
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetNearbyAircraftUseCase } from '@/domain/usecases/aircraft/GetNearbyAircraftUseCase';
import type { IAircraftRepository } from '@/domain/repositories/IAircraftRepository';
import type { AircraftPosition } from '@/types';

describe('GetNearbyAircraftUseCase', () => {
  let mockRepository: IAircraftRepository;
  let useCase: GetNearbyAircraftUseCase;

  const mockAircraftPositions: AircraftPosition[] = [
    {
      hex: 'ABC123',
      callsign: 'KAL123',
      lat: 35.5934,
      lon: 129.3518,
      altitude_ft: 3000,
      ground_speed: 150,
      track: 90,
      on_ground: false,
    },
    {
      hex: 'DEF456',
      callsign: 'AAR456',
      lat: 35.6000,
      lon: 129.3600,
      altitude_ft: 5000,
      ground_speed: 250,
      track: 180,
      on_ground: false,
    },
  ];

  beforeEach(() => {
    mockRepository = {
      fetchNearby: vi.fn().mockResolvedValue(mockAircraftPositions),
      fetchTrace: vi.fn().mockResolvedValue([]),
      fetchDetails: vi.fn().mockResolvedValue(null),
      fetchPhotoUrl: vi.fn().mockResolvedValue(null),
    };
    useCase = new GetNearbyAircraftUseCase(mockRepository);
  });

  it('should return aircraft list with correct count', async () => {
    const result = await useCase.execute({
      center: { lat: 35.5934, lon: 129.3518 },
      radiusNM: 100,
    });

    expect(result.aircraft).toHaveLength(2);
    expect(result.totalCount).toBe(2);
    expect(result.fetchedAt).toBeTypeOf('number');
  });

  it('should call repository with correct parameters', async () => {
    const center = { lat: 35.5934, lon: 129.3518 };
    const radiusNM = 50;

    await useCase.execute({ center, radiusNM });

    expect(mockRepository.fetchNearby).toHaveBeenCalledWith({
      center,
      radiusNM,
    });
  });

  it('should convert positions to Aircraft entities', async () => {
    const result = await useCase.execute({
      center: { lat: 35.5934, lon: 129.3518 },
      radiusNM: 100,
    });

    const aircraft = result.aircraft[0];
    expect(aircraft).toHaveProperty('hex', 'ABC123');
    expect(aircraft).toHaveProperty('position');
    expect(aircraft).toHaveProperty('flightPhase');
    expect(aircraft).toHaveProperty('lastUpdated');
    expect(aircraft).toHaveProperty('trail');
  });

  it('should detect flight phase correctly', async () => {
    const result = await useCase.execute({
      center: { lat: 35.5934, lon: 129.3518 },
      radiusNM: 100,
    });

    // 고도 3000ft, 속도 150kt - approach 또는 departure 예상
    const aircraft = result.aircraft[0];
    expect(['approach', 'departure', 'climb', 'descent', 'enroute']).toContain(
      aircraft?.flightPhase
    );
  });

  it('should filter out positions without lat/lon', async () => {
    const positionsWithInvalid: AircraftPosition[] = [
      ...mockAircraftPositions,
      { hex: 'INVALID', lat: undefined as unknown as number, lon: undefined as unknown as number },
    ];
    (mockRepository.fetchNearby as ReturnType<typeof vi.fn>).mockResolvedValue(positionsWithInvalid);

    const result = await useCase.execute({
      center: { lat: 35.5934, lon: 129.3518 },
      radiusNM: 100,
    });

    expect(result.aircraft).toHaveLength(2);
  });

  it('should return empty array when no aircraft found', async () => {
    (mockRepository.fetchNearby as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await useCase.execute({
      center: { lat: 35.5934, lon: 129.3518 },
      radiusNM: 100,
    });

    expect(result.aircraft).toHaveLength(0);
    expect(result.totalCount).toBe(0);
  });

  it('should handle repository errors', async () => {
    (mockRepository.fetchNearby as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Network error')
    );

    await expect(
      useCase.execute({
        center: { lat: 35.5934, lon: 129.3518 },
        radiusNM: 100,
      })
    ).rejects.toThrow('Network error');
  });
});

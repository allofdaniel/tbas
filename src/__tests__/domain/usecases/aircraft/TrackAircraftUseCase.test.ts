/**
 * TrackAircraftUseCase 테스트
 * DO-278A 요구사항 추적: SRS-ACF-UC-002-TEST
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TrackAircraftUseCase } from '@/domain/usecases/aircraft/TrackAircraftUseCase';
import type { IAircraftRepository } from '@/domain/repositories/IAircraftRepository';
import type { AircraftDetails, AircraftTrailPoint } from '@/types';

describe('TrackAircraftUseCase', () => {
  let mockRepository: IAircraftRepository;
  let useCase: TrackAircraftUseCase;

  const mockDetails: AircraftDetails = {
    hex: 'ABC123',
    registration: 'HL7777',
    type: 'B737',
    operator: 'Korean Air',
  };

  const mockTrail: AircraftTrailPoint[] = [
    { lat: 35.590, lon: 129.350, altitude_ft: 2000, timestamp: Date.now() - 60000 },
    { lat: 35.592, lon: 129.351, altitude_ft: 2500, timestamp: Date.now() - 30000 },
    { lat: 35.594, lon: 129.352, altitude_ft: 3000, timestamp: Date.now() },
  ];

  beforeEach(() => {
    mockRepository = {
      fetchNearby: vi.fn().mockResolvedValue([]),
      fetchTrace: vi.fn().mockResolvedValue(mockTrail),
      fetchDetails: vi.fn().mockResolvedValue(mockDetails),
      fetchPhotoUrl: vi.fn().mockResolvedValue('https://example.com/photo.jpg'),
    };
    useCase = new TrackAircraftUseCase(mockRepository);
  });

  it('should fetch details and trail for aircraft', async () => {
    const result = await useCase.execute({
      hex: 'ABC123',
      includeDetails: true,
      includeTrace: true,
    });

    expect(result.hex).toBe('ABC123');
    expect(result.details).toEqual(mockDetails);
    expect(result.trail).toHaveLength(3);
    expect(result.trackedAt).toBeTypeOf('number');
  });

  it('should fetch photo when requested', async () => {
    const result = await useCase.execute({
      hex: 'ABC123',
      includePhoto: true,
    });

    expect(result.photoUrl).toBe('https://example.com/photo.jpg');
    expect(mockRepository.fetchPhotoUrl).toHaveBeenCalledWith('ABC123');
  });

  it('should not fetch photo when not requested', async () => {
    const result = await useCase.execute({
      hex: 'ABC123',
      includePhoto: false,
    });

    expect(result.photoUrl).toBeNull();
    expect(mockRepository.fetchPhotoUrl).not.toHaveBeenCalled();
  });

  it('should skip details when not requested', async () => {
    const result = await useCase.execute({
      hex: 'ABC123',
      includeDetails: false,
    });

    expect(result.details).toBeNull();
    expect(mockRepository.fetchDetails).not.toHaveBeenCalled();
  });

  it('should skip trace when not requested', async () => {
    const result = await useCase.execute({
      hex: 'ABC123',
      includeTrace: false,
    });

    expect(result.trail).toHaveLength(0);
    expect(mockRepository.fetchTrace).not.toHaveBeenCalled();
  });

  it('should filter abnormal jumps in trail', async () => {
    const trailWithJump: AircraftTrailPoint[] = [
      { lat: 35.590, lon: 129.350, altitude_ft: 2000, timestamp: Date.now() - 60000 },
      { lat: 35.592, lon: 129.351, altitude_ft: 2500, timestamp: Date.now() - 30000 },
      // 비정상 점프 (0.5도 이상)
      { lat: 36.100, lon: 129.352, altitude_ft: 3000, timestamp: Date.now() },
    ];
    (mockRepository.fetchTrace as ReturnType<typeof vi.fn>).mockResolvedValue(trailWithJump);

    const result = await useCase.execute({
      hex: 'ABC123',
      includeTrace: true,
    });

    // 비정상 점프가 필터링되어야 함
    expect(result.trail.length).toBeLessThan(3);
  });

  it('should call all fetch methods in parallel', async () => {
    const detailsPromise = new Promise<AircraftDetails>((resolve) =>
      setTimeout(() => resolve(mockDetails), 100)
    );
    const tracePromise = new Promise<AircraftTrailPoint[]>((resolve) =>
      setTimeout(() => resolve(mockTrail), 100)
    );
    const photoPromise = new Promise<string>((resolve) =>
      setTimeout(() => resolve('photo.jpg'), 100)
    );

    (mockRepository.fetchDetails as ReturnType<typeof vi.fn>).mockReturnValue(detailsPromise);
    (mockRepository.fetchTrace as ReturnType<typeof vi.fn>).mockReturnValue(tracePromise);
    (mockRepository.fetchPhotoUrl as ReturnType<typeof vi.fn>).mockReturnValue(photoPromise);

    const startTime = Date.now();
    await useCase.execute({
      hex: 'ABC123',
      includeDetails: true,
      includeTrace: true,
      includePhoto: true,
    });
    const elapsed = Date.now() - startTime;

    // 병렬 호출이므로 300ms 미만이어야 함
    expect(elapsed).toBeLessThan(300);
  });

  it('should handle null details from repository', async () => {
    (mockRepository.fetchDetails as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await useCase.execute({
      hex: 'ABC123',
      includeDetails: true,
    });

    expect(result.details).toBeNull();
  });

  it('should handle empty trail from repository', async () => {
    (mockRepository.fetchTrace as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await useCase.execute({
      hex: 'ABC123',
      includeTrace: true,
    });

    expect(result.trail).toHaveLength(0);
  });
});

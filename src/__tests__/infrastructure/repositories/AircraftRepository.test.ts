/**
 * AircraftRepository Tests
 * DO-278A 요구사항 추적: SRS-REPO-002
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AircraftRepository } from '@/infrastructure/repositories/AircraftRepository';
import type { AircraftApiClient } from '@/infrastructure/api/clients/AircraftApiClient';
import type { AircraftPosition, AircraftTrailPoint } from '@/types';

describe('AircraftRepository', () => {
  let repository: AircraftRepository;
  let mockApiClient: AircraftApiClient;

  const mockAircraftPositions: AircraftPosition[] = [
    {
      hex: 'abc123',
      lat: 35.5,
      lon: 129.3,
      altitude_baro: 35000,
      ground_speed: 450,
      track: 90,
      flight: 'KAL1234',
      r: 'HL7777',
      t: 'B773',
    },
    {
      hex: 'def456',
      lat: 35.6,
      lon: 129.4,
      altitude_baro: 28000,
      ground_speed: 380,
      track: 180,
      flight: 'AAR5678',
      r: 'HL8888',
      t: 'A321',
    },
  ];

  const mockTrailPoints: AircraftTrailPoint[] = [
    { lat: 35.5, lon: 129.3, altitude: 35000, timestamp: Date.now() - 60000, ground_speed: 450, track: 90 },
    { lat: 35.55, lon: 129.35, altitude: 35100, timestamp: Date.now() - 30000, ground_speed: 452, track: 92 },
    { lat: 35.6, lon: 129.4, altitude: 35200, timestamp: Date.now(), ground_speed: 455, track: 95 },
  ];

  beforeEach(() => {
    mockApiClient = {
      fetchNearby: vi.fn().mockResolvedValue(mockAircraftPositions),
      fetchTrace: vi.fn().mockResolvedValue(mockTrailPoints),
      fetchDetails: vi.fn().mockResolvedValue(mockAircraftPositions[0]),
      fetchPhotoUrl: vi.fn().mockResolvedValue('https://example.com/photo.jpg'),
      clearCache: vi.fn(),
    } as unknown as AircraftApiClient;

    repository = new AircraftRepository(mockApiClient);
  });

  describe('fetchNearby', () => {
    it('should fetch aircraft within specified radius', async () => {
      const options = {
        center: { lat: 35.5, lon: 129.3 },
        radiusNM: 100,
      };

      const result = await repository.fetchNearby(options);

      expect(result).toEqual(mockAircraftPositions);
      expect(mockApiClient.fetchNearby).toHaveBeenCalledWith(
        { lat: 35.5, lon: 129.3 },
        100
      );
    });

    it('should handle empty results', async () => {
      vi.mocked(mockApiClient.fetchNearby).mockResolvedValue([]);

      const result = await repository.fetchNearby({
        center: { lat: 0, lon: 0 },
        radiusNM: 50,
      });

      expect(result).toEqual([]);
    });
  });

  describe('fetchTrace', () => {
    it('should fetch aircraft trail by hex', async () => {
      const result = await repository.fetchTrace('abc123');

      expect(result).toEqual(mockTrailPoints);
      expect(mockApiClient.fetchTrace).toHaveBeenCalledWith('abc123');
    });

    it('should handle non-existent aircraft', async () => {
      vi.mocked(mockApiClient.fetchTrace).mockResolvedValue([]);

      const result = await repository.fetchTrace('unknown');

      expect(result).toEqual([]);
    });
  });

  describe('fetchDetails', () => {
    it('should fetch and transform aircraft details', async () => {
      const result = await repository.fetchDetails('abc123');

      expect(result).toEqual({
        hex: 'abc123',
        registration: 'HL7777',
        type: 'B773',
      });
      expect(mockApiClient.fetchDetails).toHaveBeenCalledWith('abc123');
    });

    it('should return null when aircraft not found', async () => {
      vi.mocked(mockApiClient.fetchDetails).mockResolvedValue(null);

      const result = await repository.fetchDetails('unknown');

      expect(result).toBeNull();
    });

    it('should handle aircraft without registration', async () => {
      const positionWithoutReg = {
        hex: 'xyz789',
        lat: 35.5,
        lon: 129.3,
      } as AircraftPosition;
      vi.mocked(mockApiClient.fetchDetails).mockResolvedValue(positionWithoutReg);

      const result = await repository.fetchDetails('xyz789');

      expect(result).toEqual({
        hex: 'xyz789',
        registration: undefined,
        type: undefined,
      });
    });
  });

  describe('fetchPhotoUrl', () => {
    it('should fetch photo URL when registration provided', async () => {
      const result = await repository.fetchPhotoUrl('abc123', 'HL7777');

      expect(result).toBe('https://example.com/photo.jpg');
      expect(mockApiClient.fetchPhotoUrl).toHaveBeenCalledWith('HL7777');
    });

    it('should return null when registration not provided', async () => {
      const result = await repository.fetchPhotoUrl('abc123');

      expect(result).toBeNull();
      expect(mockApiClient.fetchPhotoUrl).not.toHaveBeenCalled();
    });

    it('should return null when registration is empty string', async () => {
      const result = await repository.fetchPhotoUrl('abc123', '');

      expect(result).toBeNull();
    });
  });

  describe('clearCache', () => {
    it('should clear API client cache', () => {
      repository.clearCache();

      expect(mockApiClient.clearCache).toHaveBeenCalled();
    });
  });
});

describe('AircraftRepository singleton', () => {
  it('should use default API client when none provided', () => {
    const repository = new AircraftRepository();
    expect(repository).toBeDefined();
  });
});

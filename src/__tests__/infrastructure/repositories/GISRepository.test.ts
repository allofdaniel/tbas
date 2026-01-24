/**
 * GISRepository Tests
 * DO-278A 요구사항 추적: SRS-REPO-004
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GISRepository } from '@/infrastructure/repositories/GISRepository';
import type { GISApiClient } from '@/infrastructure/api/clients/GISApiClient';
import type { Waypoint, Route, Airspace, FlightProcedure } from '@/types';

describe('GISRepository', () => {
  let repository: GISRepository;
  let mockApiClient: GISApiClient;

  const mockWaypoints: Waypoint[] = [
    { id: '1', ident: 'RKPU', name: 'Ulsan Airport', type: 'airport', lat: 35.5934, lon: 129.3518 },
    { id: '2', ident: 'DOTOL', name: 'DOTOL', type: 'waypoint', lat: 35.6, lon: 129.4 },
    { id: '3', ident: 'PSN', name: 'Pohang VOR', type: 'navaid', lat: 35.9877, lon: 129.4204 },
  ];

  const mockRoutes: Route[] = [
    { name: 'Y711', type: 'ATS', points: [
      { id: '1', ident: 'WP1', name: 'Waypoint 1', type: 'waypoint', lat: 35.5, lon: 129.3 },
      { id: '2', ident: 'WP2', name: 'Waypoint 2', type: 'waypoint', lat: 35.6, lon: 129.4 }
    ] },
    { name: 'B576', type: 'RNAV', points: [
      { id: '3', ident: 'WP3', name: 'Waypoint 3', type: 'waypoint', lat: 35.6, lon: 129.4 },
      { id: '4', ident: 'WP4', name: 'Waypoint 4', type: 'waypoint', lat: 35.7, lon: 129.5 }
    ] },
  ];

  const mockAirspaces: Airspace[] = [
    { id: '1', name: 'RKPU CTR', type: 'CTR', lowerLimit: 0, upperLimit: 5000 },
    { id: '2', name: 'Ulsan TMA', type: 'TMA', lowerLimit: 0, upperLimit: 14000 },
    { id: '3', name: 'Incheon FIR', type: 'FIR', lowerLimit: 0, upperLimit: 60000 },
    { id: '4', name: 'Daegu ACC', type: 'ACC', lowerLimit: 24500, upperLimit: 60000 },
  ];

  const mockProcedures: FlightProcedure[] = [
    { name: 'OSBON1B', displayName: 'OSBON 1B', type: 'SID', runway: '36', segments: [] },
    { name: 'GUKDO1A', displayName: 'GUKDO 1A', type: 'STAR', runway: '36', segments: [] },
    { name: 'ILS36', displayName: 'ILS RWY 36', type: 'APPROACH', runway: '36', segments: [] },
  ];

  const mockNavaids = [
    { id: '1', ident: 'PSN', name: 'Pohang', lat: 35.9877, lon: 129.4204, frequency: 112.4 },
    { id: '2', ident: 'KJR', name: 'Kijang', lat: 35.3, lon: 129.2, frequency: 115.2 },
  ];

  const mockObstacles = [
    { id: '1', name: 'Tower 1', type: 'Tower', lat: 35.59, lon: 129.35, heightAgl: 100, heightMsl: 150 },
    { id: '2', name: 'Building 1', type: 'Building', lat: 35.58, lon: 129.34, heightAgl: 50, heightMsl: 100 },
  ];

  const mockRunways = [
    { id: '1', name: '36', heading: 360, length: 2743, width: 45, threshold: { lat: 35.59, lon: 129.35 }, end: { lat: 35.61, lon: 129.35 } },
    { id: '2', name: '18', heading: 180, length: 2743, width: 45, threshold: { lat: 35.61, lon: 129.35 }, end: { lat: 35.59, lon: 129.35 } },
  ];

  beforeEach(() => {
    mockApiClient = {
      getWaypoints: vi.fn().mockResolvedValue(mockWaypoints),
      getRoutes: vi.fn().mockResolvedValue(mockRoutes),
      getAirspaces: vi.fn().mockResolvedValue(mockAirspaces),
      getProcedures: vi.fn().mockImplementation((type: string) => {
        return Promise.resolve(mockProcedures.filter(p => p.type === type));
      }),
      getNavaids: vi.fn().mockResolvedValue(mockNavaids),
      getObstacles: vi.fn().mockResolvedValue(mockObstacles),
      getRunways: vi.fn().mockResolvedValue(mockRunways),
      clearCache: vi.fn(),
    } as unknown as GISApiClient;

    repository = new GISRepository(mockApiClient);
  });

  describe('loadAviationData', () => {
    it('should load all aviation data for an airport', async () => {
      const result = await repository.loadAviationData('RKPU');

      expect(result).not.toBeNull();
      expect(result?.airport.icao).toBe('RKPU');
      expect(result?.waypoints).toEqual(mockWaypoints);
      expect(result?.routes).toEqual(mockRoutes);
      expect(result?.airspaces).toEqual(mockAirspaces);
    });

    it('should organize procedures by type', async () => {
      const result = await repository.loadAviationData('RKPU');

      expect(result?.procedures.SID).toBeDefined();
      expect(result?.procedures.STAR).toBeDefined();
      expect(result?.procedures.APPROACH).toBeDefined();
    });

    it('should transform navaids with correct type', async () => {
      const result = await repository.loadAviationData('RKPU');

      expect(result?.navaids.every(n => n.type === 'navaid')).toBe(true);
    });

    it('should transform obstacles with correct properties', async () => {
      const result = await repository.loadAviationData('RKPU');

      expect(result?.obstacles.length).toBe(2);
      const firstObstacle = result?.obstacles[0];
      expect(firstObstacle).toBeDefined();
      if (firstObstacle) {
        expect(firstObstacle.elevation_amsl_ft).toBe(150);
        expect(firstObstacle.height_agl_ft).toBe(100);
      }
    });

    it('should return null on API error', async () => {
      vi.mocked(mockApiClient.getWaypoints).mockRejectedValue(new Error('API Error'));

      const result = await repository.loadAviationData('RKPU');

      expect(result).toBeNull();
    });
  });

  describe('loadKoreaAirspace', () => {
    it('should load national airspace data', async () => {
      const result = await repository.loadKoreaAirspace();

      expect(result).not.toBeNull();
      expect(result?.metadata.source).toBe('eAIP Korea');
      expect(result?.waypoints).toEqual(mockWaypoints);
      expect(result?.routes).toEqual(mockRoutes);
    });

    it('should include metadata with AIRAC date', async () => {
      const result = await repository.loadKoreaAirspace();

      expect(result?.metadata.airac).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result?.metadata.url).toBe('https://aim.koca.go.kr');
    });

    it('should return null on API error', async () => {
      vi.mocked(mockApiClient.getWaypoints).mockRejectedValue(new Error('API Error'));

      const result = await repository.loadKoreaAirspace();

      expect(result).toBeNull();
    });
  });

  describe('loadAtcSectors', () => {
    it('should organize airspaces by ATC sector type', async () => {
      const result = await repository.loadAtcSectors();

      expect(result).not.toBeNull();
    });

    it('should filter CTR airspaces', async () => {
      const result = await repository.loadAtcSectors();

      expect(result?.CTR).toBeDefined();
    });

    it('should filter TMA airspaces', async () => {
      const result = await repository.loadAtcSectors();

      expect(result?.TMA).toBeDefined();
    });

    it('should find FIR airspace', async () => {
      const result = await repository.loadAtcSectors();

      expect(result?.FIR?.type).toBe('FIR');
    });
  });

  describe('getWaypoints', () => {
    it('should fetch waypoints', async () => {
      const result = await repository.getWaypoints();

      expect(result).toEqual(mockWaypoints);
      expect(mockApiClient.getWaypoints).toHaveBeenCalledWith('local');
    });
  });

  describe('getRoutes', () => {
    it('should fetch routes', async () => {
      const result = await repository.getRoutes();

      expect(result).toEqual(mockRoutes);
      expect(mockApiClient.getRoutes).toHaveBeenCalledWith('local');
    });
  });

  describe('getAirspaces', () => {
    it('should fetch airspaces', async () => {
      const result = await repository.getAirspaces();

      expect(result).toEqual(mockAirspaces);
      expect(mockApiClient.getAirspaces).toHaveBeenCalledWith('local');
    });
  });

  describe('getProcedures', () => {
    it('should fetch all procedure types', async () => {
      const result = await repository.getProcedures('RKPU');

      expect(result.SID).toBeDefined();
      expect(result.STAR).toBeDefined();
      expect(result.APPROACH).toBeDefined();
      expect(mockApiClient.getProcedures).toHaveBeenCalledWith('SID');
      expect(mockApiClient.getProcedures).toHaveBeenCalledWith('STAR');
      expect(mockApiClient.getProcedures).toHaveBeenCalledWith('APPROACH');
    });
  });

  describe('getObstacles', () => {
    it('should fetch obstacles', async () => {
      const result = await repository.getObstacles();

      expect(result).toEqual(mockObstacles);
    });
  });

  describe('getRunways', () => {
    it('should fetch runways', async () => {
      const result = await repository.getRunways();

      expect(result).toEqual(mockRunways);
    });
  });

  describe('clearCache', () => {
    it('should clear API client cache', () => {
      repository.clearCache();

      expect(mockApiClient.clearCache).toHaveBeenCalled();
    });
  });
});

describe('GISRepository singleton', () => {
  it('should use default API client when none provided', () => {
    const repository = new GISRepository();
    expect(repository).toBeDefined();
  });
});

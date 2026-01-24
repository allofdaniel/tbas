/**
 * GetWaypointsUseCase Tests
 * DO-278A 요구사항 추적: SRS-GIS-UC-002
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetWaypointsUseCase } from '@/domain/usecases/gis/GetWaypointsUseCase';
import type { IGISRepository } from '@/domain/repositories/IGISRepository';
import type { Waypoint } from '@/types';

describe('GetWaypointsUseCase', () => {
  let mockRepository: IGISRepository;
  let useCase: GetWaypointsUseCase;
  let mockWaypoints: Waypoint[];

  beforeEach(() => {
    mockWaypoints = [
      { id: '1', ident: 'RKPK', name: 'Gimhae Intl', type: 'airport', lat: 35.1795, lon: 128.9383 },
      { id: '2', ident: 'RKSS', name: 'Gimpo Intl', type: 'airport', lat: 37.5587, lon: 126.7906 },
      { id: '3', ident: 'PSN', name: 'Pohang VOR', type: 'navaid', lat: 35.9877, lon: 129.4204 },
      { id: '4', ident: 'DOTOL', name: 'DOTOL', type: 'waypoint', lat: 36.0, lon: 129.0 },
      { id: '5', ident: 'GUKDO', name: 'GUKDO', type: 'waypoint', lat: 35.5, lon: 129.5 },
    ];

    mockRepository = {
      getWaypoints: vi.fn().mockResolvedValue(mockWaypoints),
      getAirspaces: vi.fn().mockResolvedValue([]),
      getRoutes: vi.fn().mockResolvedValue([]),
      getProcedures: vi.fn().mockResolvedValue({ SID: [], STAR: [], APPROACH: [] }),
      loadAviationData: vi.fn().mockResolvedValue(null),
      loadKoreaAirspace: vi.fn().mockResolvedValue(null),
      loadAtcSectors: vi.fn().mockResolvedValue(null),
    };

    useCase = new GetWaypointsUseCase(mockRepository);
  });

  describe('execute', () => {
    it('should return all waypoints when no filters applied', async () => {
      const result = await useCase.execute();

      expect(mockRepository.getWaypoints).toHaveBeenCalled();
      expect(result.waypoints).toHaveLength(5);
      expect(result.totalCount).toBe(5);
      expect(result.fetchedAt).toBeGreaterThan(0);
    });

    it('should filter by type', async () => {
      const result = await useCase.execute({ types: ['airport'] });

      expect(result.waypoints).toHaveLength(2);
      expect(result.waypoints.every(w => w.type === 'airport')).toBe(true);
    });

    it('should filter by multiple types', async () => {
      const result = await useCase.execute({ types: ['airport', 'navaid'] });

      expect(result.waypoints).toHaveLength(3);
      expect(result.byType.airports).toHaveLength(2);
      expect(result.byType.navaids).toHaveLength(1);
    });

    it('should filter by location', async () => {
      // Filter around RKPK (35.1795, 128.9383) with small radius
      const result = await useCase.execute({
        filterByLocation: { lat: 35.1795, lon: 128.9383 },
        radiusNM: 30, // Small radius to only get nearby waypoints
      });

      // Should find RKPK and maybe GUKDO
      expect(result.waypoints.some(w => w.ident === 'RKPK')).toBe(true);
    });

    it('should filter by search query (ident)', async () => {
      const result = await useCase.execute({ searchQuery: 'RK' });

      expect(result.waypoints).toHaveLength(2);
      expect(result.waypoints.every(w => w.ident.includes('RK'))).toBe(true);
    });

    it('should filter by search query (name)', async () => {
      const result = await useCase.execute({ searchQuery: 'Gimhae' });

      expect(result.waypoints).toHaveLength(1);
      const firstWaypoint = result.waypoints[0];
      expect(firstWaypoint?.ident).toBe('RKPK');
    });

    it('should be case-insensitive for search', async () => {
      const result = await useCase.execute({ searchQuery: 'gimhae' });

      expect(result.waypoints).toHaveLength(1);
      const firstWaypoint = result.waypoints[0];
      expect(firstWaypoint?.ident).toBe('RKPK');
    });

    it('should categorize waypoints by type', async () => {
      const result = await useCase.execute();

      expect(result.byType.airports).toHaveLength(2);
      expect(result.byType.navaids).toHaveLength(1);
      expect(result.byType.waypoints).toHaveLength(2);
    });

    it('should combine multiple filters', async () => {
      const result = await useCase.execute({
        types: ['airport'],
        searchQuery: 'Gimhae',
      });

      expect(result.waypoints).toHaveLength(1);
      const firstWaypoint = result.waypoints[0];
      expect(firstWaypoint?.ident).toBe('RKPK');
    });
  });

  describe('findByIdent', () => {
    it('should find waypoint by exact ident', async () => {
      const result = await useCase.findByIdent('RKPK');

      expect(result).not.toBeNull();
      expect(result?.ident).toBe('RKPK');
      expect(result?.name).toBe('Gimhae Intl');
    });

    it('should be case-insensitive', async () => {
      const result = await useCase.findByIdent('rkpk');

      expect(result).not.toBeNull();
      expect(result?.ident).toBe('RKPK');
    });

    it('should return null for unknown ident', async () => {
      const result = await useCase.findByIdent('UNKNOWN');

      expect(result).toBeNull();
    });
  });
});

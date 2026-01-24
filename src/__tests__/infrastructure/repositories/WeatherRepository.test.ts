/**
 * WeatherRepository Tests
 * DO-278A 요구사항 추적: SRS-REPO-003
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WeatherRepository } from '@/infrastructure/repositories/WeatherRepository';
import type { WeatherApiClient, InternalMetarData, InternalTafData, InternalUpperWindData } from '@/infrastructure/api/clients/WeatherApiClient';
import type { SigmetData } from '@/types';

describe('WeatherRepository', () => {
  let repository: WeatherRepository;
  let mockApiClient: {
    fetchMetar: ReturnType<typeof vi.fn>;
    fetchTaf: ReturnType<typeof vi.fn>;
    fetchSigmet: ReturnType<typeof vi.fn>;
    fetchAirmet: ReturnType<typeof vi.fn>;
    fetchUpperWind: ReturnType<typeof vi.fn>;
    fetchRadar: ReturnType<typeof vi.fn>;
    fetchSatellite: ReturnType<typeof vi.fn>;
    fetchLightning: ReturnType<typeof vi.fn>;
    fetchLLWS: ReturnType<typeof vi.fn>;
    clearCache: ReturnType<typeof vi.fn>;
  };

  const mockMetar: InternalMetarData = {
    icao: 'RKPU',
    obsTime: new Date('2024-01-20T12:00:00Z'),
    temp: 15,
    dewpoint: 8,
    windDirection: 360,
    windSpeed: 10,
    visibility: 10,
    ceiling: 3000,
    rawMetar: 'RKPU 201200Z 36010KT 9999 FEW030 15/08 Q1013',
    altimeter: 1013,
    flightCategory: 'VFR',
    source: 'AWOS',
  };

  const mockTaf: InternalTafData = {
    icao: 'RKPU',
    rawTaf: 'RKPU 201200Z 2012/2112 36010KT 9999 SCT030 TEMPO 2012/2018 4000 RA',
    validFrom: new Date('2024-01-20T12:00:00Z'),
    validTo: new Date('2024-01-21T12:00:00Z'),
    issueTime: new Date('2024-01-20T12:00:00Z'),
  };

  const mockSigmet: SigmetData[] = [
    {
      id: '1',
      type: 'THUNDERSTORM',
      hazard: 'TS',
      raw: 'SIGMET test raw',
      validFrom: '2024-01-20T12:00:00Z',
      validTo: '2024-01-20T18:00:00Z',
      coords: [{ lat: 35.5, lon: 129.3 }, { lat: 35.6, lon: 129.4 }],
    },
  ];

  const mockUpperWind: InternalUpperWindData = {
    time: '2024-01-20T12:00:00Z',
    grid: [
      {
        lat: 35.5,
        lon: 129.3,
        name: 'Ulsan',
        levels: {
          '850': { altitude_m: 1500, windDirection: 270, windSpeed: 25 },
          '500': { altitude_m: 5500, windDirection: 280, windSpeed: 45 },
        },
      },
    ],
    source: 'Open-Meteo',
  };

  const mockRadar = {
    composite: 'https://kma.go.kr/radar/composite.png',
    echoTop: 'https://kma.go.kr/radar/echotop.png',
    vil: 'https://kma.go.kr/radar/vil.png',
    time: '2024-01-20T12:00:00Z',
    bounds: [[33.0, 125.0], [38.5, 132.0]],
  };

  const mockSatellite = {
    vis: 'https://kma.go.kr/satellite/vis.png',
    ir: 'https://kma.go.kr/satellite/ir.png',
    wv: 'https://kma.go.kr/satellite/wv.png',
    enhir: 'https://kma.go.kr/satellite/enhir.png',
    time: '2024-01-20T12:00:00Z',
    bounds: [[33.0, 125.0], [38.5, 132.0]],
  };

  const mockLightning = {
    strikes: [
      { lat: 35.5, lon: 129.3, time: '2024-01-20T12:00:00Z', amplitude: -25, type: 'CG' },
      { lat: 35.6, lon: 129.4, time: '2024-01-20T12:01:00Z', amplitude: 30, type: 'IC' },
    ],
    timeRange: { start: '2024-01-20T11:00:00Z', end: '2024-01-20T12:00:00Z' },
  };

  const mockLlws = [
    {
      airport: 'RKPU',
      runway: '36',
      type: 'WS',
      altitude: 200,
      loss: -15,
      time: '2024-01-20T12:00:00Z',
    },
  ];

  beforeEach(() => {
    mockApiClient = {
      fetchMetar: vi.fn().mockResolvedValue([mockMetar]),
      fetchTaf: vi.fn().mockResolvedValue([mockTaf]),
      fetchSigmet: vi.fn().mockResolvedValue(mockSigmet),
      fetchAirmet: vi.fn().mockResolvedValue([]),
      fetchUpperWind: vi.fn().mockResolvedValue(mockUpperWind),
      fetchRadar: vi.fn().mockResolvedValue(mockRadar),
      fetchSatellite: vi.fn().mockResolvedValue(mockSatellite),
      fetchLightning: vi.fn().mockResolvedValue(mockLightning),
      fetchLLWS: vi.fn().mockResolvedValue(mockLlws),
      clearCache: vi.fn(),
    };

    repository = new WeatherRepository(mockApiClient as unknown as WeatherApiClient);
  });

  describe('fetchMetar', () => {
    it('should fetch and transform METAR data', async () => {
      const result = await repository.fetchMetar('RKPU');

      expect(result).not.toBeNull();
      expect(result?.icaoId).toBe('RKPU');
      expect(result?.temp).toBe(15);
      expect(result?.dewp).toBe(8);
      expect(result?.wdir).toBe(360);
      expect(result?.wspd).toBe(10);
      expect(result?.rawOb).toContain('RKPU');
    });

    it('should determine VFR flight category correctly', async () => {
      const result = await repository.fetchMetar('RKPU');

      expect(result?.fltCat).toBe('VFR');
    });

    it('should determine MVFR flight category', async () => {
      const mvfrMetar: InternalMetarData = { ...mockMetar, visibility: 4, ceiling: 2500 };
      mockApiClient.fetchMetar.mockResolvedValue([mvfrMetar]);

      const result = await repository.fetchMetar('RKPU');

      expect(result?.fltCat).toBe('MVFR');
    });

    it('should determine IFR flight category', async () => {
      const ifrMetar: InternalMetarData = { ...mockMetar, visibility: 2, ceiling: 800 };
      mockApiClient.fetchMetar.mockResolvedValue([ifrMetar]);

      const result = await repository.fetchMetar('RKPU');

      expect(result?.fltCat).toBe('IFR');
    });

    it('should determine LIFR flight category', async () => {
      const lifrMetar: InternalMetarData = { ...mockMetar, visibility: 0.5, ceiling: 400 };
      mockApiClient.fetchMetar.mockResolvedValue([lifrMetar]);

      const result = await repository.fetchMetar('RKPU');

      expect(result?.fltCat).toBe('LIFR');
    });

    it('should return null when no METAR data', async () => {
      mockApiClient.fetchMetar.mockResolvedValue([]);

      const result = await repository.fetchMetar('RKPU');

      expect(result).toBeNull();
    });

    it('should return null when API returns null', async () => {
      mockApiClient.fetchMetar.mockResolvedValue(null);

      const result = await repository.fetchMetar('RKPU');

      expect(result).toBeNull();
    });
  });

  describe('fetchTaf', () => {
    it('should fetch and transform TAF data', async () => {
      const result = await repository.fetchTaf('RKPU');

      expect(result).not.toBeNull();
      expect(result?.icaoId).toBe('RKPU');
      expect(result?.rawTAF).toContain('RKPU');
    });

    it('should return null when no TAF data', async () => {
      mockApiClient.fetchTaf.mockResolvedValue([]);

      const result = await repository.fetchTaf('RKPU');

      expect(result).toBeNull();
    });
  });

  describe('fetchSigmet', () => {
    it('should fetch SIGMET data', async () => {
      const result = await repository.fetchSigmet();

      expect(result).toEqual(mockSigmet);
    });
  });

  describe('fetchAirmet', () => {
    it('should fetch AIRMET data', async () => {
      const mockAirmet: SigmetData[] = [
        { id: '1', type: 'OTHER', hazard: 'TURB', raw: 'AIRMET raw text', validFrom: '', validTo: '', coords: [] },
      ];
      mockApiClient.fetchAirmet.mockResolvedValue(mockAirmet);

      const result = await repository.fetchAirmet();

      expect(result).toEqual(mockAirmet);
    });
  });

  describe('fetchUpperWind', () => {
    it('should fetch and transform upper wind data', async () => {
      const result = await repository.fetchUpperWind();

      expect(result).not.toBeNull();
      expect(result?.source).toBe('Open-Meteo');
      expect(result?.grid.length).toBe(1);
    });

    it('should transform levels correctly', async () => {
      const result = await repository.fetchUpperWind();

      const firstGrid = result?.grid[0];
      expect(firstGrid?.levels['850']).toBeDefined();
      if (firstGrid) {
        expect(firstGrid.levels['850']?.wind_dir).toBe(270);
        expect(firstGrid.levels['850']?.wind_spd_kt).toBe(25);
      }
    });

    it('should return null when API returns null', async () => {
      mockApiClient.fetchUpperWind.mockResolvedValue(null);

      const result = await repository.fetchUpperWind();

      expect(result).toBeNull();
    });
  });

  describe('fetchRadar', () => {
    it('should fetch radar data', async () => {
      const result = await repository.fetchRadar();

      expect(result).not.toBeNull();
      expect(result?.composite).toBe(mockRadar.composite);
      expect(result?.echoTop).toBe(mockRadar.echoTop);
    });

    it('should return null when API returns null', async () => {
      mockApiClient.fetchRadar.mockResolvedValue(null);

      const result = await repository.fetchRadar();

      expect(result).toBeNull();
    });
  });

  describe('fetchSatellite', () => {
    it('should fetch satellite data', async () => {
      const result = await repository.fetchSatellite();

      expect(result).not.toBeNull();
      expect(result?.vis).toBe(mockSatellite.vis);
      expect(result?.ir).toBe(mockSatellite.ir);
    });

    it('should return null when API returns null', async () => {
      mockApiClient.fetchSatellite.mockResolvedValue(null);

      const result = await repository.fetchSatellite();

      expect(result).toBeNull();
    });
  });

  describe('fetchLightning', () => {
    it('should fetch and transform lightning data', async () => {
      const result = await repository.fetchLightning();

      expect(result.length).toBe(2);
      const strike = result[0];
      expect(strike?.lat).toBe(35.5);
      expect(strike?.lon).toBe(129.3);
      expect(strike?.amplitude).toBe(-25);
      expect(strike?.type).toBe('CG');
    });

    it('should return empty array when no strikes', async () => {
      mockApiClient.fetchLightning.mockResolvedValue({
        strikes: [],
        timeRange: { start: '', end: '' }
      });

      const result = await repository.fetchLightning();

      expect(result).toEqual([]);
    });

    it('should return empty array when API returns null', async () => {
      mockApiClient.fetchLightning.mockResolvedValue(null);

      const result = await repository.fetchLightning();

      expect(result).toEqual([]);
    });
  });

  describe('fetchLlws', () => {
    it('should fetch LLWS data', async () => {
      const result = await repository.fetchLlws();

      expect(result).toEqual(mockLlws);
    });
  });

  describe('clearCache', () => {
    it('should clear API client cache', () => {
      repository.clearCache();

      expect(mockApiClient.clearCache).toHaveBeenCalled();
    });
  });
});

describe('WeatherRepository singleton', () => {
  it('should use default API client when none provided', () => {
    const repository = new WeatherRepository();
    expect(repository).toBeDefined();
  });
});

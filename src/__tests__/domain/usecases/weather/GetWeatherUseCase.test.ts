/**
 * GetWeatherUseCase 테스트
 * DO-278A 요구사항 추적: SRS-WX-UC-001-TEST
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetWeatherUseCase } from '@/domain/usecases/weather/GetWeatherUseCase';
import type { IWeatherRepository } from '@/domain/repositories/IWeatherRepository';
import type { MetarData, TafData } from '@/types';

describe('GetWeatherUseCase', () => {
  let mockRepository: IWeatherRepository;
  let useCase: GetWeatherUseCase;

  const mockMetar: MetarData = {
    icaoId: 'RKPU',
    obsTime: new Date().toISOString(),
    temp: 15,
    dewp: 10,
    wdir: 270,
    wspd: 10,
    visib: 10,
    ceiling: 3000,
    fltCat: 'VFR',
    rawOb: 'RKPU 120000Z 27010KT 9999 FEW030 15/10 Q1013',
  };

  const mockTaf: TafData = {
    icaoId: 'RKPU',
    rawTAF: 'TAF RKPU 120000Z 1200/1306 27010KT 9999 FEW030',
    validTimeFrom: new Date().toISOString(),
    validTimeTo: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };

  beforeEach(() => {
    mockRepository = {
      fetchMetar: vi.fn().mockResolvedValue(mockMetar),
      fetchTaf: vi.fn().mockResolvedValue(mockTaf),
      fetchSigmet: vi.fn().mockResolvedValue([]),
      fetchAirmet: vi.fn().mockResolvedValue([]),
      fetchUpperWind: vi.fn().mockResolvedValue(null),
      fetchRadar: vi.fn().mockResolvedValue(null),
      fetchSatellite: vi.fn().mockResolvedValue(null),
      fetchLightning: vi.fn().mockResolvedValue([]),
      fetchLlws: vi.fn().mockResolvedValue([]),
    };
    useCase = new GetWeatherUseCase(mockRepository);
  });

  it('should fetch METAR and TAF for airport', async () => {
    const result = await useCase.execute({ icao: 'RKPU' });

    expect(result.icao).toBe('RKPU');
    expect(result.metar).toEqual(mockMetar);
    expect(result.taf).toEqual(mockTaf);
    expect(result.fetchedAt).toBeTypeOf('number');
  });

  it('should assess weather risk as low for VFR conditions', async () => {
    const result = await useCase.execute({ icao: 'RKPU' });

    expect(result.riskAssessment.level).toBe('low');
    expect(result.riskAssessment.factors).toContain('Good weather conditions');
  });

  it('should assess weather risk as severe for LIFR conditions', async () => {
    const lifrMetar: MetarData = {
      ...mockMetar,
      fltCat: 'LIFR',
      visib: 0.5,
      ceiling: 100,
    };
    (mockRepository.fetchMetar as ReturnType<typeof vi.fn>).mockResolvedValue(lifrMetar);

    const result = await useCase.execute({ icao: 'RKPU' });

    expect(result.riskAssessment.level).toBe('severe');
    expect(result.riskAssessment.factors).toContain('LIFR conditions');
  });

  it('should assess weather risk for IFR conditions', async () => {
    const ifrMetar: MetarData = {
      ...mockMetar,
      fltCat: 'IFR',
      visib: 2,
      ceiling: 400,
    };
    (mockRepository.fetchMetar as ReturnType<typeof vi.fn>).mockResolvedValue(ifrMetar);

    const result = await useCase.execute({ icao: 'RKPU' });

    expect(result.riskAssessment.level).toBe('high');
    expect(result.riskAssessment.factors).toContain('IFR conditions');
  });

  it('should assess weather risk for MVFR conditions', async () => {
    const mvfrMetar: MetarData = {
      ...mockMetar,
      fltCat: 'MVFR',
      visib: 4,
      ceiling: 1500,
    };
    (mockRepository.fetchMetar as ReturnType<typeof vi.fn>).mockResolvedValue(mvfrMetar);

    const result = await useCase.execute({ icao: 'RKPU' });

    expect(result.riskAssessment.level).toBe('moderate');
    expect(result.riskAssessment.factors).toContain('MVFR conditions');
  });

  it('should assess high risk for strong winds', async () => {
    const windyMetar: MetarData = {
      ...mockMetar,
      wspd: 30,
      wgst: 40,
    };
    (mockRepository.fetchMetar as ReturnType<typeof vi.fn>).mockResolvedValue(windyMetar);

    const result = await useCase.execute({ icao: 'RKPU' });

    expect(result.riskAssessment.factors.some((f) => f.includes('Strong winds'))).toBe(true);
  });

  it('should skip METAR when not requested', async () => {
    const result = await useCase.execute({
      icao: 'RKPU',
      includeMetar: false,
    });

    expect(result.metar).toBeNull();
    expect(mockRepository.fetchMetar).not.toHaveBeenCalled();
  });

  it('should skip TAF when not requested', async () => {
    const result = await useCase.execute({
      icao: 'RKPU',
      includeTaf: false,
    });

    expect(result.taf).toBeNull();
    expect(mockRepository.fetchTaf).not.toHaveBeenCalled();
  });

  it('should handle null METAR from repository', async () => {
    (mockRepository.fetchMetar as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await useCase.execute({ icao: 'RKPU' });

    expect(result.metar).toBeNull();
    expect(result.riskAssessment.factors).toContain('No weather data available');
  });

  it('should call repository methods in parallel', async () => {
    const metarPromise = new Promise<MetarData>((resolve) =>
      setTimeout(() => resolve(mockMetar), 100)
    );
    const tafPromise = new Promise<TafData>((resolve) =>
      setTimeout(() => resolve(mockTaf), 100)
    );

    (mockRepository.fetchMetar as ReturnType<typeof vi.fn>).mockReturnValue(metarPromise);
    (mockRepository.fetchTaf as ReturnType<typeof vi.fn>).mockReturnValue(tafPromise);

    const startTime = Date.now();
    await useCase.execute({ icao: 'RKPU' });
    const elapsed = Date.now() - startTime;

    // 병렬 호출이므로 200ms 미만이어야 함
    expect(elapsed).toBeLessThan(200);
  });
});

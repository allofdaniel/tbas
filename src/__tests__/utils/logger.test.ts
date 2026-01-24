/**
 * Logger Utility Tests
 * DO-278A 요구사항 추적: SVV-LOG-001
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Logger 테스트를 위한 모듈 임포트
// Note: logger는 싱글톤이므로 모듈 리로드가 필요할 수 있음

describe('Logger Utility', () => {
  // DO-278A: 테스트 Mock - 타입 안전성보다 실용성 우선
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let consoleSpy: Record<string, any>;

  beforeEach(() => {
    consoleSpy = {
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('LogLevel enum', () => {
    it('should have correct numeric values', async () => {
      const { LogLevel } = await import('@/utils/logger');

      expect(LogLevel.DEBUG).toBe(0);
      expect(LogLevel.INFO).toBe(1);
      expect(LogLevel.WARN).toBe(2);
      expect(LogLevel.ERROR).toBe(3);
      expect(LogLevel.SILENT).toBe(4);
    });
  });

  describe('ErrorSeverity enum', () => {
    it('should have correct string values', async () => {
      const { ErrorSeverity } = await import('@/utils/logger');

      expect(ErrorSeverity.LOW).toBe('low');
      expect(ErrorSeverity.MEDIUM).toBe('medium');
      expect(ErrorSeverity.HIGH).toBe('high');
      expect(ErrorSeverity.CRITICAL).toBe('critical');
    });
  });

  describe('logger singleton', () => {
    it('should export a logger instance', async () => {
      const { logger } = await import('@/utils/logger');

      expect(logger).toBeDefined();
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.api).toBe('function');
      expect(typeof logger.perf).toBe('function');
    });

    it('should have log management functions', async () => {
      const { logger } = await import('@/utils/logger');

      expect(typeof logger.exportLogs).toBe('function');
      expect(typeof logger.clearLogs).toBe('function');
      expect(typeof logger.setLevel).toBe('function');
      expect(typeof logger.getStats).toBe('function');
    });
  });

  describe('logger.warn', () => {
    it('should log warning messages', async () => {
      const { logger } = await import('@/utils/logger');

      logger.warn('TestModule', 'Test warning message');

      expect(consoleSpy.warn).toHaveBeenCalled();
    });

    it('should include context in warning', async () => {
      const { logger } = await import('@/utils/logger');

      logger.warn('TestModule', 'Test warning', { key: 'value' });

      expect(consoleSpy.warn).toHaveBeenCalled();
    });
  });

  describe('logger.error', () => {
    it('should log error messages', async () => {
      const { logger } = await import('@/utils/logger');

      logger.error('TestModule', 'Test error message');

      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it('should handle Error objects', async () => {
      const { logger } = await import('@/utils/logger');
      const testError = new Error('Test error');

      logger.error('TestModule', 'Error occurred', testError);

      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it('should handle non-Error objects', async () => {
      const { logger } = await import('@/utils/logger');

      logger.error('TestModule', 'Error occurred', 'string error');

      expect(consoleSpy.error).toHaveBeenCalled();
    });
  });

  describe('logger.exportLogs', () => {
    it('should return an array of log entries', async () => {
      const { logger } = await import('@/utils/logger');

      logger.warn('TestModule', 'Test log for export');

      const logs = logger.exportLogs();

      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBeGreaterThan(0);
    });
  });

  describe('logger.clearLogs', () => {
    it('should clear all logs', async () => {
      const { logger } = await import('@/utils/logger');

      logger.warn('TestModule', 'Log before clear');
      logger.clearLogs();

      const logs = logger.exportLogs();

      expect(logs.length).toBe(0);
    });
  });

  describe('logger.getStats', () => {
    it('should return statistics about logs', async () => {
      const { logger } = await import('@/utils/logger');

      logger.clearLogs();
      logger.warn('TestModule', 'Test warning');
      logger.error('TestModule', 'Test error');

      const stats = logger.getStats();

      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('byLevel');
      expect(typeof stats.total).toBe('number');
    });
  });

  describe('withTiming helper', () => {
    it('should be a function', async () => {
      const { withTiming } = await import('@/utils/logger');

      expect(typeof withTiming).toBe('function');
    });

    it('should wrap a function and measure time', async () => {
      const { withTiming } = await import('@/utils/logger');

      const testFn = () => 'result';
      const wrapped = withTiming('TestModule', 'testOperation', testFn);

      const result = wrapped();

      expect(result).toBe('result');
    });
  });

  describe('measureAsync helper', () => {
    it('should be a function', async () => {
      const { measureAsync } = await import('@/utils/logger');

      expect(typeof measureAsync).toBe('function');
    });

    it('should measure async function execution time', async () => {
      const { measureAsync } = await import('@/utils/logger');

      const asyncFn = async () => {
        await new Promise((r) => setTimeout(r, 10));
        return 'async result';
      };

      const result = await measureAsync('TestModule', 'asyncOperation', asyncFn);

      expect(result).toBe('async result');
    });
  });
});

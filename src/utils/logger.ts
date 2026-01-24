/**
 * Structured Logger
 * DO-278A 요구사항 추적: SRS-LOG-001
 *
 * 환경에 따라 다른 로깅 동작을 제공하는 구조화된 로깅 시스템
 * - 개발 환경: 상세한 디버그 로그 출력
 * - 프로덕션: 에러만 수집, 선택적 원격 전송
 */


/**
 * 로그 레벨 정의
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

/**
 * 에러 심각도 정의
 */
export enum ErrorSeverity {
  LOW = 'low', // 재시도 가능, 사용자 영향 미미
  MEDIUM = 'medium', // 기능 저하
  HIGH = 'high', // 주요 기능 오류
  CRITICAL = 'critical', // 완전 장애
}

/**
 * 로그 엔트리 인터페이스
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  severity?: ErrorSeverity;
}

/**
 * 로거 설정 옵션
 */
export interface LoggerOptions {
  level?: LogLevel;
  maxLogs?: number;
  enableRemoteLogging?: boolean;
  remoteEndpoint?: string;
}

/**
 * 구조화된 로거 클래스
 */
class StructuredLogger {
  private level: LogLevel;
  private isDev: boolean;
  private logs: LogEntry[] = [];
  private readonly MAX_LOGS: number;
  private enableRemoteLogging: boolean;
  private remoteEndpoint?: string;

  constructor(options: LoggerOptions = {}) {
    // Vite의 import.meta.env.DEV 사용
    this.isDev =
      typeof import.meta !== 'undefined' && import.meta.env?.DEV === true;
    this.level = options.level ?? (this.isDev ? LogLevel.DEBUG : LogLevel.WARN);
    this.MAX_LOGS = options.maxLogs ?? 1000;
    this.enableRemoteLogging = options.enableRemoteLogging ?? false;
    this.remoteEndpoint = options.remoteEndpoint;
  }

  /**
   * 로그 레벨 설정
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * 로그 포맷팅
   */
  private formatLog(entry: LogEntry): string {
    const { timestamp, level, module, message, context } = entry;
    const levelName = LogLevel[level];
    const time = timestamp.split('T')[1]?.slice(0, 8) ?? timestamp;
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `[${time}] [${levelName}] [${module}] ${message}${contextStr}`;
  }

  /**
   * 로그 저장
   */
  private addLog(entry: LogEntry): void {
    this.logs.push(entry);
    if (this.logs.length > this.MAX_LOGS) {
      this.logs.shift();
    }
  }

  /**
   * 원격 로깅 (프로덕션)
   */
  private async sendToRemote(entry: LogEntry): Promise<void> {
    if (!this.enableRemoteLogging || !this.remoteEndpoint) return;

    try {
      await fetch(this.remoteEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
    } catch {
      // 원격 로깅 실패는 무시 (무한 루프 방지)
    }
  }

  /**
   * Debug 레벨 로그
   * 개발 환경에서만 출력되는 상세 디버깅 정보
   */
  debug(
    module: string,
    message: string,
    context?: Record<string, unknown>
  ): void {
    if (this.level > LogLevel.DEBUG) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.DEBUG,
      module,
      message,
      context,
    };

    console.debug(this.formatLog(entry));
    this.addLog(entry);
  }

  /**
   * Info 레벨 로그
   * 일반적인 정보성 로그
   */
  info(
    module: string,
    message: string,
    context?: Record<string, unknown>
  ): void {
    if (this.level > LogLevel.INFO) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      module,
      message,
      context,
    };

    if (this.isDev) {
      console.info(this.formatLog(entry));
    }
    this.addLog(entry);
  }

  /**
   * Warning 레벨 로그
   * 잠재적 문제 또는 권장되지 않는 동작
   */
  warn(
    module: string,
    message: string,
    context?: Record<string, unknown>
  ): void {
    if (this.level > LogLevel.WARN) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.WARN,
      module,
      message,
      context,
    };

    console.warn(this.formatLog(entry));
    this.addLog(entry);
  }

  /**
   * Error 레벨 로그
   * 오류 발생 시 사용
   */
  error(
    module: string,
    message: string,
    error?: Error | unknown,
    context?: Record<string, unknown>,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM
  ): void {
    const normalizedError =
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : error
          ? {
              name: 'UnknownError',
              message: String(error),
              stack: undefined,
            }
          : undefined;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      module,
      message,
      error: normalizedError,
      context,
      severity,
    };

    console.error(this.formatLog(entry));
    if (normalizedError?.stack) {
      console.error(normalizedError.stack);
    }

    this.addLog(entry);

    // 프로덕션 환경에서는 원격 서버로 전송
    if (!this.isDev) {
      void this.sendToRemote(entry);
    }
  }

  /**
   * API 호출 로그 (특수 목적)
   */
  api(
    endpoint: string,
    method: string,
    status: number,
    duration: number,
    context?: Record<string, unknown>
  ): void {
    const isError = status >= 400;
    const level = isError ? LogLevel.WARN : LogLevel.DEBUG;

    if (this.level > level) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      module: 'API',
      message: `${method} ${endpoint} - ${status} (${duration}ms)`,
      context: {
        endpoint,
        method,
        status,
        duration,
        ...context,
      },
    };

    if (isError) {
      console.warn(this.formatLog(entry));
    } else if (this.isDev) {
      console.debug(this.formatLog(entry));
    }

    this.addLog(entry);
  }

  /**
   * 성능 측정 로그
   */
  perf(
    module: string,
    operation: string,
    duration: number,
    context?: Record<string, unknown>
  ): void {
    if (this.level > LogLevel.DEBUG) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.DEBUG,
      module,
      message: `[PERF] ${operation}: ${duration.toFixed(2)}ms`,
      context: {
        operation,
        duration,
        ...context,
      },
    };

    if (this.isDev) {
      // 느린 작업은 경고로 표시
      if (duration > 100) {
        console.warn(this.formatLog(entry));
      } else {
        console.debug(this.formatLog(entry));
      }
    }

    this.addLog(entry);
  }

  /**
   * 저장된 로그 내보내기
   */
  exportLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * 로그 지우기
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * CSV 형식으로 로그 다운로드
   */
  downloadLogs(): void {
    const logs = this.exportLogs();
    const csv = [
      'Timestamp,Level,Module,Message,Context,Error',
      ...logs.map((l) => {
        const context = l.context ? JSON.stringify(l.context) : '';
        const error = l.error ? JSON.stringify(l.error) : '';
        return `"${l.timestamp}","${LogLevel[l.level]}","${l.module}","${l.message.replace(/"/g, '""')}","${context.replace(/"/g, '""')}","${error.replace(/"/g, '""')}"`;
      }),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tbas-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * 통계 정보
   */
  getStats(): {
    total: number;
    byLevel: Record<string, number>;
    lastError?: LogEntry;
  } {
    const byLevel: Record<string, number> = {};

    for (const log of this.logs) {
      const levelName = LogLevel[log.level];
      byLevel[levelName] = (byLevel[levelName] || 0) + 1;
    }

    const errors = this.logs.filter((l) => l.level === LogLevel.ERROR);
    const lastError = errors[errors.length - 1];

    return {
      total: this.logs.length,
      byLevel,
      lastError,
    };
  }
}

// 싱글톤 로거 인스턴스
export const logger = new StructuredLogger();

// 개발자 도구 확장
if (typeof window !== 'undefined') {
  // @ts-expect-error 개발자 도구용 전역 함수
  window.__tbasLogger = {
    exportLogs: () => logger.exportLogs(),
    downloadLogs: () => logger.downloadLogs(),
    getStats: () => logger.getStats(),
    setLevel: (level: LogLevel) => logger.setLevel(level),
    clearLogs: () => logger.clearLogs(),
  };
}

/**
 * 함수 실행 시간 측정 데코레이터
 */
export function withTiming<T extends (...args: unknown[]) => unknown>(
  module: string,
  operation: string,
  fn: T
): T {
  return ((...args: unknown[]) => {
    const start = performance.now();
    const result = fn(...args);

    if (result instanceof Promise) {
      return result.finally(() => {
        logger.perf(module, operation, performance.now() - start);
      });
    }

    logger.perf(module, operation, performance.now() - start);
    return result;
  }) as T;
}

/**
 * 비동기 함수 실행 시간 측정
 */
export async function measureAsync<T>(
  module: string,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    logger.perf(module, operation, performance.now() - start);
  }
}

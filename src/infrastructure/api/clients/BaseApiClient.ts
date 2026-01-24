/**
 * Base API Client
 * DO-278A 요구사항 추적: SRS-API-001
 *
 * HTTP API 호출을 위한 기본 클래스
 * 재시도 로직, 에러 처리, 캐싱, 요청 중복방지 등을 포함
 */

import { API_BASE_URL } from '@/config/constants';
import { logger } from '@/utils/logger';

/**
 * API 에러 클래스
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly response?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Rate Limit 에러 클래스
 */
export class RateLimitError extends ApiError {
  constructor(message = 'Rate limited', retryAfter?: number) {
    super(message, 429);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }

  retryAfter?: number;
}

/**
 * API 요청 옵션
 */
export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

/**
 * 기본 API 클라이언트
 */
export class BaseApiClient {
  protected baseUrl: string;
  protected defaultTimeout: number;
  protected defaultRetries: number;
  protected defaultRetryDelay: number;
  /** 진행 중인 요청 (중복 방지용) */
  private pendingRequests = new Map<string, Promise<unknown>>();

  constructor(
    baseUrl = API_BASE_URL,
    options?: {
      timeout?: number;
      retries?: number;
      retryDelay?: number;
    }
  ) {
    this.baseUrl = baseUrl;
    this.defaultTimeout = options?.timeout ?? 30000;
    this.defaultRetries = options?.retries ?? 3;
    this.defaultRetryDelay = options?.retryDelay ?? 1000;
  }

  /**
   * 진행 중인 동일 요청이 있으면 해당 Promise 반환 (요청 중복 방지)
   */
  protected async requestWithDedup<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const method = options.method || 'GET';
    const requestKey = `${method}:${endpoint}`;

    // 진행 중인 동일 요청이 있으면 그 Promise를 반환
    const pending = this.pendingRequests.get(requestKey);
    if (pending) {
      logger.debug('API', `Deduplicating request: ${requestKey}`);
      return pending as Promise<T>;
    }

    // 새 요청 생성
    const promise = this.request<T>(endpoint, options);
    this.pendingRequests.set(requestKey, promise);

    try {
      const result = await promise;
      return result;
    } finally {
      this.pendingRequests.delete(requestKey);
    }
  }

  /**
   * HTTP 요청 실행
   */
  protected async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const {
      method = 'GET',
      headers = {},
      body,
      timeout = this.defaultTimeout,
      retries = this.defaultRetries,
      retryDelay = this.defaultRetryDelay,
    } = options;

    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    const startTime = performance.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const duration = performance.now() - startTime;

        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          logger.warn('API', `Rate limited: ${endpoint}`, { retryAfter });
          throw new RateLimitError(
            'Rate limited',
            retryAfter ? parseInt(retryAfter, 10) : undefined
          );
        }

        if (!response.ok) {
          const errorBody = await response.text();
          logger.api(endpoint, method, response.status, duration);
          throw new ApiError(
            `HTTP ${response.status}: ${response.statusText}`,
            response.status,
            errorBody
          );
        }

        const data = await response.json();
        logger.api(endpoint, method, response.status, duration);
        return data as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Rate limit 에러는 재시도
        if (error instanceof RateLimitError && attempt < retries) {
          const delay = error.retryAfter
            ? error.retryAfter * 1000
            : retryDelay * Math.pow(2, attempt);
          logger.debug('API', `Retrying after rate limit: ${endpoint}`, { attempt, delay });
          await this.sleep(delay);
          continue;
        }

        // 네트워크 에러는 재시도
        if (
          error instanceof TypeError &&
          error.message.includes('fetch') &&
          attempt < retries
        ) {
          const delay = retryDelay * Math.pow(2, attempt);
          logger.debug('API', `Retrying after network error: ${endpoint}`, { attempt, delay });
          await this.sleep(delay);
          continue;
        }

        // AbortError (타임아웃)는 재시도하지 않음
        if (error instanceof DOMException && error.name === 'AbortError') {
          const duration = performance.now() - startTime;
          logger.api(endpoint, method, 408, duration);
          throw new ApiError('Request timeout', 408);
        }

        // 다른 에러는 재시도하지 않음
        break;
      }
    }

    const duration = performance.now() - startTime;
    logger.error('API', `Request failed: ${endpoint}`, lastError, { duration, attempts: retries + 1 });
    throw lastError ?? new Error('Unknown error');
  }

  /**
   * GET 요청
   */
  protected async get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  /**
   * POST 요청
   */
  protected async post<T>(
    endpoint: string,
    body: unknown,
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'POST', body });
  }

  /**
   * 지연 유틸리티
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * URL 쿼리 파라미터 빌드
   */
  protected buildQueryString(params: Record<string, string | number | boolean | undefined>): string {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    }
    const queryString = searchParams.toString();
    return queryString ? `?${queryString}` : '';
  }
}

/**
 * 간단한 메모리 캐시
 */
export class SimpleCache<T> {
  private cache = new Map<string, { data: T; timestamp: number }>();
  private ttlMs: number;

  constructor(ttlMs = 60000) {
    this.ttlMs = ttlMs;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  getAge(key: string): number | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    return Date.now() - entry.timestamp;
  }

  clear(): void {
    this.cache.clear();
  }

  delete(key: string): void {
    this.cache.delete(key);
  }
}

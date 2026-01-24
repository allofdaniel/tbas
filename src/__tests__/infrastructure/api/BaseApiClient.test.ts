/**
 * BaseApiClient Tests
 * DO-278A 요구사항 추적: SRS-API-001
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseApiClient, ApiError, RateLimitError, SimpleCache } from '@/infrastructure/api/clients/BaseApiClient';

// Concrete implementation for testing abstract-like BaseApiClient
class TestApiClient extends BaseApiClient {
  // Expose protected methods for testing
  public testGet<T>(endpoint: string): Promise<T> {
    return this.get<T>(endpoint);
  }

  public testPost<T>(endpoint: string, body: unknown): Promise<T> {
    return this.post<T>(endpoint, body);
  }

  public testBuildQueryString(params: Record<string, string | number | boolean | undefined>): string {
    return this.buildQueryString(params);
  }

  public testRequestWithDedup<T>(endpoint: string): Promise<T> {
    return this.requestWithDedup<T>(endpoint);
  }
}

describe('BaseApiClient', () => {
  let client: TestApiClient;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    client = new TestApiClient('https://api.test.com', {
      timeout: 5000,
      retries: 2,
      retryDelay: 100,
    });
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should use default values when no options provided', () => {
      const defaultClient = new TestApiClient();
      expect(defaultClient).toBeDefined();
    });

    it('should use custom options when provided', () => {
      const customClient = new TestApiClient('https://custom.api.com', {
        timeout: 10000,
        retries: 5,
        retryDelay: 500,
      });
      expect(customClient).toBeDefined();
    });
  });

  describe('get', () => {
    it('should make GET request and return data', async () => {
      const mockData = { id: 1, name: 'test' };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockData),
      });

      const result = await client.testGet<typeof mockData>('/test');

      expect(result).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test.com/test',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should handle absolute URLs', async () => {
      const mockData = { success: true };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockData),
      });

      await client.testGet('https://other-api.com/endpoint');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://other-api.com/endpoint',
        expect.any(Object)
      );
    });

    it('should throw ApiError on non-ok response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('Resource not found'),
      });

      await expect(client.testGet('/not-found')).rejects.toThrow(ApiError);
    });

    it('should throw RateLimitError on 429 response', async () => {
      // Create client with no retries for faster test
      const clientNoRetry = new TestApiClient('https://api.test.com', {
        timeout: 5000,
        retries: 0,
        retryDelay: 100,
      });
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Headers({ 'Retry-After': '60' }),
        text: () => Promise.resolve('Rate limited'),
      });

      await expect(clientNoRetry.testGet('/limited')).rejects.toThrow(RateLimitError);
    });
  });

  describe('post', () => {
    it('should make POST request with body', async () => {
      const requestBody = { name: 'New Item' };
      const mockResponse = { id: 1, name: 'New Item' };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.testPost('/items', requestBody);

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test.com/items',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(requestBody),
        })
      );
    });
  });

  describe('buildQueryString', () => {
    it('should build query string from params', () => {
      const result = client.testBuildQueryString({
        lat: 35.5,
        lon: 129.3,
        radius: 100,
      });

      expect(result).toBe('?lat=35.5&lon=129.3&radius=100');
    });

    it('should handle boolean params', () => {
      const result = client.testBuildQueryString({
        active: true,
        disabled: false,
      });

      expect(result).toBe('?active=true&disabled=false');
    });

    it('should skip undefined params', () => {
      const result = client.testBuildQueryString({
        name: 'test',
        optional: undefined,
      });

      expect(result).toBe('?name=test');
    });

    it('should return empty string for empty params', () => {
      const result = client.testBuildQueryString({});
      expect(result).toBe('');
    });
  });

  describe('retry logic', () => {
    it('should retry on network error', async () => {
      let attempts = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 2) {
          return Promise.reject(new TypeError('fetch failed'));
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true }),
        });
      });

      const result = await client.testGet('/retry-test');

      expect(result).toEqual({ success: true });
      expect(attempts).toBe(2);
    });

    it('should not retry on API errors (non-retryable)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: () => Promise.resolve('Invalid request'),
      });

      await expect(client.testGet('/bad-request')).rejects.toThrow(ApiError);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('request deduplication', () => {
    it('should deduplicate concurrent identical requests', async () => {
      let resolveFirst: (value: Response) => void;
      const firstPromise = new Promise<Response>((resolve) => {
        resolveFirst = resolve;
      });

      global.fetch = vi.fn().mockReturnValue(firstPromise);

      // Start two identical requests
      const request1 = client.testRequestWithDedup('/test');
      const request2 = client.testRequestWithDedup('/test');

      // Resolve the underlying fetch
      resolveFirst!({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: 'shared' }),
      } as Response);

      const [result1, result2] = await Promise.all([request1, request2]);

      expect(result1).toEqual(result2);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
});

describe('SimpleCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('basic operations', () => {
    it('should store and retrieve values', () => {
      const cache = new SimpleCache<string>(60000);
      cache.set('key1', 'value1');

      expect(cache.get('key1')).toBe('value1');
    });

    it('should return null for non-existent keys', () => {
      const cache = new SimpleCache<string>(60000);

      expect(cache.get('non-existent')).toBeNull();
    });

    it('should delete values', () => {
      const cache = new SimpleCache<string>(60000);
      cache.set('key1', 'value1');
      cache.delete('key1');

      expect(cache.get('key1')).toBeNull();
    });

    it('should clear all values', () => {
      const cache = new SimpleCache<string>(60000);
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();

      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
    });
  });

  describe('TTL behavior', () => {
    it('should expire values after TTL', () => {
      const cache = new SimpleCache<string>(1000); // 1 second TTL
      cache.set('key1', 'value1');

      expect(cache.get('key1')).toBe('value1');

      vi.advanceTimersByTime(1001);

      expect(cache.get('key1')).toBeNull();
    });

    it('should return value before TTL expires', () => {
      const cache = new SimpleCache<string>(1000);
      cache.set('key1', 'value1');

      vi.advanceTimersByTime(500);

      expect(cache.get('key1')).toBe('value1');
    });
  });

  describe('getAge', () => {
    it('should return age of cached item', () => {
      const cache = new SimpleCache<string>(60000);
      cache.set('key1', 'value1');

      vi.advanceTimersByTime(5000);

      const age = cache.getAge('key1');
      expect(age).toBe(5000);
    });

    it('should return null for non-existent keys', () => {
      const cache = new SimpleCache<string>(60000);

      expect(cache.getAge('non-existent')).toBeNull();
    });
  });

  describe('complex data types', () => {
    it('should cache objects', () => {
      const cache = new SimpleCache<{ id: number; name: string }>(60000);
      const obj = { id: 1, name: 'test' };
      cache.set('key1', obj);

      expect(cache.get('key1')).toEqual(obj);
    });

    it('should cache arrays', () => {
      const cache = new SimpleCache<number[]>(60000);
      const arr = [1, 2, 3, 4, 5];
      cache.set('key1', arr);

      expect(cache.get('key1')).toEqual(arr);
    });
  });
});

describe('ApiError', () => {
  it('should create error with status code', () => {
    const error = new ApiError('Not found', 404);

    expect(error.message).toBe('Not found');
    expect(error.statusCode).toBe(404);
    expect(error.name).toBe('ApiError');
  });

  it('should include response data', () => {
    const response = { error: 'Invalid input' };
    const error = new ApiError('Bad request', 400, response);

    expect(error.response).toEqual(response);
  });
});

describe('RateLimitError', () => {
  it('should create error with default message', () => {
    const error = new RateLimitError();

    expect(error.message).toBe('Rate limited');
    expect(error.statusCode).toBe(429);
    expect(error.name).toBe('RateLimitError');
  });

  it('should include retryAfter', () => {
    const error = new RateLimitError('Rate limited', 60);

    expect(error.retryAfter).toBe(60);
  });
});

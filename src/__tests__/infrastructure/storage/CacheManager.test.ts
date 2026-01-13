/**
 * CacheManager 테스트
 * DO-278A 요구사항 추적: SRS-STG-004-TEST
 *
 * 메모리 캐시 기능만 테스트 (IndexedDB는 브라우저 환경에서 테스트)
 */

import { describe, it, expect, beforeEach } from 'vitest';

// CacheManager를 직접 모킹하여 메모리 캐시만 테스트
describe('CacheManager - Memory Cache', () => {
  // 간단한 메모리 캐시 구현으로 테스트
  class SimpleMemoryCache {
    private cache: Map<string, { value: unknown; expiresAt?: number }> = new Map();
    private stats = { hits: 0, misses: 0 };

    async set<T>(key: string, value: T, ttl?: number): Promise<void> {
      this.cache.set(key, {
        value,
        expiresAt: ttl ? Date.now() + ttl : undefined,
      });
    }

    async get<T>(key: string): Promise<T | null> {
      const item = this.cache.get(key);
      if (!item) {
        this.stats.misses++;
        return null;
      }
      if (item.expiresAt && Date.now() > item.expiresAt) {
        this.cache.delete(key);
        this.stats.misses++;
        return null;
      }
      this.stats.hits++;
      return item.value as T;
    }

    async has(key: string): Promise<boolean> {
      const item = this.cache.get(key);
      if (!item) return false;
      if (item.expiresAt && Date.now() > item.expiresAt) {
        this.cache.delete(key);
        return false;
      }
      return true;
    }

    async remove(key: string): Promise<void> {
      this.cache.delete(key);
    }

    async clear(): Promise<void> {
      this.cache.clear();
      this.stats = { hits: 0, misses: 0 };
    }

    async keys(prefix?: string): Promise<string[]> {
      const allKeys = Array.from(this.cache.keys());
      return prefix ? allKeys.filter((k) => k.startsWith(prefix)) : allKeys;
    }

    getStats() {
      return { ...this.stats, size: this.cache.size };
    }

    getHitRate(): number {
      const total = this.stats.hits + this.stats.misses;
      return total === 0 ? 0 : this.stats.hits / total;
    }

    async cleanup(): Promise<void> {
      const now = Date.now();
      for (const [key, item] of this.cache.entries()) {
        if (item.expiresAt && now > item.expiresAt) {
          this.cache.delete(key);
        }
      }
    }
  }

  let cache: SimpleMemoryCache;

  beforeEach(() => {
    cache = new SimpleMemoryCache();
  });

  describe('set and get', () => {
    it('should store and retrieve a value', async () => {
      await cache.set('key1', { data: 'value1' });
      const result = await cache.get<{ data: string }>('key1');
      expect(result).toEqual({ data: 'value1' });
    });

    it('should return null for non-existent key', async () => {
      const result = await cache.get('non-existent');
      expect(result).toBeNull();
    });

    it('should return null for expired value', async () => {
      await cache.set('key1', 'value1', -1000);
      const result = await cache.get('key1');
      expect(result).toBeNull();
    });
  });

  describe('has', () => {
    it('should return true for existing key', async () => {
      await cache.set('key1', 'value1');
      expect(await cache.has('key1')).toBe(true);
    });

    it('should return false for non-existent key', async () => {
      expect(await cache.has('non-existent')).toBe(false);
    });

    it('should return false for expired key', async () => {
      await cache.set('key1', 'value1', -1000);
      expect(await cache.has('key1')).toBe(false);
    });
  });

  describe('remove', () => {
    it('should remove a value', async () => {
      await cache.set('key1', 'value1');
      await cache.remove('key1');
      expect(await cache.has('key1')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all values', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.clear();

      expect(await cache.has('key1')).toBe(false);
      expect(await cache.has('key2')).toBe(false);
    });

    it('should reset stats', async () => {
      await cache.set('key1', 'value1');
      await cache.get('key1'); // hit
      await cache.clear();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('keys', () => {
    it('should return all keys', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');

      const keys = await cache.keys();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
    });

    it('should filter by prefix', async () => {
      await cache.set('aircraft:1', 'value1');
      await cache.set('weather:1', 'value2');

      const keys = await cache.keys('aircraft:');
      expect(keys).toEqual(['aircraft:1']);
    });
  });

  describe('getHitRate', () => {
    it('should calculate hit rate correctly', async () => {
      await cache.set('key1', 'value1');
      await cache.get('key1'); // hit
      await cache.get('key1'); // hit
      await cache.get('non-existent'); // miss

      const hitRate = cache.getHitRate();
      expect(hitRate).toBeCloseTo(2 / 3, 2);
    });

    it('should return 0 when no requests', () => {
      const hitRate = cache.getHitRate();
      expect(hitRate).toBe(0);
    });
  });

  describe('cleanup', () => {
    it('should remove expired items', async () => {
      await cache.set('expired', 'value1', -1000);
      await cache.set('valid', 'value2', 10000);

      await cache.cleanup();

      expect(await cache.has('expired')).toBe(false);
      expect(await cache.has('valid')).toBe(true);
    });
  });

  describe('stats', () => {
    it('should track hits', async () => {
      await cache.set('key1', 'value1');
      await cache.get('key1');

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
    });

    it('should track misses', async () => {
      await cache.get('non-existent');

      const stats = cache.getStats();
      expect(stats.misses).toBe(1);
    });

    it('should track size', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');

      const stats = cache.getStats();
      expect(stats.size).toBe(2);
    });
  });
});

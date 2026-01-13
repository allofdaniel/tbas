/**
 * LocalStorageAdapter 테스트
 * DO-278A 요구사항 추적: SRS-STG-002-TEST
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LocalStorageAdapter } from '@/infrastructure/storage/LocalStorageAdapter';

describe('LocalStorageAdapter', () => {
  let adapter: LocalStorageAdapter;
  const testPrefix = 'test-rkpu:';

  beforeEach(() => {
    // localStorage 모킹
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
      clear: vi.fn(() => {
        Object.keys(store).forEach((key) => delete store[key]);
      }),
      key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
      get length() {
        return Object.keys(store).length;
      },
    });

    adapter = new LocalStorageAdapter(testPrefix);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('set and get', () => {
    it('should store and retrieve a value', async () => {
      await adapter.set('key1', { data: 'value1' });
      const result = await adapter.get<{ data: string }>('key1');

      expect(result).toEqual({ data: 'value1' });
    });

    it('should return null for non-existent key', async () => {
      const result = await adapter.get('non-existent');

      expect(result).toBeNull();
    });

    it('should store value with TTL', async () => {
      await adapter.set('key1', 'value1', { ttl: 1000 });

      const item = JSON.parse(localStorage.getItem(`${testPrefix}key1`) ?? '{}');
      expect(item.expiresAt).toBeTypeOf('number');
      expect(item.expiresAt).toBeGreaterThan(Date.now());
    });

    it('should store value with tags', async () => {
      await adapter.set('key1', 'value1', { tags: ['tag1', 'tag2'] });

      const item = JSON.parse(localStorage.getItem(`${testPrefix}key1`) ?? '{}');
      expect(item.tags).toEqual(['tag1', 'tag2']);
    });

    it('should return null for expired value', async () => {
      // 이미 만료된 TTL 설정
      await adapter.set('key1', 'value1', { ttl: -1000 });

      const result = await adapter.get('key1');
      expect(result).toBeNull();
    });
  });

  describe('remove', () => {
    it('should remove a value', async () => {
      await adapter.set('key1', 'value1');
      await adapter.remove('key1');

      const result = await adapter.get('key1');
      expect(result).toBeNull();
    });

    it('should not throw when removing non-existent key', async () => {
      await expect(adapter.remove('non-existent')).resolves.not.toThrow();
    });
  });

  describe('clear', () => {
    it('should remove all values with prefix', async () => {
      await adapter.set('key1', 'value1');
      await adapter.set('key2', 'value2');
      await adapter.clear();

      expect(await adapter.get('key1')).toBeNull();
      expect(await adapter.get('key2')).toBeNull();
    });
  });

  describe('has', () => {
    it('should return true for existing key', async () => {
      await adapter.set('key1', 'value1');

      expect(await adapter.has('key1')).toBe(true);
    });

    it('should return false for non-existent key', async () => {
      expect(await adapter.has('non-existent')).toBe(false);
    });

    it('should return false for expired key', async () => {
      await adapter.set('key1', 'value1', { ttl: -1000 });

      expect(await adapter.has('key1')).toBe(false);
    });
  });

  describe('keys', () => {
    it('should return all keys', async () => {
      await adapter.set('key1', 'value1');
      await adapter.set('key2', 'value2');

      const keys = await adapter.keys();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
    });

    it('should filter keys by prefix', async () => {
      await adapter.set('aircraft:1', 'value1');
      await adapter.set('aircraft:2', 'value2');
      await adapter.set('weather:1', 'value3');

      const keys = await adapter.keys('aircraft:');
      expect(keys).toHaveLength(2);
      expect(keys.every((k) => k.startsWith('aircraft:'))).toBe(true);
    });
  });

  describe('invalidateByTags', () => {
    it('should remove items with matching tags', async () => {
      await adapter.set('key1', 'value1', { tags: ['aircraft'] });
      await adapter.set('key2', 'value2', { tags: ['weather'] });
      await adapter.set('key3', 'value3', { tags: ['aircraft', 'important'] });

      await adapter.invalidateByTags(['aircraft']);

      expect(await adapter.has('key1')).toBe(false);
      expect(await adapter.has('key2')).toBe(true);
      expect(await adapter.has('key3')).toBe(false);
    });

    it('should handle empty tags array', async () => {
      await adapter.set('key1', 'value1', { tags: ['aircraft'] });

      await adapter.invalidateByTags([]);

      expect(await adapter.has('key1')).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should remove expired items', async () => {
      await adapter.set('expired', 'value1', { ttl: -1000 });
      await adapter.set('valid', 'value2', { ttl: 10000 });

      await adapter.cleanup();

      expect(await adapter.has('expired')).toBe(false);
      expect(await adapter.has('valid')).toBe(true);
    });
  });
});

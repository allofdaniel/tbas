/**
 * Cache Manager
 * DO-278A 요구사항 추적: SRS-STG-004
 *
 * 다층 캐싱 관리자
 */

import type { IStorage, CacheOptions, CacheStats } from './IStorage';
import { LocalStorageAdapter } from './LocalStorageAdapter';
import { IndexedDBAdapter } from './IndexedDBAdapter';

/**
 * 캐시 레벨
 */
export type CacheLevel = 'memory' | 'local' | 'indexed';

/**
 * 캐시 관리자 설정
 */
export interface CacheManagerConfig {
  /** 메모리 캐시 최대 항목 수 */
  memoryMaxItems?: number;
  /** 기본 TTL (ms) */
  defaultTtl?: number;
  /** 자동 정리 간격 (ms) */
  cleanupInterval?: number;
}

/**
 * 다층 캐시 관리자
 *
 * L1: 메모리 캐시 (가장 빠름, 휘발성)
 * L2: LocalStorage (빠름, 소용량)
 * L3: IndexedDB (느림, 대용량)
 */
export class CacheManager implements IStorage {
  private readonly memoryCache: Map<string, { value: unknown; expiresAt?: number }>;
  private readonly localStorage: LocalStorageAdapter;
  private readonly indexedDB: IndexedDBAdapter;
  private readonly config: Required<CacheManagerConfig>;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  // 통계
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
  };

  constructor(config: CacheManagerConfig = {}) {
    this.config = {
      memoryMaxItems: config.memoryMaxItems ?? 1000,
      defaultTtl: config.defaultTtl ?? 5 * 60 * 1000, // 5분
      cleanupInterval: config.cleanupInterval ?? 60 * 1000, // 1분
    };

    this.memoryCache = new Map();
    this.localStorage = new LocalStorageAdapter();
    this.indexedDB = new IndexedDBAdapter();

    // 자동 정리 시작
    this.startCleanup();
  }

  /**
   * 값 저장 (레벨 지정 가능)
   */
  async set<T>(
    key: string,
    value: T,
    options?: CacheOptions & { level?: CacheLevel }
  ): Promise<void> {
    const ttl = options?.ttl ?? this.config.defaultTtl;
    const expiresAt = Date.now() + ttl;
    const level = options?.level ?? 'memory';

    // 메모리에 항상 저장
    this.setMemory(key, value, expiresAt);

    // 추가 레벨에 저장
    if (level === 'local' || level === 'indexed') {
      await this.localStorage.set(key, value, options);
    }

    if (level === 'indexed') {
      await this.indexedDB.set(key, value, options);
    }

    this.stats.size = this.memoryCache.size;
  }

  /**
   * 값 조회 (계층적 조회)
   */
  async get<T>(key: string): Promise<T | null> {
    // L1: 메모리 캐시 확인
    const memoryValue = this.getMemory<T>(key);
    if (memoryValue !== null) {
      this.stats.hits++;
      return memoryValue;
    }

    // L2: LocalStorage 확인
    const localValue = await this.localStorage.get<T>(key);
    if (localValue !== null) {
      this.stats.hits++;
      // 메모리에 승격
      this.setMemory(key, localValue);
      return localValue;
    }

    // L3: IndexedDB 확인
    const indexedValue = await this.indexedDB.get<T>(key);
    if (indexedValue !== null) {
      this.stats.hits++;
      // 메모리와 LocalStorage에 승격
      this.setMemory(key, indexedValue);
      await this.localStorage.set(key, indexedValue);
      return indexedValue;
    }

    this.stats.misses++;
    return null;
  }

  /**
   * 값 삭제 (모든 레벨에서)
   */
  async remove(key: string): Promise<void> {
    this.memoryCache.delete(key);
    await this.localStorage.remove(key);
    await this.indexedDB.remove(key);
    this.stats.size = this.memoryCache.size;
  }

  /**
   * 모든 값 삭제
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    await this.localStorage.clear();
    await this.indexedDB.clear();
    this.stats = { hits: 0, misses: 0, size: 0 };
  }

  /**
   * 키 존재 여부 확인
   */
  async has(key: string): Promise<boolean> {
    if (this.memoryCache.has(key)) return true;
    if (await this.localStorage.has(key)) return true;
    return await this.indexedDB.has(key);
  }

  /**
   * 모든 키 조회
   */
  async keys(prefix?: string): Promise<string[]> {
    const memoryKeys = Array.from(this.memoryCache.keys());
    const localKeys = await this.localStorage.keys(prefix);
    const indexedKeys = await this.indexedDB.keys(prefix);

    const allKeys = [...new Set([...memoryKeys, ...localKeys, ...indexedKeys])];

    if (prefix) {
      return allKeys.filter((key) => key.startsWith(prefix));
    }

    return allKeys;
  }

  /**
   * 태그로 캐시 무효화
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    await this.localStorage.invalidateByTags(tags);
    await this.indexedDB.invalidateByTags(tags);
    // 메모리 캐시는 태그 정보가 없으므로 전체 정리
    // 실제 구현에서는 메모리 캐시에도 태그 정보를 저장할 수 있음
  }

  /**
   * 만료된 항목 정리
   */
  async cleanup(): Promise<void> {
    const now = Date.now();

    // 메모리 캐시 정리
    for (const [key, item] of this.memoryCache.entries()) {
      if (item.expiresAt && now > item.expiresAt) {
        this.memoryCache.delete(key);
      }
    }

    // 메모리 캐시 크기 제한
    if (this.memoryCache.size > this.config.memoryMaxItems) {
      const keysToDelete = Array.from(this.memoryCache.keys()).slice(
        0,
        this.memoryCache.size - this.config.memoryMaxItems
      );
      for (const key of keysToDelete) {
        this.memoryCache.delete(key);
      }
    }

    // 하위 레벨 정리
    await this.localStorage.cleanup();
    await this.indexedDB.cleanup();

    this.stats.size = this.memoryCache.size;
  }

  /**
   * 캐시 통계 조회
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * 캐시 적중률 조회
   */
  getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    if (total === 0) return 0;
    return this.stats.hits / total;
  }

  /**
   * 메모리 캐시에 저장
   */
  private setMemory<T>(key: string, value: T, expiresAt?: number): void {
    this.memoryCache.set(key, { value, expiresAt });
  }

  /**
   * 메모리 캐시에서 조회
   */
  private getMemory<T>(key: string): T | null {
    const item = this.memoryCache.get(key);
    if (!item) return null;

    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.memoryCache.delete(key);
      return null;
    }

    return item.value as T;
  }

  /**
   * 자동 정리 시작
   */
  private startCleanup(): void {
    if (this.cleanupTimer) return;

    this.cleanupTimer = setInterval(() => {
      this.cleanup().catch(console.error);
    }, this.config.cleanupInterval);
  }

  /**
   * 자동 정리 중지
   */
  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * 리소스 정리
   */
  dispose(): void {
    this.stopCleanup();
    this.memoryCache.clear();
    this.indexedDB.close();
  }
}

/**
 * 전역 캐시 관리자 인스턴스
 */
let globalCacheManager: CacheManager | null = null;

/**
 * 전역 캐시 관리자 가져오기
 */
export function getCacheManager(): CacheManager {
  if (!globalCacheManager) {
    globalCacheManager = new CacheManager();
  }
  return globalCacheManager;
}

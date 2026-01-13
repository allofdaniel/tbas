/**
 * Storage Layer
 * DO-278A 요구사항 추적: SRS-STG
 *
 * 스토리지 추상화 계층
 */

export type { IStorage, CacheOptions, StoredItem, CacheStats } from './IStorage';
export { LocalStorageAdapter } from './LocalStorageAdapter';
export { IndexedDBAdapter } from './IndexedDBAdapter';
export { CacheManager, getCacheManager } from './CacheManager';
export type { CacheLevel, CacheManagerConfig } from './CacheManager';

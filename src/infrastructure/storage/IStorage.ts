/**
 * Storage Interface
 * DO-278A 요구사항 추적: SRS-STG-001
 *
 * 스토리지 추상화 인터페이스
 */

/**
 * 캐시 옵션
 */
export interface CacheOptions {
  /** TTL in milliseconds */
  ttl?: number;
  /** 캐시 태그 (일괄 무효화용) */
  tags?: string[];
}

/**
 * 저장된 아이템 메타데이터
 */
export interface StoredItem<T> {
  key: string;
  value: T;
  createdAt: number;
  expiresAt?: number;
  tags?: string[];
}

/**
 * 스토리지 인터페이스
 */
export interface IStorage {
  /**
   * 값 저장
   * @param key 키
   * @param value 값
   * @param options 캐시 옵션
   */
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;

  /**
   * 값 조회
   * @param key 키
   * @returns 저장된 값 또는 null
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * 값 삭제
   * @param key 키
   */
  remove(key: string): Promise<void>;

  /**
   * 모든 값 삭제
   */
  clear(): Promise<void>;

  /**
   * 키 존재 여부 확인
   * @param key 키
   */
  has(key: string): Promise<boolean>;

  /**
   * 모든 키 조회
   * @param prefix 키 접두사 필터
   */
  keys(prefix?: string): Promise<string[]>;

  /**
   * 태그로 캐시 무효화
   * @param tags 태그 배열
   */
  invalidateByTags(tags: string[]): Promise<void>;

  /**
   * 만료된 항목 정리
   */
  cleanup(): Promise<void>;
}

/**
 * 캐시 통계
 */
export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  oldestEntry?: number;
  newestEntry?: number;
}

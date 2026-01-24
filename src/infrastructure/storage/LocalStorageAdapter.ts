/**
 * LocalStorage Adapter
 * DO-278A 요구사항 추적: SRS-STG-002
 *
 * 브라우저 LocalStorage를 사용한 스토리지 구현
 */

import type { IStorage, CacheOptions, StoredItem } from './IStorage';

/**
 * 스토리지 접두사
 */
const STORAGE_PREFIX = 'tbas:';

/**
 * LocalStorage 어댑터
 *
 * 간단한 키-값 저장에 적합합니다.
 * 용량 제한: ~5MB
 */
export class LocalStorageAdapter implements IStorage {
  private readonly prefix: string;

  constructor(prefix: string = STORAGE_PREFIX) {
    this.prefix = prefix;
  }

  /**
   * 값 저장
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const fullKey = this.getFullKey(key);
    const item: StoredItem<T> = {
      key,
      value,
      createdAt: Date.now(),
      expiresAt: options?.ttl ? Date.now() + options.ttl : undefined,
      tags: options?.tags,
    };

    try {
      localStorage.setItem(fullKey, JSON.stringify(item));
    } catch (error) {
      // 용량 초과 시 오래된 항목 정리 후 재시도
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        await this.cleanup();
        try {
          localStorage.setItem(fullKey, JSON.stringify(item));
        } catch (retryError) {
          // Cleanup 후에도 실패하면 무시 (필수 기능 아님)
          console.warn('LocalStorage: 저장 실패 (용량 부족)', key);
        }
      } else if (error instanceof DOMException && (error.name === 'SecurityError' || error.name === 'InvalidStateError')) {
        // Private browsing mode 또는 localStorage 비활성화
        console.warn('LocalStorage: 저장 불가 (비활성화됨)');
      } else {
        console.warn('LocalStorage: 저장 실패', error);
      }
    }
  }

  /**
   * 값 조회
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const fullKey = this.getFullKey(key);
      const raw = localStorage.getItem(fullKey);

      if (!raw) return null;

      const item: StoredItem<T> = JSON.parse(raw);

      // 만료 확인
      if (item.expiresAt && Date.now() > item.expiresAt) {
        await this.remove(key);
        return null;
      }

      return item.value;
    } catch {
      // localStorage 접근 실패 또는 JSON 파싱 실패
      return null;
    }
  }

  /**
   * 값 삭제
   */
  async remove(key: string): Promise<void> {
    try {
      const fullKey = this.getFullKey(key);
      localStorage.removeItem(fullKey);
    } catch {
      // localStorage 접근 실패 시 무시
    }
  }

  /**
   * 모든 값 삭제
   */
  async clear(): Promise<void> {
    const keys = await this.keys();
    for (const key of keys) {
      await this.remove(key);
    }
  }

  /**
   * 키 존재 여부 확인
   */
  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  /**
   * 모든 키 조회
   */
  async keys(prefix?: string): Promise<string[]> {
    try {
      const result: string[] = [];
      const searchPrefix = this.prefix + (prefix ?? '');

      for (let i = 0; i < localStorage.length; i++) {
        const fullKey = localStorage.key(i);
        if (fullKey?.startsWith(searchPrefix)) {
          result.push(fullKey.slice(this.prefix.length));
        }
      }

      return result;
    } catch {
      // localStorage 접근 실패 시 빈 배열 반환
      return [];
    }
  }

  /**
   * 태그로 캐시 무효화
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    const allKeys = await this.keys();

    for (const key of allKeys) {
      const fullKey = this.getFullKey(key);
      const raw = localStorage.getItem(fullKey);
      if (!raw) continue;

      try {
        const item: StoredItem<unknown> = JSON.parse(raw);
        if (item.tags?.some((tag) => tags.includes(tag))) {
          await this.remove(key);
        }
      } catch {
        // 파싱 실패 시 무시
      }
    }
  }

  /**
   * 만료된 항목 정리
   */
  async cleanup(): Promise<void> {
    const allKeys = await this.keys();
    const now = Date.now();

    for (const key of allKeys) {
      const fullKey = this.getFullKey(key);
      const raw = localStorage.getItem(fullKey);
      if (!raw) continue;

      try {
        const item: StoredItem<unknown> = JSON.parse(raw);
        if (item.expiresAt && now > item.expiresAt) {
          await this.remove(key);
        }
      } catch {
        // 파싱 실패 시 삭제
        await this.remove(key);
      }
    }
  }

  /**
   * 전체 키 생성
   */
  private getFullKey(key: string): string {
    return this.prefix + key;
  }
}

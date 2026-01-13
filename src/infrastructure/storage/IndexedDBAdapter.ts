/**
 * IndexedDB Adapter
 * DO-278A 요구사항 추적: SRS-STG-003
 *
 * 브라우저 IndexedDB를 사용한 대용량 스토리지 구현
 */

import type { IStorage, CacheOptions, StoredItem } from './IStorage';

/**
 * DB 설정
 */
const DB_NAME = 'tbas-db';
const DB_VERSION = 1;
const STORE_NAME = 'cache';

/**
 * IndexedDB 어댑터
 *
 * 대용량 데이터 저장에 적합합니다.
 * GIS 데이터, 항공기 궤적 등에 사용됩니다.
 */
export class IndexedDBAdapter implements IStorage {
  private db: IDBDatabase | null = null;
  private readonly dbName: string;
  private readonly storeName: string;

  constructor(
    dbName: string = DB_NAME,
    storeName: string = STORE_NAME
  ) {
    this.dbName = dbName;
    this.storeName = storeName;
  }

  /**
   * DB 연결 초기화
   */
  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, DB_VERSION);

      request.onerror = () => {
        reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 객체 저장소 생성
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'key' });
          store.createIndex('expiresAt', 'expiresAt', { unique: false });
          store.createIndex('tags', 'tags', { unique: false, multiEntry: true });
        }
      };
    });
  }

  /**
   * 값 저장
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const db = await this.getDB();
    const item: StoredItem<T> = {
      key,
      value,
      createdAt: Date.now(),
      expiresAt: options?.ttl ? Date.now() + options.ttl : undefined,
      tags: options?.tags,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(item);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * 값 조회
   */
  async get<T>(key: string): Promise<T | null> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const item = request.result as StoredItem<T> | undefined;

        if (!item) {
          resolve(null);
          return;
        }

        // 만료 확인
        if (item.expiresAt && Date.now() > item.expiresAt) {
          this.remove(key).then(() => resolve(null));
          return;
        }

        resolve(item.value);
      };
    });
  }

  /**
   * 값 삭제
   */
  async remove(key: string): Promise<void> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * 모든 값 삭제
   */
  async clear(): Promise<void> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
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
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAllKeys();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        let keys = request.result as string[];

        if (prefix) {
          keys = keys.filter((key) => key.startsWith(prefix));
        }

        resolve(keys);
      };
    });
  }

  /**
   * 태그로 캐시 무효화
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    const db = await this.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('tags');
      const keysToDelete: string[] = [];

      // 각 태그에 해당하는 키 수집
      let completed = 0;
      for (const tag of tags) {
        const request = index.getAllKeys(tag);
        request.onsuccess = () => {
          keysToDelete.push(...(request.result as string[]));
          completed++;

          if (completed === tags.length) {
            // 중복 제거 후 삭제
            const uniqueKeys = [...new Set(keysToDelete)];
            let deleteCompleted = 0;

            if (uniqueKeys.length === 0) {
              resolve();
              return;
            }

            for (const key of uniqueKeys) {
              const deleteRequest = store.delete(key);
              deleteRequest.onsuccess = () => {
                deleteCompleted++;
                if (deleteCompleted === uniqueKeys.length) {
                  resolve();
                }
              };
              deleteRequest.onerror = () => reject(deleteRequest.error);
            }
          }
        };
        request.onerror = () => reject(request.error);
      }

      if (tags.length === 0) {
        resolve();
      }
    });
  }

  /**
   * 만료된 항목 정리
   */
  async cleanup(): Promise<void> {
    const db = await this.getDB();
    const now = Date.now();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('expiresAt');
      const range = IDBKeyRange.upperBound(now);
      const request = index.openCursor(range);
      let count = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          count++;
          cursor.continue();
        } else {
          console.log(`IndexedDB cleanup: removed ${count} expired items`);
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * DB 연결 닫기
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

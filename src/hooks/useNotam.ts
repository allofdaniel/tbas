/**
 * useNotam Hook
 * NOTAM 데이터 페칭, 캐싱 및 상태 관리
 */
import { useState, useCallback, useEffect } from 'react';
import { IS_PRODUCTION, NOTAM_CACHE_DURATION } from '../constants/config';

export interface NotamItem {
  id: string;
  notam_number: string;
  location: string;
  qcode?: string;
  qcode_mean?: string;
  e_text?: string;
  full_text?: string;
  effective_start?: string;
  effective_end?: string;
  series?: string;
  fir?: string;
  [key: string]: unknown;
}

export interface NotamData {
  data: NotamItem[];
  count?: number;
  returned?: number;
  source?: string;
}

interface CacheEntry {
  data: NotamData;
  timestamp: number;
}

// NOTAM 메모리 캐시
const notamMemoryCache: Record<string, CacheEntry> = {};

/**
 * 캐시에서 NOTAM 가져오기
 */
const getNotamCache = (period: string): NotamData | null => {
  const cached = notamMemoryCache[period];
  if (!cached) return null;

  const now = Date.now();
  if (now - cached.timestamp < NOTAM_CACHE_DURATION) {
    console.log(`NOTAM memory cache hit for period: ${period}, age: ${Math.round((now - cached.timestamp) / 1000)}s`);
    return cached.data;
  }

  delete notamMemoryCache[period];
  return null;
};

/**
 * 캐시에 NOTAM 저장
 */
const setNotamCache = (period: string, data: NotamData): void => {
  notamMemoryCache[period] = {
    data,
    timestamp: Date.now()
  };
  console.log(`NOTAM memory cache saved for period: ${period}, count: ${data?.data?.length || 0}`);
};

/**
 * 캐시 나이 가져오기
 */
const getNotamCacheAge = (period: string): number | null => {
  const cached = notamMemoryCache[period];
  if (!cached) return null;
  return Date.now() - cached.timestamp;
};

export interface UseNotamReturn {
  showNotamPanel: boolean;
  setShowNotamPanel: React.Dispatch<React.SetStateAction<boolean>>;
  notamData: NotamData | null;
  notamLoading: boolean;
  notamError: string | null;
  notamCacheAge: number | null;
  fetchNotamData: (period?: string, forceRefresh?: boolean) => Promise<void>;
  notamFilter: string;
  setNotamFilter: React.Dispatch<React.SetStateAction<string>>;
  notamLocationFilter: string;
  setNotamLocationFilter: React.Dispatch<React.SetStateAction<string>>;
  notamPeriod: string;
  setNotamPeriod: React.Dispatch<React.SetStateAction<string>>;
  notamExpanded: Record<string, boolean>;
  toggleNotamExpanded: (id: string) => void;
  showNotamOnMap: boolean;
  setShowNotamOnMap: React.Dispatch<React.SetStateAction<boolean>>;
  notamLocationsOnMap: Set<string>;
  toggleLocationOnMap: (location: string) => void;
  clearMapLocations: () => void;
  toggleMultipleLocations: (locations: string[], selectAll: boolean) => void;
}

/**
 * NOTAM 데이터 관리 훅
 */
export const useNotam = (): UseNotamReturn => {
  // Panel visibility
  const [showNotamPanel, setShowNotamPanel] = useState(false);

  // Data states
  const [notamData, setNotamData] = useState<NotamData | null>(null);
  const [notamLoading, setNotamLoading] = useState(false);
  const [notamError, setNotamError] = useState<string | null>(null);
  const [notamCacheAge, setNotamCacheAge] = useState<number | null>(null);

  // Filter states
  const [notamFilter, setNotamFilter] = useState('');
  const [notamLocationFilter, setNotamLocationFilter] = useState('');
  const [notamPeriod, setNotamPeriod] = useState('current');
  const [notamExpanded, setNotamExpanded] = useState<Record<string, boolean>>({});

  // Map layer states
  const [showNotamOnMap, setShowNotamOnMap] = useState(false);
  const [notamLocationsOnMap, setNotamLocationsOnMap] = useState<Set<string>>(new Set());

  /**
   * NOTAM 데이터 가져오기
   */
  const fetchNotamData = useCallback(async (period = 'current', forceRefresh = false): Promise<void> => {
    // 캐시 확인
    if (!forceRefresh) {
      const cachedData = getNotamCache(period);
      if (cachedData) {
        setNotamData(cachedData);
        setNotamCacheAge(getNotamCacheAge(period));
        setNotamLoading(false);
        return;
      }
    }

    setNotamLoading(true);
    setNotamError(null);

    try {
      const baseUrl = IS_PRODUCTION ? '/api/notam' : 'https://rkpu-viewer.vercel.app/api/notam';
      const params = new URLSearchParams();
      params.set('source', 'complete');
      params.set('period', period);
      params.set('bounds', '32,123,44,146');

      const url = `${baseUrl}?${params.toString()}`;
      const response = await fetch(url);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const json = await response.json();

      // 캐시에 저장
      setNotamCache(period, json);
      setNotamCacheAge(0);
      setNotamData(json);
    } catch (e) {
      console.error('NOTAM fetch failed:', e);
      setNotamError((e as Error).message);

      // 네트워크 에러 시 만료된 캐시라도 사용
      const expiredCache = notamMemoryCache[period];
      if (expiredCache) {
        setNotamData(expiredCache.data);
        setNotamError('캐시된 데이터 사용 중 (네트워크 오류)');
      }
    } finally {
      setNotamLoading(false);
    }
  }, []);

  // 패널 열릴 때 또는 기간 변경 시 데이터 가져오기
  useEffect(() => {
    if (showNotamPanel) {
      fetchNotamData(notamPeriod);
    }
  }, [showNotamPanel, notamPeriod, fetchNotamData]);

  /**
   * NOTAM 아이템 확장 토글
   */
  const toggleNotamExpanded = useCallback((id: string): void => {
    setNotamExpanded(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  }, []);

  /**
   * 지도에 표시할 공항 토글
   */
  const toggleLocationOnMap = useCallback((location: string): void => {
    setNotamLocationsOnMap(prev => {
      const newSet = new Set(prev);
      if (newSet.has(location)) {
        newSet.delete(location);
      } else {
        newSet.add(location);
      }
      return newSet;
    });
  }, []);

  /**
   * 모든 지도 필터 해제
   */
  const clearMapLocations = useCallback((): void => {
    setNotamLocationsOnMap(new Set());
  }, []);

  /**
   * 여러 공항 한번에 토글
   */
  const toggleMultipleLocations = useCallback((locations: string[], selectAll: boolean): void => {
    setNotamLocationsOnMap(prev => {
      const newSet = new Set(prev);
      locations.forEach(loc => {
        if (selectAll) {
          newSet.add(loc);
        } else {
          newSet.delete(loc);
        }
      });
      return newSet;
    });
  }, []);

  return {
    showNotamPanel,
    setShowNotamPanel,
    notamData,
    notamLoading,
    notamError,
    notamCacheAge,
    fetchNotamData,
    notamFilter,
    setNotamFilter,
    notamLocationFilter,
    setNotamLocationFilter,
    notamPeriod,
    setNotamPeriod,
    notamExpanded,
    toggleNotamExpanded,
    showNotamOnMap,
    setShowNotamOnMap,
    notamLocationsOnMap,
    toggleLocationOnMap,
    clearMapLocations,
    toggleMultipleLocations,
  };
};

export default useNotam;

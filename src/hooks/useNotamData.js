import { useState, useCallback, useEffect, useRef } from 'react';
import { IS_PRODUCTION, NOTAM_CACHE_DURATION } from '../constants/config';

/**
 * useNotamData - NOTAM 데이터 관리 훅
 * - 메모리 캐시 관리
 * - 데이터 fetching
 * - 기간별 필터링
 */

// NOTAM Memory Cache (module level for persistence)
const notamMemoryCache = {}; // { period: { data, timestamp } }

// NOTAM 메모리 캐시 헬퍼 함수
const getNotamCache = (period) => {
  const cached = notamMemoryCache[period];
  if (!cached) return null;

  const now = Date.now();

  // 캐시가 유효한지 확인 (10분 이내)
  if (now - cached.timestamp < NOTAM_CACHE_DURATION) {
    console.log(`NOTAM memory cache hit for period: ${period}, age: ${Math.round((now - cached.timestamp) / 1000)}s`);
    return cached.data;
  }

  // 만료된 캐시 삭제
  delete notamMemoryCache[period];
  return null;
};

const setNotamCache = (period, data) => {
  notamMemoryCache[period] = {
    data,
    timestamp: Date.now()
  };
  console.log(`NOTAM memory cache saved for period: ${period}, count: ${data?.data?.length || 0}`);
};

const getNotamCacheAge = (period) => {
  const cached = notamMemoryCache[period];
  if (!cached) return null;
  return Date.now() - cached.timestamp;
};

export default function useNotamData(showNotamPanel) {
  const [notamData, setNotamData] = useState(null);
  const [notamLoading, setNotamLoading] = useState(false);
  const [notamError, setNotamError] = useState(null);
  const [notamCacheAge, setNotamCacheAge] = useState(null);
  const [notamPeriod, setNotamPeriod] = useState('current'); // 'current', '1month', '1year', 'all'
  const [notamFilter, setNotamFilter] = useState(''); // 필터링용 검색어
  const [notamLocationFilter, setNotamLocationFilter] = useState(''); // 전체 지역
  const [notamExpanded, setNotamExpanded] = useState({});
  const [notamLocationsOnMap, setNotamLocationsOnMap] = useState(new Set()); // e.g., Set(['RKPU', 'RKTN'])

  // NOTAM data fetching with caching - always use complete DB with period filtering
  const fetchNotamData = useCallback(async (period = notamPeriod, forceRefresh = false) => {
    // 1. 먼저 캐시 확인 (강제 새로고침이 아닌 경우)
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
      // Use production URL in development, local API in production
      const baseUrl = IS_PRODUCTION ? '/api/notam' : 'https://rkpu-viewer.vercel.app/api/notam';
      const params = new URLSearchParams();

      // Always use complete DB with appropriate period filter
      params.set('source', 'complete');
      params.set('period', period); // 'current', '1month', '1year', or 'all'

      // Use fixed Korea+Japan region bounds instead of map bounds
      // This ensures all Korean airports are always included
      // Korea: 33-43N, 124-132E, Japan nearby: extend to 145E
      params.set('bounds', '32,123,44,146');

      const url = baseUrl + '?' + params.toString();

      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();

      // 2. 캐시에 저장
      setNotamCache(period, json);
      setNotamCacheAge(0);

      setNotamData(json);
    } catch (e) {
      console.error('NOTAM fetch failed:', e);
      setNotamError(e.message);

      // 3. 네트워크 에러 시 만료된 메모리 캐시라도 사용 시도
      const expiredCache = notamMemoryCache[period];
      if (expiredCache) {
        setNotamData(expiredCache.data);
        setNotamError('캐시된 데이터 사용 중 (네트워크 오류)');
      }
    } finally {
      setNotamLoading(false);
    }
  }, [notamPeriod]);

  // Fetch NOTAM when panel is opened or period changes
  useEffect(() => {
    if (showNotamPanel) {
      fetchNotamData(notamPeriod);
    }
  }, [showNotamPanel, notamPeriod, fetchNotamData]);

  return {
    notamData,
    setNotamData,
    notamLoading,
    notamError,
    notamCacheAge,
    notamPeriod,
    setNotamPeriod,
    notamFilter,
    setNotamFilter,
    notamLocationFilter,
    setNotamLocationFilter,
    notamExpanded,
    setNotamExpanded,
    notamLocationsOnMap,
    setNotamLocationsOnMap,
    fetchNotamData,
  };
}

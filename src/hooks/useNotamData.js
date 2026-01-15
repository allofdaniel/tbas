import { useState, useCallback, useEffect, useRef } from 'react';
import { NOTAM_CACHE_DURATION } from '../constants/config';

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
      let response;
      let usedFallback = false;

      // Try API first, fallback to local data if it fails
      try {
        const params = new URLSearchParams();
        params.set('source', 'complete');
        params.set('period', period);
        params.set('bounds', '32,123,44,146');
        const url = '/api/notam?' + params.toString();

        response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        // Check if response is JSON (Vite dev server returns HTML for missing routes)
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Response is not JSON');
        }
      } catch (apiError) {
        console.log('NOTAM API failed, trying local fallback:', apiError.message);
        // Fallback to local mock data
        response = await fetch('/data/notams.json');
        usedFallback = true;
        if (!response.ok) throw new Error(`Fallback also failed: HTTP ${response.status}`);
      }
      const rawData = await response.json();

      // Handle both API response format and direct S3 JSON array
      let json;
      if (Array.isArray(rawData)) {
        // Direct S3 response - wrap in expected format
        json = {
          data: rawData,
          count: rawData.length,
          returned: rawData.length,
          source: 's3-direct'
        };
      } else {
        json = rawData;
      }

      // 2. 캐시에 저장
      if (usedFallback) {
        json.source = 'local-demo';
        console.log('Using local demo NOTAM data');
      }
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

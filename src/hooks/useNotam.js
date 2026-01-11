/**
 * useNotam Hook
 * NOTAM 데이터 페칭, 캐싱 및 상태 관리
 */
import { useState, useCallback, useEffect } from 'react';
import { IS_PRODUCTION, NOTAM_CACHE_DURATION } from '../constants/config';

// NOTAM 메모리 캐시
const notamMemoryCache = {};

/**
 * 캐시에서 NOTAM 가져오기
 */
const getNotamCache = (period) => {
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
const setNotamCache = (period, data) => {
  notamMemoryCache[period] = {
    data,
    timestamp: Date.now()
  };
  console.log(`NOTAM memory cache saved for period: ${period}, count: ${data?.data?.length || 0}`);
};

/**
 * 캐시 나이 가져오기
 */
const getNotamCacheAge = (period) => {
  const cached = notamMemoryCache[period];
  if (!cached) return null;
  return Date.now() - cached.timestamp;
};

/**
 * NOTAM 데이터 관리 훅
 * @returns {Object} NOTAM 상태 및 함수들
 */
export const useNotam = () => {
  // Panel visibility
  const [showNotamPanel, setShowNotamPanel] = useState(false);

  // Data states
  const [notamData, setNotamData] = useState(null);
  const [notamLoading, setNotamLoading] = useState(false);
  const [notamError, setNotamError] = useState(null);
  const [notamCacheAge, setNotamCacheAge] = useState(null);

  // Filter states
  const [notamFilter, setNotamFilter] = useState('');
  const [notamLocationFilter, setNotamLocationFilter] = useState('');
  const [notamPeriod, setNotamPeriod] = useState('current');
  const [notamExpanded, setNotamExpanded] = useState({});

  // Map layer states
  const [showNotamOnMap, setShowNotamOnMap] = useState(false);
  const [notamLocationsOnMap, setNotamLocationsOnMap] = useState(new Set());

  /**
   * NOTAM 데이터 가져오기
   */
  const fetchNotamData = useCallback(async (period = 'current', forceRefresh = false) => {
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
      setNotamError(e.message);

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
  const toggleNotamExpanded = useCallback((id) => {
    setNotamExpanded(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  }, []);

  /**
   * 지도에 표시할 공항 토글
   */
  const toggleLocationOnMap = useCallback((location) => {
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
  const clearMapLocations = useCallback(() => {
    setNotamLocationsOnMap(new Set());
  }, []);

  /**
   * 여러 공항 한번에 토글
   */
  const toggleMultipleLocations = useCallback((locations, selectAll) => {
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
    // Panel
    showNotamPanel,
    setShowNotamPanel,

    // Data
    notamData,
    notamLoading,
    notamError,
    notamCacheAge,
    fetchNotamData,

    // Filters
    notamFilter,
    setNotamFilter,
    notamLocationFilter,
    setNotamLocationFilter,
    notamPeriod,
    setNotamPeriod,

    // Expansion
    notamExpanded,
    toggleNotamExpanded,

    // Map layer
    showNotamOnMap,
    setShowNotamOnMap,
    notamLocationsOnMap,
    toggleLocationOnMap,
    clearMapLocations,
    toggleMultipleLocations,
  };
};

export default useNotam;

import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Import constants
import {
  MAPBOX_ACCESS_TOKEN,
  IS_PRODUCTION,
  AIRCRAFT_UPDATE_INTERVAL,
  NOTAM_CACHE_DURATION,
  TRAIL_COLOR,
  TRAIL_DURATION_OPTIONS,
  getAircraftApiUrl,
  getAircraftTraceUrl,
  AIRCRAFT_MODEL_MAP,
  MAP_STYLES,
  PROCEDURE_CHARTS,
} from './constants/config';

import {
  AIRPORT_DATABASE,
  COUNTRY_INFO,
  AIRPORT_TYPE_LABELS,
  AIRPORT_COORDINATES,
  KOREA_AIRPORTS,
  getAirportInfo,
  getAirportName,
  getAirportCoordinates,
} from './constants/airports';

// Import utilities
import {
  ftToM,
  createCirclePolygon,
  createObstacleShape,
  createRibbonSegment,
  isPointInPolygon,
} from './utils/geometry';

import {
  generateColor,
  altitudeToColor,
  AIRCRAFT_CATEGORY_COLORS,
  OBSTACLE_COLORS,
} from './utils/colors';

import {
  parseNotamDateString,
} from './utils/format';

// Import weather utilities
import {
  parseMetar,
  parseMetarTime,
  formatUTC,
  formatKST,
} from './utils/weather';

// Import aircraft constants
import {
  ICAO_TO_IATA,
  AIRCRAFT_SILHOUETTE,
  AIRCRAFT_COLORS,
  getAircraftImage,
  getAircraftColor,
} from './constants/aircraft';

// Import flight utilities
import {
  detectFlightPhase,
  detectCurrentAirspace,
  findNearestWaypoints,
  detectCurrentProcedure,
} from './utils/flight';

// Import NOTAM utilities
import {
  parseNotamCoordinates,
  getNotamDisplayCoords,
  getNotamType,
  getCancelledNotamRef,
  extractDatesFromFullText,
  getNotamValidity,
  isNotamActive,
  buildCancelledNotamSet,
  createNotamCircle,
} from './utils/notam';

// Import components
import {
  AltitudeLegend,
  Accordion,
  ToggleItem,
  SidPanel,
  StarPanel,
  ApproachPanel,
  ChartOverlayPanel,
  WeatherPanel,
  AircraftDetailPanel,
  TimeWeatherBar,
  ViewControlsBar,
  AircraftControlPanel,
  KoreaAirspacePanel,
} from './components';

// Import hooks
import {
  useRadarLayer,
  useChartOverlay,
  useMapStyle,
  useAtcRadarRings,
  useAtcSectors,
  useKoreaAirspace,
} from './hooks';

mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

// NOTAM Cache - 메모리 캐시 사용 (localStorage는 용량 초과로 실패)
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

// NOTE: AIRPORT_DATABASE, COUNTRY_INFO, AIRPORT_TYPE_LABELS, AIRPORT_COORDINATES
// are now imported from './constants/airports'

// NOTE: TRAIL_COLOR, TRAIL_DURATION_OPTIONS, getAircraftApiUrl, getAircraftTraceUrl
// are now imported from './constants/config'

// NOTE: generateColor, altitudeToColor, OBSTACLE_COLORS, AIRCRAFT_CATEGORY_COLORS
// are now imported from './utils/colors'

// NOTE: ftToM, createCirclePolygon, createObstacleShape, createRibbonSegment, isPointInPolygon
// NOTE: AIRCRAFT_MODEL_MAP, MAP_STYLES, PROCEDURE_CHARTS are now imported from './constants/config'

function App() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [data, setData] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [is3DView, setIs3DView] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showSatellite, setShowSatellite] = useState(false);
  const [showBuildings, setShowBuildings] = useState(true);

  const [chartBounds, setChartBounds] = useState({});
  const [activeCharts, setActiveCharts] = useState({});
  const [chartOpacities, setChartOpacities] = useState({});

  // Accordion states - all sections (기본 레이어만 열려있음)
  const [layersExpanded, setLayersExpanded] = useState(true);
  const [aircraftExpanded, setAircraftExpanded] = useState(false);
  const [sidExpanded, setSidExpanded] = useState(false);
  const [starExpanded, setStarExpanded] = useState(false);
  const [apchExpanded, setApchExpanded] = useState(false);
  const [chartExpanded, setChartExpanded] = useState(false);
  // Mobile panel state
  const [isPanelOpen, setIsPanelOpen] = useState(window.innerWidth > 768);

  // METAR/TAF popup states (separate for METAR and TAF)
  const [showMetarPopup, setShowMetarPopup] = useState(false);
  const [showTafPopup, setShowTafPopup] = useState(false);
  const [metarPinned, setMetarPinned] = useState(false);
  const [tafPinned, setTafPinned] = useState(false);

  const [showWaypoints, setShowWaypoints] = useState(false);
  const [showObstacles, setShowObstacles] = useState(false);
  const [showAirspace, setShowAirspace] = useState(true);
  const [show3DAltitude, setShow3DAltitude] = useState(true);
  const [showTerrain, setShowTerrain] = useState(true);

  const [sidVisible, setSidVisible] = useState({});
  const [starVisible, setStarVisible] = useState({});
  const [apchVisible, setApchVisible] = useState({});
  const [procColors, setProcColors] = useState({ SID: {}, STAR: {}, APPROACH: {} });

  const [showAircraft, setShowAircraft] = useState(true);
  const [showAircraftTrails, setShowAircraftTrails] = useState(true);
  const [show3DAircraft, setShow3DAircraft] = useState(true);
  const [trailDuration, setTrailDuration] = useState(60000); // 1분 기본값 (히스토리 길이)
  const [headingPrediction, setHeadingPrediction] = useState(30); // 헤딩 예측 시간 (초) - 30초 기본
  const [labelOffset, setLabelOffset] = useState({ x: 1.0, y: 0 }); // 라벨 오프셋 (사용자 드래그로 조절)
  const [isDraggingLabel, setIsDraggingLabel] = useState(false); // 라벨 드래그 중인지
  const [aircraft, setAircraft] = useState([]);
  const [aircraftTrails, setAircraftTrails] = useState({});
  const [tracesLoaded, setTracesLoaded] = useState(new Set()); // 이미 trace 로드된 항공기
  const [selectedAircraft, setSelectedAircraft] = useState(null); // 선택된 항공기 상세정보
  const [aircraftPhoto, setAircraftPhoto] = useState(null); // 선택된 항공기 사진 (airport-data.com)
  const [aircraftPhotoLoading, setAircraftPhotoLoading] = useState(false);
  const [aircraftDetails, setAircraftDetails] = useState(null); // hexdb.io 기체 상세정보 (MSN, 제조년도 등)
  const [aircraftDetailsLoading, setAircraftDetailsLoading] = useState(false);
  const [flightSchedule, setFlightSchedule] = useState(null); // aviationstack 스케줄 정보
  const [flightScheduleLoading, setFlightScheduleLoading] = useState(false);
  const [flightTrack, setFlightTrack] = useState(null); // OpenSky 비행경로 데이터
  const [flightTrackLoading, setFlightTrackLoading] = useState(false);
  const [showAircraftPanel, setShowAircraftPanel] = useState(false); // 항공기 상세 패널 표시
  const [graphHoverData, setGraphHoverData] = useState(null); // 고도 그래프 hover 데이터
  const aircraftIntervalRef = useRef(null);
  // Collapsible sections state
  const [sectionExpanded, setSectionExpanded] = useState({
    flightStatus: true,
    aircraftInfo: true,
    schedule: true,
    graph: true,
    position: true
  });
  const toggleSection = (section) => setSectionExpanded(prev => ({ ...prev, [section]: !prev[section] }));

  // aviationstack API key (환경변수 또는 직접 설정)
  const AVIATIONSTACK_API_KEY = import.meta.env.VITE_AVIATIONSTACK_API_KEY || '';

  // NOTE: ICAO_TO_IATA, AIRCRAFT_SILHOUETTE, AIRCRAFT_COLORS, getAircraftImage, getAircraftColor
  // are now imported from './constants/aircraft'

  const [weatherData, setWeatherData] = useState(null);
  const weatherIntervalRef = useRef(null);

  // Aviation weather layers
  const [showRadar, setShowRadar] = useState(false);
  const [showSatelliteWx, setShowSatelliteWx] = useState(false);
  const [showLightning, setShowLightning] = useState(false);
  const [showSigmet, setShowSigmet] = useState(false);
    const [wxLayersExpanded, setWxLayersExpanded] = useState(false);

  // Weather data states
  // NOTE: radarData is now managed by useRadarLayer hook
  const [satelliteWxData, setSatelliteWxData] = useState(null);
  const [lightningData, setLightningData] = useState(null);
  const [sigmetData, setSigmetData] = useState(null);
    const [llwsData, setLlwsData] = useState(null);
  const [notamData, setNotamData] = useState(null);

  // Right panel weather detail state
  const [showWxPanel, setShowWxPanel] = useState(false);
  const [wxPanelTab, setWxPanelTab] = useState('sigmet'); // sigmet, notam, llws, lightning

  // ATC Sectors panel
  const [showAtcPanel, setShowAtcPanel] = useState(false);
  const [atcData, setAtcData] = useState(null);
  const [atcExpanded, setAtcExpanded] = useState({ ACC: true, TMA: false, CTR: false });
  const [selectedAtcSectors, setSelectedAtcSectors] = useState(new Set());

  // ATC Only Mode (Radar Display) - 검은 배경 + 거리 링
  const [atcOnlyMode, setAtcOnlyMode] = useState(false);
  const [radarRange, setRadarRange] = useState(100); // 레이더 최대 범위 (nm) - 100nm 기본
  const [radarBlackBackground, setRadarBlackBackground] = useState(true); // 레이더뷰 검은 배경 on/off

  // NOTAM panel
  const [showNotamPanel, setShowNotamPanel] = useState(false);
  const [notamLoading, setNotamLoading] = useState(false);
  const [notamError, setNotamError] = useState(null);
  const [notamFilter, setNotamFilter] = useState(''); // 필터링용 검색어
  const [notamLocationFilter, setNotamLocationFilter] = useState(''); // 전체 지역
  const [notamExpanded, setNotamExpanded] = useState({});
  const [notamPeriod, setNotamPeriod] = useState('current'); // 'current', '1month', '1year', 'all'

  // NOTAM map layer toggle - Set of location codes to show on map
  const [showNotamOnMap, setShowNotamOnMap] = useState(false);
  const [notamLocationsOnMap, setNotamLocationsOnMap] = useState(new Set()); // e.g., Set(['RKPU', 'RKTN'])

  // Korea Airspace Data (Routes, Waypoints, NAVAIDs, Airspaces)
  const [koreaAirspaceData, setKoreaAirspaceData] = useState(null);
  const [showKoreaRoutes, setShowKoreaRoutes] = useState(false);
  const [showKoreaWaypoints, setShowKoreaWaypoints] = useState(false);
  const [showKoreaNavaids, setShowKoreaNavaids] = useState(false);
  const [showKoreaAirspaces, setShowKoreaAirspaces] = useState(false);
  const [koreaRoutesExpanded, setKoreaRoutesExpanded] = useState(false);

  // Three.js refs for GLB models
  const threeSceneRef = useRef(null);
  const threeCameraRef = useRef(null);
  const threeRendererRef = useRef(null);
  const modelCacheRef = useRef({});
  const gltfLoaderRef = useRef(null);
  const aircraftMeshesRef = useRef({});
  const procedureObjectsRef = useRef([]);

  // Custom Hooks for map layers
  const { radarData } = useRadarLayer(map, mapLoaded, showRadar);
  useChartOverlay(map, mapLoaded, activeCharts, chartOpacities, chartBounds);
  useMapStyle({
    map,
    mapLoaded,
    setMapLoaded,
    isDarkMode,
    showSatellite,
    atcOnlyMode,
    radarBlackBackground,
    is3DView,
    showTerrain,
    show3DAltitude
  });
  useAtcRadarRings(map, mapLoaded, atcOnlyMode, radarRange);
  useAtcSectors(map, mapLoaded, atcData, selectedAtcSectors);
  useKoreaAirspace(map, mapLoaded, koreaAirspaceData, showKoreaRoutes, showKoreaWaypoints, showKoreaNavaids, showKoreaAirspaces, is3DView, show3DAltitude);

  // Android WebView height fix - Critical for Galaxy S25 Ultra full-screen display
  const [windowHeight, setWindowHeight] = useState(window.innerHeight);

  useEffect(() => {
    const updateHeight = () => {
      // Get the actual viewport height (Android WebView compatible)
      const vh = Math.max(
        document.documentElement.clientHeight || 0,
        window.innerHeight || 0,
        window.screen?.availHeight || 0
      );
      setWindowHeight(vh);

      // Also set CSS custom property for CSS usage
      document.documentElement.style.setProperty('--app-height', `${vh}px`);

      // Force map resize if available
      if (map.current) {
        setTimeout(() => map.current.resize(), 50);
      }
    };

    updateHeight();

    window.addEventListener('resize', updateHeight);
    window.addEventListener('orientationchange', updateHeight);
    window.addEventListener('load', updateHeight);

    // Delayed updates for Android WebView initialization
    const timeouts = [100, 300, 500, 1000, 2000, 3000].map(delay =>
      setTimeout(updateHeight, delay)
    );

    return () => {
      window.removeEventListener('resize', updateHeight);
      window.removeEventListener('orientationchange', updateHeight);
      window.removeEventListener('load', updateHeight);
      timeouts.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    fetch('/aviation_data.json')
      .then((res) => res.json())
      .then((json) => {
        setData(json);
        const sidKeys = Object.keys(json.procedures?.SID || {});
        const starKeys = Object.keys(json.procedures?.STAR || {});
        const apchKeys = Object.keys(json.procedures?.APPROACH || {});
        setSidVisible(Object.fromEntries(sidKeys.map((k) => [k, false])));
        setStarVisible(Object.fromEntries(starKeys.map((k) => [k, false])));
        setApchVisible(Object.fromEntries(apchKeys.map((k) => [k, false])));
        setProcColors({
          SID: Object.fromEntries(sidKeys.map((k, i) => [k, generateColor(i, sidKeys.length, 120)])),
          STAR: Object.fromEntries(starKeys.map((k, i) => [k, generateColor(i, starKeys.length, 30)])),
          APPROACH: Object.fromEntries(apchKeys.map((k, i) => [k, generateColor(i, apchKeys.length, 200)])),
        });
      });
  }, []);

  useEffect(() => {
    fetch('/charts/chart_bounds.json')
      .then((res) => res.json())
      .then((bounds) => {
        setChartBounds(bounds);
        setChartOpacities(Object.fromEntries(Object.keys(bounds).map(k => [k, 0.7])));
      });
  }, []);

  useEffect(() => {
    fetch('/atc_sectors.json')
      .then((res) => res.json())
      .then((data) => setAtcData(data))
      .catch((err) => console.warn('Failed to load ATC sectors:', err));
  }, []);

  // Load Korea Airspace Data (Routes, Waypoints, NAVAIDs, Airspaces)
  useEffect(() => {
    fetch('/data/korea_airspace.json')
      .then((res) => res.json())
      .then((data) => {
        setKoreaAirspaceData(data);
        console.log(`Loaded Korea airspace: ${data.waypoints?.length} waypoints, ${data.routes?.length} routes, ${data.navaids?.length} navaids, ${data.airspaces?.length} airspaces (AIRAC ${data.metadata?.airac})`);
      })
      .catch((err) => console.warn('Failed to load Korea airspace data:', err));
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // NOTE: formatUTC, formatKST, parseMetarTime are now imported from './utils/weather'

  const fetchWeatherData = useCallback(async () => {
    try {
      // Use proxy API to avoid CORS issues with KMA API
      // Add cache buster to ensure fresh data from KMA AMOS
      const cacheBuster = `&_t=${Date.now()}`;
      const metarUrl = IS_PRODUCTION ? `/api/weather?type=metar${cacheBuster}` : `https://rkpu-viewer.vercel.app/api/weather?type=metar${cacheBuster}`;
      const tafUrl = IS_PRODUCTION ? `/api/weather?type=taf${cacheBuster}` : `https://rkpu-viewer.vercel.app/api/weather?type=taf${cacheBuster}`;

      const [metarRes, tafRes] = await Promise.all([
        fetch(metarUrl),
        fetch(tafUrl)
      ]);

      const [metarJson, tafJson] = await Promise.all([
        metarRes.json(),
        tafRes.json()
      ]);

      const metarData = metarJson?.[0] || null;
      const tafData = tafJson?.[0] || null;

      setWeatherData({ metar: metarData, taf: tafData });
    } catch (e) {
      console.error('Weather fetch failed:', e);
    }
  }, []);

  // NOTAM cache age state for UI display
  const [notamCacheAge, setNotamCacheAge] = useState(null);

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

  useEffect(() => {
    if (!data?.airport) return;
    fetchWeatherData();
    weatherIntervalRef.current = setInterval(fetchWeatherData, 5 * 60 * 1000);
    return () => clearInterval(weatherIntervalRef.current);
  }, [data?.airport, fetchWeatherData]);

  // Fetch aviation weather layers when toggled
  useEffect(() => {
    const baseUrl = IS_PRODUCTION ? '/api/weather' : 'https://rkpu-viewer.vercel.app/api/weather';

    if (showRadar) {
      fetch(`${baseUrl}?type=radar`).then(r => r.json()).then(setRadarData).catch(console.error);
      const interval = setInterval(() => {
        fetch(`${baseUrl}?type=radar`).then(r => r.json()).then(setRadarData).catch(console.error);
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [showRadar]);

  useEffect(() => {
    const baseUrl = IS_PRODUCTION ? '/api/weather' : 'https://rkpu-viewer.vercel.app/api/weather';

    if (showSatelliteWx) {
      fetch(`${baseUrl}?type=satellite`).then(r => r.json()).then(setSatelliteWxData).catch(console.error);
    }
  }, [showSatelliteWx]);

  useEffect(() => {
    const baseUrl = IS_PRODUCTION ? '/api/weather' : 'https://rkpu-viewer.vercel.app/api/weather';

    if (showLightning) {
      fetch(`${baseUrl}?type=lightning`).then(r => r.json()).then(setLightningData).catch(console.error);
      const interval = setInterval(() => {
        fetch(`${baseUrl}?type=lightning`).then(r => r.json()).then(setLightningData).catch(console.error);
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [showLightning]);

  useEffect(() => {
    const baseUrl = IS_PRODUCTION ? '/api/weather' : 'https://rkpu-viewer.vercel.app/api/weather';

    if (showSigmet || showWxPanel) {
      fetch(`${baseUrl}?type=sigmet`).then(r => r.json()).then(setSigmetData).catch(console.error);
      fetch(`${baseUrl}?type=llws`).then(r => r.json()).then(setLlwsData).catch(console.error);
      fetch(`${baseUrl}?type=notam`).then(r => r.json()).then(setNotamData).catch(console.error);
    }
  }, [showSigmet, showWxPanel]);


  // Initialize GLB loader
  useEffect(() => {
    gltfLoaderRef.current = new GLTFLoader();
    const modelsToLoad = ['/b737.glb', '/b777.glb', '/A380.glb', '/helicopter.glb'];

    modelsToLoad.forEach(url => {
      gltfLoaderRef.current.load(url, (gltf) => {
        const obj = gltf.scene.clone();
        const box = new THREE.Box3().setFromObject(obj);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = (url.includes('helicopter') ? 30 : 50) / maxDim;
        obj.scale.set(scale, scale, scale);
        modelCacheRef.current[url] = obj;
        console.log('Loaded model:', url);
      }, undefined, (err) => console.warn('Failed to load:', url, err));
    });
  }, []);

  const getModelForAircraft = useCallback((type, category) => {
    const upperType = (type || '').toUpperCase();
    for (const [key, url] of Object.entries(AIRCRAFT_MODEL_MAP)) {
      if (upperType.includes(key)) return url;
    }
    if (upperType.includes('HELI') || category === 'A7') return '/helicopter.glb';
    return '/b737.glb';
  }, []);

  // NOTE: parseMetar is now imported from './utils/weather'

  // 개별 항공기의 과거 위치 히스토리 로드
  const loadAircraftTrace = useCallback(async (hex) => {
    try {
      const response = await fetch(getAircraftTraceUrl(hex));
      const result = await response.json();
      const ac = result.ac?.[0];
      if (!ac || !ac.trace) return null;

      // trace 배열: [timestamp, lat, lon, altitude(feet?), ...]
      const tracePoints = [];
      const now = Date.now();
      ac.trace.forEach(point => {
        if (point && point.length >= 4) {
          const timestamp = point[0] * 1000; // 초 -> 밀리초
          if (now - timestamp <= trailDuration) {
            tracePoints.push({
              lat: point[1],
              lon: point[2],
              altitude_m: ftToM(point[3] || 0),
              timestamp
            });
          }
        }
      });
      return tracePoints;
    } catch (e) {
      console.error(`Failed to load trace for ${hex}:`, e);
      return null;
    }
  }, [trailDuration]);

  const fetchAircraftData = useCallback(async () => {
    if (!data?.airport) return;
    try {
      const { lat, lon } = data.airport;
      const response = await fetch(getAircraftApiUrl(lat, lon, 100));
      const result = await response.json();
      const aircraftData = result.ac || [];

      const processed = aircraftData.filter(ac => ac.lat && ac.lon).map(ac => ({
        hex: ac.hex, callsign: ac.flight?.trim() || ac.hex, type: ac.t || 'Unknown',
        category: ac.category || 'A0', lat: ac.lat, lon: ac.lon,
        altitude_ft: ac.alt_baro || ac.alt_geom || 0, altitude_m: ftToM(ac.alt_baro || ac.alt_geom || 0),
        ground_speed: ac.gs || 0, track: ac.track || 0, on_ground: ac.alt_baro === 'ground' || ac.ground,
        // 추가 ADS-B 정보
        vertical_rate: ac.baro_rate || ac.geom_rate || 0, // ft/min
        squawk: ac.squawk || '',
        emergency: ac.emergency || '',
        registration: ac.r || '',
        icao_type: ac.t || '',
        operator: ac.ownOp || '',
        origin: ac.orig || '', // 출발 공항 (있으면)
        destination: ac.dest || '', // 도착 공항 (있으면)
        nav_altitude: ac.nav_altitude_mcp || ac.nav_altitude_fms || null,
        nav_heading: ac.nav_heading || null,
        ias: ac.ias || 0, // indicated airspeed
        tas: ac.tas || 0, // true airspeed
        mach: ac.mach || 0,
        mag_heading: ac.mag_heading || ac.track || 0,
        true_heading: ac.true_heading || ac.track || 0,
        timestamp: Date.now(),
      }));

      // 새로운 항공기들의 trace 로드 (이미 로드한 항공기 제외)
      // 새로고침 시 모든 비행중인 항공기의 이전 항적을 로드
      const newAircraft = processed.filter(ac => !tracesLoaded.has(ac.hex) && !ac.on_ground);
      if (newAircraft.length > 0) {
        // 처음 로드 시에는 모든 항공기 로드, 이후에는 10개씩 로드
        const isFirstLoad = tracesLoaded.size === 0;
        const maxLoad = isFirstLoad ? newAircraft.length : 10;
        const toLoad = newAircraft.slice(0, maxLoad);

        // 병렬로 trace 로드 (처음에는 모두, 이후에는 일부)
        const tracePromises = toLoad.map(ac => loadAircraftTrace(ac.hex).then(trace => ({ hex: ac.hex, trace })));
        const traces = await Promise.all(tracePromises);

        setTracesLoaded(prev => {
          const next = new Set(prev);
          toLoad.forEach(ac => next.add(ac.hex));
          return next;
        });

        setAircraftTrails(prev => {
          const trails = { ...prev };
          traces.forEach(({ hex, trace }) => {
            if (trace && trace.length > 0) {
              trails[hex] = trace;
            }
          });
          return trails;
        });
      }

      setAircraftTrails(prev => {
        const trails = { ...prev };
        processed.forEach(ac => {
          if (!trails[ac.hex]) trails[ac.hex] = [];
          const trail = trails[ac.hex];
          const last = trail[trail.length - 1];
          if (!last || last.lat !== ac.lat || last.lon !== ac.lon) {
            trail.push({ lat: ac.lat, lon: ac.lon, altitude_m: ac.altitude_m, altitude_ft: ac.altitude_ft, timestamp: ac.timestamp });
          }
          while (trail.length > 0 && Date.now() - trail[0].timestamp > trailDuration) trail.shift();
        });
        const activeHexes = new Set(processed.map(ac => ac.hex));
        Object.keys(trails).forEach(hex => { if (!activeHexes.has(hex)) delete trails[hex]; });
        return trails;
      });
      setAircraft(processed);
    } catch (e) { console.error('Aircraft fetch failed:', e); }
  }, [data?.airport, trailDuration, tracesLoaded, loadAircraftTrace]);

  useEffect(() => {
    if (!showAircraft || !data?.airport || !mapLoaded) return;
    fetchAircraftData();
    aircraftIntervalRef.current = setInterval(fetchAircraftData, AIRCRAFT_UPDATE_INTERVAL);
    return () => clearInterval(aircraftIntervalRef.current);
  }, [showAircraft, data?.airport, mapLoaded, fetchAircraftData]);

  // Initialize map
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: MAP_STYLES.dark,
      center: [129.3518, 35.5934],
      zoom: 11,
      pitch: 60,
      bearing: -30,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

    map.current.on('load', () => {
      map.current.addSource('mapbox-dem', { type: 'raster-dem', url: 'mapbox://mapbox.mapbox-terrain-dem-v1', tileSize: 512, maxzoom: 14 });
      map.current.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
      map.current.addLayer({ id: 'sky', type: 'sky', paint: { 'sky-type': 'atmosphere', 'sky-atmosphere-sun': [0.0, 90.0], 'sky-atmosphere-sun-intensity': 15 } });
      map.current.addLayer({
        id: '3d-buildings', source: 'composite', 'source-layer': 'building', type: 'fill-extrusion', minzoom: 12,
        paint: { 'fill-extrusion-color': '#aaa', 'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-base': ['get', 'min_height'], 'fill-extrusion-opacity': 0.6 }
      });
      map.current.addSource('runway', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [[129.3505, 35.5890], [129.3530, 35.5978]] } } });
      map.current.addLayer({ id: 'runway', type: 'line', source: 'runway', paint: { 'line-color': '#FFFFFF', 'line-width': 8 } });

      // Create custom triangle arrow image for trail arrowheads
      const arrowSize = 24;
      const arrowCanvas = document.createElement('canvas');
      arrowCanvas.width = arrowSize;
      arrowCanvas.height = arrowSize;
      const ctx = arrowCanvas.getContext('2d');
      ctx.fillStyle = TRAIL_COLOR;
      ctx.beginPath();
      ctx.moveTo(arrowSize / 2, 0); // Top point
      ctx.lineTo(arrowSize, arrowSize); // Bottom right
      ctx.lineTo(arrowSize / 2, arrowSize * 0.7); // Center notch
      ctx.lineTo(0, arrowSize); // Bottom left
      ctx.closePath();
      ctx.fill();
      map.current.addImage('trail-arrow', ctx.getImageData(0, 0, arrowSize, arrowSize), { sdf: true });

      setMapLoaded(true);
    });

    return () => { if (map.current) { map.current.remove(); map.current = null; } };
  }, []);

  // Handle terrain toggle
  // 3D 고도 표시가 활성화되면 terrain을 비활성화하여 MSL(해수면) 기준 절대 고도로 표시
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    if (is3DView && showTerrain && !show3DAltitude) {
      map.current.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
    } else {
      map.current.setTerrain(null);
    }
  }, [showTerrain, is3DView, show3DAltitude, mapLoaded]);

  // NOTE: 2D/3D toggle is now handled by useMapStyle hook

  // Handle 3D buildings visibility
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    try {
      if (map.current.getLayer('3d-buildings')) {
        map.current.setLayoutProperty('3d-buildings', 'visibility', showBuildings && is3DView ? 'visible' : 'none');
      }
    } catch (e) {}
  }, [showBuildings, is3DView, mapLoaded]);

  // NOTE: Radar layer, style change, chart overlay useEffects are now managed by hooks:
  // - useRadarLayer: handles radar data fetching and layer management
  // - useMapStyle: handles style changes, 2D/3D toggle, terrain, buildings
  // - useChartOverlay: handles chart overlay management
  // - useAtcRadarRings: handles ATC radar rings and bearing lines
  // - useAtcSectors: handles ATC sector 3D visualization

  const toggleChart = (chartId) => setActiveCharts(prev => ({ ...prev, [chartId]: !prev[chartId] }));
  const updateChartOpacity = (chartId, opacity) => setChartOpacities(prev => ({ ...prev, [chartId]: opacity }));

  const getActiveWaypoints = useCallback(() => {
    if (!data) return [];
    const waypointMap = new Map();
    const extractWaypoints = (proc, color) => {
      if (!proc?.segments) return;
      proc.segments.forEach((seg) => {
        const coords = seg.coordinates;
        if (!coords || coords.length < 2) return;
        [coords[0], coords[coords.length - 1]].forEach(coord => {
          if (coord?.length >= 3) {
            const key = `${coord[0].toFixed(4)}_${coord[1].toFixed(4)}`;
            if (!waypointMap.has(key)) waypointMap.set(key, { lon: coord[0], lat: coord[1], altitude_m: coord[2], altitude_ft: Math.round(coord[2] / 0.3048), color });
          }
        });
      });
    };

    if (data.procedures?.SID) Object.entries(data.procedures.SID).forEach(([k, p]) => { if (sidVisible[k]) extractWaypoints(p, procColors.SID[k]); });
    if (data.procedures?.STAR) Object.entries(data.procedures.STAR).forEach(([k, p]) => { if (starVisible[k]) extractWaypoints(p, procColors.STAR[k]); });
    if (data.procedures?.APPROACH) Object.entries(data.procedures.APPROACH).forEach(([k, p]) => { if (apchVisible[k]) extractWaypoints(p, procColors.APPROACH[k]); });

    const namedWaypoints = Array.isArray(data.waypoints) ? data.waypoints : Object.values(data.waypoints || {});
    return Array.from(waypointMap.values()).map(wp => {
      const named = namedWaypoints.find(n => Math.abs(n.lon - wp.lon) < 0.001 && Math.abs(n.lat - wp.lat) < 0.001);
      return { ...wp, ident: named?.ident || '' };
    });
  }, [data, sidVisible, starVisible, apchVisible, procColors]);

  const hasActiveProcedure = Object.values(sidVisible).some(v => v) || Object.values(starVisible).some(v => v) || Object.values(apchVisible).some(v => v);

  // Create Three.js custom layer for procedures (terrain-independent MSL altitude)
  const createProcedureThreeLayer = useCallback((procedures, procColors, visibleState, typePrefix) => {
    if (!map.current) return null;

    const layerId = `${typePrefix}-three-layer`;

    // Collect segments from visible procedures - each segment is a separate line
    const procedureLines = [];
    Object.entries(procedures).forEach(([key, proc]) => {
      if (!visibleState[key]) return;
      const color = procColors[key];

      // Each segment is a separate line (don't merge)
      proc.segments?.forEach(seg => {
        if (seg.coordinates?.length >= 2) {
          procedureLines.push({ coords: seg.coordinates, color });
        }
      });
    });

    if (procedureLines.length === 0) return null;

    // Custom Three.js layer
    const customLayer = {
      id: layerId,
      type: 'custom',
      renderingMode: '3d',
      onAdd: function(map, gl) {
        this.camera = new THREE.Camera();
        this.scene = new THREE.Scene();

        const ribbonWidth = 0.000004; // Width in mercator units (halved)

        // Create continuous ribbon for each procedure
        procedureLines.forEach(({ coords, color }) => {
          const threeColor = new THREE.Color(color);

          // Build continuous ribbon geometry
          const vertices = [];
          const indices = [];

          for (let i = 0; i < coords.length; i++) {
            const [lon, lat, alt] = coords[i];
            const altM = alt || 0;
            const p = mapboxgl.MercatorCoordinate.fromLngLat([lon, lat], altM);

            // Calculate direction for ribbon width
            let dx, dy;
            if (i < coords.length - 1) {
              const [nextLon, nextLat, nextAlt] = coords[i + 1];
              const nextP = mapboxgl.MercatorCoordinate.fromLngLat([nextLon, nextLat], nextAlt || 0);
              dx = nextP.x - p.x;
              dy = nextP.y - p.y;
            } else if (i > 0) {
              const [prevLon, prevLat, prevAlt] = coords[i - 1];
              const prevP = mapboxgl.MercatorCoordinate.fromLngLat([prevLon, prevLat], prevAlt || 0);
              dx = p.x - prevP.x;
              dy = p.y - prevP.y;
            } else {
              dx = 1; dy = 0;
            }

            const len = Math.sqrt(dx * dx + dy * dy);
            if (len === 0) continue;

            // Perpendicular direction for ribbon width
            const nx = -dy / len * ribbonWidth;
            const ny = dx / len * ribbonWidth;

            // Add two vertices (left and right edge of ribbon)
            const baseIdx = vertices.length / 3;
            vertices.push(p.x + nx, p.y + ny, p.z); // left
            vertices.push(p.x - nx, p.y - ny, p.z); // right

            // Create triangles between this point and next
            if (i > 0) {
              const prevBase = baseIdx - 2;
              // Triangle 1: prev-left, prev-right, curr-right
              indices.push(prevBase, prevBase + 1, baseIdx + 1);
              // Triangle 2: prev-left, curr-right, curr-left
              indices.push(prevBase, baseIdx + 1, baseIdx);
            }
          }

          if (vertices.length >= 6 && indices.length >= 3) {
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
            geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));

            const material = new THREE.MeshBasicMaterial({
              color: threeColor,
              transparent: true,
              opacity: 0.85,
              side: THREE.DoubleSide,
              depthWrite: false
            });

            const mesh = new THREE.Mesh(geometry, material);
            this.scene.add(mesh);
          }
        });

        this.renderer = new THREE.WebGLRenderer({
          canvas: map.getCanvas(),
          context: gl,
          antialias: true
        });
        this.renderer.autoClear = false;
      },
      render: function(gl, matrix) {
        const m = new THREE.Matrix4().fromArray(matrix);
        this.camera.projectionMatrix = m;
        this.renderer.resetState();
        this.renderer.render(this.scene, this.camera);
      }
    };

    return customLayer;
  }, []);

  // Main rendering - Using Three.js custom layer for terrain-independent MSL altitude
  useEffect(() => {
    if (!map.current || !data || !mapLoaded) return;

    const safeRemoveLayer = (id) => { try { if (map.current.getLayer(id)) map.current.removeLayer(id); } catch (e) {} };
    const safeRemoveSource = (id) => { try { if (map.current.getSource(id)) map.current.removeSource(id); } catch (e) {} };

    // Clean up previous layers
    ['waypoints-3d', 'waypoints-2d', 'waypoints-labels', 'proc-waypoints-labels', 'obstacles-3d', 'obstacles-2d', 'airspace', 'airspace-outline', 'notam-extrusion', 'notam-fill', 'notam-outline', 'notam-icons', 'notam-labels'].forEach(safeRemoveLayer);
    ['waypoints-3d', 'waypoints-2d', 'waypoints-labels', 'proc-waypoints-labels', 'obstacles-3d', 'obstacles-2d', 'airspace', 'notam-areas', 'notam-centers'].forEach(safeRemoveSource);

    // Remove old procedure layers (both Mapbox and Three.js) - including segment-based layers
    const cleanupProcedureLayers = (type, key, proc) => {
      ['3d', '2d', 'line'].forEach(suffix => {
        safeRemoveLayer(`${type}-${key}-${suffix}`);
        safeRemoveSource(`${type}-${key}-${suffix}`);
      });
      // Also remove segment-based layers (seg0, seg1, etc.)
      const segCount = proc?.segments?.length || 10;
      for (let i = 0; i < segCount; i++) {
        safeRemoveLayer(`${type}-${key}-seg${i}-line`);
        safeRemoveSource(`${type}-${key}-seg${i}-line`);
      }
    };
    Object.entries(data.procedures?.SID || {}).forEach(([k, p]) => cleanupProcedureLayers('sid', k, p));
    Object.entries(data.procedures?.STAR || {}).forEach(([k, p]) => cleanupProcedureLayers('star', k, p));
    Object.entries(data.procedures?.APPROACH || {}).forEach(([k, p]) => cleanupProcedureLayers('apch', k, p));

    // Remove Three.js custom layers
    ['sid-three-layer', 'star-three-layer', 'apch-three-layer'].forEach(safeRemoveLayer);

    // Render procedures using Three.js custom layer (terrain-independent)
    if (is3DView && show3DAltitude) {
      // Add Three.js layers for each procedure type
      if (data.procedures?.SID) {
        const sidLayer = createProcedureThreeLayer(data.procedures.SID, procColors.SID, sidVisible, 'sid');
        if (sidLayer) map.current.addLayer(sidLayer);
      }
      if (data.procedures?.STAR) {
        const starLayer = createProcedureThreeLayer(data.procedures.STAR, procColors.STAR, starVisible, 'star');
        if (starLayer) map.current.addLayer(starLayer);
      }
      if (data.procedures?.APPROACH) {
        const apchLayer = createProcedureThreeLayer(data.procedures.APPROACH, procColors.APPROACH, apchVisible, 'apch');
        if (apchLayer) map.current.addLayer(apchLayer);
      }
    } else {
      // 2D fallback - use simple line layers (each segment as separate line)
      const render2DProcedure = (type, key, proc, color) => {
        proc.segments?.forEach((seg, segIdx) => {
          if (seg.coordinates && seg.coordinates.length >= 2) {
            const sourceId = `${type}-${key}-seg${segIdx}-line`;
            const coords = seg.coordinates.map(c => [c[0], c[1]]);
            map.current.addSource(sourceId, { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } } });
            map.current.addLayer({ id: sourceId, type: 'line', source: sourceId, paint: { 'line-color': color, 'line-width': 3, 'line-opacity': 0.8 } });
          }
        });
      };

      if (data.procedures?.SID) Object.entries(data.procedures.SID).forEach(([k, p]) => { if (sidVisible[k]) render2DProcedure('sid', k, p, procColors.SID[k]); });
      if (data.procedures?.STAR) Object.entries(data.procedures.STAR).forEach(([k, p]) => { if (starVisible[k]) render2DProcedure('star', k, p, procColors.STAR[k]); });
      if (data.procedures?.APPROACH) Object.entries(data.procedures.APPROACH).forEach(([k, p]) => { if (apchVisible[k]) render2DProcedure('apch', k, p, procColors.APPROACH[k]); });
    }

    // Waypoint labels - use symbol layer with proper elevation
    if (hasActiveProcedure) {
      const activeWaypoints = getActiveWaypoints();
      if (activeWaypoints.length > 0) {
        const features = activeWaypoints.map(wp => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [wp.lon, wp.lat, wp.altitude_m] },
          properties: { ident: wp.ident, altitude_ft: wp.altitude_ft, label: `${wp.ident}\n${wp.altitude_ft}ft`, color: wp.color }
        }));
        map.current.addSource('proc-waypoints-labels', { type: 'geojson', data: { type: 'FeatureCollection', features } });
        map.current.addLayer({
          id: 'proc-waypoints-labels',
          type: 'symbol',
          source: 'proc-waypoints-labels',
          layout: {
            'text-field': ['get', 'label'],
            'text-size': 12,
            'text-anchor': 'bottom',
            'text-offset': [0, -0.5],
            'text-allow-overlap': true,
            'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
            'symbol-z-elevate': true
          },
          paint: {
            'text-color': '#FFEB3B',
            'text-halo-color': 'rgba(0, 0, 0, 0.9)',
            'text-halo-width': 2
          }
        });
      }
    }

    // Airspace
    if (showAirspace && data.airspace) {
      const features = data.airspace.map((as) => ({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: as.coordinates },
        properties: { name: as.name }
      }));
      map.current.addSource('airspace', { type: 'geojson', data: { type: 'FeatureCollection', features } });
      map.current.addLayer({ id: 'airspace', type: 'fill', source: 'airspace', paint: { 'fill-color': '#E91E63', 'fill-opacity': 0.1 } });
      map.current.addLayer({ id: 'airspace-outline', type: 'line', source: 'airspace', paint: { 'line-color': '#E91E63', 'line-width': 2, 'line-dasharray': [4, 2] } });
    }

    // Active NOTAMs on map - only show when locations are selected
    if (notamLocationsOnMap.size > 0 && notamData?.data && notamData.data.length > 0) {
      // Build set of cancelled NOTAMs first
      const cancelledSet = buildCancelledNotamSet(notamData.data);

      // Filter NOTAMs: only selected locations, only currently active (not future), exclude expired
      const validNotams = notamData.data.filter(n => {
        // Must be in selected locations
        if (!notamLocationsOnMap.has(n.location)) return false;
        // Check if currently active only (not future, not expired/cancelled)
        const validity = getNotamValidity(n, cancelledSet);
        if (validity !== 'active') return false;
        // Must have coordinates (Q-line or airport fallback)
        const coords = getNotamDisplayCoords(n);
        if (!coords) return false;
        // Exclude NOTAMs with very large radius (100+ NM) that cover large portions of map
        if (coords.radiusNM && coords.radiusNM >= 100) return false;
        return true;
      });

      if (validNotams.length > 0) {
        const notamFeatures = validNotams.map(n => {
          const coords = getNotamDisplayCoords(n);
          const validity = getNotamValidity(n, cancelledSet);
          return {
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: createNotamCircle(coords.lon, coords.lat, coords.radiusNM || 5) },
            properties: {
              id: n.id,
              notam_number: n.notam_number,
              location: n.location,
              qcode: n.qcode,
              qcode_mean: n.qcode_mean,
              e_text: n.e_text,
              full_text: n.full_text,
              effective_start: n.effective_start,
              effective_end: n.effective_end || 'PERM',
              series: n.series,
              fir: n.fir,
              lowerAlt: coords.lowerAlt,
              upperAlt: coords.upperAlt,
              validity: validity // 'active' or 'future'
            }
          };
        });

        // Center points for labels (include full properties for click handler)
        const notamCenterFeatures = validNotams.map(n => {
          const coords = getNotamDisplayCoords(n);
          const validity = getNotamValidity(n, cancelledSet);
          return {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [coords.lon, coords.lat] },
            properties: {
              id: n.id,
              notam_number: n.notam_number,
              location: n.location,
              qcode: n.qcode,
              qcode_mean: n.qcode_mean,
              e_text: n.e_text,
              full_text: n.full_text,
              effective_start: n.effective_start,
              effective_end: n.effective_end || 'PERM',
              series: n.series,
              fir: n.fir,
              lowerAlt: coords.lowerAlt,
              upperAlt: coords.upperAlt,
              validity: validity // 'active' or 'future'
            }
          };
        });

        map.current.addSource('notam-areas', { type: 'geojson', data: { type: 'FeatureCollection', features: notamFeatures } });

        // 3D extrusion layer for NOTAMs (shows altitude range) - color by validity
        if (is3DView) {
          map.current.addLayer({
            id: 'notam-extrusion',
            type: 'fill-extrusion',
            source: 'notam-areas',
            paint: {
              'fill-extrusion-color': [
                'case',
                ['==', ['get', 'validity'], 'future'], '#2196F3', // Blue for future
                '#FF9800' // Orange for active
              ],
              'fill-extrusion-opacity': 0.35,
              'fill-extrusion-base': ['*', ['get', 'lowerAlt'], 0.3048], // Convert feet to meters
              'fill-extrusion-height': ['*', ['get', 'upperAlt'], 0.3048]
            }
          });
        }

        // 2D fill layer - color by validity (active: orange, future: blue)
        map.current.addLayer({
          id: 'notam-fill',
          type: 'fill',
          source: 'notam-areas',
          paint: {
            'fill-color': [
              'case',
              ['==', ['get', 'validity'], 'future'], '#2196F3', // Blue for future
              '#FF9800' // Orange for active
            ],
            'fill-opacity': is3DView ? 0.05 : 0.15
          }
        });
        map.current.addLayer({
          id: 'notam-outline',
          type: 'line',
          source: 'notam-areas',
          paint: {
            'line-color': [
              'case',
              ['==', ['get', 'validity'], 'future'], '#2196F3',
              '#FF9800'
            ],
            'line-width': 2,
            'line-dasharray': [3, 2]
          }
        });

        map.current.addSource('notam-centers', { type: 'geojson', data: { type: 'FeatureCollection', features: notamCenterFeatures } });
        map.current.addLayer({
          id: 'notam-icons',
          type: 'circle',
          source: 'notam-centers',
          paint: {
            'circle-radius': 6,
            'circle-color': [
              'case',
              ['==', ['get', 'validity'], 'future'], '#2196F3',
              '#FF9800'
            ],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fff'
          }
        });
        map.current.addLayer({
          id: 'notam-labels',
          type: 'symbol',
          source: 'notam-centers',
          layout: {
            'text-field': ['get', 'notam_number'],
            'text-size': 10,
            'text-anchor': 'top',
            'text-offset': [0, 0.8],
            'text-allow-overlap': true, // Allow overlap to show all NOTAM labels
            'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold']
          },
          paint: {
            'text-color': [
              'case',
              ['==', ['get', 'validity'], 'future'], '#2196F3',
              '#FF9800'
            ],
            'text-halo-color': 'rgba(0, 0, 0, 0.9)',
            'text-halo-width': 1.5
          }
        });

        // Helper function to show NOTAM popup
        const showNotamPopup = (props, lngLat) => {
          // Format effective times (YYMMDDHHMM -> readable format)
          const formatNotamTime = (timeStr) => {
            if (!timeStr || timeStr === 'PERM') return 'PERM (영구)';
            if (timeStr.length < 10) return timeStr;
            const year = '20' + timeStr.substring(0, 2);
            const month = timeStr.substring(2, 4);
            const day = timeStr.substring(4, 6);
            const hour = timeStr.substring(6, 8);
            const minute = timeStr.substring(8, 10);
            return `${year}-${month}-${day} ${hour}:${minute}Z`;
          };

          const startTime = formatNotamTime(props.effective_start);
          const endTime = formatNotamTime(props.effective_end);
          const validity = props.validity;
          const validityColor = validity === 'future' ? '#2196F3' : '#FF9800';
          const validityText = validity === 'future' ? '예정' : '활성';
          const validityBgColor = validity === 'future' ? 'rgba(33,150,243,0.2)' : 'rgba(255,152,0,0.2)';

          // Escape and format full_text for HTML display
          const fullTextFormatted = (props.full_text || '')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\r\n/g, '<br>')
            .replace(/\n/g, '<br>');

          const popupContent = `
            <div style="max-width: 400px; font-size: 12px; max-height: 500px; overflow-y: auto;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid ${validityColor}40; padding-bottom: 6px;">
                <span style="font-weight: bold; color: ${validityColor}; font-size: 14px;">${props.notam_number}</span>
                <div style="display: flex; gap: 4px;">
                  <span style="background: ${validityBgColor}; color: ${validityColor}; padding: 2px 6px; border-radius: 3px; font-size: 10px;">${validityText}</span>
                  <span style="background: rgba(255,255,255,0.1); color: #aaa; padding: 2px 6px; border-radius: 3px; font-size: 10px;">${props.series || ''}</span>
                </div>
              </div>
              <div style="display: grid; grid-template-columns: auto 1fr; gap: 4px 8px; margin-bottom: 8px;">
                <span style="color: #888;">위치:</span><span>${props.location} (${props.fir || 'RKRR'})</span>
                <span style="color: #888;">Q-Code:</span><span>${props.qcode}</span>
                <span style="color: #888;">의미:</span><span>${props.qcode_mean || '-'}</span>
                <span style="color: #888;">유효시작:</span><span style="color: #4CAF50;">${startTime}</span>
                <span style="color: #888;">유효종료:</span><span style="color: #f44336;">${endTime}</span>
                <span style="color: #888;">고도:</span><span>FL${String(Math.round(props.lowerAlt/100)).padStart(3,'0')} ~ FL${String(Math.round(props.upperAlt/100)).padStart(3,'0')}</span>
              </div>
              <div style="margin-bottom: 8px;">
                <div style="color: #888; margin-bottom: 4px; font-size: 11px;">내용 (E):</div>
                <div style="background: ${validityBgColor}; padding: 8px; border-radius: 4px; white-space: pre-wrap; line-height: 1.4;">
                  ${props.e_text || '-'}
                </div>
              </div>
              <details style="margin-top: 8px;">
                <summary style="cursor: pointer; color: ${validityColor}; font-size: 11px;">전문 보기 (Full Text)</summary>
                <div style="background: rgba(0,0,0,0.3); padding: 8px; border-radius: 4px; margin-top: 4px; font-family: monospace; font-size: 10px; white-space: pre-wrap; line-height: 1.3; color: #ccc;">
                  ${fullTextFormatted}
                </div>
              </details>
            </div>
          `;
          new mapboxgl.Popup({ closeButton: true, maxWidth: '450px' })
            .setLngLat(lngLat)
            .setHTML(popupContent)
            .addTo(map.current);
        };

        // Add popup on click for fill layer
        map.current.on('click', 'notam-fill', (e) => {
          if (e.features.length > 0) {
            showNotamPopup(e.features[0].properties, e.lngLat);
          }
        });

        map.current.on('mouseenter', 'notam-fill', () => {
          map.current.getCanvas().style.cursor = 'pointer';
        });
        map.current.on('mouseleave', 'notam-fill', () => {
          map.current.getCanvas().style.cursor = '';
        });

        // Also add click handler to notam-icons (center dots) for easier clicking
        map.current.on('click', 'notam-icons', (e) => {
          e.preventDefault(); // Prevent triggering notam-fill click
          if (e.features.length > 0) {
            showNotamPopup(e.features[0].properties, e.lngLat);
          }
        });

        map.current.on('mouseenter', 'notam-icons', () => {
          map.current.getCanvas().style.cursor = 'pointer';
        });
        map.current.on('mouseleave', 'notam-icons', () => {
          map.current.getCanvas().style.cursor = '';
        });
      }
    }

    // Waypoints (when no procedure is active)
    if (showWaypoints && !hasActiveProcedure && data.waypoints) {
      const waypointsArray = Array.isArray(data.waypoints) ? data.waypoints : Object.values(data.waypoints);
      if (waypointsArray.length > 0) {
        const features = waypointsArray.map(wp => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [wp.lon, wp.lat] },
          properties: { ident: wp.ident || '', type: wp.type || 'WPT' }
        }));
        map.current.addSource('waypoints-2d', { type: 'geojson', data: { type: 'FeatureCollection', features } });
        map.current.addLayer({
          id: 'waypoints-2d',
          type: 'circle',
          source: 'waypoints-2d',
          paint: { 'circle-radius': 5, 'circle-color': '#00BCD4', 'circle-stroke-width': 1.5, 'circle-stroke-color': '#fff' }
        });
        map.current.addLayer({
          id: 'waypoints-labels',
          type: 'symbol',
          source: 'waypoints-2d',
          layout: {
            'text-field': ['get', 'ident'],
            'text-size': 11,
            'text-anchor': 'bottom',
            'text-offset': [0, -0.8],
            'text-allow-overlap': false,
            'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold']
          },
          paint: { 'text-color': '#00BCD4', 'text-halo-color': 'rgba(0, 0, 0, 0.9)', 'text-halo-width': 1.5 }
        });
      }
    }

    // Obstacles
    if (showObstacles && data.obstacles) {
      const filteredObstacles = data.obstacles.filter(obs => obs.height_m > 0);
      if (is3DView && show3DAltitude) {
        const features3d = filteredObstacles.map((obs) => ({
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: createObstacleShape(obs.lon, obs.lat, obs.type, 0.0002) },
          properties: { height: obs.height_m, color: OBSTACLE_COLORS[obs.type] || OBSTACLE_COLORS.Unknown }
        }));
        if (features3d.length > 0) {
          map.current.addSource('obstacles-3d', { type: 'geojson', data: { type: 'FeatureCollection', features: features3d } });
          map.current.addLayer({ id: 'obstacles-3d', type: 'fill-extrusion', source: 'obstacles-3d', paint: { 'fill-extrusion-color': ['get', 'color'], 'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 0.85 } });
        }
      } else {
        const features2d = filteredObstacles.map((obs) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [obs.lon, obs.lat] },
          properties: { color: OBSTACLE_COLORS[obs.type] || OBSTACLE_COLORS.Unknown }
        }));
        if (features2d.length > 0) {
          map.current.addSource('obstacles-2d', { type: 'geojson', data: { type: 'FeatureCollection', features: features2d } });
          map.current.addLayer({ id: 'obstacles-2d', type: 'circle', source: 'obstacles-2d', paint: { 'circle-radius': 5, 'circle-color': ['get', 'color'], 'circle-stroke-width': 1, 'circle-stroke-color': '#000' } });
        }
      }
    }

  }, [data, mapLoaded, showWaypoints, showObstacles, showAirspace, show3DAltitude, sidVisible, starVisible, apchVisible, procColors, is3DView, hasActiveProcedure, getActiveWaypoints, createProcedureThreeLayer, notamLocationsOnMap, notamData]);

  // Aircraft visualization - 레이어 재사용으로 깜빡임 방지
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // 헬퍼: 소스가 있으면 데이터 업데이트, 없으면 생성
    const updateOrCreateSource = (id, data) => {
      const source = map.current.getSource(id);
      if (source) {
        source.setData(data);
        return true; // 소스 존재함
      }
      return false; // 소스 없음
    };

    const emptyFeatureCollection = { type: 'FeatureCollection', features: [] };

    // 항공기 표시 끄기 - 빈 데이터로 업데이트
    if (!showAircraft || aircraft.length === 0) {
      ['aircraft-3d', 'aircraft-2d', 'aircraft-labels', 'aircraft-trails-2d', 'aircraft-trails-3d', 'aircraft-trails-arrows'].forEach(id => {
        const source = map.current.getSource(id);
        if (source) source.setData(emptyFeatureCollection);
      });
      return;
    }

    const flyingAircraft = aircraft.filter(ac => !ac.on_ground && ac.altitude_ft > 100);

    // Aircraft shape 생성 함수
    const createAircraftShape = (lon, lat, heading, size = 0.002) => {
      const rad = -(heading || 0) * Math.PI / 180;
      const cos = Math.cos(rad), sin = Math.sin(rad);
      const points = [
        [0, size * 1.5],
        [-size * 0.5, -size],
        [0, -size * 0.3],
        [size * 0.5, -size],
      ];
      const rotated = points.map(([x, y]) => [
        lon + (x * cos - y * sin),
        lat + (x * sin + y * cos)
      ]);
      rotated.push(rotated[0]);
      return [rotated];
    };

    // 3D Aircraft 데이터 - 항상 표시 (고도에 맞게)
    const features3d = (show3DAircraft && flyingAircraft.length > 0) ?
      flyingAircraft.map(ac => {
        const altM = ftToM(ac.altitude_ft);
        return {
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: createAircraftShape(ac.lon, ac.lat, ac.track, 0.008) },
          properties: { color: AIRCRAFT_CATEGORY_COLORS[ac.category] || '#00BCD4', height: altM + 150, base: altM }
        };
      }) : [];

    // 2D Aircraft 데이터 - 3D 항공기가 꺼져있을 때만 표시
    const features2d = (!show3DAircraft) && flyingAircraft.length > 0 ?
      flyingAircraft.map(ac => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [ac.lon, ac.lat] },
        properties: { callsign: ac.callsign, color: AIRCRAFT_CATEGORY_COLORS[ac.category] || '#00BCD4', rotation: ac.track || 0 }
      })) : [];

    // Label 데이터 - 항공기 정보 표시 (선택된 항공기는 확장 라벨)
    const labelFeatures = flyingAircraft.map(ac => {
      const isEmergency = ['7700', '7600', '7500'].includes(ac.squawk);
      const vsIndicator = ac.vertical_rate > 100 ? '↑' : ac.vertical_rate < -100 ? '↓' : '';
      const isSelected = selectedAircraft?.hex === ac.hex;

      // 선택된 항공기는 확장 라벨, 아니면 기본 라벨
      let label;
      if (isSelected) {
        // 확장 라벨: 모든 정보 표시
        const route = (ac.origin || ac.destination) ? `${ac.origin || '???'}→${ac.destination || '???'}` : '';
        label = `${ac.callsign || ac.hex} [${ac.icao_type || ac.type || '?'}]` +
          `${ac.registration ? ` ${ac.registration}` : ''}` +
          `${route ? `\n${route}` : ''}` +
          `\nALT ${(ac.altitude_ft || 0).toLocaleString()}ft  GS ${ac.ground_speed || 0}kt` +
          `\nHDG ${Math.round(ac.track || 0)}°  VS ${ac.vertical_rate > 0 ? '+' : ''}${ac.vertical_rate || 0}fpm` +
          `\nSQK ${ac.squawk || '----'}`;
      } else {
        // 기본 라벨: 콜사인, 고도, 속도, 스쿽
        label = `${ac.callsign || ac.hex}\n${ac.altitude_ft || 0} ${ac.ground_speed || 0}kt${vsIndicator}\n${ac.squawk || '----'}`;
      }

      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [ac.lon, ac.lat] },
        properties: {
          label,
          hex: ac.hex,
          color: isEmergency ? '#ff0000' : (isSelected ? '#ffff00' : '#00ff88')
        }
      };
    });

    // 헤딩 지시선 3D 리본 (항공기 앞에 예측 시간 기반) - 고도에 맞게 표시
    const headingRibbonFeatures = [];
    if (headingPrediction > 0) {
      flyingAircraft.forEach(ac => {
        const heading = (ac.track || 0) * Math.PI / 180;
        const speedKt = ac.ground_speed || 0;
        const distanceNm = (speedKt / 3600) * headingPrediction;
        const distanceDeg = distanceNm * 0.0166;
        const lineLength = Math.max(0.005, distanceDeg);
        const endLon = ac.lon + Math.sin(heading) * lineLength;
        const endLat = ac.lat + Math.cos(heading) * lineLength;

        // 리본 생성 - createRibbonSegment는 (coord1, coord2, width) 형식
        const ribbon = createRibbonSegment(
          [ac.lon, ac.lat, ac.altitude_m],
          [endLon, endLat, ac.altitude_m],
          0.0008 // 항적과 동일한 너비
        );
        if (ribbon && ribbon.coordinates) {
          headingRibbonFeatures.push({
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: ribbon.coordinates },
            properties: {
              color: '#00ffff', // 시안색 (청록색)
              height: ac.altitude_m + 50,
              base: ac.altitude_m - 50,
              hex: ac.hex
            }
          });
        }
      });
    }

    // 3D Aircraft 업데이트 또는 생성
    const data3d = { type: 'FeatureCollection', features: features3d };
    if (!updateOrCreateSource('aircraft-3d', data3d)) {
      map.current.addSource('aircraft-3d', { type: 'geojson', data: data3d });
      map.current.addLayer({
        id: 'aircraft-3d',
        type: 'fill-extrusion',
        source: 'aircraft-3d',
        paint: {
          'fill-extrusion-color': ['get', 'color'],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': ['get', 'base'],
          'fill-extrusion-opacity': 0.9
        }
      });
    }

    // 2D Aircraft 업데이트 또는 생성
    const data2d = { type: 'FeatureCollection', features: features2d };
    if (!updateOrCreateSource('aircraft-2d', data2d)) {
      map.current.addSource('aircraft-2d', { type: 'geojson', data: data2d });
      map.current.addLayer({
        id: 'aircraft-2d',
        type: 'symbol',
        source: 'aircraft-2d',
        layout: {
          'icon-image': 'airport-15',
          'icon-size': ['interpolate', ['linear'], ['zoom'], 6, 1.5, 10, 2.5, 14, 3.5],
          'icon-rotate': ['get', 'rotation'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true
        },
        paint: { 'icon-color': ['get', 'color'] }
      });
    }

    // Labels 업데이트 또는 생성 - 사용자 드래그로 오프셋 조절 가능
    // anchor는 오프셋 방향에 따라 자동 결정
    const getAnchorFromOffset = (x, y) => {
      if (x >= 0 && y <= 0) return 'bottom-left';
      if (x < 0 && y <= 0) return 'bottom-right';
      if (x >= 0 && y > 0) return 'top-left';
      return 'top-right';
    };
    const currentAnchor = getAnchorFromOffset(labelOffset.x, labelOffset.y);

    const labelData = { type: 'FeatureCollection', features: labelFeatures };
    if (!updateOrCreateSource('aircraft-labels', labelData)) {
      map.current.addSource('aircraft-labels', { type: 'geojson', data: labelData });
      map.current.addLayer({
        id: 'aircraft-labels', type: 'symbol', source: 'aircraft-labels',
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 10,
          'text-anchor': currentAnchor,
          'text-offset': [labelOffset.x, labelOffset.y],
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
          'text-allow-overlap': true,
          'text-ignore-placement': true
        },
        paint: { 'text-color': ['get', 'color'], 'text-halo-color': 'rgba(0, 0, 0, 0.9)', 'text-halo-width': 2 }
      });
    } else if (map.current.getLayer('aircraft-labels')) {
      // 라벨 위치가 변경되면 레이아웃 업데이트
      map.current.setLayoutProperty('aircraft-labels', 'text-anchor', currentAnchor);
      map.current.setLayoutProperty('aircraft-labels', 'text-offset', [labelOffset.x, labelOffset.y]);
    }

    // 헤딩 지시선 레이어 (3D 리본) - headingPrediction이 0이면 표시 안함
    const headingData = { type: 'FeatureCollection', features: headingRibbonFeatures };
    if (!updateOrCreateSource('aircraft-heading-lines', headingData)) {
      map.current.addSource('aircraft-heading-lines', { type: 'geojson', data: headingData });
      map.current.addLayer({
        id: 'aircraft-heading-lines',
        type: 'fill-extrusion',
        source: 'aircraft-heading-lines',
        paint: {
          'fill-extrusion-color': ['get', 'color'],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': ['get', 'base'],
          'fill-extrusion-opacity': 0.85
        }
      });
    }

    // Aircraft trails - 항상 3D 리본 형태로 고도에 맞게 표시 + opacity 그라디언트
    const trail3dFeatures = [];

    const now = Date.now();

    if (showAircraftTrails && Object.keys(aircraftTrails).length > 0) {
      Object.entries(aircraftTrails).forEach(([hex, trail]) => {
        if (trail.length < 1) return;
        const ac = aircraft.find(a => a.hex === hex);
        if (!ac || ac.on_ground) return;

        // 현재 항공기 위치를 마지막 점으로 추가하여 끊김 방지
        const extendedTrail = [...trail];
        const lastTrail = trail[trail.length - 1];
        if (lastTrail && (lastTrail.lat !== ac.lat || lastTrail.lon !== ac.lon)) {
          extendedTrail.push({ lat: ac.lat, lon: ac.lon, altitude_m: ac.altitude_m, timestamp: now });
        }

        if (extendedTrail.length < 2) return;

        // 세그먼트별로 opacity 계산하여 리본 생성 (오래된 것 = 연하게)
        // 점선 효과: 2개 그리고 1개 건너뛰기
        for (let i = 0; i < extendedTrail.length - 1; i++) {
          // 점선 효과 - 매 3번째 세그먼트 건너뛰기
          if (i % 3 === 2) continue;

          const p1 = extendedTrail[i];
          const p2 = extendedTrail[i + 1];
          // 세그먼트의 중간 시간으로 opacity 계산
          const segTime = (p1.timestamp + p2.timestamp) / 2;
          const age = now - segTime;
          // 0 (가장 최신) ~ trailDuration (가장 오래됨) -> 1.0 ~ 0.3 opacity
          const opacity = Math.max(0.3, 1.0 - (age / trailDuration) * 0.7);

          // 항상 3D 리본 형태로 표시 (고도에 맞게)
          const colorWithAlpha = `rgba(0, 255, 136, ${opacity})`; // TRAIL_COLOR with opacity

          const ribbon = createRibbonSegment([p1.lon, p1.lat, p1.altitude_m || 100], [p2.lon, p2.lat, p2.altitude_m || 100], 0.001);
          if (ribbon) trail3dFeatures.push({
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: ribbon.coordinates },
            properties: { height: ribbon.avgAlt + 30, base: Math.max(0, ribbon.avgAlt - 30), color: colorWithAlpha }
          });
        }
      });
    }

    // 3D Trails 업데이트 또는 생성 - 항상 고도에 맞게 표시
    const trail3dData = { type: 'FeatureCollection', features: trail3dFeatures };
    if (!updateOrCreateSource('aircraft-trails-3d', trail3dData)) {
      map.current.addSource('aircraft-trails-3d', { type: 'geojson', data: trail3dData });
      map.current.addLayer({ id: 'aircraft-trails-3d', type: 'fill-extrusion', source: 'aircraft-trails-3d', paint: {
        'fill-extrusion-color': ['get', 'color'],
        'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-base': ['get', 'base'],
        'fill-extrusion-opacity': 0.9
      } });
    }

    // 2D Trails 레이어는 더 이상 사용하지 않음 (빈 데이터로 유지)
    const emptyTrail2dData = { type: 'FeatureCollection', features: [] };
    if (!updateOrCreateSource('aircraft-trails-2d', emptyTrail2dData)) {
      map.current.addSource('aircraft-trails-2d', { type: 'geojson', data: emptyTrail2dData });
    }

    // 화살표 레이어 제거 (더 이상 사용하지 않음)
    const emptyArrowData = { type: 'FeatureCollection', features: [] };
    updateOrCreateSource('aircraft-trails-arrows', emptyArrowData);

  }, [aircraft, aircraftTrails, showAircraft, showAircraftTrails, show3DAircraft, is3DView, show3DAltitude, mapLoaded, getModelForAircraft, trailDuration, headingPrediction, selectedAircraft, labelOffset]);

  // Aircraft click handler - 클릭 시 상세정보 표시
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const handleAircraftClick = (e) => {
      if (e.features && e.features.length > 0) {
        const hex = e.features[0].properties.hex;
        if (hex) {
          // 토글 방식: 같은 항공기 클릭 시 선택 해제
          if (selectedAircraft?.hex === hex) {
            setSelectedAircraft(null);
          } else {
            const ac = aircraft.find(a => a.hex === hex);
            if (ac) {
              setSelectedAircraft(ac);
            }
          }
        }
      }
    };

    const handleMapClick = (e) => {
      // 항공기 레이어 외부 클릭 시 선택 해제
      const features = map.current.queryRenderedFeatures(e.point, { layers: ['aircraft-labels', 'aircraft-3d', 'aircraft-2d', 'aircraft-heading-lines'] });
      if (features.length === 0) {
        setSelectedAircraft(null);
      }
    };

    // 라벨 클릭으로 항공기 선택
    if (map.current.getLayer('aircraft-labels')) {
      map.current.on('click', 'aircraft-labels', handleAircraftClick);
      map.current.on('mouseenter', 'aircraft-labels', () => { map.current.getCanvas().style.cursor = 'pointer'; });
      map.current.on('mouseleave', 'aircraft-labels', () => { map.current.getCanvas().style.cursor = ''; });
    }

    // 항적 클릭으로도 항공기 선택 가능
    if (map.current.getLayer('aircraft-trails-3d')) {
      map.current.on('click', 'aircraft-trails-3d', handleAircraftClick);
      map.current.on('mouseenter', 'aircraft-trails-3d', () => { map.current.getCanvas().style.cursor = 'pointer'; });
      map.current.on('mouseleave', 'aircraft-trails-3d', () => { map.current.getCanvas().style.cursor = ''; });
    }

    map.current.on('click', handleMapClick);

    return () => {
      if (map.current) {
        try {
          map.current.off('click', 'aircraft-labels', handleAircraftClick);
          map.current.off('click', 'aircraft-trails-3d', handleAircraftClick);
          map.current.off('click', handleMapClick);
        } catch (e) {}
      }
    };
  }, [mapLoaded, aircraft, selectedAircraft]);

  // Fetch aircraft photo when selectedAircraft changes
  useEffect(() => {
    if (!selectedAircraft) {
      setAircraftPhoto(null);
      setShowAircraftPanel(false);
      return;
    }

    setShowAircraftPanel(true);
    setAircraftPhotoLoading(true);
    setAircraftPhoto(null);

    const hex = selectedAircraft.hex?.toUpperCase();
    const reg = selectedAircraft.registration;

    // Vercel API Route를 통한 사진 조회 (CORS 해결)
    const fetchPhoto = async () => {
      try {
        const params = new URLSearchParams();
        if (hex) params.append('hex', hex);
        if (reg) params.append('reg', reg);

        const res = await fetch(`/api/aircraft-photo?${params}`);
        const data = await res.json();

        if (data.image) {
          setAircraftPhoto(data);
        }
        setAircraftPhotoLoading(false);
      } catch (err) {
        console.warn('Failed to fetch aircraft photo:', err);
        setAircraftPhotoLoading(false);
      }
    };

    fetchPhoto();
  }, [selectedAircraft?.hex]);

  // Fetch aircraft details from hexdb.io when selectedAircraft changes
  useEffect(() => {
    if (!selectedAircraft) {
      setAircraftDetails(null);
      return;
    }

    const hex = selectedAircraft.hex?.toUpperCase();
    if (!hex) return;

    setAircraftDetailsLoading(true);
    setAircraftDetails(null);

    const fetchDetails = async () => {
      try {
        const res = await fetch(`https://hexdb.io/api/v1/aircraft/${hex}`);
        if (res.ok) {
          const data = await res.json();
          setAircraftDetails(data);
        }
      } catch (err) {
        console.warn('Failed to fetch aircraft details from hexdb.io:', err);
      } finally {
        setAircraftDetailsLoading(false);
      }
    };

    fetchDetails();
  }, [selectedAircraft?.hex]);

  // Fetch flight route from FlightRadar24 (primary) or aviationstack (fallback)
  useEffect(() => {
    if (!selectedAircraft) {
      setFlightSchedule(null);
      return;
    }

    const callsign = selectedAircraft.callsign?.trim();
    const hex = selectedAircraft.hex;
    if (!callsign && !hex) return;

    setFlightScheduleLoading(true);
    setFlightSchedule(null);

    const fetchSchedule = async () => {
      // ICAO to IATA 변환 맵 (UBIKAIS 데이터용)
      const icaoToIata = {
        'RKSI': 'ICN', 'RKSS': 'GMP', 'RKPK': 'PUS', 'RKPC': 'CJU',
        'RKPU': 'USN', 'RKTN': 'TAE', 'RKTU': 'CJJ', 'RKJB': 'MWX',
        'RKNY': 'YNY', 'RKJY': 'RSU', 'RKPS': 'HIN', 'RKTH': 'KPO',
        'RJTT': 'HND', 'RJAA': 'NRT', 'RJBB': 'KIX', 'RJOO': 'ITM',
        'RJFF': 'FUK', 'RJCC': 'CTS', 'VHHH': 'HKG', 'RCTP': 'TPE',
        'WSSS': 'SIN', 'VTBS': 'BKK', 'WMKK': 'KUL', 'RPLL': 'MNL',
        'ZGGG': 'CAN', 'ZSPD': 'PVG', 'ZSSS': 'SHA', 'ZBAA': 'PEK',
        'VVTS': 'SGN', 'VVNB': 'HAN', 'VVCR': 'CXR', 'VVDN': 'DAD', 'VVPQ': 'PQC',
        'OMDB': 'DXB', 'OTHH': 'DOH', 'HAAB': 'ADD', 'LTFM': 'IST',
        'KLAX': 'LAX', 'KJFK': 'JFK', 'KORD': 'ORD', 'KCVG': 'CVG', 'PANC': 'ANC',
        'EDDF': 'FRA', 'EDDP': 'LEJ', 'EBBR': 'BRU', 'LIMC': 'MXP',
        'ZMCK': 'UBN', 'WBKK': 'BKI', 'ZSYT': 'YNT'
      };

      try {
        // 1차: 로컬 UBIKAIS 정적 JSON 파일 직접 검색 (API 없이 작동)
        const reg = selectedAircraft?.registration;
        try {
          const ubikaisRes = await fetch('/flight_schedule.json');
          if (ubikaisRes.ok) {
            const ubikaisData = await ubikaisRes.json();
            const departures = ubikaisData.departures || [];
            let matchedFlight = null;

            // callsign으로 검색
            if (callsign) {
              const normalizedCallsign = callsign.replace(/\s/g, '').toUpperCase();
              matchedFlight = departures.find(f => {
                const flightNum = f.flight_number?.replace(/\s/g, '').toUpperCase();
                return flightNum === normalizedCallsign ||
                       flightNum === normalizedCallsign.replace(/^([A-Z]+)0*/, '$1');
              });
            }

            // registration으로 검색
            if (!matchedFlight && reg) {
              const normalizedReg = reg.replace(/-/g, '').toUpperCase();
              matchedFlight = departures.find(f => {
                const flightReg = f.registration?.replace(/-/g, '').toUpperCase();
                return flightReg === normalizedReg;
              });
            }

            if (matchedFlight) {
              const originIcao = matchedFlight.origin;
              const destIcao = matchedFlight.destination;
              setFlightSchedule({
                flight: { iata: matchedFlight.flight_number, icao: callsign },
                departure: originIcao ? {
                  iata: icaoToIata[originIcao] || originIcao,
                  icao: originIcao,
                  airport: AIRPORT_DATABASE[originIcao]?.name
                } : null,
                arrival: destIcao ? {
                  iata: icaoToIata[destIcao] || destIcao,
                  icao: destIcao,
                  airport: AIRPORT_DATABASE[destIcao]?.name
                } : null,
                flight_status: matchedFlight.status,
                schedule: {
                  std: matchedFlight.std,
                  etd: matchedFlight.etd,
                  atd: matchedFlight.atd,
                  sta: matchedFlight.sta,
                  eta: matchedFlight.eta,
                  status: matchedFlight.status,
                  nature: matchedFlight.nature
                },
                aircraft_info: {
                  registration: matchedFlight.registration,
                  type: matchedFlight.aircraft_type
                },
                _source: 'ubikais',
                _lastUpdated: ubikaisData.last_updated
              });
              setFlightScheduleLoading(false);
              console.log('UBIKAIS match found:', matchedFlight.flight_number);
              return;
            }
          }
        } catch (e) {
          console.warn('UBIKAIS static JSON search error:', e.message);
        }

        // 2차: UBIKAIS + FlightRadar24 통합 API로 출발/도착 정보 가져오기
        const params = new URLSearchParams();
        if (callsign) params.append('callsign', callsign);
        if (hex) params.append('hex', hex);
        if (reg) params.append('reg', reg);

        const fr24Res = await fetch(`/api/flight-route?${params}`);
        if (fr24Res.ok) {
          const routeData = await fr24Res.json();
          if (routeData?.origin?.iata || routeData?.destination?.iata) {
            // UBIKAIS 또는 FR24 데이터를 통합 형식으로 변환
            const isUbikais = routeData.source === 'ubikais';
            setFlightSchedule({
              flight: { iata: routeData.callsign, icao: callsign },
              departure: routeData.origin ? {
                iata: routeData.origin.iata,
                icao: routeData.origin.icao,
                airport: routeData.origin.name || AIRPORT_DATABASE[routeData.origin.icao]?.name
              } : null,
              arrival: routeData.destination ? {
                iata: routeData.destination.iata,
                icao: routeData.destination.icao,
                airport: routeData.destination.name || AIRPORT_DATABASE[routeData.destination.icao]?.name
              } : null,
              flight_status: routeData.schedule?.status || routeData.status?.text || 'active',
              // UBIKAIS/FR24 스케줄 정보 (모든 소스에서 사용)
              schedule: routeData.schedule || null,
              aircraft_info: routeData.aircraft,
              // FR24 항공기 사진 (fallback용)
              aircraft_images: routeData.aircraft?.images || [],
              _source: routeData.source,
              _lastUpdated: routeData.lastUpdated
            });
            setFlightScheduleLoading(false);
            return;
          }
        }

        // 2차: aviationstack API 백업 (FR24에서 못 찾으면)
        if (AVIATIONSTACK_API_KEY && callsign) {
          const icaoMatch = callsign.match(/^([A-Z]{3})(\d+)/);
          let flightNumber = callsign;

          if (icaoMatch) {
            const icaoCode = icaoMatch[1];
            const number = icaoMatch[2];
            const iataCode = ICAO_TO_IATA[icaoCode];
            if (iataCode) {
              flightNumber = iataCode + number;
            }
          }

          const avRes = await fetch(`/api/flight-schedule?flight=${flightNumber}`);
          if (avRes.ok) {
            const avData = await avRes.json();
            if (avData?.data?.length > 0) {
              setFlightSchedule({ ...avData.data[0], _source: 'aviationstack' });
            }
          }
        }
      } catch (err) {
        console.warn('Failed to fetch flight schedule:', err);
      } finally {
        setFlightScheduleLoading(false);
      }
    };

    fetchSchedule();
  }, [selectedAircraft?.hex, selectedAircraft?.callsign]);

  // Fetch flight track from OpenSky Network tracks API when selectedAircraft changes
  useEffect(() => {
    if (!selectedAircraft) {
      setFlightTrack(null);
      return;
    }

    const hex = selectedAircraft.hex?.toLowerCase();
    if (!hex) return;

    setFlightTrackLoading(true);
    setFlightTrack(null);

    const fetchTrack = async () => {
      try {
        // OpenSky tracks API - time=0 means current flight
        // path: [[time, lat, lon, baro_altitude, true_track, on_ground], ...]
        const res = await fetch(
          `https://opensky-network.org/api/tracks/all?icao24=${hex}&time=0`
        );
        if (res.ok) {
          const data = await res.json();
          if (data && data.path && data.path.length > 0) {
            // path 배열을 그래프용 데이터로 변환
            const trackData = data.path.map(p => ({
              time: p[0],
              lat: p[1],
              lon: p[2],
              altitude_ft: p[3] ? Math.round(p[3] * 3.28084) : 0, // meters to feet
              track: p[4],
              on_ground: p[5]
            }));
            setFlightTrack({
              icao24: data.icao24,
              callsign: data.callsign,
              startTime: data.startTime,
              endTime: data.endTime,
              path: trackData
            });
          }
        }
      } catch (err) {
        console.warn('Failed to fetch flight track from OpenSky:', err);
      } finally {
        setFlightTrackLoading(false);
      }
    };

    fetchTrack();
  }, [selectedAircraft?.hex]);

  // NOTE: Korea Airspace Routes and Waypoints layer is now managed by useKoreaAirspace hook

  // Wind thread animation - thin silk-like threads with fade in/out
  useEffect(() => {
    if (!map.current || !mapLoaded || !weatherData?.metar?.wdir || !data?.airport) return;

    const windDir = weatherData.metar.wdir;
    const windSpd = weatherData.metar.wspd || 5;
    if (windDir === 'VRB' || windDir === 0) return;

    const centerLon = data.airport.lon || 129.3518;
    const centerLat = data.airport.lat || 35.5934;
    const windRad = ((windDir + 180) % 360) * Math.PI / 180;

    // Thread configuration
    const threadCount = 30;
    const areaRadius = 0.022;
    const maxLife = 180; // Frames until respawn

    // Initialize threads
    let threads = [];
    for (let i = 0; i < threadCount; i++) {
      threads.push(createThread());
    }

    function createThread() {
      // Start from upwind edge with random lateral position
      const lateralOffset = (Math.random() - 0.5) * areaRadius * 2;
      const startLon = centerLon + Math.sin(windRad + Math.PI) * areaRadius * 1.2 + Math.cos(windRad) * lateralOffset;
      const startLat = centerLat + Math.cos(windRad + Math.PI) * areaRadius * 1.2 - Math.sin(windRad) * lateralOffset;
      return {
        points: [[startLon, startLat]],
        speed: 0.6 + Math.random() * 0.5,
        life: 0,
        maxLife: maxLife * (0.7 + Math.random() * 0.6)
      };
    }

    const sourceId = 'wind-threads';
    const glowSourceId = 'wind-threads-glow';
    const layerId = 'wind-threads-layer';
    const glowLayerId = 'wind-threads-glow-layer';

    [layerId, glowLayerId].forEach(id => { try { if (map.current.getLayer(id)) map.current.removeLayer(id); } catch (e) {} });
    [sourceId, glowSourceId].forEach(id => { try { if (map.current.getSource(id)) map.current.removeSource(id); } catch (e) {} });

    map.current.addSource(sourceId, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.current.addSource(glowSourceId, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

    // Glow layer (wider, softer)
    map.current.addLayer({
      id: glowLayerId,
      type: 'line',
      source: glowSourceId,
      paint: {
        'line-color': '#00d4ff',
        'line-width': 3,
        'line-opacity': ['get', 'opacity'],
        'line-blur': 2
      }
    });

    // Main thread layer
    map.current.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      paint: {
        'line-color': '#ffffff',
        'line-width': ['get', 'width'],
        'line-opacity': ['get', 'opacity']
      }
    });

    const baseSpeed = 0.00012 * (windSpd / 10 + 0.5);
    let animFrame;

    const animate = () => {
      const features = [];
      const glowFeatures = [];

      threads.forEach((thread, idx) => {
        thread.life++;

        // Calculate life progress (0 to 1)
        const lifeProgress = thread.life / thread.maxLife;

        // Fade in (0-20%), full (20-70%), fade out (70-100%)
        let opacity;
        if (lifeProgress < 0.15) {
          opacity = lifeProgress / 0.15; // Fade in
        } else if (lifeProgress < 0.7) {
          opacity = 1; // Full
        } else {
          opacity = 1 - (lifeProgress - 0.7) / 0.3; // Fade out
        }
        opacity = Math.max(0, Math.min(1, opacity)) * 0.6;

        // Respawn if life ended
        if (thread.life >= thread.maxLife) {
          threads[idx] = createThread();
          return;
        }

        // Move head
        const head = thread.points[0];
        const wobble = (Math.random() - 0.5) * 0.00002;
        const newLon = head[0] + Math.sin(windRad) * baseSpeed * thread.speed + Math.cos(windRad) * wobble;
        const newLat = head[1] + Math.cos(windRad) * baseSpeed * thread.speed - Math.sin(windRad) * wobble;

        // Add new point at head
        thread.points.unshift([newLon, newLat]);

        // Limit trail length based on life
        const maxPoints = Math.min(50, Math.floor(thread.life * 0.5) + 5);
        if (thread.points.length > maxPoints) {
          thread.points = thread.points.slice(0, maxPoints);
        }

        if (thread.points.length >= 2 && opacity > 0.02) {
          // Create gradient segments (head is brighter, tail fades)
          const segmentCount = Math.min(5, Math.floor(thread.points.length / 3));
          const pointsPerSegment = Math.floor(thread.points.length / segmentCount);

          for (let s = 0; s < segmentCount; s++) {
            const startIdx = s * pointsPerSegment;
            const endIdx = Math.min((s + 1) * pointsPerSegment + 1, thread.points.length);
            const segmentPoints = thread.points.slice(startIdx, endIdx);

            if (segmentPoints.length >= 2) {
              // Opacity decreases towards tail
              const segOpacity = opacity * (1 - s * 0.18);
              const segWidth = 1.2 - s * 0.15;

              features.push({
                type: 'Feature',
                geometry: { type: 'LineString', coordinates: segmentPoints },
                properties: { opacity: segOpacity, width: Math.max(0.5, segWidth) }
              });

              // Glow only for head segments
              if (s < 2) {
                glowFeatures.push({
                  type: 'Feature',
                  geometry: { type: 'LineString', coordinates: segmentPoints },
                  properties: { opacity: segOpacity * 0.3 }
                });
              }
            }
          }
        }
      });

      try {
        map.current?.getSource(sourceId)?.setData({ type: 'FeatureCollection', features });
        map.current?.getSource(glowSourceId)?.setData({ type: 'FeatureCollection', features: glowFeatures });
      } catch (e) {}

      animFrame = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animFrame);
      [layerId, glowLayerId].forEach(id => { try { if (map.current?.getLayer(id)) map.current.removeLayer(id); } catch (e) {} });
      [sourceId, glowSourceId].forEach(id => { try { if (map.current?.getSource(id)) map.current.removeSource(id); } catch (e) {} });
    };
  }, [weatherData?.metar?.wdir, weatherData?.metar?.wspd, mapLoaded, data?.airport]);

  // Lightning layer rendering
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const sourceId = 'lightning-strikes';
    const layerId = 'lightning-strikes-layer';
    const glowLayerId = 'lightning-glow-layer';

    // Remove existing
    [layerId, glowLayerId].forEach(id => { try { if (map.current.getLayer(id)) map.current.removeLayer(id); } catch (e) {} });
    try { if (map.current.getSource(sourceId)) map.current.removeSource(sourceId); } catch (e) {}

    if (!showLightning || !lightningData?.strikes?.length) return;

    const features = lightningData.strikes.map(s => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
      properties: { amplitude: Math.abs(s.amplitude || 30) }
    }));

    map.current.addSource(sourceId, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features }
    });

    // Glow layer
    map.current.addLayer({
      id: glowLayerId,
      type: 'circle',
      source: sourceId,
      paint: {
        'circle-radius': 12,
        'circle-color': '#ffff00',
        'circle-opacity': 0.3,
        'circle-blur': 1
      }
    });

    // Main strike layer
    map.current.addLayer({
      id: layerId,
      type: 'circle',
      source: sourceId,
      paint: {
        'circle-radius': 4,
        'circle-color': '#ffff00',
        'circle-stroke-color': '#ff8800',
        'circle-stroke-width': 2,
        'circle-opacity': 0.9
      }
    });

    return () => {
      [layerId, glowLayerId].forEach(id => { try { if (map.current?.getLayer(id)) map.current.removeLayer(id); } catch (e) {} });
      try { if (map.current?.getSource(sourceId)) map.current.removeSource(sourceId); } catch (e) {}
    };
  }, [showLightning, lightningData, mapLoaded]);

  // SIGMET rendering
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const sourceId = 'sigmet-areas';
    const layerId = 'sigmet-fill-layer';
    const outlineLayerId = 'sigmet-outline-layer';
    const labelLayerId = 'sigmet-label-layer';

    [layerId, outlineLayerId, labelLayerId].forEach(id => { try { if (map.current.getLayer(id)) map.current.removeLayer(id); } catch (e) {} });
    try { if (map.current.getSource(sourceId)) map.current.removeSource(sourceId); } catch (e) {}

    if (!showSigmet || !sigmetData) return;

    // Process SIGMET data
    const features = [];
    const intlSigmets = sigmetData.international || [];

    intlSigmets.forEach((sig, idx) => {
      if (sig.coords && sig.coords.length >= 3) {
        const color = sig.hazard === 'TURB' ? '#ff9800' :
                      sig.hazard === 'ICE' ? '#2196f3' :
                      sig.hazard === 'TS' || sig.hazard === 'CONVECTIVE' ? '#f44336' :
                      sig.hazard === 'VA' ? '#9c27b0' : '#ff5722';

        features.push({
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [sig.coords.map(c => [c.lon, c.lat]).concat([[sig.coords[0].lon, sig.coords[0].lat]])]
          },
          properties: {
            type: sig.hazard || 'SIGMET',
            color,
            raw: sig.rawSigmet || ''
          }
        });
      }
    });

    if (features.length === 0) return;

    map.current.addSource(sourceId, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features }
    });

    map.current.addLayer({
      id: layerId,
      type: 'fill',
      source: sourceId,
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': 0.2
      }
    });

    map.current.addLayer({
      id: outlineLayerId,
      type: 'line',
      source: sourceId,
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 2,
        'line-dasharray': [4, 2]
      }
    });

    return () => {
      [layerId, outlineLayerId, labelLayerId].forEach(id => { try { if (map.current?.getLayer(id)) map.current.removeLayer(id); } catch (e) {} });
      try { if (map.current?.getSource(sourceId)) map.current.removeSource(sourceId); } catch (e) {}
    };
  }, [showSigmet, sigmetData, mapLoaded]);


  // Radar overlay rendering
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const sourceId = 'radar-overlay';
    const layerId = 'radar-layer';

    try { if (map.current.getLayer(layerId)) map.current.removeLayer(layerId); } catch (e) {}
    try { if (map.current.getSource(sourceId)) map.current.removeSource(sourceId); } catch (e) {}

    if (!showRadar) return;

    // RainViewer API - global radar tiles
    const timestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago

    map.current.addSource(sourceId, {
      type: 'raster',
      tiles: [
        `https://tilecache.rainviewer.com/v2/radar/${timestamp}/256/{z}/{x}/{y}/2/1_1.png`
      ],
      tileSize: 256
    });

    map.current.addLayer({
      id: layerId,
      type: 'raster',
      source: sourceId,
      paint: {
        'raster-opacity': 0.6,
        'raster-fade-duration': 0
      }
    }, 'aeroway-line'); // Place under airport features

    return () => {
      try { if (map.current?.getLayer(layerId)) map.current.removeLayer(layerId); } catch (e) {}
      try { if (map.current?.getSource(sourceId)) map.current.removeSource(sourceId); } catch (e) {}
    };
  }, [showRadar, mapLoaded]);

  // Surface wind - removed (per user request, no background particle animation)

  const flyToAirport = () => {
    map.current?.flyTo({ center: [129.3518, 35.5934], zoom: 12, pitch: is3DView ? 60 : 0, bearing: is3DView ? -30 : 0, duration: 2000 });
  };

  const chartsByRunway = {
    '18': Object.entries(PROCEDURE_CHARTS).filter(([_, c]) => c.runway === '18'),
    '36': Object.entries(PROCEDURE_CHARTS).filter(([_, c]) => c.runway === '36'),
  };

  return (
    <div
      className={`app-container ${isDarkMode ? 'dark-mode' : 'light-mode'}`}
      style={{
        height: `${windowHeight}px`,
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden'
      }}
    >
      <div ref={mapContainer} id="map" style={{ height: `${windowHeight}px` }} />

      {/* Time & Weather Display */}
      <TimeWeatherBar
        currentTime={currentTime}
        weatherData={weatherData}
        showMetarPopup={showMetarPopup}
        setShowMetarPopup={setShowMetarPopup}
        metarPinned={metarPinned}
        setMetarPinned={setMetarPinned}
        showTafPopup={showTafPopup}
        setShowTafPopup={setShowTafPopup}
        tafPinned={tafPinned}
        setTafPinned={setTafPinned}
        parseMetar={parseMetar}
        parseMetarTime={parseMetarTime}
      />

      {/* View Controls */}
      <ViewControlsBar
        is3DView={is3DView}
        setIs3DView={setIs3DView}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        showSatellite={showSatellite}
        setShowSatellite={setShowSatellite}
        wxLayersExpanded={wxLayersExpanded}
        setWxLayersExpanded={setWxLayersExpanded}
        showRadar={showRadar}
        setShowRadar={setShowRadar}
        showSatelliteWx={showSatelliteWx}
        setShowSatelliteWx={setShowSatelliteWx}
        showLightning={showLightning}
        setShowLightning={setShowLightning}
        showSigmet={showSigmet}
        setShowSigmet={setShowSigmet}
        setShowWxPanel={setShowWxPanel}
        showAtcPanel={showAtcPanel}
        setShowAtcPanel={setShowAtcPanel}
        atcOnlyMode={atcOnlyMode}
        setAtcOnlyMode={setAtcOnlyMode}
        atcData={atcData}
        selectedAtcSectors={selectedAtcSectors}
        setSelectedAtcSectors={setSelectedAtcSectors}
        atcExpanded={atcExpanded}
        setAtcExpanded={setAtcExpanded}
        radarRange={radarRange}
        setRadarRange={setRadarRange}
        radarBlackBackground={radarBlackBackground}
        setRadarBlackBackground={setRadarBlackBackground}
        map={map}
        showNotamPanel={showNotamPanel}
        setShowNotamPanel={setShowNotamPanel}
        notamData={notamData}
        notamLoading={notamLoading}
        notamError={notamError}
        notamCacheAge={notamCacheAge}
        notamPeriod={notamPeriod}
        setNotamPeriod={setNotamPeriod}
        notamLocationFilter={notamLocationFilter}
        setNotamLocationFilter={setNotamLocationFilter}
        notamFilter={notamFilter}
        setNotamFilter={setNotamFilter}
        notamExpanded={notamExpanded}
        setNotamExpanded={setNotamExpanded}
        notamLocationsOnMap={notamLocationsOnMap}
        setNotamLocationsOnMap={setNotamLocationsOnMap}
        fetchNotamData={fetchNotamData}
      />

      {/* Mobile Menu Toggle Button - 패널 열릴 때 숨김 */}
      {!isPanelOpen && (
        <button
          className="mobile-menu-toggle"
          onClick={() => setIsPanelOpen(true)}
          aria-label="메뉴 열기"
        >
          ☰
        </button>
      )}
      <div className={`control-panel ${isPanelOpen ? 'open' : 'closed'}`}>
        <div className="panel-header">
          <span className="panel-title">TBAS</span>
          <button className="panel-close-btn" onClick={() => setIsPanelOpen(false)} aria-label="패널 닫기">✕</button>
        </div>

        <div className="panel-content">
          {/* Altitude Legend */}
          <AltitudeLegend />

          {/* Basic Layers - Accordion */}
          <Accordion title="기본 레이어" expanded={layersExpanded} onToggle={() => setLayersExpanded(!layersExpanded)}>
            <ToggleItem label="웨이포인트" checked={showWaypoints} onChange={setShowWaypoints} disabled={hasActiveProcedure} hint={hasActiveProcedure ? "(절차별)" : null} />
            <ToggleItem label="장애물" checked={showObstacles} onChange={setShowObstacles} />
            <ToggleItem label="공역" checked={showAirspace} onChange={setShowAirspace} />
            {is3DView && <ToggleItem label="3D 고도 표시" checked={show3DAltitude} onChange={setShow3DAltitude} />}
            {is3DView && <ToggleItem label="지형" checked={showTerrain} onChange={setShowTerrain} />}
            {is3DView && <ToggleItem label="3D 건물" checked={showBuildings} onChange={setShowBuildings} />}
            <ToggleItem label="기상 레이더" checked={showRadar} onChange={setShowRadar} />
          </Accordion>

          {/* Korea Routes/Waypoints/Airspaces - Accordion */}
          <KoreaAirspacePanel
            koreaAirspaceData={koreaAirspaceData}
            koreaRoutesExpanded={koreaRoutesExpanded}
            setKoreaRoutesExpanded={setKoreaRoutesExpanded}
            showKoreaRoutes={showKoreaRoutes}
            setShowKoreaRoutes={setShowKoreaRoutes}
            showKoreaWaypoints={showKoreaWaypoints}
            setShowKoreaWaypoints={setShowKoreaWaypoints}
            showKoreaNavaids={showKoreaNavaids}
            setShowKoreaNavaids={setShowKoreaNavaids}
            showKoreaAirspaces={showKoreaAirspaces}
            setShowKoreaAirspaces={setShowKoreaAirspaces}
          />

          {/* Aircraft - Accordion */}
          <AircraftControlPanel
            aircraftExpanded={aircraftExpanded}
            setAircraftExpanded={setAircraftExpanded}
            showAircraft={showAircraft}
            setShowAircraft={setShowAircraft}
            showAircraftTrails={showAircraftTrails}
            setShowAircraftTrails={setShowAircraftTrails}
            show3DAircraft={show3DAircraft}
            setShow3DAircraft={setShow3DAircraft}
            is3DView={is3DView}
            trailDuration={trailDuration}
            setTrailDuration={setTrailDuration}
            headingPrediction={headingPrediction}
            setHeadingPrediction={setHeadingPrediction}
            labelOffset={labelOffset}
            setLabelOffset={setLabelOffset}
            isDraggingLabel={isDraggingLabel}
            setIsDraggingLabel={setIsDraggingLabel}
          />

          {/* SID 출발절차 */}
          <SidPanel
            procedures={data?.procedures?.SID}
            expanded={sidExpanded}
            onToggle={() => setSidExpanded(!sidExpanded)}
            visible={sidVisible}
            setVisible={setSidVisible}
            colors={procColors.SID}
          />

          {/* STAR 도착절차 */}
          <StarPanel
            procedures={data?.procedures?.STAR}
            expanded={starExpanded}
            onToggle={() => setStarExpanded(!starExpanded)}
            visible={starVisible}
            setVisible={setStarVisible}
            colors={procColors.STAR}
          />

          {/* APCH 접근절차 */}
          <ApproachPanel
            procedures={data?.procedures?.APPROACH}
            expanded={apchExpanded}
            onToggle={() => setApchExpanded(!apchExpanded)}
            visible={apchVisible}
            setVisible={setApchVisible}
            colors={procColors.APPROACH}
          />

          {/* 차트 오버레이 */}
          <ChartOverlayPanel
            chartsByRunway={chartsByRunway}
            expanded={chartExpanded}
            onToggle={() => setChartExpanded(!chartExpanded)}
            activeCharts={activeCharts}
            toggleChart={toggleChart}
            chartOpacities={chartOpacities}
            updateChartOpacity={updateChartOpacity}
          />

          <div className="section">
            <button className="fly-btn" onClick={flyToAirport}>공항으로 이동</button>
          </div>
        </div>
      </div>

      {/* Aircraft Detail Panel (FR24 Style) */}
      <AircraftDetailPanel
        showAircraftPanel={showAircraftPanel}
        setShowAircraftPanel={setShowAircraftPanel}
        selectedAircraft={selectedAircraft}
        setSelectedAircraft={setSelectedAircraft}
        aircraft={aircraft}
        aircraftPhoto={aircraftPhoto}
        aircraftPhotoLoading={aircraftPhotoLoading}
        aircraftDetails={aircraftDetails}
        aircraftDetailsLoading={aircraftDetailsLoading}
        flightSchedule={flightSchedule}
        flightScheduleLoading={flightScheduleLoading}
        flightTrack={flightTrack}
        flightTrackLoading={flightTrackLoading}
        aircraftTrails={aircraftTrails}
        sectionExpanded={sectionExpanded}
        toggleSection={toggleSection}
        graphHoverData={graphHoverData}
        setGraphHoverData={setGraphHoverData}
        data={data}
        atcData={atcData}
        getAircraftImage={getAircraftImage}
        detectFlightPhase={detectFlightPhase}
        detectCurrentAirspace={detectCurrentAirspace}
        findNearestWaypoints={findNearestWaypoints}
        detectCurrentProcedure={detectCurrentProcedure}
        AIRPORT_DATABASE={AIRPORT_DATABASE}
      />

      {/* Right Weather Panel */}
      <WeatherPanel
        showWxPanel={showWxPanel}
        setShowWxPanel={setShowWxPanel}
        wxPanelTab={wxPanelTab}
        setWxPanelTab={setWxPanelTab}
        sigmetData={sigmetData}
        notamData={notamData}
        lightningData={lightningData}
      />
    </div>
  );
}

export default App;

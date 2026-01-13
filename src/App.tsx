/**
 * TBAS (Trajectory-Based Awareness System) Application
 * 궤적기반 상황인식 시스템
 * DO-278A 요구사항 추적: SRS-APP-001
 *
 * Clean Architecture 기반 메인 애플리케이션 컴포넌트
 */

import React, { useState, useCallback, useEffect } from 'react';
import './index.css';

// Context Providers
import { MapProvider, useMapContext } from '@/presentation/contexts/MapContext';
import { AircraftProvider, useAircraftContext } from '@/presentation/contexts/AircraftContext';
import { WeatherProvider, useWeatherContext } from '@/presentation/contexts/WeatherContext';

// Map Components
import { MapContainer } from '@/presentation/components/map/MapContainer';
import { AircraftLayer } from '@/presentation/components/map/AircraftLayer';
import { TrailLayer } from '@/presentation/components/map/TrailLayer';
import { WaypointLayer } from '@/presentation/components/map/WaypointLayer';
import { AirspaceLayer } from '@/presentation/components/map/AirspaceLayer';
import { ChartLayer } from '@/presentation/components/map/ChartLayer';
import type { ChartData } from '@/presentation/components/map/ChartLayer';

// Panel Components
import { AircraftInfoPanel } from '@/presentation/components/Panels/AircraftInfoPanel';
import { WeatherPanel } from '@/presentation/components/Panels/WeatherPanel';
import { ControlPanel } from '@/presentation/components/Panels/ControlPanel';
import { AircraftListPanel } from '@/presentation/components/Panels/AircraftListPanel';
import { ChartPanel } from '@/presentation/components/Panels/ChartPanel';

// Services
import { getAirportCharts, getMockChartData } from '@/services/chartService';
import { AIRPORT_COORDINATES } from '@/config/airports';

// Hooks
import { useGIS } from '@/presentation/hooks/useGIS';

// Config
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_TRAIL_DURATION,
  TRAIL_COLOR,
} from '@/config/constants';

/**
 * Android WebView에서 실제 화면 높이 계산
 */
function useWindowHeight() {
  const [height, setHeight] = useState(window.innerHeight);

  useEffect(() => {
    const updateHeight = () => {
      // 실제 화면 높이 계산 (Android WebView 호환)
      const vh = Math.max(
        document.documentElement.clientHeight || 0,
        window.innerHeight || 0,
        window.screen.availHeight || 0
      );
      setHeight(vh);

      // CSS 변수로도 설정
      document.documentElement.style.setProperty('--app-height', `${vh}px`);
    };

    updateHeight();

    // 다양한 이벤트에서 높이 업데이트
    window.addEventListener('resize', updateHeight);
    window.addEventListener('orientationchange', updateHeight);
    window.addEventListener('load', updateHeight);

    // Android에서 초기 로딩 후 지연 업데이트
    const timeouts = [100, 300, 500, 1000, 2000].map(delay =>
      setTimeout(updateHeight, delay)
    );

    return () => {
      window.removeEventListener('resize', updateHeight);
      window.removeEventListener('orientationchange', updateHeight);
      window.removeEventListener('load', updateHeight);
      timeouts.forEach(clearTimeout);
    };
  }, []);

  return height;
}

/**
 * 메인 뷰어 컴포넌트
 */
function RKPUViewer() {
  const [trailDuration, setTrailDuration] = useState(DEFAULT_TRAIL_DURATION);
  const [showControlPanel, setShowControlPanel] = useState(false);
  const [showAircraftList, setShowAircraftList] = useState(false);
  const [showWeather, setShowWeather] = useState(true);
  const [showCharts, setShowCharts] = useState(false);

  // Chart state
  const [selectedChartAirport, setSelectedChartAirport] = useState('RKPU');
  const [selectedChartTypes, setSelectedChartTypes] = useState<string[]>(['ADC', 'IAC', 'VAC']);
  const [chartOpacity, setChartOpacity] = useState(0.7);
  const [charts, setCharts] = useState<ChartData[]>([]);

  // Android WebView 높이 계산
  const windowHeight = useWindowHeight();

  // Contexts
  const { selectedAircraftHex, selectAircraft, flyTo } = useMapContext();
  const { aircraft, selectedAircraft } = useAircraftContext();
  const { metar, taf, weatherRisk, refreshWeather } = useWeatherContext();

  // GIS Data
  const { waypoints, airspaces, isLoading: isGISLoading } = useGIS({
    airport: 'RKPU',
    autoLoad: true,
  });

  /**
   * 차트 데이터 로드
   */
  const loadCharts = useCallback(async () => {
    if (!selectedChartAirport || !showCharts) return;

    try {
      // Try to load from API first
      let loadedCharts = await getAirportCharts(
        selectedChartAirport,
        undefined,
        selectedChartTypes.length > 0 ? selectedChartTypes : undefined
      );

      // If no charts from API, use mock data for development
      if (loadedCharts.length === 0) {
        loadedCharts = getMockChartData(selectedChartAirport);
        if (selectedChartTypes.length > 0) {
          loadedCharts = loadedCharts.filter((c) => selectedChartTypes.includes(c.chart_type));
        }
      }

      setCharts(loadedCharts);
    } catch (error) {
      console.error('Failed to load charts:', error);
      // Fallback to mock data
      let mockCharts = getMockChartData(selectedChartAirport);
      if (selectedChartTypes.length > 0) {
        mockCharts = mockCharts.filter((c) => selectedChartTypes.includes(c.chart_type));
      }
      setCharts(mockCharts);
    }
  }, [selectedChartAirport, selectedChartTypes, showCharts]);

  useEffect(() => {
    loadCharts();
  }, [loadCharts]);

  /**
   * 공항 변경 시 지도 이동
   */
  const handleChartAirportChange = useCallback(
    (icao: string) => {
      setSelectedChartAirport(icao);
      const coords = AIRPORT_COORDINATES[icao];
      if (coords) {
        flyTo({ lat: coords.lat, lon: coords.lon }, { zoom: 11 });
      }
    },
    [flyTo]
  );

  /**
   * 항공기 선택 핸들러
   */
  const handleAircraftSelect = useCallback(
    (hex: string) => {
      selectAircraft(hex === selectedAircraftHex ? null : hex);

      // 선택된 항공기로 이동
      const ac = aircraft.find((a) => a.hex === hex);
      if (ac && ac.lat && ac.lon) {
        flyTo({ lat: ac.lat, lon: ac.lon }, { zoom: 12 });
      }
    },
    [selectAircraft, selectedAircraftHex, aircraft, flyTo]
  );

  /**
   * 항공기 선택 해제
   */
  const handleCloseAircraftInfo = useCallback(() => {
    selectAircraft(null);
  }, [selectAircraft]);

  /**
   * 키보드 단축키
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC: 선택 해제
      if (e.key === 'Escape') {
        selectAircraft(null);
      }
      // C: 컨트롤 패널 토글
      if (e.key === 'c' || e.key === 'C') {
        if (!e.ctrlKey && !e.metaKey) {
          setShowControlPanel((prev) => !prev);
        }
      }
      // L: 항공기 목록 토글
      if (e.key === 'l' || e.key === 'L') {
        setShowAircraftList((prev) => !prev);
      }
      // W: 기상 패널 토글
      if (e.key === 'w' || e.key === 'W') {
        setShowWeather((prev) => !prev);
      }
      // H: 차트 패널 토글
      if (e.key === 'h' || e.key === 'H') {
        setShowCharts((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectAircraft]);

  return (
    <div
      style={{
        width: '100%',
        height: `${windowHeight}px`,
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
      }}
    >
      {/* 지도 */}
      <MapContainer style={{ width: '100%', height: `${windowHeight}px` }}>
        {showCharts && (
          <ChartLayer
            airport={selectedChartAirport}
            chartTypes={selectedChartTypes.length > 0 ? selectedChartTypes : undefined}
            opacity={chartOpacity}
            onChartLoad={setCharts}
          />
        )}
        <AircraftLayer colorBy="flightPhase" showLabels />
        <TrailLayer color={TRAIL_COLOR} />
        <WaypointLayer waypoints={waypoints} showLabels />
        <AirspaceLayer airspaces={airspaces} fillOpacity={0.15} />
      </MapContainer>

      {/* 상단 도구 모음 */}
      <div
        style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          display: 'flex',
          gap: '8px',
          zIndex: 100,
        }}
      >
        <ToolbarButton
          active={showControlPanel}
          onClick={() => setShowControlPanel(!showControlPanel)}
          title="Settings (C)"
        >
          Settings
        </ToolbarButton>
        <ToolbarButton
          active={showAircraftList}
          onClick={() => setShowAircraftList(!showAircraftList)}
          title="Aircraft List (L)"
        >
          Aircraft
        </ToolbarButton>
        <ToolbarButton
          active={showWeather}
          onClick={() => setShowWeather(!showWeather)}
          title="Weather (W)"
        >
          Weather
        </ToolbarButton>
        <ToolbarButton
          active={showCharts}
          onClick={() => setShowCharts(!showCharts)}
          title="AIP Charts (H)"
        >
          Charts
        </ToolbarButton>
      </div>

      {/* 상태 표시 */}
      <div
        style={{
          position: 'absolute',
          top: '16px',
          right: '60px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          padding: '8px 16px',
          borderRadius: '8px',
          color: '#fff',
          fontSize: '12px',
          zIndex: 100,
        }}
      >
        <span>
          Aircraft: <strong>{aircraft.length}</strong>
        </span>
        {isGISLoading && <span style={{ color: '#FF9800' }}>Loading GIS...</span>}
      </div>

      {/* 컨트롤 패널 */}
      {showControlPanel && (
        <div
          style={{
            position: 'absolute',
            top: '60px',
            left: '16px',
            zIndex: 100,
          }}
        >
          <ControlPanel
            trailDuration={trailDuration}
            onTrailDurationChange={setTrailDuration}
          />
        </div>
      )}

      {/* 항공기 목록 */}
      {showAircraftList && (
        <div
          style={{
            position: 'absolute',
            top: '60px',
            left: showControlPanel ? '236px' : '16px',
            width: '320px',
            zIndex: 100,
          }}
        >
          <AircraftListPanel
            aircraft={aircraft}
            selectedHex={selectedAircraftHex}
            onSelect={handleAircraftSelect}
          />
        </div>
      )}

      {/* 기상 패널 */}
      {showWeather && (
        <div
          style={{
            position: 'absolute',
            bottom: '16px',
            left: '16px',
            zIndex: 100,
          }}
        >
          <WeatherPanel
            metar={metar}
            taf={taf}
            weatherRisk={weatherRisk}
            onRefresh={refreshWeather}
          />
        </div>
      )}

      {/* 선택된 항공기 정보 */}
      {selectedAircraft && (
        <div
          style={{
            position: 'absolute',
            bottom: '16px',
            right: '16px',
            zIndex: 100,
          }}
        >
          <AircraftInfoPanel
            aircraft={selectedAircraft}
            onClose={handleCloseAircraftInfo}
          />
        </div>
      )}

      {/* 차트 패널 */}
      {showCharts && (
        <div
          style={{
            position: 'absolute',
            top: '60px',
            right: '16px',
            zIndex: 100,
          }}
        >
          <ChartPanel
            selectedAirport={selectedChartAirport}
            onAirportChange={handleChartAirportChange}
            selectedChartTypes={selectedChartTypes}
            onChartTypesChange={setSelectedChartTypes}
            chartOpacity={chartOpacity}
            onOpacityChange={setChartOpacity}
            charts={charts}
          />
        </div>
      )}

      {/* 하단 정보 */}
      <div
        style={{
          position: 'absolute',
          bottom: '8px',
          right: '8px',
          fontSize: '10px',
          color: 'rgba(255,255,255,0.5)',
          zIndex: 50,
        }}
      >
        TBAS Viewer | Keys: C (Settings), L (List), W (Weather), H (Charts), ESC (Deselect)
      </div>
    </div>
  );
}

/**
 * 도구 모음 버튼 컴포넌트
 */
function ToolbarButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        backgroundColor: active ? 'rgba(33, 150, 243, 0.8)' : 'rgba(0, 0, 0, 0.7)',
        border: active ? '1px solid #2196F3' : '1px solid rgba(255,255,255,0.2)',
        color: '#fff',
        padding: '8px 16px',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '12px',
        fontWeight: active ? 'bold' : 'normal',
      }}
    >
      {children}
    </button>
  );
}

/**
 * 앱 루트 컴포넌트 (Provider 래핑)
 */
export function App() {
  return (
    <MapProvider initialCenter={DEFAULT_MAP_CENTER} initialZoom={10}>
      <AircraftProvider center={DEFAULT_MAP_CENTER} radiusNM={100} autoUpdate>
        <WeatherProvider icao="RKPU" autoUpdate>
          <RKPUViewer />
        </WeatherProvider>
      </AircraftProvider>
    </MapProvider>
  );
}

export default App;

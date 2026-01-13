import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Import toast hook
import { useToast } from './components/Toast';

// Import constants
import {
  MAPBOX_ACCESS_TOKEN,
  PROCEDURE_CHARTS,
} from './constants/config';

import { AIRPORT_DATABASE } from './constants/airports';

// Import weather utilities
import { parseMetar, parseMetarTime } from './utils/weather';

// Import aircraft constants
import { getAircraftImage } from './constants/aircraft';

// Import flight utilities
import {
  detectFlightPhase,
  detectCurrentAirspace,
  findNearestWaypoints,
  detectCurrentProcedure,
} from './utils/flight';

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
  useWeatherLayers,
  useAircraftVisualization,
  useAircraftData,
  useSelectedAircraft,
  useAircraftClickHandler,
  useProcedureRendering,
  useNotamLayer,
  useNotamData,
  useWeatherData,
  useAirspaceLayers,
  useMapInit,
  useDataLoading,
  useWindowHeight,
} from './hooks';

mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

function App() {
  const mapContainer = useRef(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Toast notifications
  const { addToast, updateToast, dismissToast } = useToast();
  const flightTrackToastRef = useRef(null);

  // Map initialization hook
  const { map, mapLoaded, setMapLoaded } = useMapInit(mapContainer);

  // Data loading hook
  const {
    data,
    sidVisible,
    setSidVisible,
    starVisible,
    setStarVisible,
    apchVisible,
    setApchVisible,
    procColors,
    chartBounds,
    chartOpacities,
    setChartOpacities,
    atcData,
    koreaAirspaceData,
  } = useDataLoading();

  // Window height hook (Android WebView fix)
  const windowHeight = useWindowHeight(map);

  const [is3DView, setIs3DView] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showSatellite, setShowSatellite] = useState(false);
  const [showBuildings, setShowBuildings] = useState(true);

  const [activeCharts, setActiveCharts] = useState({});

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

  const [showAircraft, setShowAircraft] = useState(true);
  const [showAircraftTrails, setShowAircraftTrails] = useState(true);
  const [show3DAircraft, setShow3DAircraft] = useState(true);
  const [trailDuration, setTrailDuration] = useState(60000); // 1분 기본값 (히스토리 길이)
  const [headingPrediction, setHeadingPrediction] = useState(30); // 헤딩 예측 시간 (초) - 30초 기본
  const [labelOffset, setLabelOffset] = useState({ x: 1.0, y: 0 }); // 라벨 오프셋 (사용자 드래그로 조절)
  const [isDraggingLabel, setIsDraggingLabel] = useState(false); // 라벨 드래그 중인지
  const [selectedAircraft, setSelectedAircraft] = useState(null); // 선택된 항공기 상세정보
  const [graphHoverData, setGraphHoverData] = useState(null); // 고도 그래프 hover 데이터
  // Note: aircraft, aircraftTrails, aircraftPhoto, aircraftDetails, flightSchedule, flightTrack
  // are now managed by useAircraftData and useSelectedAircraft hooks
  // Collapsible sections state
  const [sectionExpanded, setSectionExpanded] = useState({
    flightStatus: true,
    aircraftInfo: true,
    schedule: true,
    graph: true,
    position: true
  });
  const toggleSection = (section) => setSectionExpanded(prev => ({ ...prev, [section]: !prev[section] }));

  // Aviation weather layers toggles
  const [showRadar, setShowRadar] = useState(false);
  const [showSatelliteWx, setShowSatelliteWx] = useState(false);
  const [showLightning, setShowLightning] = useState(false);
  const [showSigmet, setShowSigmet] = useState(false);
  const [wxLayersExpanded, setWxLayersExpanded] = useState(false);

  // Right panel weather detail state
  const [showWxPanel, setShowWxPanel] = useState(false);
  const [wxPanelTab, setWxPanelTab] = useState('sigmet'); // sigmet, notam, llws, lightning

  // ATC Sectors panel
  const [showAtcPanel, setShowAtcPanel] = useState(false);
  const [atcExpanded, setAtcExpanded] = useState({ ACC: true, TMA: false, CTR: false });
  const [selectedAtcSectors, setSelectedAtcSectors] = useState(new Set());

  // ATC Only Mode (Radar Display) - 검은 배경 + 거리 링
  const [atcOnlyMode, setAtcOnlyMode] = useState(false);
  const [radarRange, setRadarRange] = useState(100); // 레이더 최대 범위 (nm) - 100nm 기본
  const [radarBlackBackground, setRadarBlackBackground] = useState(true); // 레이더뷰 검은 배경 on/off

  // NOTAM panel visibility
  const [showNotamPanel, setShowNotamPanel] = useState(false);

  // Korea Airspace visibility
  const [showKoreaRoutes, setShowKoreaRoutes] = useState(false);
  const [showKoreaWaypoints, setShowKoreaWaypoints] = useState(false);
  const [showKoreaNavaids, setShowKoreaNavaids] = useState(false);
  const [showKoreaAirspaces, setShowKoreaAirspaces] = useState(false);
  const [koreaRoutesExpanded, setKoreaRoutesExpanded] = useState(false);

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

  // Aircraft data hook - 항공기 데이터 로딩
  const {
    aircraft,
    aircraftTrails,
  } = useAircraftData(data, mapLoaded, showAircraft, trailDuration);

  // Selected aircraft details hook - 선택된 항공기 상세 정보
  const {
    aircraftPhoto,
    aircraftPhotoLoading,
    aircraftDetails,
    aircraftDetailsLoading,
    flightSchedule,
    flightScheduleLoading,
    flightTrack,
    flightTrackLoading,
    showAircraftPanel,
    setShowAircraftPanel,
  } = useSelectedAircraft(selectedAircraft);

  // Procedure rendering hook - SID/STAR/APCH 렌더링
  const { hasActiveProcedure } = useProcedureRendering(
    map, mapLoaded, data, sidVisible, starVisible, apchVisible, procColors, is3DView, show3DAltitude
  );

  // Aircraft visualization hook - 항공기 시각화
  useAircraftVisualization(
    map, mapLoaded, aircraft, aircraftTrails, showAircraft, showAircraftTrails,
    show3DAircraft, is3DView, show3DAltitude, trailDuration, headingPrediction, selectedAircraft, labelOffset
  );

  // Aircraft click handler hook - 항공기 클릭 처리
  useAircraftClickHandler(map, mapLoaded, aircraft, selectedAircraft, setSelectedAircraft);

  // Weather data hook - 기상 데이터 fetching
  const {
    weatherData,
    lightningData,
    sigmetData,
  } = useWeatherData(data?.airport, showRadar, showSatelliteWx, showLightning, showSigmet, showWxPanel);

  // NOTAM data hook - NOTAM 데이터 관리
  const {
    notamData,
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
  } = useNotamData(showNotamPanel);

  // Weather layers hook - 기상 레이어 (바람, 낙뢰, SIGMET, 레이더)
  useWeatherLayers(map, mapLoaded, weatherData, data, showRadar, showLightning, lightningData, showSigmet, sigmetData);

  // NOTAM layer hook - NOTAM 지도 레이어
  useNotamLayer(map, mapLoaded, notamLocationsOnMap, notamData, is3DView);

  // Airspace layers hook - 공역/웨이포인트/장애물 렌더링
  useAirspaceLayers(map, mapLoaded, data, showWaypoints, showObstacles, showAirspace, show3DAltitude, is3DView, hasActiveProcedure);

  // Flight track loading toast notification
  useEffect(() => {
    if (flightTrackLoading && selectedAircraft) {
      const callsign = selectedAircraft.callsign || selectedAircraft.hex;
      flightTrackToastRef.current = addToast(`${callsign} 항적 불러오는 중...`, { type: 'loading' });
    } else if (!flightTrackLoading && flightTrackToastRef.current) {
      if (flightTrack?.path?.length > 0) {
        const source = flightTrack.source === 'trino' ? 'Trino' : 'OpenSky';
        updateToast(flightTrackToastRef.current, {
          message: `항적 로드 완료 (${flightTrack.path.length}개 포인트, ${source})`,
          type: 'success'
        });
      } else {
        dismissToast(flightTrackToastRef.current);
      }
      flightTrackToastRef.current = null;
    }
  }, [flightTrackLoading, selectedAircraft, flightTrack, addToast, updateToast, dismissToast]);

  // Current time update
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // NOTE: Weather, NOTAM, and map initialization are handled by hooks

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

  // NOTE: All rendering is handled by dedicated hooks - see hooks/index.js

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

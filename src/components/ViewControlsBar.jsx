/**
 * ViewControlsBar Component
 * 뷰 컨트롤 바 (2D/3D, 다크모드, 기상 드롭다운 등)
 */
import React from 'react';
import AtcPanel from './AtcPanel';
import NotamPanel from './NotamPanel';

/**
 * Weather Dropdown
 */
const WeatherDropdown = ({
  wxLayersExpanded,
  setWxLayersExpanded,
  showRadar,
  setShowRadar,
  showSatelliteWx,
  setShowSatelliteWx,
  showLightning,
  setShowLightning,
  showSigmet,
  setShowSigmet,
  setShowWxPanel
}) => (
  <div className="wx-dropdown-wrapper">
    <button
      className={`view-btn ${wxLayersExpanded ? 'active' : ''}`}
      onClick={() => setWxLayersExpanded(!wxLayersExpanded)}
      title="기상정보"
    >
      기상
    </button>
    {wxLayersExpanded && (
      <div className="wx-dropdown">
        <div className={`wx-dropdown-item ${showRadar ? 'active' : ''}`} onClick={() => setShowRadar(!showRadar)}>
          <input type="checkbox" checked={showRadar} readOnly />
          <span>레이더</span>
        </div>
        <div className={`wx-dropdown-item ${showSatelliteWx ? 'active' : ''}`} onClick={() => setShowSatelliteWx(!showSatelliteWx)}>
          <input type="checkbox" checked={showSatelliteWx} readOnly />
          <span>위성영상</span>
        </div>
        <div className={`wx-dropdown-item ${showLightning ? 'active' : ''}`} onClick={() => setShowLightning(!showLightning)}>
          <input type="checkbox" checked={showLightning} readOnly />
          <span>낙뢰</span>
        </div>
        <div className={`wx-dropdown-item ${showSigmet ? 'active' : ''}`} onClick={() => setShowSigmet(!showSigmet)}>
          <input type="checkbox" checked={showSigmet} readOnly />
          <span>SIGMET</span>
        </div>
        <div className="wx-dropdown-divider"></div>
        <div className="wx-dropdown-item" onClick={() => setShowWxPanel(true)}>
          <span>상세 기상정보 ▶</span>
        </div>
      </div>
    )}
  </div>
);

/**
 * View Controls Bar Component
 */
const ViewControlsBar = ({
  // 2D/3D Toggle
  is3DView,
  setIs3DView,
  // Dark Mode
  isDarkMode,
  setIsDarkMode,
  // Satellite
  showSatellite,
  setShowSatellite,
  // Weather Dropdown
  wxLayersExpanded,
  setWxLayersExpanded,
  showRadar,
  setShowRadar,
  showSatelliteWx,
  setShowSatelliteWx,
  showLightning,
  setShowLightning,
  showSigmet,
  setShowSigmet,
  setShowWxPanel,
  // ATC Panel props
  showAtcPanel,
  setShowAtcPanel,
  atcOnlyMode,
  setAtcOnlyMode,
  atcData,
  selectedAtcSectors,
  setSelectedAtcSectors,
  atcExpanded,
  setAtcExpanded,
  radarRange,
  setRadarRange,
  radarBlackBackground,
  setRadarBlackBackground,
  map,
  // NOTAM Panel props
  showNotamPanel,
  setShowNotamPanel,
  notamData,
  notamLoading,
  notamError,
  notamCacheAge,
  notamPeriod,
  setNotamPeriod,
  notamLocationFilter,
  setNotamLocationFilter,
  notamFilter,
  setNotamFilter,
  notamExpanded,
  setNotamExpanded,
  notamLocationsOnMap,
  setNotamLocationsOnMap,
  fetchNotamData
}) => {
  return (
    <div className="view-controls">
      <button className={`view-btn ${is3DView ? 'active' : ''}`} onClick={() => setIs3DView(true)}>3D</button>
      <button className={`view-btn ${!is3DView ? 'active' : ''}`} onClick={() => setIs3DView(false)}>2D</button>
      <button
        className="view-btn icon-btn"
        onClick={() => setIsDarkMode(!isDarkMode)}
        title={isDarkMode ? '라이트 모드' : '다크 모드'}
      >
        {isDarkMode ? '🌙' : '☀️'}
      </button>
      <button
        className={`view-btn icon-btn ${showSatellite ? 'active' : ''}`}
        onClick={() => setShowSatellite(!showSatellite)}
        title="위성 사진"
      >
        🛰️
      </button>

      <WeatherDropdown
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
      />

      <AtcPanel
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
        setIsDarkMode={setIsDarkMode}
        setShowSatellite={setShowSatellite}
        map={map}
      />

      <NotamPanel
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
    </div>
  );
};

export default ViewControlsBar;

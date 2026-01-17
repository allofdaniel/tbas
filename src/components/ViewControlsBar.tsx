/**
 * ViewControlsBar Component
 * 뷰 컨트롤 바 (2D/3D, 다크모드, 기상 드롭다운 등)
 * 관제 패널은 좌측 패널로 이동됨, 기상레이더 제거됨
 */
import React from 'react';
import NotamPanel from './NotamPanel';

interface WeatherDropdownProps {
  wxLayersExpanded: boolean;
  setWxLayersExpanded: (expanded: boolean) => void;
  showLightning: boolean;
  setShowLightning: (show: boolean) => void;
  showSigmet: boolean;
  setShowSigmet: (show: boolean) => void;
  setShowWxPanel: (show: boolean) => void;
}

interface NotamExpandedState {
  [key: string]: boolean;
}

interface NotamDataItem {
  id?: string;
  location?: string;
  notam_number?: string;
  e_text?: string;
  qcode?: string;
  qcode_mean?: string;
  full_text?: string;
  effective_start?: string;
  effective_end?: string;
  [key: string]: unknown;
}

interface NotamDataResponse {
  data?: NotamDataItem[];
  returned?: number;
}

interface ViewControlsBarProps {
  // 2D/3D Toggle
  is3DView: boolean;
  setIs3DView: (is3D: boolean) => void;
  // Dark Mode
  isDarkMode: boolean;
  setIsDarkMode: (dark: boolean) => void;
  // Satellite
  showSatellite: boolean;
  setShowSatellite: (show: boolean) => void;
  // Weather Dropdown
  wxLayersExpanded: boolean;
  setWxLayersExpanded: (expanded: boolean) => void;
  showLightning: boolean;
  setShowLightning: (show: boolean) => void;
  showSigmet: boolean;
  setShowSigmet: (show: boolean) => void;
  setShowWxPanel: (show: boolean) => void;
  // NOTAM Panel props
  showNotamPanel: boolean;
  setShowNotamPanel: (show: boolean) => void;
  notamData: NotamDataResponse | null;
  notamLoading: boolean;
  notamError: string | null;
  notamCacheAge: number | null;
  notamPeriod: string;
  setNotamPeriod: (period: string) => void;
  notamLocationFilter: string;
  setNotamLocationFilter: (filter: string) => void;
  notamFilter: string;
  setNotamFilter: (filter: string) => void;
  notamExpanded: NotamExpandedState;
  setNotamExpanded: React.Dispatch<React.SetStateAction<NotamExpandedState>>;
  notamLocationsOnMap: Set<string>;
  setNotamLocationsOnMap: (locations: Set<string>) => void;
  fetchNotamData: (period: string, forceRefresh?: boolean) => void;
}

/**
 * Weather Dropdown (기상레이더 제거됨)
 */
const WeatherDropdown: React.FC<WeatherDropdownProps> = ({
  wxLayersExpanded,
  setWxLayersExpanded,
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
 * 관제 패널은 좌측 패널로 이동됨
 */
const ViewControlsBar: React.FC<ViewControlsBarProps> = ({
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
  showLightning,
  setShowLightning,
  showSigmet,
  setShowSigmet,
  setShowWxPanel,
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
        showLightning={showLightning}
        setShowLightning={setShowLightning}
        showSigmet={showSigmet}
        setShowSigmet={setShowSigmet}
        setShowWxPanel={setShowWxPanel}
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

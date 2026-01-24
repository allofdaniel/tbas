/**
 * ProcedurePanel Component
 * SID/STAR/APPROACH 절차 패널 컴포넌트
 */
import React, { type MutableRefObject } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';

interface Procedure {
  display_name: string;
}

type ProcedureRecord = Record<string, Procedure>;
type VisibleState = Record<string, boolean>;
type ColorRecord = Record<string, string>;

interface ProcedureItemProps {
  procedureKey: string;
  procedure: Procedure;
  visible: boolean;
  onToggle: (key: string) => void;
  color: string;
}

interface RunwayGroupProps {
  label: string;
  procedures: [string, Procedure][];
  visible: VisibleState;
  onToggle: React.Dispatch<React.SetStateAction<VisibleState>>;
  colors: ColorRecord;
}

interface ProcedurePanelProps {
  procedures: ProcedureRecord | null;
  expanded: boolean;
  onToggle: () => void;
  visible: VisibleState;
  setVisible: React.Dispatch<React.SetStateAction<VisibleState>>;
  colors: ColorRecord;
}

interface ChartBounds {
  bounds: [number, number][];
  type?: string;
  name?: string;
}

type ChartsByAirport = Record<string, Record<string, ChartBounds>>;

interface ChartOverlayPanelProps {
  chartsByRunway?: unknown;
  expanded: boolean;
  onToggle: () => void;
  activeCharts: Record<string, boolean>;
  toggleChart: (chartId: string) => void;
  chartOpacities: Record<string, number>;
  updateChartOpacity: (chartId: string, opacity: number) => void;
  allChartBounds: ChartsByAirport | null;
  selectedAirport: string;
  setSelectedAirport: (airport: string) => void;
  map: MutableRefObject<MapboxMap | null>;
}

/**
 * Procedure Toggle Item
 */
const ProcedureItem: React.FC<ProcedureItemProps> = ({ procedureKey, procedure, visible, onToggle, color }) => (
  <div
    className={`toggle-item ${visible ? 'active' : ''}`}
    onClick={() => onToggle(procedureKey)}
  >
    <input
      type="checkbox"
      className="toggle-checkbox"
      checked={visible || false}
      readOnly
    />
    <span className="toggle-label">{procedure.display_name}</span>
    <span className="toggle-color" style={{ background: color }}></span>
  </div>
);

/**
 * Runway Group Component
 */
const RunwayGroup: React.FC<RunwayGroupProps> = ({ label, procedures, visible, onToggle, colors }) => (
  <div className="runway-group">
    <div className="runway-label">{label}</div>
    {procedures.map(([key, proc]) => (
      <ProcedureItem
        key={key}
        procedureKey={key}
        procedure={proc}
        visible={visible[key] ?? false}
        onToggle={(k) => onToggle(prev => ({ ...prev, [k]: !prev[k] }))}
        color={colors[key] ?? '#ffffff'}
      />
    ))}
  </div>
);

/**
 * SID Panel Component
 */
export const SidPanel: React.FC<ProcedurePanelProps> = ({
  procedures,
  expanded,
  onToggle,
  visible,
  setVisible,
  colors
}) => {
  if (!procedures || Object.keys(procedures).length === 0) return null;

  const rwy18 = Object.entries(procedures).filter(([k]) => k.startsWith('2-6') || k.startsWith('2-7'));
  const rwy36 = Object.entries(procedures).filter(([k]) => k.startsWith('2-8') || k.startsWith('2-9'));

  return (
    <div className="section accordion">
      <div className="accordion-header" onClick={onToggle}>
        <span>SID 출발절차</span>
        <span className={`accordion-icon ${expanded ? 'expanded' : ''}`}>▼</span>
      </div>
      <div className={`toggle-group accordion-content ${!expanded ? 'collapsed' : ''}`}>
        <RunwayGroup
          label="RWY 18 (2-6, 2-7)"
          procedures={rwy18}
          visible={visible}
          onToggle={setVisible}
          colors={colors}
        />
        <RunwayGroup
          label="RWY 36 (2-8, 2-9)"
          procedures={rwy36}
          visible={visible}
          onToggle={setVisible}
          colors={colors}
        />
      </div>
    </div>
  );
};

/**
 * STAR Panel Component
 */
export const StarPanel: React.FC<ProcedurePanelProps> = ({
  procedures,
  expanded,
  onToggle,
  visible,
  setVisible,
  colors
}) => {
  if (!procedures || Object.keys(procedures).length === 0) return null;

  const rwy18 = Object.entries(procedures).filter(([k]) => k.startsWith('2-10'));
  const rwy36 = Object.entries(procedures).filter(([k]) => k.startsWith('2-11'));

  return (
    <div className="section accordion">
      <div className="accordion-header" onClick={onToggle}>
        <span>STAR 도착절차</span>
        <span className={`accordion-icon ${expanded ? 'expanded' : ''}`}>▼</span>
      </div>
      <div className={`toggle-group accordion-content ${!expanded ? 'collapsed' : ''}`}>
        <RunwayGroup
          label="RWY 18 (2-10)"
          procedures={rwy18}
          visible={visible}
          onToggle={setVisible}
          colors={colors}
        />
        <RunwayGroup
          label="RWY 36 (2-11)"
          procedures={rwy36}
          visible={visible}
          onToggle={setVisible}
          colors={colors}
        />
      </div>
    </div>
  );
};

/**
 * Approach Panel Component
 */
export const ApproachPanel: React.FC<ProcedurePanelProps> = ({
  procedures,
  expanded,
  onToggle,
  visible,
  setVisible,
  colors
}) => {
  if (!procedures || Object.keys(procedures).length === 0) return null;

  const rwy18 = Object.entries(procedures).filter(([k]) => k.includes('RWY 18'));
  const rwy36 = Object.entries(procedures).filter(([k]) => k.includes('RWY 36'));

  return (
    <div className="section accordion">
      <div className="accordion-header" onClick={onToggle}>
        <span>APCH 접근절차</span>
        <span className={`accordion-icon ${expanded ? 'expanded' : ''}`}>▼</span>
      </div>
      <div className={`toggle-group accordion-content ${!expanded ? 'collapsed' : ''}`}>
        <RunwayGroup
          label="RWY 18"
          procedures={rwy18}
          visible={visible}
          onToggle={setVisible}
          colors={colors}
        />
        <RunwayGroup
          label="RWY 36"
          procedures={rwy36}
          visible={visible}
          onToggle={setVisible}
          colors={colors}
        />
      </div>
    </div>
  );
};

// 공항 정보 (korea_airports.json과 동기화)
const AIRPORT_INFO: Record<string, string> = {
  RKSI: 'ICN 인천',
  RKSS: 'GMP 김포',
  RKPK: 'PUS 김해',
  RKPC: 'CJU 제주',
  RKPU: 'USN 울산',
  RKTH: 'KPO 포항',
  RKTN: 'TAE 대구',
  RKJJ: 'KWJ 광주',
  RKJB: 'MWX 무안',
  RKJK: 'KUV 군산',
  RKJY: 'RSU 여수',
  RKNW: 'WJU 원주',
  RKNY: 'YNY 양양',
  RKPS: 'HIN 사천',
  RKSM: 'SSN 성남',
  RKTL: 'CJJ 청주',
};

// 차트 타입 표시명
const CHART_TYPE_LABELS: Record<string, string> = {
  IAC: '접근 차트',
  SID: '출발 절차',
  STAR: '도착 절차',
  ADC: '공항 도면',
  GMC: '지상이동 차트',
  PDC: '주기장 차트',
  VAC: '시계접근 차트',
  'AOC-A': '장애물차트 A',
  'AOC-B': '장애물차트 B',
  OTHER: '기타',
  BIRD: '조류충돌 지도',
};

interface ChartDataWithDisplay extends ChartBounds {
  displayName?: string;
}

/**
 * Chart Overlay Panel Component (멀티 공항 지원)
 */
export const ChartOverlayPanel: React.FC<ChartOverlayPanelProps> = ({
  expanded,
  onToggle,
  activeCharts,
  toggleChart,
  chartOpacities,
  updateChartOpacity,
  allChartBounds,
  selectedAirport,
  setSelectedAirport,
  map
}) => {
  // Get available airports from allChartBounds
  const availableAirports = Object.keys(allChartBounds || {}).sort();

  // Get charts for selected airport, grouped by type
  const airportCharts = allChartBounds?.[selectedAirport] || {};
  const chartsByType: Record<string, [string, ChartDataWithDisplay][]> = {};
  const nameCounters: Record<string, number> = {}; // 중복 이름 카운터

  Object.entries(airportCharts).forEach(([chartId, chartData]) => {
    const type = chartData.type || 'OTHER';
    if (!chartsByType[type]) chartsByType[type] = [];

    // 중복 이름 처리: 같은 이름이 있으면 번호 붙임
    const baseName = chartData.name || chartId;
    const nameKey = `${type}_${baseName}`;
    if (!nameCounters[nameKey]) nameCounters[nameKey] = 0;
    nameCounters[nameKey]++;

    const displayName = nameCounters[nameKey] > 1
      ? `${baseName} (${nameCounters[nameKey]})`
      : baseName;

    chartsByType[type].push([chartId, { ...chartData, displayName }]);
  });

  // 첫 번째 항목도 번호가 필요한 경우 수정
  Object.entries(chartsByType).forEach(([, charts]) => {
    const nameCounts: Record<string, number> = {};
    charts.forEach(([, chartData]) => {
      const baseName = chartData.name || '';
      nameCounts[baseName] = (nameCounts[baseName] || 0) + 1;
    });

    charts.forEach(([chartId, chartData]) => {
      const baseName = chartData.name || chartId;
      const count = nameCounts[baseName];
      if (count !== undefined && count > 1 && !chartData.displayName?.includes('(')) {
        chartData.displayName = `${baseName} (1)`;
      }
    });
  });

  // Sort chart types
  const typeOrder = ['IAC', 'SID', 'STAR', 'ADC', 'GMC', 'PDC', 'VAC', 'AOC-A', 'AOC-B', 'BIRD', 'OTHER'];
  const sortedTypes = Object.keys(chartsByType).sort((a, b) => {
    const aIdx = typeOrder.indexOf(a);
    const bIdx = typeOrder.indexOf(b);
    return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
  });

  // Fly to airport when changed
  const handleAirportChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const newAirport = e.target.value;
    setSelectedAirport(newAirport);

    // Get airport coordinates from a chart bounds (center of first chart)
    const charts = allChartBounds?.[newAirport];
    if (charts && map?.current) {
      const firstChart = Object.values(charts)[0];
      if (firstChart?.bounds) {
        const nw = firstChart.bounds[0];
        const ne = firstChart.bounds[1];
        const sw = firstChart.bounds[2];
        if (nw && ne && sw) {
          const centerLon = (nw[0] + ne[0]) / 2;
          const centerLat = (nw[1] + sw[1]) / 2;
          map.current.flyTo({ center: [centerLon, centerLat], zoom: 12, duration: 1500 });
        }
      }
    }
  };

  return (
    <div className="section accordion">
      <div className="accordion-header" onClick={onToggle}>
        <span>차트 오버레이</span>
        <span className="chart-airport-badge">{selectedAirport}</span>
        <span className={`accordion-icon ${expanded ? 'expanded' : ''}`}>▼</span>
      </div>
      <div className={`toggle-group accordion-content ${!expanded ? 'collapsed' : ''}`}>
        {/* Airport Selector */}
        <div className="airport-selector">
          <select
            value={selectedAirport}
            onChange={handleAirportChange}
            className="airport-select"
          >
            {availableAirports.map(icao => (
              <option key={icao} value={icao}>
                {AIRPORT_INFO[icao] || icao} ({Object.keys(allChartBounds?.[icao] || {}).length})
              </option>
            ))}
          </select>
        </div>

        {/* Charts by Type */}
        {sortedTypes.map(type => (
          <div className="runway-group" key={type}>
            <div className="runway-label">{CHART_TYPE_LABELS[type] || type}</div>
            {chartsByType[type]?.map(([chartId, chartData]) => (
              <div key={chartId} className="chart-control-item">
                <div
                  className={`toggle-item ${activeCharts[chartId] ? 'active' : ''}`}
                  onClick={() => toggleChart(chartId)}
                >
                  <input
                    type="checkbox"
                    className="toggle-checkbox"
                    checked={activeCharts[chartId] || false}
                    readOnly
                  />
                  <span className="toggle-label">{chartData.displayName || chartData.name || chartId}</span>
                </div>
                {activeCharts[chartId] && (
                  <div className="opacity-control">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={chartOpacities[chartId] || 0.7}
                      onChange={(e) => updateChartOpacity(chartId, parseFloat(e.target.value))}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="opacity-value">
                      {Math.round((chartOpacities[chartId] || 0.7) * 100)}%
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}

        {/* Show message if no charts */}
        {sortedTypes.length === 0 && (
          <div className="no-charts-message">
            {availableAirports.length === 0 ? '차트 데이터 로딩 중...' : '선택된 공항에 차트가 없습니다'}
          </div>
        )}
      </div>
    </div>
  );
};

export default {
  SidPanel,
  StarPanel,
  ApproachPanel,
  ChartOverlayPanel
};

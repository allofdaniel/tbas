/**
 * ProcedurePanel Component
 * SID/STAR/APPROACH 절차 패널 컴포넌트
 */
import React from 'react';

/**
 * Procedure Toggle Item
 */
const ProcedureItem = ({ procedureKey, procedure, visible, onToggle, color }) => (
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
const RunwayGroup = ({ label, procedures, visible, onToggle, colors }) => (
  <div className="runway-group">
    <div className="runway-label">{label}</div>
    {procedures.map(([key, proc]) => (
      <ProcedureItem
        key={key}
        procedureKey={key}
        procedure={proc}
        visible={visible[key]}
        onToggle={(k) => onToggle(prev => ({ ...prev, [k]: !prev[k] }))}
        color={colors[key]}
      />
    ))}
  </div>
);

/**
 * SID Panel Component
 */
export const SidPanel = ({
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
export const StarPanel = ({
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
export const ApproachPanel = ({
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

/**
 * Chart Overlay Panel Component
 */
export const ChartOverlayPanel = ({
  chartsByRunway,
  expanded,
  onToggle,
  activeCharts,
  toggleChart,
  chartOpacities,
  updateChartOpacity
}) => {
  return (
    <div className="section accordion">
      <div className="accordion-header" onClick={onToggle}>
        <span>차트 오버레이</span>
        <span className={`accordion-icon ${expanded ? 'expanded' : ''}`}>▼</span>
      </div>
      <div className={`toggle-group accordion-content ${!expanded ? 'collapsed' : ''}`}>
        {['18', '36'].map(rwy => (
          <div className="runway-group" key={rwy}>
            <div className="runway-label">RWY {rwy}</div>
            {chartsByRunway[rwy]?.map(([chartId, chart]) => (
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
                  <span className="toggle-label">{chart.name}</span>
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

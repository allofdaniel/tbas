/**
 * AtcPanel Component
 * 관제구역 드롭다운 패널
 */
import React from 'react';

/**
 * Radar View Controls
 */
const RadarViewControls = ({
  atcOnlyMode,
  setAtcOnlyMode,
  radarRange,
  setRadarRange,
  radarBlackBackground,
  setRadarBlackBackground,
  setIsDarkMode,
  setShowSatellite,
  map
}) => (
  <div className="atc-dropdown-batch" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px', marginBottom: '8px' }}>
    <button
      className={`atc-mini-btn ${atcOnlyMode ? 'active' : ''}`}
      style={{ width: '100%', background: atcOnlyMode ? '#00FF00' : 'rgba(0,255,0,0.2)', color: atcOnlyMode ? '#000' : '#00FF00' }}
      onClick={() => {
        setAtcOnlyMode(!atcOnlyMode);
        if (!atcOnlyMode) {
          setIsDarkMode(true);
          setShowSatellite(false);
          if (map?.current) {
            map.current.flyTo({ center: [129.3517, 35.5935], zoom: 5, pitch: 0, bearing: 0, duration: 1000 });
          }
        }
      }}
    >
      📡 레이더 뷰 ({radarRange}nm)
    </button>
    {atcOnlyMode && (
      <div style={{ marginTop: '8px', padding: '4px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#00FF00', marginBottom: '4px' }}>
          <span>범위:</span>
          <span>{radarRange}nm</span>
        </div>
        <input
          type="range"
          min="50"
          max="500"
          step="50"
          value={radarRange}
          onChange={(e) => setRadarRange(parseInt(e.target.value))}
          style={{ width: '100%', accentColor: '#00FF00' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#888', marginTop: '2px' }}>
          <span>50</span>
          <span>150</span>
          <span>300</span>
          <span>500</span>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', fontSize: '11px', color: '#00FF00', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={radarBlackBackground}
            onChange={(e) => setRadarBlackBackground(e.target.checked)}
            style={{ accentColor: '#00FF00' }}
          />
          검은 배경
        </label>
      </div>
    )}
  </div>
);

/**
 * Batch Selection Buttons
 */
const BatchSelectionButtons = ({ atcData, selectedAtcSectors, setSelectedAtcSectors }) => {
  const toggleAll = (sectors) => {
    const ids = sectors.map(s => s.id);
    const allSelected = ids.every(id => selectedAtcSectors.has(id));
    setSelectedAtcSectors(prev => {
      const newSet = new Set(prev);
      ids.forEach(id => allSelected ? newSet.delete(id) : newSet.add(id));
      return newSet;
    });
  };

  return (
    <div className="atc-dropdown-batch">
      <button
        className={`atc-mini-btn ${atcData.ACC.every(s => selectedAtcSectors.has(s.id)) ? 'active' : ''}`}
        onClick={() => toggleAll(atcData.ACC)}
      >
        ACC ({atcData.ACC.length})
      </button>
      <button
        className={`atc-mini-btn ${atcData.TMA.every(s => selectedAtcSectors.has(s.id)) ? 'active' : ''}`}
        onClick={() => toggleAll(atcData.TMA)}
      >
        TMA ({atcData.TMA.length})
      </button>
      <button
        className={`atc-mini-btn ${atcData.CTR.every(s => selectedAtcSectors.has(s.id)) ? 'active' : ''}`}
        onClick={() => toggleAll(atcData.CTR)}
      >
        CTR ({atcData.CTR.length})
      </button>
    </div>
  );
};

/**
 * Sector Section Component
 */
const SectorSection = ({
  type,
  sectors,
  expanded,
  onToggle,
  selectedAtcSectors,
  setSelectedAtcSectors,
  nameProcessor
}) => (
  <div className="atc-dropdown-section">
    <div className="atc-section-label" onClick={onToggle}>
      {type} <span className={`atc-expand-icon ${expanded ? 'expanded' : ''}`}>▼</span>
    </div>
    {expanded && (
      <div className="atc-grid">
        {sectors.map(s => (
          <label
            key={s.id}
            className={`atc-chip ${selectedAtcSectors.has(s.id) ? 'selected' : ''}`}
            title={`${s.name}\n${s.vertical_limits || ''}`}
          >
            <input
              type="checkbox"
              checked={selectedAtcSectors.has(s.id)}
              onChange={e => {
                setSelectedAtcSectors(prev => {
                  const newSet = new Set(prev);
                  e.target.checked ? newSet.add(s.id) : newSet.delete(s.id);
                  return newSet;
                });
              }}
            />
            <span className="atc-chip-color" style={{ background: s.color }}></span>
            <span className="atc-chip-name">{nameProcessor(s.name)}</span>
          </label>
        ))}
      </div>
    )}
  </div>
);

/**
 * ATC Panel Component
 */
const AtcPanel = ({
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
  setIsDarkMode,
  setShowSatellite,
  map
}) => {
  return (
    <div className="atc-dropdown-wrapper">
      <button
        className={`view-btn ${showAtcPanel || atcOnlyMode ? 'active' : ''}`}
        onClick={() => setShowAtcPanel(!showAtcPanel)}
        title="관제구역"
      >
        관제
      </button>
      {showAtcPanel && atcData && (
        <div className="atc-dropdown">
          <div className="atc-dropdown-header">
            <span className="atc-dropdown-title">{atcData.FIR.name}</span>
            <button className="atc-clear-btn" onClick={() => setSelectedAtcSectors(new Set())}>
              초기화
            </button>
          </div>

          <RadarViewControls
            atcOnlyMode={atcOnlyMode}
            setAtcOnlyMode={setAtcOnlyMode}
            radarRange={radarRange}
            setRadarRange={setRadarRange}
            radarBlackBackground={radarBlackBackground}
            setRadarBlackBackground={setRadarBlackBackground}
            setIsDarkMode={setIsDarkMode}
            setShowSatellite={setShowSatellite}
            map={map}
          />

          <BatchSelectionButtons
            atcData={atcData}
            selectedAtcSectors={selectedAtcSectors}
            setSelectedAtcSectors={setSelectedAtcSectors}
          />

          <div className="atc-dropdown-sections">
            <SectorSection
              type="ACC"
              sectors={atcData.ACC}
              expanded={atcExpanded.ACC}
              onToggle={() => setAtcExpanded(p => ({ ...p, ACC: !p.ACC }))}
              selectedAtcSectors={selectedAtcSectors}
              setSelectedAtcSectors={setSelectedAtcSectors}
              nameProcessor={(name) => name.replace(/Daegu ACC - |Incheon ACC - /g, '')}
            />
            <SectorSection
              type="TMA"
              sectors={atcData.TMA}
              expanded={atcExpanded.TMA}
              onToggle={() => setAtcExpanded(p => ({ ...p, TMA: !p.TMA }))}
              selectedAtcSectors={selectedAtcSectors}
              setSelectedAtcSectors={setSelectedAtcSectors}
              nameProcessor={(name) => name.replace(/ - .* TMA| TMA/g, '')}
            />
            <SectorSection
              type="CTR"
              sectors={atcData.CTR}
              expanded={atcExpanded.CTR}
              onToggle={() => setAtcExpanded(p => ({ ...p, CTR: !p.CTR }))}
              selectedAtcSectors={selectedAtcSectors}
              setSelectedAtcSectors={setSelectedAtcSectors}
              nameProcessor={(name) => name.replace(/ CTR/g, '')}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AtcPanel;

/**
 * AircraftControlPanel Component
 * 실시간 항공기 제어 패널
 */
import React from 'react';
import { TRAIL_DURATION_OPTIONS } from '../constants/config';

interface LabelOffset {
  x: number;
  y: number;
}

interface LabelPositionPadProps {
  labelOffset: LabelOffset;
  setLabelOffset: (offset: LabelOffset) => void;
  isDraggingLabel: boolean;
  setIsDraggingLabel: (dragging: boolean) => void;
}

interface AircraftControlPanelProps {
  // Accordion state
  aircraftExpanded: boolean;
  setAircraftExpanded: (expanded: boolean) => void;
  // Aircraft display toggles
  showAircraft: boolean;
  setShowAircraft: (show: boolean) => void;
  showAircraftTrails: boolean;
  setShowAircraftTrails: (show: boolean) => void;
  show3DAircraft: boolean;
  setShow3DAircraft: (show: boolean) => void;
  is3DView: boolean;
  // Trail settings
  trailDuration: number;
  setTrailDuration: (duration: number) => void;
  headingPrediction: number;
  setHeadingPrediction: (prediction: number) => void;
  // Label position
  labelOffset: LabelOffset;
  setLabelOffset: (offset: LabelOffset) => void;
  isDraggingLabel: boolean;
  setIsDraggingLabel: (dragging: boolean) => void;
}

/**
 * Label Position Pad
 * 라벨 위치 조절 패드
 */
const LabelPositionPad: React.FC<LabelPositionPadProps> = ({
  labelOffset,
  setLabelOffset,
  isDraggingLabel,
  setIsDraggingLabel
}) => (
  <div className="trail-duration-select" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
    <span className="trail-duration-label" style={{ marginBottom: '4px' }}>라벨 위치 (드래그):</span>
    <div
      className="label-position-pad"
      style={{
        width: '60px', height: '60px', background: 'rgba(0,0,0,0.5)',
        border: '1px solid rgba(0,255,136,0.5)', borderRadius: '4px',
        position: 'relative', cursor: 'crosshair'
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        setIsDraggingLabel(true);
      }}
      onMouseMove={(e) => {
        if (!isDraggingLabel) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width - 0.5) * 4; // -2 ~ 2 범위
        const y = ((e.clientY - rect.top) / rect.height - 0.5) * 4;
        setLabelOffset({ x: Math.max(-2, Math.min(2, x)), y: Math.max(-2, Math.min(2, y)) });
      }}
      onMouseUp={() => setIsDraggingLabel(false)}
      onMouseLeave={() => setIsDraggingLabel(false)}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 중심 + 표시 */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'rgba(0,255,136,0.3)', fontSize: '20px' }}>✈</div>
      {/* 현재 라벨 위치 표시 */}
      <div style={{
        position: 'absolute',
        left: `${50 + labelOffset.x * 12.5}%`,
        top: `${50 + labelOffset.y * 12.5}%`,
        transform: 'translate(-50%, -50%)',
        width: '8px', height: '8px',
        background: '#00ff88', borderRadius: '50%',
        boxShadow: '0 0 4px #00ff88'
      }}></div>
    </div>
    <span style={{ fontSize: '9px', color: '#888', marginTop: '2px' }}>
      X:{labelOffset.x.toFixed(1)} Y:{labelOffset.y.toFixed(1)}
    </span>
  </div>
);

/**
 * Aircraft Control Panel Component
 */
const AircraftControlPanel: React.FC<AircraftControlPanelProps> = ({
  // Accordion state
  aircraftExpanded,
  setAircraftExpanded,
  // Aircraft display toggles
  showAircraft,
  setShowAircraft,
  showAircraftTrails,
  setShowAircraftTrails,
  show3DAircraft,
  setShow3DAircraft,
  is3DView,
  // Trail settings
  trailDuration,
  setTrailDuration,
  headingPrediction,
  setHeadingPrediction,
  // Label position
  labelOffset,
  setLabelOffset,
  isDraggingLabel,
  setIsDraggingLabel
}) => {
  return (
    <div className="section accordion">
      <div className="accordion-header" onClick={() => setAircraftExpanded(!aircraftExpanded)}>
        <span>실시간 항공기</span>
        <span className={`accordion-icon ${aircraftExpanded ? 'expanded' : ''}`}>▼</span>
      </div>
      <div className={`toggle-group accordion-content ${!aircraftExpanded ? 'collapsed' : ''}`}>
        <div className={`toggle-item ${showAircraft ? 'active' : ''}`} onClick={() => setShowAircraft(!showAircraft)}>
          <input type="checkbox" className="toggle-checkbox" checked={showAircraft} readOnly />
          <span className="toggle-label">항공기 표시</span>
        </div>
        <div className={`toggle-item ${showAircraftTrails ? 'active' : ''}`} onClick={() => setShowAircraftTrails(!showAircraftTrails)}>
          <input type="checkbox" className="toggle-checkbox" checked={showAircraftTrails} readOnly />
          <span className="toggle-label">항적 표시</span>
        </div>

        {showAircraftTrails && (
          <>
            <div className="trail-duration-select">
              <span className="trail-duration-label">히스토리 길이:</span>
              <select
                value={trailDuration}
                onChange={(e) => setTrailDuration(Number(e.target.value))}
                onClick={(e) => e.stopPropagation()}
              >
                {TRAIL_DURATION_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="trail-duration-select">
              <span className="trail-duration-label">헤딩 예측:</span>
              <select
                value={headingPrediction}
                onChange={(e) => setHeadingPrediction(Number(e.target.value))}
                onClick={(e) => e.stopPropagation()}
              >
                <option value={0}>없음</option>
                <option value={30}>30초</option>
                <option value={60}>1분</option>
                <option value={120}>2분</option>
                <option value={180}>3분</option>
                <option value={300}>5분</option>
              </select>
            </div>
            <LabelPositionPad
              labelOffset={labelOffset}
              setLabelOffset={setLabelOffset}
              isDraggingLabel={isDraggingLabel}
              setIsDraggingLabel={setIsDraggingLabel}
            />
          </>
        )}

        {is3DView && (
          <div className={`toggle-item ${show3DAircraft ? 'active' : ''}`} onClick={() => setShow3DAircraft(!show3DAircraft)}>
            <input type="checkbox" className="toggle-checkbox" checked={show3DAircraft} readOnly />
            <span className="toggle-label">3D 항공기 (GLB)</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default AircraftControlPanel;

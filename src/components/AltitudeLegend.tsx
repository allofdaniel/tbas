/**
 * AltitudeLegend Component
 * 고도 범례 표시 컴포넌트
 */
import React from 'react';

const AltitudeLegend: React.FC = () => {
  return (
    <div className="section">
      <div className="section-title">고도 범례</div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '8px'
      }}>
        <span style={{ fontSize: '11px', color: '#9aa0a6' }}>0ft</span>
        <div style={{
          flex: 1,
          height: '12px',
          borderRadius: '6px',
          background: 'linear-gradient(to right, rgb(0,255,50), rgb(255,255,50), rgb(255,0,50))'
        }} />
        <span style={{ fontSize: '11px', color: '#9aa0a6' }}>8000ft</span>
      </div>
    </div>
  );
};

export default AltitudeLegend;

/**
 * Accordion Component
 * 접기/펼치기 가능한 섹션 컴포넌트
 */
import React from 'react';

const Accordion = ({ title, expanded, onToggle, badge, children, className = '' }) => {
  return (
    <div className={`section accordion ${className}`}>
      <div className="accordion-header" onClick={onToggle}>
        <span>{title}</span>
        {badge !== undefined && <span className="badge">{badge}</span>}
        <span className={`accordion-icon ${expanded ? 'expanded' : ''}`}>▼</span>
      </div>
      <div className={`toggle-group accordion-content ${!expanded ? 'collapsed' : ''}`}>
        {children}
      </div>
    </div>
  );
};

export default Accordion;

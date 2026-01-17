/**
 * Accordion Component
 * 접기/펼치기 가능한 섹션 컴포넌트
 */
import React, { type ReactNode } from 'react';

interface AccordionProps {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  badge?: number | string;
  children: ReactNode;
  className?: string;
}

const Accordion: React.FC<AccordionProps> = ({
  title,
  expanded,
  onToggle,
  badge,
  children,
  className = ''
}) => {
  return (
    <div className={`section accordion ${className}`}>
      <div className="accordion-header" onClick={onToggle}>
        <span>{title}</span>
        {badge != null && badge !== '' && <span className="badge">{badge}</span>}
        <span className={`accordion-icon ${expanded ? 'expanded' : ''}`}>▼</span>
      </div>
      <div className={`toggle-group accordion-content ${!expanded ? 'collapsed' : ''}`}>
        {children}
      </div>
    </div>
  );
};

export default Accordion;

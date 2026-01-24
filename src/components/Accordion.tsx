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

const Accordion: React.FC<AccordionProps> = React.memo(({
  title,
  expanded,
  onToggle,
  badge,
  children,
  className = ''
}) => {
  const headerId = React.useId();
  const contentId = React.useId();

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle();
    }
  }, [onToggle]);

  return (
    <div className={`section accordion ${className}`}>
      <div
        id={headerId}
        className="accordion-header"
        onClick={onToggle}
        onKeyDown={handleKeyDown}
        role="button"
        aria-expanded={expanded}
        aria-controls={contentId}
        tabIndex={0}
      >
        <span>{title}</span>
        {Boolean(badge) && <span className="badge">{badge}</span>}
        <span className={`accordion-icon ${expanded ? 'expanded' : ''}`} aria-hidden="true">▼</span>
      </div>
      <div
        id={contentId}
        className={`toggle-group accordion-content ${!expanded ? 'collapsed' : ''}`}
        role="region"
        aria-labelledby={headerId}
        hidden={!expanded}
      >
        {children}
      </div>
    </div>
  );
});

Accordion.displayName = 'Accordion';

export default Accordion;

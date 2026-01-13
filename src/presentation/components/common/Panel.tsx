/**
 * Panel Component
 * DO-278A 요구사항 추적: SRS-UI-001
 *
 * 재사용 가능한 패널 컴포넌트
 */

import React from 'react';

export interface PanelProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClose?: () => void;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  headerActions?: React.ReactNode;
}

export function Panel({
  title,
  children,
  className = '',
  style,
  onClose,
  collapsible = false,
  defaultCollapsed = false,
  headerActions,
}: PanelProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed);

  const baseStyle: React.CSSProperties = {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: '#fff',
    overflow: 'hidden',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
    ...style,
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: isCollapsed ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
    cursor: collapsible ? 'pointer' : 'default',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 600,
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  const actionsStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  const contentStyle: React.CSSProperties = {
    padding: '12px 16px',
    display: isCollapsed ? 'none' : 'block',
  };

  const handleHeaderClick = () => {
    if (collapsible) {
      setIsCollapsed(!isCollapsed);
    }
  };

  return (
    <div className={className} style={baseStyle}>
      {title && (
        <div style={headerStyle} onClick={handleHeaderClick}>
          <h3 style={titleStyle}>
            {collapsible && (
              <span style={{ fontSize: '10px', transition: 'transform 0.2s' }}>
                {isCollapsed ? '▶' : '▼'}
              </span>
            )}
            {title}
          </h3>
          <div style={actionsStyle}>
            {headerActions}
            {onClose && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.6)',
                  cursor: 'pointer',
                  fontSize: '16px',
                  padding: '4px',
                  lineHeight: 1,
                }}
                aria-label="Close"
              >
                ×
              </button>
            )}
          </div>
        </div>
      )}
      <div style={contentStyle}>{children}</div>
    </div>
  );
}

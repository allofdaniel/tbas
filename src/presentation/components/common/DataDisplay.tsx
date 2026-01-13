/**
 * Data Display Components
 * DO-278A 요구사항 추적: SRS-UI-006
 *
 * 데이터 표시용 컴포넌트
 */

import React from 'react';

/**
 * Key-Value 표시 컴포넌트
 */
export interface KeyValueProps {
  label: string;
  value: React.ReactNode;
  unit?: string;
  labelWidth?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

export function KeyValue({
  label,
  value,
  unit,
  labelWidth = '80px',
  className = '',
  style,
}: KeyValueProps) {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    fontSize: '12px',
    padding: '4px 0',
    ...style,
  };

  const labelStyle: React.CSSProperties = {
    width: typeof labelWidth === 'number' ? `${labelWidth}px` : labelWidth,
    color: 'rgba(255, 255, 255, 0.6)',
    flexShrink: 0,
  };

  const valueStyle: React.CSSProperties = {
    color: '#fff',
    fontWeight: 500,
  };

  const unitStyle: React.CSSProperties = {
    color: 'rgba(255, 255, 255, 0.5)',
    marginLeft: '4px',
    fontSize: '11px',
  };

  return (
    <div className={className} style={containerStyle}>
      <span style={labelStyle}>{label}</span>
      <span style={valueStyle}>
        {value}
        {unit && <span style={unitStyle}>{unit}</span>}
      </span>
    </div>
  );
}

/**
 * 데이터 그리드 컴포넌트
 */
export interface DataGridProps {
  items: Array<{
    label: string;
    value: React.ReactNode;
    unit?: string;
  }>;
  columns?: 1 | 2 | 3;
  className?: string;
  style?: React.CSSProperties;
}

export function DataGrid({ items, columns = 2, className = '', style }: DataGridProps) {
  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${columns}, 1fr)`,
    gap: '8px',
    ...style,
  };

  return (
    <div className={className} style={gridStyle}>
      {items.map((item, index) => (
        <KeyValue key={index} label={item.label} value={item.value} unit={item.unit} />
      ))}
    </div>
  );
}

/**
 * 구분선 컴포넌트
 */
export interface DividerProps {
  margin?: number;
  color?: string;
}

export function Divider({ margin = 12, color = 'rgba(255, 255, 255, 0.1)' }: DividerProps) {
  return (
    <div
      style={{
        height: '1px',
        backgroundColor: color,
        margin: `${margin}px 0`,
      }}
    />
  );
}

/**
 * 섹션 헤더 컴포넌트
 */
export interface SectionHeaderProps {
  title: string;
  action?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function SectionHeader({ title, action, className = '', style }: SectionHeaderProps) {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px',
    ...style,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.8)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };

  return (
    <div className={className} style={containerStyle}>
      <span style={titleStyle}>{title}</span>
      {action}
    </div>
  );
}

/**
 * Empty State 컴포넌트
 */
export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 16px',
    textAlign: 'center',
  };

  const iconStyle: React.CSSProperties = {
    fontSize: '32px',
    color: 'rgba(255, 255, 255, 0.3)',
    marginBottom: '12px',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 500,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: '4px',
  };

  const descriptionStyle: React.CSSProperties = {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: '16px',
  };

  return (
    <div style={containerStyle}>
      {icon && <div style={iconStyle}>{icon}</div>}
      <div style={titleStyle}>{title}</div>
      {description && <div style={descriptionStyle}>{description}</div>}
      {action}
    </div>
  );
}

/**
 * 값 변화 표시 컴포넌트
 */
export interface ValueChangeProps {
  value: number;
  format?: (value: number) => string;
  positiveColor?: string;
  negativeColor?: string;
  neutralColor?: string;
}

export function ValueChange({
  value,
  format = (v) => `${v > 0 ? '+' : ''}${v}`,
  positiveColor = '#4CAF50',
  negativeColor = '#F44336',
  neutralColor = 'rgba(255, 255, 255, 0.5)',
}: ValueChangeProps) {
  const color = value > 0 ? positiveColor : value < 0 ? negativeColor : neutralColor;
  const arrow = value > 0 ? '↑' : value < 0 ? '↓' : '→';

  return (
    <span style={{ color, fontWeight: 500 }}>
      {arrow} {format(Math.abs(value))}
    </span>
  );
}

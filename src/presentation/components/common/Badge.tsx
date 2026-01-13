/**
 * Badge Component
 * DO-278A 요구사항 추적: SRS-UI-003
 *
 * 상태 표시용 배지 컴포넌트
 */

import React from 'react';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';
export type BadgeSize = 'small' | 'medium';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  pulsing?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const variantStyles: Record<BadgeVariant, React.CSSProperties> = {
  default: {
    backgroundColor: 'rgba(158, 158, 158, 0.3)',
    color: '#fff',
  },
  success: {
    backgroundColor: 'rgba(76, 175, 80, 0.3)',
    color: '#4CAF50',
  },
  warning: {
    backgroundColor: 'rgba(255, 152, 0, 0.3)',
    color: '#FF9800',
  },
  danger: {
    backgroundColor: 'rgba(244, 67, 54, 0.3)',
    color: '#F44336',
  },
  info: {
    backgroundColor: 'rgba(33, 150, 243, 0.3)',
    color: '#2196F3',
  },
};

const sizeStyles: Record<BadgeSize, React.CSSProperties> = {
  small: {
    padding: '2px 6px',
    fontSize: '10px',
    borderRadius: '4px',
  },
  medium: {
    padding: '4px 8px',
    fontSize: '12px',
    borderRadius: '6px',
  },
};

export function Badge({
  children,
  variant = 'default',
  size = 'medium',
  pulsing = false,
  className = '',
  style,
}: BadgeProps) {
  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 600,
    ...variantStyles[variant],
    ...sizeStyles[size],
    ...(pulsing
      ? {
          animation: 'pulse 2s ease-in-out infinite',
        }
      : {}),
    ...style,
  };

  return (
    <span className={className} style={baseStyle}>
      {children}
    </span>
  );
}

/**
 * Flight Category Badge
 */
export type FlightCategory = 'VFR' | 'MVFR' | 'IFR' | 'LIFR';

export interface FlightCategoryBadgeProps {
  category: FlightCategory;
  size?: BadgeSize;
}

const categoryVariants: Record<FlightCategory, BadgeVariant> = {
  VFR: 'success',
  MVFR: 'info',
  IFR: 'warning',
  LIFR: 'danger',
};

export function FlightCategoryBadge({ category, size = 'medium' }: FlightCategoryBadgeProps) {
  return (
    <Badge variant={categoryVariants[category]} size={size}>
      {category}
    </Badge>
  );
}

/**
 * Weather Risk Badge
 */
export type WeatherRiskLevel = 'low' | 'moderate' | 'high' | 'severe';

export interface WeatherRiskBadgeProps {
  level: WeatherRiskLevel;
  size?: BadgeSize;
}

const riskVariants: Record<WeatherRiskLevel, BadgeVariant> = {
  low: 'success',
  moderate: 'warning',
  high: 'danger',
  severe: 'danger',
};

const riskLabels: Record<WeatherRiskLevel, string> = {
  low: 'Low Risk',
  moderate: 'Moderate',
  high: 'High Risk',
  severe: 'Severe',
};

export function WeatherRiskBadge({ level, size = 'medium' }: WeatherRiskBadgeProps) {
  return (
    <Badge variant={riskVariants[level]} size={size} pulsing={level === 'severe'}>
      {riskLabels[level]}
    </Badge>
  );
}

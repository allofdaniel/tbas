/**
 * Loading Component
 * DO-278A 요구사항 추적: SRS-UI-004
 *
 * 로딩 상태 표시 컴포넌트
 */

import React from 'react';

export type LoadingSize = 'small' | 'medium' | 'large';

export interface LoadingProps {
  size?: LoadingSize;
  color?: string;
  text?: string;
  fullscreen?: boolean;
  overlay?: boolean;
}

const sizeValues: Record<LoadingSize, { spinner: number; text: number }> = {
  small: { spinner: 16, text: 11 },
  medium: { spinner: 32, text: 12 },
  large: { spinner: 48, text: 14 },
};

export function Loading({
  size = 'medium',
  color = '#2196F3',
  text,
  fullscreen = false,
  overlay = false,
}: LoadingProps) {
  const { spinner: spinnerSize, text: textSize } = sizeValues[size];

  const containerStyle: React.CSSProperties = fullscreen
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: overlay ? 'rgba(0, 0, 0, 0.7)' : 'transparent',
        zIndex: 9999,
      }
    : {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      };

  const spinnerStyle: React.CSSProperties = {
    width: `${spinnerSize}px`,
    height: `${spinnerSize}px`,
    border: `3px solid rgba(255, 255, 255, 0.1)`,
    borderTopColor: color,
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  };

  const textStyle: React.CSSProperties = {
    marginTop: '12px',
    fontSize: `${textSize}px`,
    color: 'rgba(255, 255, 255, 0.7)',
  };

  return (
    <div style={containerStyle}>
      <div style={spinnerStyle} />
      {text && <div style={textStyle}>{text}</div>}
    </div>
  );
}

/**
 * Skeleton Loading
 */
export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = 4,
  className = '',
  style,
}: SkeletonProps) {
  const baseStyle: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    borderRadius: typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    animation: 'shimmer 1.5s ease-in-out infinite',
    ...style,
  };

  return <div className={className} style={baseStyle} />;
}

/**
 * Loading Dots
 */
export function LoadingDots({ color = '#2196F3' }: { color?: string }) {
  const dotStyle: React.CSSProperties = {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: color,
    display: 'inline-block',
    margin: '0 2px',
  };

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      <span style={{ ...dotStyle, animation: 'bounce 1s ease-in-out 0s infinite' }} />
      <span style={{ ...dotStyle, animation: 'bounce 1s ease-in-out 0.2s infinite' }} />
      <span style={{ ...dotStyle, animation: 'bounce 1s ease-in-out 0.4s infinite' }} />
    </span>
  );
}

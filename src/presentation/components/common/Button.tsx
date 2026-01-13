/**
 * Button Component
 * DO-278A 요구사항 추적: SRS-UI-002
 *
 * 재사용 가능한 버튼 컴포넌트
 */

import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'small' | 'medium' | 'large';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  active?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    backgroundColor: 'rgba(33, 150, 243, 0.8)',
    border: '1px solid #2196F3',
    color: '#fff',
  },
  secondary: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    color: '#fff',
  },
  danger: {
    backgroundColor: 'rgba(244, 67, 54, 0.8)',
    border: '1px solid #F44336',
    color: '#fff',
  },
  ghost: {
    backgroundColor: 'transparent',
    border: '1px solid transparent',
    color: 'rgba(255, 255, 255, 0.8)',
  },
};

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  small: {
    padding: '4px 8px',
    fontSize: '11px',
    borderRadius: '4px',
  },
  medium: {
    padding: '8px 16px',
    fontSize: '12px',
    borderRadius: '8px',
  },
  large: {
    padding: '12px 24px',
    fontSize: '14px',
    borderRadius: '8px',
  },
};

export function Button({
  variant = 'secondary',
  size = 'medium',
  active = false,
  loading = false,
  icon,
  fullWidth = false,
  disabled,
  children,
  style,
  ...props
}: ButtonProps) {
  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    fontWeight: active ? 'bold' : 'normal',
    transition: 'all 0.2s ease',
    opacity: disabled || loading ? 0.5 : 1,
    width: fullWidth ? '100%' : 'auto',
    ...variantStyles[variant],
    ...sizeStyles[size],
    ...(active && variant === 'secondary'
      ? {
          backgroundColor: 'rgba(33, 150, 243, 0.8)',
          border: '1px solid #2196F3',
        }
      : {}),
    ...style,
  };

  return (
    <button style={baseStyle} disabled={disabled || loading} {...props}>
      {loading ? (
        <span
          style={{
            display: 'inline-block',
            width: '12px',
            height: '12px',
            border: '2px solid transparent',
            borderTopColor: 'currentColor',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}

/**
 * Toast Component
 * 토스트 알림 컴포넌트
 */
import React, { useState, useCallback, createContext, useContext, type ReactNode } from 'react';

type ToastType = 'info' | 'success' | 'error' | 'loading';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  duration: number | null;
  icon?: ReactNode;
}

interface ToastOptions {
  type?: ToastType;
  duration?: number | null;
  icon?: ReactNode;
}

interface ToastContextValue {
  addToast: (message: string, options?: ToastOptions) => number;
  dismissToast: (id: number) => void;
  updateToast: (id: number, updates: Partial<ToastOptions & { message?: string }>) => void;
}

interface ToastProviderProps {
  children: ReactNode;
}

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: number) => void;
}

/**
 * Toast Context for global toast notifications
 */
const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

/**
 * Toast Provider Component
 */
export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: number): void => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, options: ToastOptions = {}): number => {
    const id = Date.now() + Math.random();
    const toast: Toast = {
      id,
      message,
      type: options.type || 'info',
      duration: options.duration ?? (options.type === 'loading' ? null : 3000),
      icon: options.icon,
    };

    setToasts(prev => [...prev, toast]);

    // Auto-dismiss if duration is set
    if (toast.duration) {
      setTimeout(() => {
        dismissToast(id);
      }, toast.duration);
    }

    return id;
  }, [dismissToast]);

  const updateToast = useCallback((id: number, updates: Partial<ToastOptions & { message?: string }>): void => {
    setToasts(prev => prev.map(t =>
      t.id === id ? { ...t, ...updates } as Toast : t
    ));

    // If updating to non-loading, auto-dismiss after duration
    if (updates.type && updates.type !== 'loading') {
      const duration = updates.duration ?? 2000;
      setTimeout(() => {
        dismissToast(id);
      }, duration);
    }
  }, [dismissToast]);

  return (
    <ToastContext.Provider value={{ addToast, dismissToast, updateToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
};

/**
 * Toast Container - renders all toasts
 */
const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

/**
 * Individual Toast Item
 */
const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  const [isExiting, setIsExiting] = useState(false);

  const handleDismiss = (): void => {
    setIsExiting(true);
    setTimeout(() => onDismiss(toast.id), 200);
  };

  const getIcon = (): ReactNode => {
    if (toast.icon) return toast.icon;
    switch (toast.type) {
      case 'loading':
        return <span className="toast-spinner" />;
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      default:
        return 'ℹ';
    }
  };

  return (
    <div
      className={`toast-item toast-${toast.type} ${isExiting ? 'toast-exit' : ''}`}
      onClick={toast.type !== 'loading' ? handleDismiss : undefined}
    >
      <span className="toast-icon">{getIcon()}</span>
      <span className="toast-message">{toast.message}</span>
    </div>
  );
};

export default ToastProvider;

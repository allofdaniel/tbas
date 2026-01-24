/**
 * ToggleItem Component
 * 토글 가능한 항목 컴포넌트
 */
import React from 'react';

interface ToggleItemProps {
  label: string;
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  hint?: string;
  count?: number;
}

const ToggleItem: React.FC<ToggleItemProps> = React.memo(({
  label,
  checked,
  onChange,
  disabled = false,
  hint,
  count
}) => {
  const handleClick = React.useCallback((): void => {
    if (!disabled && onChange) {
      onChange(!checked);
    }
  }, [disabled, onChange, checked]);

  return (
    <div
      className={`toggle-item ${checked && !disabled ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
      onClick={handleClick}
      role="checkbox"
      aria-checked={checked && !disabled}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <input
        type="checkbox"
        className="toggle-checkbox"
        checked={checked && !disabled}
        readOnly
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
      />
      <span className="toggle-label">
        {label}
        {hint && <span className="hint">{hint}</span>}
      </span>
      {count !== undefined && <span className="toggle-count">{count}</span>}
    </div>
  );
});

ToggleItem.displayName = 'ToggleItem';

export default ToggleItem;

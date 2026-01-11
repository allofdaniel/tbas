/**
 * ToggleItem Component
 * 토글 가능한 항목 컴포넌트
 */
import React from 'react';

const ToggleItem = ({
  label,
  checked,
  onChange,
  disabled = false,
  hint,
  count
}) => {
  const handleClick = () => {
    if (!disabled && onChange) {
      onChange(!checked);
    }
  };

  return (
    <div
      className={`toggle-item ${checked && !disabled ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
      onClick={handleClick}
    >
      <input
        type="checkbox"
        className="toggle-checkbox"
        checked={checked && !disabled}
        readOnly
        disabled={disabled}
      />
      <span className="toggle-label">
        {label}
        {hint && <span className="hint">{hint}</span>}
      </span>
      {count !== undefined && <span className="toggle-count">{count}</span>}
    </div>
  );
};

export default ToggleItem;

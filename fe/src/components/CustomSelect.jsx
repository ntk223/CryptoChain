import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { shortenKey } from '../utils/wallet';

export default function CustomSelect({ options = [], value, onChange, placeholder = 'Chọn...' }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="custom-select-container" ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
      {/* Trigger Button — reuses form-input class for border/bg/radius */}
      <div
        className="form-input"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          padding: '10px 14px',
          userSelect: 'none',
          borderColor: isOpen ? 'var(--accent)' : 'var(--border)',
          boxShadow: isOpen ? '0 0 0 2px rgba(99,130,255,0.2)' : 'none',
        }}
      >
        {selectedOption ? (
          <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              {selectedOption.name} {selectedOption.balance !== undefined && `(${selectedOption.balance} BTC)`}
            </span>
            {selectedOption.publicKey && (
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>
                {shortenKey(selectedOption.publicKey, 12)}
              </span>
            )}
          </div>
        ) : (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{placeholder}</span>
        )}
        <ChevronDown
          size={18}
          color="var(--accent)"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.3s ease',
            flexShrink: 0,
          }}
        />
      </div>

      {/* Options Dropdown Menu */}
      {isOpen && (
        <div
          className="custom-select-dropdown"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            zIndex: 1100,
            background: 'var(--bg-card)',          /* ✅ respects light/dark theme */
            backdropFilter: 'blur(12px)',
            border: '1px solid var(--border)',      /* ✅ respects light/dark theme */
            borderRadius: 'var(--radius-sm)',
            boxShadow: 'var(--shadow)',             /* ✅ respects light/dark theme */
            maxHeight: '260px',
            overflowY: 'auto',
            animation: 'selectFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            display: 'flex',
            flexDirection: 'column',
            padding: '4px',
            gap: '2px',
          }}
        >
          {options.length === 0 ? (
            <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Không có lựa chọn nào
            </div>
          ) : (
            options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <div
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    borderRadius: 'calc(var(--radius-sm) - 2px)',
                    cursor: 'pointer',
                    background: isSelected
                      ? 'rgba(99, 130, 255, 0.15)'   /* ✅ accent tint — works on both themes */
                      : 'transparent',
                    transition: 'background 0.15s ease',
                    textAlign: 'left',
                  }}
                  className="custom-select-option"
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: isSelected ? 'var(--accent)' : 'var(--text-primary)', /* ✅ theme-aware */
                    }}>
                      {opt.name} {opt.balance !== undefined && `· ${opt.balance} BTC`}
                    </span>
                    {opt.publicKey && (
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>
                        {shortenKey(opt.publicKey, 14)}
                      </span>
                    )}
                  </div>
                  {isSelected && <Check size={16} color="var(--accent)" />}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

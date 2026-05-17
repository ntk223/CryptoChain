import { useCopy } from '../hooks/useCopy';

export default function KeyBox({ label, value, icon }) {
  const { copy, copied } = useCopy();
  const id = label + value;

  return (
    <div style={{ marginBottom: '0.8rem' }}>
      <div className="key-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>{label} {icon}</div>
      <div className="key-box" style={{ paddingRight: '60px' }}>
        {value}
        <button className="copy-btn" onClick={() => copy(value, id)}>
          {copied === id ? '✓ Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

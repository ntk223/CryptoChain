import { useCopy } from '../hooks/useCopy';
import { Copy, Check } from 'lucide-react';
import { shortenKey } from '../utils/wallet';

export default function CopyableKey({ value, shortenLen = 10, style = {} }) {
  const { copy, copied } = useCopy();
  const id = value;
  const isCopied = copied === id;

  const displayVal = shortenLen ? shortenKey(value, shortenLen) : value;

  return (
    <span
      onClick={(e) => {
        e.stopPropagation(); // Ngăn sự kiện nổi bọt (bản thân thẻ ví cũng có onClick)
        copy(value, id);
      }}
      className="copyable-key-container"
      style={style}
      title="Click để sao chép đầy đủ"
    >
      <span style={{ fontSize: 'inherit', fontFamily: 'inherit', color: 'inherit' }}>{displayVal}</span>
      {isCopied ? (
        <Check size={12} color="var(--accent-green)" />
      ) : (
        <Copy size={12} className="copy-icon-hover" style={{ opacity: 0.6, flexShrink: 0 }} />
      )}
      {isCopied && (
        <span style={{ fontSize: '0.65rem', color: 'var(--accent-green)', fontWeight: 600, marginLeft: '2px', whiteSpace: 'nowrap' }}>
          Đã chép!
        </span>
      )}
    </span>
  );
}

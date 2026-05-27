import { useState, useCallback, useEffect } from 'react';
import {
  getLocalWallets, addLocalWallet, removeLocalWallet, updateLocalBalance,
  getActiveWallet, setActiveWallet, shortenKey, formatTime,
} from '../utils/wallet';
import { apiCreateWallet, apiGetWallet, apiImportWallet, apiUpdateWalletName } from '../api/client';
import KeyBox from '../components/KeyBox';
import Alert from '../components/Alert';
import CopyableKey from '../components/CopyableKey';
import { Wallet, KeyRound, CirclePlus, CircleCheckBig, RefreshCcw, EyeOff, Eye, Trash, TriangleAlert, Sparkles, Edit3, Check, X } from 'lucide-react';

export default function WalletPage() {
  const [myWallets, setMyWallets] = useState(getLocalWallets);
  const [active, setActive] = useState(getActiveWallet);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState(null);
  const [newWallet, setNewWallet] = useState(null);
  const [showPrivate, setShowPrivate] = useState({});
  const [activeTab, setActiveTab] = useState('create');
  const [importKey, setImportKey] = useState('');
  const [importName, setImportName] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [walletSearch, setWalletSearch] = useState('');

  function flash(type, text) {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 6000);
  }

  /** Lấy balance mới nhất từ server cho tất cả ví local. */
  const refreshBalances = useCallback(async () => {
    const current = getLocalWallets();
    if (current.length === 0) return;
    setRefreshing(true);
    try {
      const updated = await Promise.all(
        current.map(async (w) => {
          try {
            const { wallet } = await apiGetWallet(w.publicKey);
            return { ...w, balance: wallet.balance, name: wallet.name };
          } catch {
            return w; // Giữ nguyên nếu fetch lỗi
          }
        })
      );
      updated.forEach(w => updateLocalBalance(w.publicKey, w.balance));
      setMyWallets(updated);
      // Sync active wallet balance
      if (active) {
        const updatedActive = updated.find(w => w.publicKey === active.publicKey);
        if (updatedActive) { setActive(updatedActive); setActiveWallet(updatedActive); }
      }
    } finally {
      setRefreshing(false);
    }
  }, [active]);

  // Listen for blockchain updates in real time to update balances
  useEffect(() => {
    window.addEventListener('blockchain-update', refreshBalances);
    return () => window.removeEventListener('blockchain-update', refreshBalances);
  }, [refreshBalances]);

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return flash('error', 'Vui lòng nhập tên ví.');
    setLoading(true);
    try {
      const { wallet } = await apiCreateWallet(trimmed);
      // Lưu vào localStorage (kể cả privateKey)
      const list = addLocalWallet(wallet);
      setMyWallets(list);
      setNewWallet(wallet);
      setName('');
      flash('success', `Ví "${wallet.name}" đã được tạo! Balance khởi đầu: ${wallet.balance} BTC.`);
    } catch (err) {
      flash('error', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    const trimmedKey = importKey.trim();
    const trimmedName = importName.trim();
    if (!trimmedKey) return flash('error', 'Vui lòng nhập private key.');
    if (!trimmedName) return flash('error', 'Vui lòng nhập tên ví khi import.');
    if (!/^[0-9a-fA-F]{64}$/.test(trimmedKey)) {
      return flash('error', 'Private key không hợp lệ (phải là chuỗi hex 64 ký tự).');
    }
    setImportLoading(true);
    try {
      const { wallet } = await apiImportWallet(trimmedKey, trimmedName);
      // Lưu vào localStorage
      const list = addLocalWallet(wallet);
      setMyWallets(list);
      setNewWallet(wallet);
      setActive(wallet);
      setActiveWallet(wallet);
      setImportKey('');
      setImportName('');
      flash('success', `Đã import ví "${wallet.name}" thành công và đặt làm hoạt động! Số dư: ${wallet.balance} BTC.`);
    } catch (err) {
      flash('error', err.message);
    } finally {
      setImportLoading(false);
    }
  }

  function handleSelectActive(wallet) {
    setActive(wallet);
    setActiveWallet(wallet);
    flash('success', `Đang dùng ví: ${wallet.name}`);
  }

  function handleRemove(publicKey) {
    if (!confirm('Xoá ví này khỏi trình duyệt? (Ví vẫn tồn tại trên blockchain)')) return;
    const list = removeLocalWallet(publicKey);
    setMyWallets(list);
    if (active?.publicKey === publicKey) { setActive(null); setActiveWallet(null); }
    if (newWallet?.publicKey === publicKey) setNewWallet(null);
  }

  function togglePrivate(pk) {
    setShowPrivate(prev => ({ ...prev, [pk]: !prev[pk] }));
  }

  return (
    <div className="animate-fade">
      <div className="page-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '30px' }}>
        <KeyRound size={24} color='var(--accent)' style={{ marginRight: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
        Quản lý Ví
      </div>
      <div className="grid-2">
        {/* ── Tạo hoặc Import ví ── */}
        <div className="card">
          {/* Tab Selection */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '1.2rem', gap: '0.5rem' }}>
            <button
              onClick={() => setActiveTab('create')}
              style={{
                flex: 1,
                padding: '10px 12px',
                border: 'none',
                background: 'none',
                color: activeTab === 'create' ? 'var(--accent)' : 'var(--text-muted)',
                borderBottom: activeTab === 'create' ? '2px solid var(--accent)' : '2px solid transparent',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.85rem',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <CirclePlus size={16} />
              Tạo Ví Mới
            </button>
            <button
              onClick={() => setActiveTab('import')}
              style={{
                flex: 1,
                padding: '10px 12px',
                border: 'none',
                background: 'none',
                color: activeTab === 'import' ? 'var(--accent)' : 'var(--text-muted)',
                borderBottom: activeTab === 'import' ? '2px solid var(--accent)' : '2px solid transparent',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.85rem',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <KeyRound size={16} />
              Import Private Key
            </button>
          </div>

          {activeTab === 'create' ? (
            <>
              <div className="form-group">
                <label className="form-label" htmlFor="wallet-name-input">Tên ví</label>
                <input
                  id="wallet-name-input"
                  className="form-input"
                  placeholder="Ví dụ: Alice, Bob..."
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                />
              </div>

              <button
                id="create-wallet-btn"
                className="btn btn-primary btn-full"
                onClick={handleCreate}
                disabled={loading || !name.trim()}
              >
                {loading ? <span className="spinner" /> : ''}
                {loading ? 'Đang tạo...' : 'Tạo ví'}
              </button>
            </>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label" htmlFor="import-wallet-name">Tên ví hiển thị</label>
                <input
                  id="import-wallet-name"
                  className="form-input"
                  placeholder="Ví dụ: Ví của tôi, Ví phụ..."
                  value={importName}
                  onChange={e => setImportName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="import-wallet-key">Private Key (Hex 64 ký tự)</label>
                <input
                  id="import-wallet-key"
                  className="form-input"
                  style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem' }}
                  placeholder="Nhập chuỗi Private Key hex..."
                  value={importKey}
                  onChange={e => setImportKey(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleImport()}
                />
              </div>

              <button
                id="import-wallet-btn"
                className="btn btn-primary btn-full"
                onClick={handleImport}
                disabled={importLoading || !importKey.trim() || !importName.trim()}
              >
                {importLoading ? <span className="spinner" /> : ''}
                {importLoading ? 'Đang import...' : 'Import Ví'}
              </button>
            </>
          )}

          {msg && <Alert type={msg.type}>{msg.text}</Alert>}

          {/* Ví vừa tạo */}
          {newWallet && (
            <div style={{ marginTop: '1.5rem' }}>
              <hr className="divider" />
              <div className="section-heading" style={{ display: 'flex', alignItems: 'center' }}>
                <Sparkles
                  size={15}
                  color='var(--accent)'
                  style={{ marginRight: '6px' }}
                />
                <span>Ví vừa tạo — lưu private key ngay!</span>
              </div>
              <div className="wallet-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div className="wallet-name">{newWallet.name}</div>
                  <span className="badge badge-green">
                    {(newWallet.balance ?? 50).toLocaleString()} BTC
                  </span>
                </div>
                <KeyBox label="Public Key (địa chỉ ví)" value={newWallet.publicKey} />
                {showPrivate[newWallet.publicKey]
                  ? <KeyBox label="Private Key — BÍ MẬT" value={newWallet.privateKey} icon={<KeyRound color="var(--accent-yellow)" size={14} />} />
                  : (
                    <button className="btn btn-outline btn-sm" onClick={() => togglePrivate(newWallet.publicKey)}>
                      <Eye size={14} /> Hiện Private Key
                    </button>
                  )
                }
                <div className="wallet-actions" style={{ marginTop: '10px' }}>
                  <button className="btn btn-green btn-sm" onClick={() => handleSelectActive(newWallet)}>
                    ✓ Dùng ví này
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Danh sách ví ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignSelf: 'start' }}>
          {/* Active wallet banner */}
          {active && (
            <div className="card" style={{ border: '1px solid rgba(99,130,255,0.4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="card-icon icon-green">
                  <CircleCheckBig color="var(--accent-green)" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ví đang sử dụng</div>
                  <div style={{ fontWeight: 700 }}>{active.name}</div>
                  <div style={{ marginTop: '4px' }}>
                    <CopyableKey value={active.publicKey} shortenLen={14} style={{ fontSize: '0.72rem' }} />
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Balance</div>
                  <div style={{
                    fontSize: '1.5rem', fontWeight: 800,
                    color: (active.balance ?? 0) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
                  }}>
                    {(active.balance ?? 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>BTC</div>
                </div>
              </div>
            </div>
          )}

          {/* Wallet list */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Header cố định — không bị cuộn */}
            <div className="card-header" style={{ flexWrap: 'wrap', gap: '8px', flexShrink: 0 }}>
              <div className="card-icon icon-purple">
                <Wallet color='purple' />
              </div>
              <div className="card-title">Ví của tôi ({myWallets.length})</div>

              {/* Search input */}
              <div style={{
                marginLeft: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '4px 10px',
                minWidth: '150px',
                maxWidth: '200px',
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  id="wallet-search-input"
                  type="text"
                  placeholder="Tìm tên ví..."
                  value={walletSearch}
                  onChange={e => setWalletSearch(e.target.value)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    fontSize: '0.78rem',
                    color: 'var(--text-primary)',
                    width: '100%',
                  }}
                />
                {walletSearch && (
                  <button
                    onClick={() => setWalletSearch('')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)', lineHeight: 1 }}
                    title="Xoá tìm kiếm"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              <button
                className="btn btn-outline btn-sm"
                onClick={refreshBalances}
                disabled={refreshing || myWallets.length === 0}
                title="Cập nhật balance từ server"
              >
                {refreshing
                  ? <span className="spinner" style={{ borderTopColor: 'var(--accent)' }} />
                  : <RefreshCcw size='18px' />}
              </button>
            </div>

            {/* Body có thể cuộn */}
            {(() => {
              const filtered = myWallets.filter(w =>
                w.name.toLowerCase().includes(walletSearch.toLowerCase())
              );
              if (myWallets.length === 0) {
                return (
                  <div className="empty-state">
                    <div className="empty-state-icon"><Wallet color='grey' size='48px' /></div>
                    <div className="empty-state-text">Chưa có ví nào.<br />Tạo ví đầu tiên để bắt đầu!</div>
                  </div>
                );
              }
              if (filtered.length === 0) {
                return (
                  <div style={{ padding: '24px 0', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Không tìm thấy ví nào khớp với "<strong style={{ color: 'var(--text-primary)' }}>{walletSearch}</strong>".
                  </div>
                );
              }
              return (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  maxHeight: '430px',
                  minHeight: 0,
                  paddingRight: '2px',
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'var(--border) transparent',
                }}>
                  {filtered.map(w => (
                    <WalletItem
                      key={w.publicKey}
                      wallet={w}
                      isActive={active?.publicKey === w.publicKey}
                      showPrivate={!!showPrivate[w.publicKey]}
                      onSelect={() => handleSelectActive(w)}
                      onTogglePrivate={() => togglePrivate(w.publicKey)}
                      onRemove={() => handleRemove(w.publicKey)}
                    />
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Hint */}
          {/* {myWallets.length > 0 && (
            <div className="alert alert-info" style={{ marginTop: 0 }}>
              <span>💡</span>
              <span style={{ fontSize: '0.8rem' }}>
                Các ví này chỉ hiển thị trên trình duyệt này. Xoá ví khỏi danh sách không xoá tài khoản trên blockchain.
              </span>
            </div>
          )} */}
        </div>
      </div>
    </div>
  );
}

function WalletItem({ wallet: w, isActive, showPrivate, onSelect, onTogglePrivate, onRemove }) {
  const balance = w.balance ?? 0;
  return (
    <div className="wallet-card" style={{ flexShrink: 0, ...(isActive ? { border: '1px solid rgba(99,130,255,0.5)' } : {}) }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
        <div style={{ minWidth: 0 }}>
          <div className="wallet-name">{w.name}</div>
          <div style={{ marginTop: '4px', wordBreak: 'break-all' }}>
            <CopyableKey value={w.publicKey} shortenLen={10} style={{ fontSize: '0.7rem' }} />
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {formatTime(w.createdAt)}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {isActive && <div style={{ marginBottom: '4px' }}><span className="badge badge-green">✓ Đang dùng</span></div>}
          <div style={{
            fontSize: '1.15rem', fontWeight: 700,
            color: balance >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
          }}>
            {balance.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: '4px' }}>BTC</span>
          </div>
        </div>
      </div>

      <div className="wallet-actions" style={{ marginTop: '10px' }}>
        {!isActive && (
          <button className="btn btn-primary btn-sm" onClick={onSelect}>✓ Chọn</button>
        )}
        <button className="btn btn-outline btn-sm" onClick={onTogglePrivate}>
          {showPrivate ? <><EyeOff color='var(--accent)' size='18px' /> Ẩn Private Key</> : <><Eye color='var(--accent)' size='18px' /> Xem Private Key</>}
        </button>
        <button
          className="btn btn-sm"
          style={{ background: 'rgba(248,113,113,0.1)', color: 'var(--accent-red)', border: '1px solid rgba(248,113,113,0.3)' }}
          onClick={onRemove}
          title="Xoá khỏi danh sách (không xoá trên blockchain)"
        >
          <Trash size={18} />
          <span>Xoá</span>
        </button>
      </div>

      {showPrivate && (
        <div style={{ marginTop: '10px' }}>
          <KeyBox
            label="Đừng để lộ Private Key"
            value={w.privateKey}
            icon={<TriangleAlert color='var(--accent-red)' size={16} />}
          />
        </div>
      )}
    </div>
  );
}

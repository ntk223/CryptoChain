import { useState, useCallback } from 'react';
import {
  getLocalWallets, addLocalWallet, removeLocalWallet, updateLocalBalance,
  getActiveWallet, setActiveWallet, shortenKey, formatTime,
} from '../utils/wallet';
import { apiCreateWallet, apiGetWallet } from '../api/client';
import KeyBox from '../components/KeyBox';
import Alert from '../components/Alert';
import { Wallet, KeyRound, CirclePlus, CircleCheckBig, RefreshCcw, EyeOff, Eye, Trash, TriangleAlert, Sparkles } from 'lucide-react';

export default function WalletPage() {
  const [myWallets, setMyWallets] = useState(getLocalWallets);
  const [active, setActive]       = useState(getActiveWallet);
  const [name, setName]           = useState('');
  const [loading, setLoading]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg]             = useState(null);
  const [newWallet, setNewWallet] = useState(null);
  const [showPrivate, setShowPrivate] = useState({});

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
      flash('success', `Ví "${wallet.name}" đã được tạo! Balance khởi đầu: ${wallet.balance} coins.`);
    } catch (err) {
      flash('error', err.message);
    } finally {
      setLoading(false);
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
        {/* ── Tạo ví ── */}
        <div className="card">
          <div className="card-header">
            <div className="card-icon icon-blue"><CirclePlus/></div>
            <div className="card-title">Tạo Ví Mới</div>
          </div>

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
                    {(newWallet.balance ?? 50).toLocaleString()} coins
                  </span>
                </div>
                <KeyBox label="Public Key (địa chỉ ví)" value={newWallet.publicKey} />
                {showPrivate[newWallet.publicKey]
                  ? <KeyBox label="Private Key — BÍ MẬT" value={newWallet.privateKey} icon={<KeyRound color="var(--accent-yellow)" size={14}/>}/>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Active wallet banner */}
          {active && (
            <div className="card" style={{ border: '1px solid rgba(99,130,255,0.4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="card-icon icon-green">
                  <CircleCheckBig color="var(--accent-green)"/>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ví đang sử dụng</div>
                  <div style={{ fontWeight: 700 }}>{active.name}</div>
                  <div style={{ fontSize: '0.72rem', fontFamily: 'JetBrains Mono', color: 'var(--text-muted)' }}>
                    {shortenKey(active.publicKey, 14)}
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
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>coins</div>
                </div>
              </div>
            </div>
          )}

          {/* Wallet list */}
          <div className="card">
            <div className="card-header">
              <div className="card-icon icon-purple">
                <Wallet color='purple'/>
              </div>
              <div className="card-title">Ví của tôi ({myWallets.length})</div>
              <button
                className="btn btn-outline btn-sm"
                style={{ marginLeft: 'auto' }}
                onClick={refreshBalances}
                disabled={refreshing || myWallets.length === 0}
                title="Cập nhật balance từ server"
              >
                {refreshing
                  ? <span className="spinner" style={{ borderTopColor: 'var(--accent)' }} />
                  : <RefreshCcw size='18px' />}
              </button>
            </div>

            {myWallets.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <Wallet color='grey' size='48px'/>
                </div>
                <div className="empty-state-text">
                  Chưa có ví nào.<br />Tạo ví đầu tiên để bắt đầu!
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {myWallets.map(w => (
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
            )}
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
    <div className="wallet-card" style={isActive ? { border: '1px solid rgba(99,130,255,0.5)' } : {}}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
        <div style={{ minWidth: 0 }}>
          <div className="wallet-name">{w.name}</div>
          <div style={{ fontSize: '0.7rem', fontFamily: 'JetBrains Mono', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
            {shortenKey(w.publicKey, 10)}
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
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: '4px' }}>coins</span>
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
            icon={<TriangleAlert color='var(--accent-red)' size={16}/>}
          />
        </div>
      )}
    </div>
  );
}

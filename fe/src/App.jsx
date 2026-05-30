import { useState, useEffect, useRef } from 'react';
import WalletPage from './pages/WalletPage';
import TransactionPage from './pages/TransactionPage';
import MiningPage from './pages/MiningPage';
import ExplorerPage from './pages/ExplorerPage';
import GuidePage from './pages/GuidePage';
import {
  Search, Wallet, ArrowLeftRight, Bitcoin, Sun, Moon, X,
  CheckCircle2, Info, Pickaxe, BookOpen, Bell, Pickaxe as PickaxeIcon,
  ArrowDownLeft, Layers, Trash2
} from 'lucide-react';
import { getLocalWallets, shortenKey } from './utils/wallet';

const TABS = [
  { id: 'wallet', icon: <Wallet size={20} color='var(--accent)' style={{ marginRight: '10px' }} />, label: 'Ví' },
  { id: 'transaction', icon: <ArrowLeftRight size={20} color='var(--accent)' style={{ marginRight: '10px' }} />, label: 'Giao Dịch' },
  { id: 'mining', icon: <Pickaxe size={20} color='var(--accent)' style={{ marginRight: '10px' }} />, label: 'Mining' },
  { id: 'explorer', icon: <Search size={20} color='var(--accent)' style={{ marginRight: '10px' }} />, label: 'Explorer' },
  { id: 'guide', icon: <BookOpen size={20} color='var(--accent)' style={{ marginRight: '10px' }} />, label: 'Hướng Dẫn' },
];

// Notification type config
const NOTIF_CONFIG = {
  mined:    { color: 'var(--accent)',        bg: 'rgba(79,70,229,0.1)',   icon: <PickaxeIcon size={15} /> },
  received: { color: 'var(--accent-green)',  bg: 'rgba(4,120,87,0.1)',    icon: <ArrowDownLeft size={15} /> },
  sent:     { color: 'var(--accent-yellow)', bg: 'rgba(180,83,9,0.1)',    icon: <ArrowLeftRight size={15} /> },
  info:     { color: 'var(--accent)',        bg: 'rgba(79,70,229,0.08)',  icon: <Layers size={15} /> },
};

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s trước`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h trước`;
  return `${Math.floor(diff / 86400)}d trước`;
}

export default function App() {
  const [tab, setTab] = useState('wallet');
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [toasts, setToasts] = useState([]);

  // Notification state
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifPanelRef = useRef(null);
  const bellBtnRef = useRef(null);

  // Theme effect
  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Close notification panel when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (
        notifPanelRef.current && !notifPanelRef.current.contains(e.target) &&
        bellBtnRef.current && !bellBtnRef.current.contains(e.target)
      ) {
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Add notification helper
  const addNotification = (type, title, desc) => {
    const id = Date.now() + Math.random();
    setNotifications(prev => [{ id, type, title, desc, ts: Date.now(), read: false }, ...prev].slice(0, 50));
    setUnreadCount(prev => prev + 1);
  };

  // Toast helper
  const addToast = (title, desc, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, title, desc, type }]);
    setTimeout(() => removeToast(id), 6000);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const markAllRead = () => setUnreadCount(0);
  const clearAll = () => { setNotifications([]); setUnreadCount(0); };

  // Real-time EventSource listener
  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3003';
    const cleanBase = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;

    console.log('Connecting to real-time events at:', `${cleanBase}/events`);
    const eventSource = new EventSource(`${cleanBase}/events`);

    eventSource.onmessage = (event) => {
      try {
        JSON.parse(event.data);
      } catch (err) { /* Silent */ }
    };

    eventSource.addEventListener('block-mined', (event) => {
      try {
        const block = JSON.parse(event.data);

        const myWallets = getLocalWallets();
        const myAddresses = myWallets.map(w => w.publicKey.toLowerCase());

        let relevantTxFound = false;

        if (block.transactions && block.transactions.length > 0) {
          block.transactions.forEach(tx => {
            const sender = String(tx.senderPublicKey || '').toLowerCase();
            const recipient = String(tx.recipient || '').toLowerCase();
            const amount = tx.amount;

            // Coinbase (mining reward)
            if (tx.senderPublicKey === 'SYSTEM_MINING_REWARD' && myAddresses.includes(recipient)) {
              relevantTxFound = true;
              const msg = `Nhận ${amount} BTC phần thưởng đào Block #${block.height}`;
              addToast('Đào thành công!', msg, 'success');
              addNotification('mined', 'Đào Block thành công!', msg);
              return;
            }

            if (myAddresses.includes(sender)) {
              relevantTxFound = true;
              const msg = `Gửi ${amount} BTC tới ${shortenKey(tx.recipient, 6)} (Block #${block.height})`;
              addToast('Giao dịch hoàn thành!', msg, 'success');
              addNotification('sent', 'Giao dịch hoàn thành', msg);
            } else if (myAddresses.includes(recipient)) {
              relevantTxFound = true;
              const msg = `Nhận ${amount} BTC từ ${shortenKey(tx.senderPublicKey, 6)} (Block #${block.height})`;
              addToast('Nhận được coin!', msg, 'success');
              addNotification('received', 'Nhận được BTC!', msg);
            }
          });
        }

        if (!relevantTxFound) {
          const msg = `Block #${block.height} chứa ${block.transactions?.length || 0} giao dịch vừa được thêm.`;
          addToast('Khối mới được khai thác!', msg, 'info');
          addNotification('info', 'Khối mới trên chuỗi', msg);
        }

        window.dispatchEvent(new CustomEvent('blockchain-update', { detail: block }));
      } catch (err) {
        console.error('Error processing block-mined SSE event:', err);
      }
    });

    eventSource.onerror = () => {
      console.warn('SSE connection error, attempting retry...');
    };

    return () => eventSource.close();
  }, []);

  return (
    <div className="app-container">
      {/* Toast container */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <div style={{ marginTop: '2px', display: 'flex', alignItems: 'center' }}>
              {t.type === 'success'
                ? <CheckCircle2 size={18} color="var(--accent-green)" />
                : <Info size={18} color="var(--accent)" />}
            </div>
            <div className="toast-content">
              <div className="toast-title">{t.title}</div>
              <div className="toast-desc">{t.desc}</div>
            </div>
            <button className="toast-close" onClick={() => removeToast(t.id)}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <div className="logo-icon">
              <Bitcoin size={28} color='yellow' style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
            </div>
            CryptoChain
          </div>

          <nav className="nav">
            {TABS.map(t => (
              <button
                key={t.id}
                id={`nav-${t.id}`}
                className={`nav-btn ${tab === t.id ? 'active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </nav>

          {/* Bell button */}
          <div style={{ position: 'relative', marginRight: '8px' }}>
            <button
              ref={bellBtnRef}
              id="notification-bell"
              onClick={() => {
                setNotifOpen(v => !v);
                if (!notifOpen) markAllRead();
              }}
              style={{
                background: notifOpen ? 'rgba(79,70,229,0.15)' : 'var(--bg-secondary)',
                border: `1px solid ${notifOpen ? 'rgba(79,70,229,0.4)' : 'var(--border)'}`,
                color: notifOpen ? 'var(--accent)' : 'var(--text-secondary)',
                width: 38, height: 38,
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                position: 'relative',
              }}
              title="Thông báo"
            >
              <Bell size={18} style={unreadCount > 0 ? { animation: 'bellRing 0.5s ease' } : {}} />
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: -3, right: -3,
                  background: 'var(--accent-red)',
                  color: 'white',
                  fontSize: '0.6rem',
                  fontWeight: 800,
                  width: 17, height: 17,
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2px solid var(--bg-primary)',
                  lineHeight: 1,
                }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Panel */}
            {notifOpen && (
              <div
                ref={notifPanelRef}
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 10px)',
                  right: 0,
                  width: 360,
                  maxHeight: 480,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
                  zIndex: 9998,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  animation: 'slideIn 0.2s ease',
                }}
              >
                {/* Panel Header */}
                <div style={{
                  padding: '14px 16px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Bell size={16} color="var(--accent)" />
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                      Thông báo
                    </span>
                    {notifications.length > 0 && (
                      <span style={{
                        background: 'rgba(79,70,229,0.12)',
                        color: 'var(--accent)',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '1px 7px',
                        borderRadius: '20px',
                      }}>
                        {notifications.length}
                      </span>
                    )}
                  </div>
                  {notifications.length > 0 && (
                    <button
                      onClick={clearAll}
                      style={{
                        background: 'transparent', border: 'none',
                        color: 'var(--text-muted)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '4px',
                        fontSize: '0.75rem', padding: '4px 8px',
                        borderRadius: 'var(--radius-sm)',
                        transition: 'all 0.2s',
                      }}
                      title="Xóa tất cả"
                    >
                      <Trash2 size={13} /> Xóa tất cả
                    </button>
                  )}
                </div>

                {/* Notification List */}
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {notifications.length === 0 ? (
                    <div style={{
                      padding: '48px 20px', textAlign: 'center',
                      color: 'var(--text-muted)', fontSize: '0.85rem',
                    }}>
                      <Bell size={32} style={{ opacity: 0.3, marginBottom: '10px' }} />
                      <div>Chưa có thông báo nào</div>
                      <div style={{ fontSize: '0.75rem', marginTop: '4px', opacity: 0.7 }}>
                        Thông báo sẽ xuất hiện khi có giao dịch hoặc block mới
                      </div>
                    </div>
                  ) : (
                    notifications.map((n, idx) => {
                      const cfg = NOTIF_CONFIG[n.type] || NOTIF_CONFIG.info;
                      return (
                        <div
                          key={n.id}
                          style={{
                            padding: '12px 16px',
                            borderBottom: idx < notifications.length - 1 ? '1px solid var(--border)' : 'none',
                            display: 'flex',
                            gap: '10px',
                            alignItems: 'flex-start',
                            background: !n.read ? 'rgba(79,70,229,0.03)' : 'transparent',
                            transition: 'background 0.2s',
                          }}
                        >
                          <div style={{
                            width: 30, height: 30, borderRadius: '50%',
                            background: cfg.bg,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0, color: cfg.color, marginTop: '1px',
                          }}>
                            {cfg.icon}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontWeight: 600, fontSize: '0.82rem',
                              color: 'var(--text-primary)', marginBottom: '2px',
                            }}>
                              {n.title}
                            </div>
                            <div style={{
                              fontSize: '0.75rem', color: 'var(--text-muted)',
                              lineHeight: 1.4, wordBreak: 'break-word',
                            }}>
                              {n.desc}
                            </div>
                          </div>
                          <div style={{
                            fontSize: '0.65rem', color: 'var(--text-muted)',
                            whiteSpace: 'nowrap', flexShrink: 0, marginTop: '2px',
                          }}>
                            {timeAgo(n.ts)}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Theme toggle */}
          <button
            className="theme-toggle-btn"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={theme === 'dark' ? 'Chuyển sang Giao diện Sáng' : 'Chuyển sang Giao diện Tối'}
            style={{ marginRight: '10px' }}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      <main className="main-content">
        {tab === 'wallet' && <WalletPage />}
        {tab === 'transaction' && <TransactionPage />}
        {tab === 'mining' && <MiningPage />}
        {tab === 'explorer' && <ExplorerPage />}
        {tab === 'guide' && <GuidePage onTabSwitch={setTab} />}
      </main>
    </div>
  );
}

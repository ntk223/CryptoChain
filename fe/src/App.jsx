import { useState, useEffect } from 'react';
import WalletPage from './pages/WalletPage';
import TransactionPage from './pages/TransactionPage';
import ExplorerPage from './pages/ExplorerPage';
import { Search, Wallet, ArrowLeftRight, Bitcoin, Sun, Moon, X, CheckCircle2, Info } from 'lucide-react';
import { getLocalWallets, shortenKey } from './utils/wallet';

const TABS = [
  { id: 'wallet', icon: <Wallet size={20} color='var(--accent)' style={{ marginRight: '10px' }} />, label: 'Ví' },
  { id: 'transaction', icon: <ArrowLeftRight size={20} color='var(--accent)' style={{ marginRight: '10px' }} />, label: 'Giao Dịch' },
  { id: 'explorer', icon: <Search size={20} color='var(--accent)' style={{ marginRight: '10px' }} />, label: 'Explorer' },
];

export default function App() {
  const [tab, setTab] = useState('wallet');
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [toasts, setToasts] = useState([]);

  // Theme effect
  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Toast helper
  const addToast = (title, desc, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, title, desc, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 6000);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Real-time EventSource listener
  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3003';
    const cleanBase = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;

    console.log('Connecting to real-time events at:', `${cleanBase}/events`);
    const eventSource = new EventSource(`${cleanBase}/events`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Received generic event:', data);
      } catch (err) {
        // Silent error
      }
    };

    eventSource.addEventListener('block-mined', (event) => {
      try {
        const block = JSON.parse(event.data);
        console.log('Received block-mined event:', block);

        const myWallets = getLocalWallets();
        const myAddresses = myWallets.map(w => w.publicKey.toLowerCase());

        let relevantTxFound = false;

        if (block.transactions && block.transactions.length > 0) {
          block.transactions.forEach(tx => {
            const sender = String(tx.senderPublicKey || '').toLowerCase();
            const recipient = String(tx.recipient || '').toLowerCase();
            const amount = tx.amount;

            if (myAddresses.includes(sender)) {
              relevantTxFound = true;
              addToast(
                'Giao dịch hoàn thành!',
                `Gửi thành công ${amount} BTC tới ${shortenKey(tx.recipient, 6)} (Block #${block.height})`,
                'success'
              );
            } else if (myAddresses.includes(recipient)) {
              relevantTxFound = true;
              addToast(
                'Nhận được coin!',
                `Bạn đã nhận ${amount} BTC từ ${shortenKey(tx.senderPublicKey, 6)}! (Block #${block.height})`,
                'success'
              );
            }
          });
        }

        // Show general notification if no specific transaction is ours
        if (!relevantTxFound) {
          addToast(
            'Khối mới được khai thác!',
            `Block #${block.height} chứa ${block.transactions?.length || 0} giao dịch vừa được thêm vào chuỗi.`,
            'info'
          );
        }

        // Dispatch custom event to notify current views to reload
        window.dispatchEvent(new CustomEvent('blockchain-update', { detail: block }));
      } catch (err) {
        console.error('Error processing block-mined SSE event:', err);
      }
    });

    eventSource.onerror = (err) => {
      console.warn('SSE connection error, attempting retry...', err);
    };

    return () => {
      eventSource.close();
    };
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

          <button
            className="theme-toggle-btn"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={theme === 'dark' ? 'Chuyển sang Giao diện Sáng' : 'Chuyển sang Giao diện Tối'}
            style={{ marginRight: '10px' }}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <div className="header-port-text" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {import.meta.env.VITE_API_URL}
          </div>
        </div>
      </header>

      <main className="main-content">
        {tab === 'wallet' && <WalletPage />}
        {tab === 'transaction' && <TransactionPage />}
        {tab === 'explorer' && <ExplorerPage />}
      </main>
    </div>
  );
}

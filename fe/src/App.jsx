import { useState } from 'react';
import WalletPage from './pages/WalletPage';
import TransactionPage from './pages/TransactionPage';
import ExplorerPage from './pages/ExplorerPage';
import { Search, Wallet, ArrowLeftRight, Bitcoin } from 'lucide-react';

const TABS = [
  { id: 'wallet', icon: <Wallet size={20} color='var(--accent)' style={{ marginRight: '10px' }} />, label: 'Ví' },
  { id: 'transaction', icon: <ArrowLeftRight size={20} color='var(--accent)' style={{ marginRight: '10px' }} />, label: 'Giao Dịch' },
  { id: 'explorer', icon: <Search size={20} color='var(--accent)' style={{ marginRight: '10px' }} />, label: 'Explorer' },
];

export default function App() {
  const [tab, setTab] = useState('wallet');

  return (
    <div className="app-container">
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

          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            localhost:3000
          </div>
        </div>
      </header>

      <main className="main-content">
        {tab === 'wallet'      && <WalletPage />}
        {tab === 'transaction' && <TransactionPage />}
        {tab === 'explorer'    && <ExplorerPage />}
      </main>
    </div>
  );
}

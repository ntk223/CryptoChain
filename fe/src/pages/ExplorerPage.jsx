import { useState, useEffect, useCallback } from 'react';
import { apiGetChain } from '../api/client';
import { shortenKey, formatTime } from '../utils/wallet';
import Alert from '../components/Alert';
import CopyableKey from '../components/CopyableKey';
import { useCopy } from '../hooks/useCopy';
import { Banknote, Boxes, VectorSquare, Box, RefreshCcw, Play, Pause, Search, Bitcoin, ArrowLeftRight } from 'lucide-react';

function BlockCard({ block, index }) {
  const { copy, copied } = useCopy();
  const [expanded, setExpanded] = useState(index === (block._isLatest ? 0 : -1));
  const isGenesis = index === 0;

  return (
    <div className="block-card">
      <div className="block-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="block-number">
            {isGenesis ? <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Bitcoin size={24} color="var(--accent)" /> Genesis Block</div> : `Block #${index}`}
          </span>
          {!isGenesis && block.transactions?.length > 0 && (
            <span className="badge badge-green">{block.transactions.length} tx</span>
          )}
          {!isGenesis && (!block.transactions?.length) && (
            <span className="badge" style={{ background: 'rgba(100,116,139,0.15)', color: 'var(--text-muted)' }}>0 tx</span>
          )}
        </div>
        <button
          className="btn btn-outline btn-sm"
          onClick={() => setExpanded(!expanded)}
          style={{ fontSize: '0.75rem', padding: '4px 10px' }}
        >
          {expanded ? '▲ Thu gọn' : '▼ Chi tiết'}
        </button>
      </div>

      <div className="block-body">
        <div className="block-field">
          <div className="block-field-label">Hash</div>
          <div className="block-field-value" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ flex: 1, wordBreak: 'break-all' }}>{block.hash}</span>
            <button className="copy-btn" style={{ position: 'static', flexShrink: 0 }} onClick={() => copy(block.hash, `hash-${index}`)}>
              {copied === `hash-${index}` ? '✓' : '⎘'}
            </button>
          </div>
        </div>

        <div className="block-field">
          <div className="block-field-label">Previous Hash</div>
          <div className="block-field-value" style={{ color: 'var(--text-muted)' }}>
            {block.previousHash}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="block-field">
            <div className="block-field-label">Thời gian</div>
            <div className="block-field-value">{formatTime(block.timestamp)}</div>
          </div>
          <div className="block-field">
            <div className="block-field-label">Nonce (PoW)</div>
            <div className="block-field-value" style={{ color: 'var(--accent-yellow)' }}>
              {block.nonce?.toLocaleString()}
            </div>
          </div>
        </div>

        {expanded && (
          <div>
            <hr className="divider" />
            <div className="section-heading" style={{ gap: '10px', display: 'flex', alignItems: 'center' }}>
              <ArrowLeftRight color='var(--accent)' size={20} />
              Giao dịch ({block.transactions?.length || 0})</div>
            {!block.transactions?.length ? (
              <div className="empty-state" style={{ padding: '1rem' }}>
                <div className="empty-state-icon" style={{ fontSize: '1.5rem' }}>📭</div>
                <div className="empty-state-text">Không có giao dịch</div>
              </div>
            ) : (
              <div className="tx-list">
                {block.transactions.map((tx, i) => (
                  <div className="tx-item" key={i}>
                    <div className="tx-item-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Tx #{i + 1}</span>
                      <div style={{ textAlign: 'right' }}>
                        <span className="tx-amount" style={{ display: 'block', fontWeight: 'bold' }}>+{tx.amount} BTC</span>
                        {tx.gas_fee > 0 && (
                          <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', display: 'block' }}>
                            Gas: {tx.gas_fee} BTC
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <strong style={{ color: 'var(--accent)', flexShrink: 0 }}>Từ:</strong>
                      <CopyableKey value={tx.senderPublicKey} shortenLen={10} style={{ fontSize: '0.72rem' }} />
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <strong style={{ color: 'var(--accent-green)', flexShrink: 0 }}>Đến:</strong>
                      <CopyableKey value={tx.recipient} shortenLen={10} style={{ fontSize: '0.72rem' }} />
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <strong style={{ flexShrink: 0 }}>Signature:</strong>
                      <CopyableKey value={tx.signature} shortenLen={8} style={{ fontSize: '0.68rem' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ExplorerPage() {
  const [chain, setChain] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [searchHash, setSearchHash] = useState('');

  function flash(type, text) {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 5000);
  }

  const fetchChain = useCallback(async () => {
    setLoading(true);
    try {
      const { chain: data } = await apiGetChain();
      setChain(data || []);
      setLastRefresh(new Date());
    } catch (err) {
      flash('error', `Không thể tải blockchain: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchChain(); }, [fetchChain]);

  // Listen for blockchain updates in real time
  useEffect(() => {
    window.addEventListener('blockchain-update', fetchChain);
    return () => window.removeEventListener('blockchain-update', fetchChain);
  }, [fetchChain]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(fetchChain, 5000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchChain]);

  // Stats
  const totalTx = chain.reduce((s, b) => s + (b.transactions?.length || 0), 0);
  const latestBlock = chain[chain.length - 1];
  const avgNonce = chain.length > 1
    ? Math.round(chain.slice(1).reduce((s, b) => s + (b.nonce || 0), 0) / (chain.length - 1))
    : 0;

  const filtered = searchHash
    ? chain.filter(b =>
      b.hash?.toLowerCase().includes(searchHash.toLowerCase()) ||
      b.previousHash?.toLowerCase().includes(searchHash.toLowerCase())
    )
    : chain;

  return (
    <div className="animate-fade" style={{ alignItems: 'stretch' }}>
      <div className="page-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '30px' }}>
        <Search size={20} color='var(--accent)' style={{ marginRight: '10px' }} />
        Blockchain Explorer
      </div>
      <div style={{ display: 'flex', gap: '16px', alignItems: 'stretch', marginBottom: '1.5rem', flexWrap: 'wrap' }}>

        {/* 1. Thẻ Tổng blocks */}
        <div className="stat-card" style={{ flex: 1, margin: 0 }}>
          <div className="stat-icon icon-blue">
            <VectorSquare size={30} />
          </div>
          <div>
            <div className="stat-value">{chain.length}</div>
            <div className="stat-label">Tổng blocks</div>
          </div>
        </div>

        {/* 2. Thẻ Tổng giao dịch */}
        <div className="stat-card" style={{ flex: 1, margin: 0 }}>
          <div className="stat-icon icon-green">
            <Banknote size={30} />
          </div>
          <div>
            <div className="stat-value">{totalTx}</div>
            <div className="stat-label">Tổng giao dịch</div>
          </div>
        </div>

        {/* 3. Thẻ Block mới nhất */}
        {latestBlock && (
          <div className="card" style={{ flex: 2, margin: 0, display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>

              <div className="card-icon icon-blue">
                <Box size={30} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Block mới nhất #{chain.length - 1}
                </div>
                <div style={{ fontSize: '0.8rem', fontFamily: 'JetBrains Mono', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {latestBlock.hash}
                </div>
              </div>

              {lastRefresh && (
                <div style={{ flexShrink: 0, fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  Cập nhật: {lastRefresh.toLocaleTimeString('vi-VN')}
                </div>
              )}

            </div>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="form-input"
          style={{ flex: 1, minWidth: '200px', maxWidth: '400px' }}
          placeholder="Tìm kiếm theo hash..."
          value={searchHash}
          onChange={e => setSearchHash(e.target.value)}
        />
        <button
          id="refresh-chain-btn"
          className="btn btn-outline"
          onClick={fetchChain}
          disabled={loading}
        >
          {loading ? <span className="spinner" /> : <RefreshCcw size={20} />}
        </button>
        <button
          className={`btn ${autoRefresh ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setAutoRefresh(!autoRefresh)}
        >
          {autoRefresh ? <Pause size={20} /> : <Play size={20} />}
        </button>
      </div>

      {msg && <Alert type={msg.type}>{msg.text}</Alert>}

      {loading && chain.length === 0 ? (
        <div className="empty-state">
          <div className="animate-pulse" style={{ fontSize: '3rem' }}>⛓️</div>
          <div className="empty-state-text">Đang tải blockchain...</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Search size={32} color="var(--accent)" />
          </div>
          <div className="empty-state-text">
            {searchHash ? 'Không tìm thấy block phù hợp.' : 'Blockchain trống.'}
          </div>
        </div>
      ) : (
        <>
          {searchHash && (
            <div style={{ marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              Hiển thị {filtered.length}/{chain.length} blocks
            </div>
          )}
          <div className="grid-blocks">
            {[...filtered].reverse().map((block) => {
              const idx = chain.indexOf(block);
              return (
                <BlockCard key={block.hash} block={block} index={idx} />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

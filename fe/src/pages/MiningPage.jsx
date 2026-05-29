import { useState, useEffect, useRef } from 'react';
import {
  getLocalWallets, getActiveWallet, setActiveWallet, shortenKey, aggregateSchnorrKeys
} from '../utils/wallet';
import { apiGetPendingTransactions, apiMineBlock, apiGetChain, apiGetWallet } from '../api/client';
import Alert from '../components/Alert';
import CustomSelect from '../components/CustomSelect';
import { Pickaxe, Wallet, Cpu, Play, Square, CircleCheck, Sparkles, Layers } from 'lucide-react';

export default function MiningPage() {
  const [myWallets, setMyWallets] = useState([]);
  const [miner, setMiner] = useState(null);
  const [pendingTxs, setPendingTxs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  // Mining states
  const [isMining, setIsMining] = useState(false);
  const [hashesChecked, setHashesChecked] = useState(0);
  const [hashRate, setHashRate] = useState(0);
  const [nonceFound, setNonceFound] = useState(null);
  const [minedHash, setMinedHash] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);

  const [latestBlock, setLatestBlock] = useState(null);
  const [difficulty, setDifficulty] = useState(4);

  const timerRef = useRef(null);
  const isMiningRef = useRef(false);
  const workerRef = useRef(null); // Web Worker ref
  const isSubmittingRef = useRef(false); // Guard: chỉ submit 1 lần duy nhất

  function flash(type, text) {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 8000);
  }

  // Load local wallets
  async function loadWallets() {
    const local = getLocalWallets();
    if (local.length === 0) {
      setMyWallets([]);
      return;
    }
    const withBalance = await Promise.all(
      local.map(async (w) => {
        try {
          const { wallet } = await apiGetWallet(w.publicKey);
          return { ...w, balance: wallet.balance };
        } catch {
          return w;
        }
      })
    );
    setMyWallets(withBalance);

    // Only update miner reference to keep the balance current and avoid resetting choice
    setMiner(prevMiner => {
      const activePk = prevMiner?.publicKey || getActiveWallet()?.publicKey;
      const match = withBalance.find(w => w.publicKey === activePk) || withBalance[0];
      return match || null;
    });
  }

  // Fetch mempool and blockchain parameters
  async function fetchData() {
    try {
      const { pending } = await apiGetPendingTransactions();
      setPendingTxs(pending || []);

      const { chain } = await apiGetChain();
      if (chain && chain.length > 0) {
        const lastBlock = chain[chain.length - 1];
        setLatestBlock(lastBlock);
        // Default difficulty is 4, check if lastBlock has a custom difficulty
        setDifficulty(4); // Since we set difficulty 4 in the DB init
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Refs to avoid stale closures in event listeners
  const minerRef = useRef(miner);
  const latestBlockRef = useRef(latestBlock);

  useEffect(() => {
    minerRef.current = miner;
  }, [miner]);

  useEffect(() => {
    latestBlockRef.current = latestBlock;
  }, [latestBlock]);

  useEffect(() => {
    loadWallets();
    fetchData();

    // Listen to blockchain update broadcasts (SSE events via CustomEvent)
    const handleBlockchainUpdate = (event) => {
      const newBlock = event.detail;
      if (!newBlock) return;

      // Check if this block was mined by us (by checking coinbase recipient)
      const coinbaseTx = newBlock.transactions?.find(tx => tx.senderPublicKey === 'SYSTEM_MINING_REWARD');
      const isMinedByUs = coinbaseTx && minerRef.current && coinbaseTx.recipient === minerRef.current.publicKey;

      // Stop worker nếu đang đào
      if (isMiningRef.current) {
        const currentMiningHeight = latestBlockRef.current ? latestBlockRef.current.height + 1 : 1;
        if (newBlock.height >= currentMiningHeight) {
          if (workerRef.current) {
            workerRef.current.postMessage({ action: 'STOP' });
            workerRef.current.terminate();
            workerRef.current = null;
          }
          isMiningRef.current = false;
          setIsMining(false);
          if (timerRef.current) clearInterval(timerRef.current);

          if (!isMinedByUs) {
            // Người khác đào trước, cancel submit nếu có
            isSubmittingRef.current = false;
            flash('error', `Miner khác đã khai thác thành công khối #${newBlock.height} trước! Tiến trình đào của bạn đã bị dừng.`);
          }
          // Nếu isMinedByUs: submitMinedBlock đã đang chạy, để nó tự hiện thị kết quả
        }
      } else if (!isMinedByUs && isSubmittingRef.current) {
        // Worker gửi SUCCESS trước khi SSE đến (isMiningRef đã = false)
        // nhưng block đó là của người khác — hủy submit nếu có thể
        isSubmittingRef.current = false;
      }

      // Refresh data
      fetchData();
      loadWallets();
    };

    window.addEventListener('blockchain-update', handleBlockchainUpdate);

    // Refresh every 10 seconds to keep mempool and block sync
    const interval = setInterval(fetchData, 10000);

    return () => {
      window.removeEventListener('blockchain-update', handleBlockchainUpdate);
      clearInterval(interval);
    };
  }, []);

  // Calculate fees and rewards
  const totalGasFee = pendingTxs.reduce((sum, tx) => sum + Number(tx.gasFee || 0), 0);
  const blockReward = 2.0;
  const totalReward = blockReward + totalGasFee;

  // Start client-side PoW mining — offloaded to Web Worker
  function startMining() {
    if (!miner) {
      flash('error', 'Vui lòng chọn ví nhận thưởng trước khi khai thác.');
      return;
    }
    if (pendingTxs.length === 0) {
      flash('error', 'Không có giao dịch nào trong Mempool để khai thác.');
      return;
    }
    if (!latestBlock) {
      flash('error', 'Chưa tải được khối mới nhất.');
      return;
    }

    // Reset UI state
    setIsMining(true);
    setNonceFound(null);
    setMinedHash('');
    setHashesChecked(0);
    setHashRate(0);
    setElapsedTime(0);
    isMiningRef.current = true;

    // Start elapsed timer on main thread (lightweight — just a counter)
    const startT = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startT) / 1000));
    }, 1000);

    // Build block data to send to worker
    const previousHash = latestBlock.hash;
    const timestamp = Date.now();

    const mappedUserTxs = pendingTxs.map(tx => ({
      senderPublicKey: tx.fromAddress,
      recipient: tx.toAddress,
      amount: Number(tx.amount),
      gas_fee: Number(tx.gasFee),
      signature: tx.signature,
    }));
    const coinbaseTx = {
      senderPublicKey: 'SYSTEM_MINING_REWARD',
      recipient: miner.publicKey,
      amount: totalReward,
      gas_fee: 0,
      signature: '',
    };
    const blockTransactions = [...mappedUserTxs, coinbaseTx];
    const blockTransactionsStr = JSON.stringify(blockTransactions);

    // Spawn the Web Worker from /public/miner.worker.js
    const worker = new Worker('/miner.worker.js');
    workerRef.current = worker;

    // Handle messages from worker
    worker.onmessage = (e) => {
      const { status, payload } = e.data;

      if (status === 'PROGRESS') {
        setHashesChecked(payload.hashesChecked);
        setHashRate(payload.hashRate);
      }

      if (status === 'SUCCESS') {
        // Guard: nếu đã bị cancel bởi SSE handler, bỏ qua
        if (!isMiningRef.current && isSubmittingRef.current === false) return;

        clearInterval(timerRef.current);
        setIsMining(false);
        isMiningRef.current = false;
        isSubmittingRef.current = true; // Đánh dấu đang submit
        setNonceFound(payload.nonce);
        setMinedHash(payload.hash);
        worker.terminate();
        workerRef.current = null;
        submitMinedBlock(payload.nonce, payload.timestamp, payload.hash);
      }
    };

    worker.onerror = (err) => {
      console.error('[Worker Error]', err);
      flash('error', `Lỗi Web Worker: ${err.message}`);
      clearInterval(timerRef.current);
      setIsMining(false);
      isMiningRef.current = false;
      worker.terminate();
      workerRef.current = null;
    };

    // Start mining in worker
    worker.postMessage({
      action: 'START',
      data: { previousHash, timestamp, blockTransactionsStr, difficulty },
    });
  }

  // Stop mining manually — terminate the Web Worker
  function stopMining() {
    if (workerRef.current) {
      workerRef.current.postMessage({ action: 'STOP' });
      workerRef.current.terminate();
      workerRef.current = null;
    }
    setIsMining(false);
    isMiningRef.current = false;
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    flash('info', 'Đã dừng khai thác thủ công.');
  }

  // Submit mined nonce to server
  async function submitMinedBlock(nonce, timestamp, hash) {
    setLoading(true);
    try {
      await apiMineBlock({
        minerAddress: miner.publicKey,
        nonce,
        timestamp,
      });
      isSubmittingRef.current = false;
      flash('success', `Khai thác thành công khối mới với Nonce ${nonce}! Thưởng ${totalReward} BTC đã được gửi.`);
      setPendingTxs([]);
      await loadWallets();
      await fetchData();
    } catch (err) {
      isSubmittingRef.current = false;
      setNonceFound(null);
      setMinedHash('');
      const isOrphan = err.message?.includes('Orphan Block') || err.message?.includes('pending transactions');
      if (isOrphan) {
        flash('error', 'Block của bạn bị từ chối! Miner khác đã đào thành công trước bạn. Khối của bạn trở thành Orphan Block.');
      } else {
        flash('error', `Lỗi khi nộp khối: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-fade">
      <div className="page-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '30px' }}>
        <Pickaxe size={24} color='var(--accent)' /> Mining Block
      </div>

      {msg && <Alert type={msg.type}>{msg.text}</Alert>}

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem', alignItems: 'start' }}>

        {/* Left Column: Dashboard and Stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Mining Control Panel */}
          <div className="card">
            <div className="card-header">
              <div className="card-icon icon-purple">
                <Cpu size={24} color="var(--accent)" />
              </div>
              <div className="card-title">Khai Thác Bằng GPU/CPU Web</div>
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Chọn ví Miner nhận thưởng</label>
              <CustomSelect
                options={myWallets.map(w => ({
                  value: w.publicKey,
                  name: w.name,
                  balance: w.balance !== undefined ? w.balance : '...',
                  publicKey: w.publicKey,
                }))}
                value={miner?.publicKey || ''}
                onChange={(val) => {
                  const match = myWallets.find(w => w.publicKey === val);
                  if (match) { setMiner(match); setActiveWallet(match); }
                }}
                placeholder="Chọn ví nhận thưởng..."
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', padding: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Phần thưởng khối</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-green)', marginTop: '4px' }}>
                  {blockReward} BTC
                </div>
              </div>
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', padding: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Phí Gas gom được</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-yellow)', marginTop: '4px' }}>
                  {totalGasFee.toFixed(4)} BTC
                </div>
              </div>
            </div>

            <div style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 'var(--radius-sm)', padding: '16px', marginBottom: '1.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>TỔNG PHẦN THƯỞNG MINER SẼ NHẬN</div>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--accent)', marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Sparkles size={24} color="var(--accent)" />
                {totalReward.toFixed(4)} BTC
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              {!isMining ? (
                <button
                  onClick={startMining}
                  className="btn btn-purple btn-full"
                  disabled={loading || pendingTxs.length === 0}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <Play size={18} fill="white" /> Bắt đầu khai thác (PoW)
                </button>
              ) : (
                <button
                  onClick={stopMining}
                  className="btn btn-red btn-full"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <Square size={18} fill="white" /> Dừng khai thác
                </button>
              )}
            </div>
            {pendingTxs.length === 0 && (
              <div style={{ fontSize: '0.75rem', color: 'var(--accent-red)', textAlign: 'center', marginTop: '8px' }}>
                * Mempool trống. Không có giao dịch để đóng block.
              </div>
            )}
          </div>

          {/* Real-time Mining Stats */}
          {(isMining || nonceFound !== null) && (
            <div className="card" style={{ border: isMining ? '1px solid rgba(168,85,247,0.4)' : '1px solid rgba(52,211,153,0.4)' }}>
              <div className="card-header">
                <div className="card-title" style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isMining ? (
                    <Cpu size={18} style={{ animation: 'spin 2s linear infinite' }} color="var(--accent)" />
                  ) : (
                    <CircleCheck size={18} color="var(--accent-green)" />
                  )}
                  <span>
                    {isMining ? 'Đang thực hiện Proof-of-Work...' : 'Đã tìm thấy Block mới!'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Thời gian:</span>
                  <div style={{ fontSize: '1rem', fontWeight: 700 }}>{elapsedTime} giây</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Đã kiểm tra:</span>
                  <div style={{ fontSize: '1rem', fontWeight: 700 }}>{hashesChecked.toLocaleString()} nonces</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Tốc độ hash:</span>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent)' }}>{hashRate.toLocaleString()} H/s</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Độ khó yêu cầu:</span>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent-yellow)' }}>{difficulty} chữ số '0'</div>
                </div>
              </div>

              {nonceFound !== null && (
                <div style={{ marginTop: '1.2rem', padding: '10px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Nonce hợp lệ:</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--accent-green)', fontFamily: 'JetBrains Mono' }}>{nonceFound}</div>

                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px' }}>Hash của khối:</div>
                  <div style={{ fontSize: '0.68rem', fontFamily: 'JetBrains Mono', color: 'var(--accent)', wordBreak: 'break-all' }}>{minedHash}</div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Right Column: Pending Transactions (Mempool) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="card-icon icon-yellow">
                  <Layers size={24} color="var(--accent-yellow)" />
                </div>
                <div className="card-title">Hàng đợi giao dịch (Mempool)</div>
              </div>
              <span className="badge badge-yellow">{pendingTxs.length} giao dịch</span>
            </div>

            {pendingTxs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Hiện tại không có giao dịch nào đang chờ trong Mempool.
                {/* <br />Hãy gửi giao dịch từ trang "Giao Dịch" trước! */}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '420px', overflowY: 'auto' }}>
                {pendingTxs.map((tx, idx) => (
                  <div
                    key={tx.id || idx}
                    style={{
                      background: 'var(--bg-secondary)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '12px',
                      border: '1px solid rgba(255,255,255,0.03)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Giao dịch #{tx.id || idx + 1}</span>
                      <span className="badge badge-purple" style={{ fontSize: '0.62rem' }}>Gas: {tx.gasFee} BTC</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', flexWrap: 'wrap' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Từ:</span>
                      <span style={{ fontFamily: 'JetBrains Mono', color: 'var(--text-primary)' }}>{shortenKey(tx.fromAddress, 6)}</span>
                      <span style={{ color: 'var(--accent)' }}>→</span>
                      <span style={{ color: 'var(--text-muted)' }}>Đến:</span>
                      <span style={{ fontFamily: 'JetBrains Mono', color: 'var(--text-primary)' }}>{shortenKey(tx.toAddress, 6)}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        Status: <strong style={{ color: 'var(--accent-yellow)' }}>{tx.status}</strong>
                      </div>
                      <div style={{ fontWeight: 800, color: 'var(--accent-green)', fontSize: '0.9rem' }}>
                        {tx.amount} BTC
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Schnorr Key Aggregation Card */}
          {pendingTxs.length > 0 && (
            <div className="card animate-fade" style={{ border: '1px solid rgba(168,85,247,0.3)' }}>
              <div className="card-header" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div className="card-icon icon-purple" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '50%' }}>
                  <Sparkles size={16} color="var(--accent)" />
                </div>
                <div className="card-title" style={{ fontSize: '0.9rem' }}>Giao thức Schnorr (Key Aggregation)</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                <p style={{ margin: 0 }}>
                  Với Schnorr, chữ ký và khóa công khai của tối đa <strong>3 giao dịch</strong> trong block được gộp thành một khóa công khai gộp (X_agg) và một chữ ký duy nhất giúp giảm kích thước dữ liệu lưu trữ.
                </p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                  <div style={{ fontWeight: 600 }}>Khóa công khai thành viên (Senders):</div>
                  {pendingTxs.map((tx, idx) => (
                    <div key={tx.id || idx} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'JetBrains Mono', fontSize: '0.7rem', padding: '6px 8px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.03)' }}>
                      <span style={{ color: 'var(--accent)' }}>Tx #{idx + 1} Sender:</span>
                      <span>{shortenKey(tx.fromAddress, 10)}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                  <div style={{ fontWeight: 600 }}>Khóa công khai gộp thực tế (X_agg):</div>
                  <div style={{ fontSize: '0.68rem', fontFamily: 'JetBrains Mono', color: 'var(--accent-green)', wordBreak: 'break-all', background: 'var(--bg-secondary)', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px dashed rgba(52,211,153,0.3)', lineHeight: '1.3' }}>
                    {aggregateSchnorrKeys(pendingTxs.map(tx => tx.fromAddress)) || 'Đang tính toán khóa gộp...'}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import {
  getLocalWallets, getActiveWallet, setActiveWallet,
  updateLocalBalance, signTransaction, shortenKey,
} from '../utils/wallet';
import { apiGetWallet, apiSendTransaction } from '../api/client';
import Alert from '../components/Alert';
import CustomSelect from '../components/CustomSelect';
import { ArrowLeftRight, Bitcoin, BookUser, CircleCheck, CreditCard, IdCard, LayersPlus, Pickaxe, Send, TriangleAlert, Wallet, Waypoints } from 'lucide-react';

export default function TransactionPage() {
  const [myWallets, setMyWallets] = useState([]);
  const [sender, setSender] = useState(null);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [gasFee, setGasFee] = useState('0.2');
  const [loading, setLoading] = useState(false);
  const [loadingWallets, setLoadingWallets] = useState(true);
  const [msg, setMsg] = useState(null);
  const [confirmedTx, setConfirmedTx] = useState(null);
  const [recipientMode, setRecipientMode] = useState('wallet'); // 'wallet' | 'manual'

  function flash(type, text) {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 7000);
  }

  /** Đọc ví từ localStorage rồi fetch balance mới nhất từ server. */
  async function loadWallets() {
    setLoadingWallets(true);
    const local = getLocalWallets();
    if (local.length === 0) { setMyWallets([]); setLoadingWallets(false); return; }

    const withBalance = await Promise.all(
      local.map(async (w) => {
        try {
          const { wallet } = await apiGetWallet(w.publicKey);
          // Cập nhật balance trong localStorage
          updateLocalBalance(w.publicKey, wallet.balance);
          return { ...w, balance: wallet.balance };
        } catch {
          return w; // Giữ nguyên nếu server lỗi
        }
      })
    );

    setMyWallets(withBalance);

    // Đồng bộ sender
    const activePk = getActiveWallet()?.publicKey;
    const match = withBalance.find(w => w.publicKey === activePk) || withBalance[0];
    if (match) { setSender(match); setActiveWallet(match); }

    setLoadingWallets(false);
  }

  useEffect(() => { loadWallets(); }, []); // eslint-disable-line

  async function handleSend(e) {
    e.preventDefault();
    if (!sender) return flash('error', 'Vui lòng chọn ví người gửi.');
    const recipientKey = recipient.trim();
    if (!recipientKey) return flash('error', 'Vui lòng nhập/chọn người nhận.');
    if (recipientKey === sender.publicKey) return flash('error', 'Không thể gửi cho chính mình.');
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return flash('error', 'Số lượng phải lớn hơn 0.');
    const fee = parseFloat(gasFee || 0);
    if (fee < 0) return flash('error', 'Phí gas không được âm.');
    
    const totalRequired = amt + fee;
    if (totalRequired > (sender.balance ?? 0)) {
      return flash('error', `Không đủ số dư. Hiện có: ${sender.balance} BTC. Cần: ${totalRequired} BTC (bao gồm phí gas).`);
    }

    setLoading(true);
    setConfirmedTx(null);
    const balanceBefore = sender.balance ?? 0;

    try {
      const signature = signTransaction({
        privateKey: sender.privateKey,
        senderPublicKey: sender.publicKey,
        recipient: recipientKey,
        amount: amt,
        gas_fee: fee,
      });

      const result = await apiSendTransaction({
        senderPublicKey: sender.publicKey,
        recipient: recipientKey,
        amount: amt,
        gas_fee: fee,
        signature,
      });

      setConfirmedTx({
        tx: result.transaction,
        chainLength: result.chainLength,
        fromName: sender.name,
        toKey: recipientKey,
        amount: amt,
        gasFee: fee,
        balanceBefore,
        balanceAfter: balanceBefore - totalRequired,
      });

      setAmount('');

      // Reload balance từ server
      await loadWallets();
      flash('success', `Giao dịch đã được đưa vào hàng đợi khai thác (Mempool)!`);
    } catch (err) {
      flash('error', err.message);
    } finally {
      setLoading(false);
    }
  }

  // Ví nhận: ví local khác sender hoặc nhập thủ công
  const otherMyWallets = myWallets.filter(w => w.publicKey !== sender?.publicKey);
  const recipientWallet = myWallets.find(w => w.publicKey === recipient);
  const previewBalance = (sender?.balance ?? 0) - parseFloat(amount || 0) - parseFloat(gasFee || 0);

  return (
    <div className="animate-fade">
      <div className="page-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '30px' }}>
        <ArrowLeftRight size={24} color='var(--accent)' /> Giao Dịch
      </div>

      {/* <div className="alert alert-info" style={{ marginBottom: '1.5rem' }}>
        <span>⚡</span>
        <span><strong>Auto-mine:</strong> Mỗi giao dịch được đào và xác nhận ngay lập tức.</span>
      </div> */}

      <div className="grid-2">
        {/* ── Form giao dịch ── */}
        <div className="card">
          <div className="card-header">
            <div className="card-icon icon-blue">
              <CreditCard size={24} color='var(--accent)' />
            </div>
            <div className="card-title">Tạo Giao Dịch</div>
          </div>

          {loadingWallets ? (
            <div className="empty-state">
              <div className="animate-pulse" style={{ fontSize: '2rem' }}>⏳</div>
              <div className="empty-state-text">Đang tải ví...</div>
            </div>
          ) : myWallets.length === 0 ? (
            <div className="alert alert-error" style={{ marginTop: 0 }}>
              <span>⚠️</span>
              <span>Chưa có ví nào. Hãy tạo ví trong tab <strong>Ví</strong> trước!</span>
            </div>
          ) : (
            <form onSubmit={handleSend}>
              {/* Sender */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>Ví người gửi</label>
                  {sender && (
                    <span style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Balance:</span>
                      <span style={{
                        fontWeight: 800,
                        color: (sender.balance ?? 0) > 0 ? 'var(--accent-green)' : 'var(--accent-red)',
                      }}>
                        {(sender.balance ?? 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>BTC</span>
                    </span>
                  )}
                </div>
                <CustomSelect
                  options={myWallets.map(w => ({
                    value: w.publicKey,
                    name: w.name,
                    balance: (w.balance ?? 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 }),
                    publicKey: w.publicKey,
                  }))}
                  value={sender?.publicKey || ''}
                  onChange={val => {
                    const w = myWallets.find(x => x.publicKey === val);
                    if (w) { setSender(w); setActiveWallet(w); }
                  }}
                  placeholder="Chọn ví gửi..."
                />
              </div>


              {/* Recipient */}
              <div className="form-group">
                <label className="form-label">Người nhận</label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  {otherMyWallets.length > 0 && (
                    <button type="button"
                      className={`wallet-chip ${recipientMode === 'wallet' ? 'active' : ''}`}
                      onClick={() => { setRecipientMode('wallet'); setRecipient(''); }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Wallet size={14} color='var(--accent)' />
                        Ví của tôi
                      </div>
                    </button>
                  )}
                  <button type="button"
                    className={`wallet-chip ${recipientMode === 'manual' ? 'active' : ''}`}
                    onClick={() => { setRecipientMode('manual'); setRecipient(''); }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <BookUser size={14} color='var(--accent)' />
                      <span>Nhập địa chỉ</span>
                    </div>
                  </button>
                </div>

                {recipientMode === 'wallet' && otherMyWallets.length > 0 ? (
                  <CustomSelect
                    options={otherMyWallets.map(w => ({
                      value: w.publicKey,
                      name: w.name,
                      balance: (w.balance ?? 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 }),
                      publicKey: w.publicKey,
                    }))}
                    value={recipient}
                    onChange={val => setRecipient(val)}
                    placeholder="-- Chọn ví nhận --"
                  />
                ) : (
                  <input
                    id="recipient-input"
                    className="form-input mono"
                    placeholder="Nhập public key người nhận..."
                    value={recipient}
                    onChange={e => setRecipient(e.target.value)}
                    style={{ fontSize: '0.78rem' }}
                  />
                )}
              </div>

              {/* Amount */}
              <div className="form-group">
                <label className="form-label">Số lượng (BTC)</label>
                <input
                  id="amount-input"
                  type="number"
                  className="form-input"
                  placeholder="0"
                  min="0.01"
                  step="any"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                />
              </div>

              {/* Gas Fee */}
              <div className="form-group">
                <label className="form-label">Phí Gas giao dịch</label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  {[
                    { label: 'Phí thấp', value: 0.1 },
                    { label: 'Trung bình', value: 0.2 },
                    { label: 'Phí cao', value: 0.5 },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`wallet-chip ${parseFloat(gasFee) === opt.value ? 'active' : ''}`}
                      onClick={() => setGasFee(String(opt.value))}
                      style={{ flex: 1, padding: '10px 8px', fontSize: '0.8rem', textAlign: 'center' }}
                    >
                      <div>{opt.label}</div>
                      <div style={{ fontWeight: 800, fontSize: '0.85rem', marginTop: '2px' }}>{opt.value} BTC</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              {sender && recipient && amount && parseFloat(amount) > 0 && (
                <div style={{
                  background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)',
                  padding: '12px 16px', marginBottom: '1.2rem',
                  border: `1px solid ${previewBalance < 0 ? 'rgba(248,113,113,0.3)' : 'rgba(52,211,153,0.2)'}`,
                }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Xem trước</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 600 }}>{sender.name}</span>
                    <span style={{ color: 'var(--accent)', fontSize: '1.1rem' }}>→</span>
                    <span style={{ fontWeight: 600 }}>
                      {recipientWallet?.name || shortenKey(recipient, 6)}
                    </span>
                    <span style={{ marginLeft: 'auto', fontWeight: 800, color: 'var(--accent-green)' }}>
                      {parseFloat(amount).toLocaleString('vi-VN', { maximumFractionDigits: 4 })} BTC
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Balance sau (gồm phí gas):{' '}
                    <strong style={{ color: previewBalance >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                      {previewBalance.toLocaleString('vi-VN', { maximumFractionDigits: 4 })} BTC
                    </strong>
                    {previewBalance < 0 &&
                      <span style={{ color: 'var(--accent-red)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                        <TriangleAlert size={16} color="var(--accent-red)" />
                        Không đủ số dư!
                      </span>}
                  </div>
                </div>
              )}

              <button
                id="send-tx-btn"
                type="submit"
                className="btn btn-green btn-full"
                disabled={loading || !sender || !recipient || !amount || parseFloat(amount) <= 0 || parseFloat(gasFee || 0) < 0}
              >
                {loading ? <span className="spinner" /> : <Send size={20} color="white" style={{ marginRight: '10px' }} />}
                {loading ? 'Đang ký & gửi...' : 'Ký và Gửi Giao Dịch'}
              </button>
            </form>
          )}

          {msg && <Alert type={msg.type}>{msg.text}</Alert>}
        </div>

        {/* ── Kết quả + How it works ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {confirmedTx && (
            <div className="card" style={{ border: '1px solid rgba(52,211,153,0.4)' }}>
              <div className="card-header">
                <div className="card-icon icon-green">
                  <CircleCheck size={24} color="var(--accent-green)" />
                </div>
                <div className="card-title">Giao Dịch Đã Gửi (Mempool)!</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '8px', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{confirmedTx.fromName}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--accent-red)', fontWeight: 700 }}>
                    −{(confirmedTx.amount + confirmedTx.gasFee).toLocaleString('vi-VN', { maximumFractionDigits: 4 })}
                  </div>
                  <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                    (Phí gas: {confirmedTx.gasFee} BTC)
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                    {confirmedTx.balanceAfter.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: '3px' }}>BTC</span>
                  </div>
                </div>
                <div style={{ textAlign: 'center', fontSize: '1.4rem' }}>→</div>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {myWallets.find(w => w.publicKey === confirmedTx.toKey)?.name || shortenKey(confirmedTx.toKey, 5)}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--accent-green)', fontWeight: 700 }}>
                    +{confirmedTx.amount.toLocaleString('vi-VN', { maximumFractionDigits: 4 })}
                  </div>
                </div>
              </div>

              <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', padding: '10px' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Trạng thái giao dịch</div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: '0.8rem', color: 'var(--accent-yellow)', fontWeight: 700 }}>
                  {confirmedTx.tx?.status || 'PENDING_MEMPOOL'}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '4px', wordBreak: 'break-all' }}>
                  Giao dịch đã được gửi vào Mempool và đang chờ Miner khai thác để đóng vào block tiếp theo.
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header">
              <div className="card-icon icon-purple">
                <Waypoints color='var(--accent)' size={24} />
              </div>
              <div className="card-title">Quy trình giao dịch</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[
                { n: '1', icon: <IdCard size={16} />, t: 'Ký giao dịch (client)', d: 'Private key ký SHA256(sender|recipient|amount) bằng ECDSA secp256k1' },
                { n: '2', icon: <CircleCheck size={16} />, t: 'Xác minh & kiểm tra balance', d: 'Miner kiểm tra chữ ký và balance' },
                { n: '3', icon: <Pickaxe size={16} />, t: 'Miner đào', d: 'Proof-of-Work: tìm nonce sao cho hash bắt đầu "00"' },
                { n: '4', icon: <LayersPlus size={16} />, t: 'Thêm block mới vào blockchain', d: '' },
              ].map(item => (
                <div key={item.n} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>

                  {/* Vòng tròn số thứ tự */}
                  <div style={{
                    width: '26px', height: '26px', borderRadius: '50%',
                    background: 'var(--gradient)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700,
                    flexShrink: 0, color: 'white', marginTop: '2px' // Đẩy vòng tròn xuống một chút để căn chuẩn với dòng title đầu tiên
                  }}>
                    {item.n}
                  </div>

                  {/* Cột Nội dung */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>

                    {/* Row chứa Icon và Tiêu đề */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)'
                    }}>
                      <span style={{ display: 'flex', color: 'var(--accent)' }}>
                        {item.icon}
                      </span>
                      <span>{item.t}</span>
                    </div>

                    {/* Chỉ render mô tả nếu có nội dung (d !== '') */}
                    {item.d && (
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                        {item.d}
                      </div>
                    )}
                  </div>

                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { ec as EC } from 'elliptic';
import CryptoJS from 'crypto-js';

const ec = new EC('secp256k1');

// ─── Crypto ──────────────────────────────────────────────────────────────────

/**
 * Ký giao dịch phía client.
 * Hash = SHA256(`${senderPublicKey}|${recipient}|${amount}`) — giống backend.
 */
export function signTransaction({ privateKey, senderPublicKey, recipient, amount }) {
  const hash = CryptoJS.SHA256(`${senderPublicKey}|${recipient}|${amount}`).toString();
  const key  = ec.keyFromPrivate(privateKey, 'hex');
  return key.sign(hash, 'hex').toDER('hex');
}

// ─── LocalStorage: danh sách ví của người dùng này ───────────────────────────

const MY_WALLETS_KEY = 'my_wallets_v2';

/**
 * Lấy danh sách ví đã lưu ở localStorage.
 * Mỗi wallet: { name, publicKey, privateKey, createdAt, balance? }
 */
export function getLocalWallets() {
  try { return JSON.parse(localStorage.getItem(MY_WALLETS_KEY) || '[]'); }
  catch { return []; }
}

/** Lưu 1 ví mới vào localStorage (sau khi tạo qua server). */
export function addLocalWallet(wallet) {
  const list = getLocalWallets();
  // Tránh trùng publicKey
  if (list.some(w => w.publicKey === wallet.publicKey)) return list;
  list.push({
    name: wallet.name,
    publicKey: wallet.publicKey,
    privateKey: wallet.privateKey,
    createdAt: wallet.createdAt,
    balance: wallet.balance ?? 50,
  });
  localStorage.setItem(MY_WALLETS_KEY, JSON.stringify(list));
  return list;
}

/** Cập nhật balance của 1 ví trong localStorage. */
export function updateLocalBalance(publicKey, balance) {
  const list = getLocalWallets().map(w =>
    w.publicKey === publicKey ? { ...w, balance } : w
  );
  localStorage.setItem(MY_WALLETS_KEY, JSON.stringify(list));
  return list;
}

/** Xoá 1 ví khỏi localStorage (xoá cục bộ, không xoá trên server). */
export function removeLocalWallet(publicKey) {
  const list = getLocalWallets().filter(w => w.publicKey !== publicKey);
  localStorage.setItem(MY_WALLETS_KEY, JSON.stringify(list));
  return list;
}

// ─── Active wallet ────────────────────────────────────────────────────────────

const ACTIVE_KEY = 'active_wallet_v2';

export function getActiveWallet() {
  try { return JSON.parse(localStorage.getItem(ACTIVE_KEY) || 'null'); }
  catch { return null; }
}

export function setActiveWallet(wallet) {
  localStorage.setItem(ACTIVE_KEY, wallet ? JSON.stringify(wallet) : 'null');
}

// ─── Formatting ───────────────────────────────────────────────────────────────

export function shortenKey(key = '', chars = 8) {
  if (key.length <= chars * 2 + 3) return key;
  return `${key.slice(0, chars)}…${key.slice(-chars)}`;
}

export function formatTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

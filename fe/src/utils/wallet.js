import { ec as EC } from 'elliptic';
import CryptoJS from 'crypto-js';

const ec = new EC('secp256k1');

// ─── Crypto ──────────────────────────────────────────────────────────────────

/**
 * Ký giao dịch phía client.
 * Hash = SHA256(`${senderPublicKey}|${recipient}|${amount}`) — giống backend.
 */
export function signTransaction({ privateKey, senderPublicKey, recipient, amount, gas_fee = 0 }) {
  const hash = CryptoJS.SHA256(`${senderPublicKey}|${recipient}|${amount}|${gas_fee}`).toString();
  const key  = ec.keyFromPrivate(privateKey, 'hex');
  return key.sign(hash, 'hex', { canonical: true }).toDER('hex');
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

export function addLocalWallet(wallet) {
  const list = getLocalWallets();
  const existingIdx = list.findIndex(w => w.publicKey === wallet.publicKey);
  if (existingIdx !== -1) {
    // Nếu trùng publicKey, cập nhật tên mới và balance
    list[existingIdx] = {
      ...list[existingIdx],
      name: wallet.name,
      balance: wallet.balance ?? list[existingIdx].balance,
    };
  } else {
    list.push({
      name: wallet.name,
      publicKey: wallet.publicKey,
      privateKey: wallet.privateKey,
      createdAt: wallet.createdAt,
      balance: wallet.balance ?? 50,
    });
  }
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

/**
 * Perform Schnorr Key Aggregation (summing public key points on secp256k1)
 * X_agg = X_1 + X_2 + ... + X_k
 */
export function aggregateSchnorrKeys(pubKeyHexs) {
  if (!pubKeyHexs || pubKeyHexs.length === 0) return null;
  try {
    let aggPoint = null;
    for (const hex of pubKeyHexs) {
      if (!hex || hex === 'SYSTEM_MINING_REWARD') continue;
      const point = ec.keyFromPublic(hex, 'hex').getPublic();
      if (!aggPoint) {
        aggPoint = point;
      } else {
        aggPoint = aggPoint.add(point);
      }
    }
    if (!aggPoint) return null;
    return aggPoint.encode('hex', true); // Return compressed public key hex
  } catch (err) {
    console.error('Error aggregating Schnorr keys:', err);
    return null;
  }
}

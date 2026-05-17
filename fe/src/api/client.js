const BASE = 'http://localhost:3000';

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

// Tạo ví (server tạo key, lưu DB) → trả về { wallet } kể cả privateKey
export const apiCreateWallet = (name) => request('POST', '/wallets', { name });

// Lấy info + balance của 1 ví theo publicKey (KHÔNG có privateKey)
export const apiGetWallet = (publicKey) => request('GET', `/wallet/${publicKey}`);

// Lấy balance nhanh
export const apiGetBalance = (publicKey) => request('GET', `/balance/${publicKey}`);

// Giao dịch – server tự mine sau khi nhận
export const apiSendTransaction = (payload) => request('POST', '/transaction', payload);

// Chain (Explorer)
export const apiGetChain = () => request('GET', '/chain');

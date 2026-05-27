const customCrypto = require('../utils/customCrypto');

const userRepository = require('../repositories/userRepository');

async function createWallet(name) {
  const trimmedName = String(name || '').trim();
  if (!trimmedName) {
    throw new Error('Name is required.');
  }

  const { publicKey, privateKey } = customCrypto.generateKeyPair(false);

  const user = await userRepository.createUser({
    name: trimmedName,
    publicKey,
    privateKey,
  });

  return {
    id: user.id,
    name: user.name,
    publicKey: user.public_key,
    privateKey: user.private_key,
    balance: Number(user.balance),
    createdAt: user.created_at,
  };
}

async function importWallet(privateKey, name) {
  const hexPrivateKey = String(privateKey || '').trim().replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]{64}$/.test(hexPrivateKey)) {
    throw new Error('Invalid private key format. Must be a 64-character hex string.');
  }

  // 1. Truy vấn database trực tiếp bằng private key để tìm ví ban đầu
  let user = await userRepository.getUserByPrivateKey(hexPrivateKey);

  if (user) {
    // Nếu tìm thấy và có tên mới được nhập, cập nhật tên mới vào DB!
    const trimmedName = String(name || '').trim();
    if (trimmedName && trimmedName !== user.name) {
      user = await userRepository.updateUsername(user.public_key, trimmedName);
    }
  } else {
    // 2. Nếu chưa tồn tại, khôi phục public key bằng thuật toán nhân điểm trên đường cong secp256k1
    const d = BigInt('0x' + hexPrivateKey);
    if (d <= 0n || d >= customCrypto.n) {
      throw new Error('Private key out of range [1, n-1]');
    }

    const P = customCrypto.pointMultiply(d, customCrypto.G);
    if (P === null) {
      throw new Error('Failed to derive public key point.');
    }

    const publicKey = customCrypto.serializePublicKey(P);

    // Đăng ký mới trong DB với balance mặc định là 50
    user = await userRepository.createUser({
      name: String(name || 'Imported Wallet').trim(),
      publicKey,
      privateKey: hexPrivateKey,
    });
  }

  return {
    id: user.id,
    name: user.name,
    publicKey: user.public_key,
    privateKey: user.private_key,
    balance: Number(user.balance),
    createdAt: user.created_at,
  };
}

module.exports = {
  createWallet,
  importWallet,
};

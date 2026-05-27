const userRepository = require('../repositories/userRepository');
const walletService = require('../services/walletService');

async function createWallet(req, res) {
  try {
    const { name } = req.body || {};
    const wallet = await walletService.createWallet(name);
    // Trả về đầy đủ thông tin (kể cả privateKey) một lần duy nhất khi tạo
    return res.status(201).json({ message: 'Wallet created.', wallet });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

// Lấy thông tin công khai + balance của 1 ví theo publicKey
// KHÔNG trả về privateKey
async function getWalletByPublicKey(req, res) {
  try {
    const { publicKey } = req.params;
    const user = await userRepository.getUserByPublicKey(publicKey);
    if (!user) return res.status(404).json({ message: 'Wallet not found.' });

    return res.json({
      wallet: {
        id: user.id,
        name: user.name,
        publicKey: user.public_key,
        balance: Number(user.balance),
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

// Lấy balance của 1 địa chỉ (shortcut)
async function getBalance(req, res) {
  try {
    const { publicKey } = req.params;
    if (!publicKey) return res.status(400).json({ message: 'publicKey is required.' });

    const user = await userRepository.getUserByPublicKey(publicKey);
    if (!user) return res.status(404).json({ message: 'Wallet not found.' });

    return res.json({ publicKey, balance: Number(user.balance) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function importWallet(req, res) {
  try {
    const { privateKey, name } = req.body || {};
    const wallet = await walletService.importWallet(privateKey, name);
    return res.status(200).json({ message: 'Wallet imported successfully.', wallet });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

async function updateWalletName(req, res) {
  try {
    const { publicKey } = req.params;
    const { name } = req.body || {};
    const trimmedName = String(name || '').trim();
    if (!trimmedName) {
      return res.status(400).json({ message: 'Name is required.' });
    }
    const user = await userRepository.updateUsername(publicKey, trimmedName);
    if (!user) {
      return res.status(404).json({ message: 'Wallet not found.' });
    }
    return res.json({
      message: 'Wallet name updated successfully.',
      wallet: {
        id: user.id,
        name: user.name,
        publicKey: user.public_key,
        balance: Number(user.balance),
        createdAt: user.created_at,
      }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

module.exports = { createWallet, getWalletByPublicKey, getBalance, importWallet, updateWalletName };

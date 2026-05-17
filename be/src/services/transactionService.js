const { ec: EC } = require('elliptic');

const { normalizeAmount, calculateTransactionHash } = require('../domain/transaction');
const blockchainService = require('./blockchainService');
const userRepository = require('../repositories/userRepository');

const ec = new EC('secp256k1');

async function queueTransaction({ senderPublicKey, recipient, amount, signature }) {
  if (!senderPublicKey || !recipient || !signature) {
    throw new Error('Missing required fields.');
  }

  const normalizedAmount = normalizeAmount(amount);

  // 1. Xác minh chữ ký ECDSA
  const transactionHash = calculateTransactionHash({
    senderPublicKey,
    recipient,
    amount: normalizedAmount,
  });

  let isValid = false;
  try {
    const key = ec.keyFromPublic(senderPublicKey, 'hex');
    isValid = key.verify(transactionHash, signature);
  } catch {
    throw new Error('Invalid public key or signature.');
  }

  if (!isValid) {
    throw new Error('Invalid signature.');
  }

  // 2. Kiểm tra và cập nhật balance trong DB (nguyên tử, có rollback nếu thiếu tiền)
  await userRepository.updateBalances({
    senderPublicKey,
    recipientPublicKey: recipient,
    amount: normalizedAmount,
  });

  // 3. Thêm giao dịch vào hàng chờ và tự động mine
  blockchainService.addTransaction({
    senderPublicKey,
    recipient,
    amount: normalizedAmount,
    signature,
  });

  const block = await blockchainService.minePendingTransactions();

  return {
    pendingCount: blockchainService.getPendingCount(),
    block,
    chainLength: blockchainService.getChain().length,
  };
}

module.exports = { queueTransaction };

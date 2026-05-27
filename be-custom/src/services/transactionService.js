const customCrypto = require('../utils/customCrypto');

const { normalizeAmount, calculateTransactionHash } = require('../domain/transaction');
const blockchainService = require('./blockchainService');
const userRepository = require('../repositories/userRepository');

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
    console.log('[TX_DEBUG] Verifying transaction:');
    console.log('  senderPublicKey:', senderPublicKey);
    console.log('  recipient:', recipient);
    console.log('  amount:', normalizedAmount);
    console.log('  signature:', signature);
    console.log('  calculatedHash:', transactionHash);
    
    isValid = customCrypto.verify(transactionHash, signature, senderPublicKey);
    console.log('  Verification result:', isValid);
  } catch (err) {
    console.error('  Verification threw error:', err.message);
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

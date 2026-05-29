const customCrypto = require('../utils/customCrypto');

const { normalizeAmount, normalizeGasFee, calculateTransactionHash } = require('../domain/transaction');
const blockchainService = require('./blockchainService');
const userRepository = require('../repositories/userRepository');
const transactionRepository = require('../repositories/transactionRepository');

async function queueTransaction({ senderPublicKey, recipient, amount, gas_fee, signature }) {
  if (!senderPublicKey || !recipient || !signature) {
    throw new Error('Missing required fields.');
  }

  const normalizedAmount = normalizeAmount(amount);
  const normalizedGasFee = normalizeGasFee(gas_fee);

  // 1. Xác minh chữ ký ECDSA (bao gồm gas_fee)
  const transactionHash = calculateTransactionHash({
    senderPublicKey,
    recipient,
    amount: normalizedAmount,
    gas_fee: normalizedGasFee,
  });

  let isValid = false;
  try {
    console.log('[TX_DEBUG] Verifying transaction:');
    console.log('  senderPublicKey:', senderPublicKey);
    console.log('  recipient:', recipient);
    console.log('  amount:', normalizedAmount);
    console.log('  gas_fee:', normalizedGasFee);
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
  // Khấu trừ (amount + gasFee) từ người gửi, cộng amount cho người nhận.
  await userRepository.updateBalances({
    senderPublicKey,
    recipientPublicKey: recipient,
    amount: normalizedAmount,
    gasFee: normalizedGasFee,
  });

  // 3. Thêm giao dịch vào bảng transactions trong DB với trạng thái PENDING_MEMPOOL
  const dbTx = await transactionRepository.createTransaction({
    fromAddress: senderPublicKey,
    toAddress: recipient,
    amount: normalizedAmount,
    gasFee: normalizedGasFee,
    signature,
    status: 'PENDING_MEMPOOL',
  });

  // 4. Thêm giao dịch vào hàng chờ in-memory
  blockchainService.addTransaction({
    senderPublicKey,
    recipient,
    amount: normalizedAmount,
    gas_fee: normalizedGasFee,
    signature,
  });

  return {
    pendingCount: blockchainService.getPendingCount(),
    transaction: dbTx,
    chainLength: blockchainService.getChain().length,
  };
}

module.exports = { queueTransaction };


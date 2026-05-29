const transactionService = require('../services/transactionService');
const transactionRepository = require('../repositories/transactionRepository');

async function createTransaction(req, res) {
  try {
    const { senderPublicKey, recipient, amount, gas_fee, signature } = req.body || {};
    const result = await transactionService.queueTransaction({
      senderPublicKey,
      recipient,
      amount,
      gas_fee,
      signature,
    });

    return res.status(201).json({
      message: 'Transaction confirmed and added to mempool.',
      pendingCount: result.pendingCount,
      transaction: result.transaction,
      chainLength: result.chainLength,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

async function getPendingTransactions(req, res) {
  try {
    const pending = await transactionRepository.getPendingTransactions();
    return res.json({ pending });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

module.exports = { createTransaction, getPendingTransactions };


const transactionService = require('../services/transactionService');

async function createTransaction(req, res) {
  try {
    const { senderPublicKey, recipient, amount, signature } = req.body || {};
    const result = await transactionService.queueTransaction({
      senderPublicKey,
      recipient,
      amount,
      signature,
    });

    return res.status(201).json({
      message: 'Transaction confirmed.',
      pendingCount: result.pendingCount,
      block: result.block,
      chainLength: result.chainLength,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}

module.exports = { createTransaction };

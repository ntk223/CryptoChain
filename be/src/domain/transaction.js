const SHA256 = require('crypto-js/sha256');

function normalizeAmount(rawAmount) {
  const amount = Number(rawAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Invalid amount');
  }

  return amount;
}

function calculateTransactionHash({ senderPublicKey, recipient, amount }) {
  return SHA256(`${senderPublicKey}|${recipient}|${amount}`).toString();
}

function buildTransactionPayload({ senderPublicKey, recipient, amount }) {
  const normalizedAmount = normalizeAmount(amount);
  return {
    senderPublicKey,
    recipient,
    amount: normalizedAmount,
  };
}

module.exports = {
  normalizeAmount,
  calculateTransactionHash,
  buildTransactionPayload,
};

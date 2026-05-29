const { sha256 } = require('../utils/customCrypto');

function normalizeAmount(rawAmount) {
  const amount = Number(rawAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Invalid amount');
  }

  return amount;
}

function normalizeGasFee(rawGasFee) {
  const gasFee = Number(rawGasFee !== undefined ? rawGasFee : 0);
  if (!Number.isFinite(gasFee) || gasFee < 0) {
    throw new Error('Invalid gas fee');
  }

  return gasFee;
}

function calculateTransactionHash({ senderPublicKey, recipient, amount, gas_fee }) {
  const normGasFee = normalizeGasFee(gas_fee);
  return sha256(`${senderPublicKey}|${recipient}|${amount}|${normGasFee}`);
}

function buildTransactionPayload({ senderPublicKey, recipient, amount, gas_fee }) {
  const normalizedAmount = normalizeAmount(amount);
  const normalizedGasFee = normalizeGasFee(gas_fee);
  return {
    senderPublicKey,
    recipient,
    amount: normalizedAmount,
    gas_fee: normalizedGasFee,
  };
}

module.exports = {
  normalizeAmount,
  normalizeGasFee,
  calculateTransactionHash,
  buildTransactionPayload,
};


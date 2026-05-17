const { ec: EC } = require('elliptic');

const userRepository = require('../repositories/userRepository');

const ec = new EC('secp256k1');

async function createWallet(name) {
  const trimmedName = String(name || '').trim();
  if (!trimmedName) {
    throw new Error('Name is required.');
  }

  const keyPair = ec.genKeyPair();
  const publicKey = keyPair.getPublic('hex');
  const privateKey = keyPair.getPrivate('hex');

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

module.exports = {
  createWallet,
};

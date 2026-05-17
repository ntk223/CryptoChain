const { Blockchain } = require('../domain/blockchain');
const blockRepository = require('../repositories/blockRepository');

let blockchain = null;

async function initBlockchain() {
  const storedBlocks = await blockRepository.getAllBlocks();

  if (storedBlocks.length === 0) {
    blockchain = new Blockchain();
    const genesisBlock = blockchain.chain[0];
    await blockRepository.insertBlock({
      height: 0,
      block: genesisBlock,
      difficulty: blockchain.difficulty,
    });
    return blockchain;
  }

  const chain = storedBlocks.map((item) => item.block);
  const difficulty = storedBlocks[storedBlocks.length - 1].difficulty || 2;
  blockchain = new Blockchain({ chain, difficulty });

  return blockchain;
}

function ensureInitialized() {
  if (!blockchain) {
    throw new Error('Blockchain not initialized.');
  }
}

function getChain() {
  ensureInitialized();
  return blockchain.chain;
}

function getPendingCount() {
  ensureInitialized();
  return blockchain.pendingTransactions.length;
}

function addTransaction(transaction) {
  ensureInitialized();
  blockchain.addTransaction(transaction);
}

async function minePendingTransactions() {
  ensureInitialized();
  const block = blockchain.minePendingTransactions();
  if (!block) {
    return null;
  }

  const height = blockchain.chain.length - 1;
  await blockRepository.insertBlock({
    height,
    block,
    difficulty: blockchain.difficulty,
  });

  return block;
}

module.exports = {
  initBlockchain,
  getChain,
  getPendingCount,
  addTransaction,
  minePendingTransactions,
};

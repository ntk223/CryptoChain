const { sha256 } = require('../utils/customCrypto');

class Block {
  constructor({ timestamp, transactions, previousHash = '', nonce = 0, hash = null }) {
    this.timestamp = timestamp;
    this.transactions = transactions;
    this.previousHash = previousHash;
    this.nonce = nonce;
    this.hash = hash || this.calculateHash();
  }

  calculateHash() {
    return sha256(
      `${this.previousHash}|${this.timestamp}|${JSON.stringify(this.transactions)}|${this.nonce}`
    );
  }

  mineBlock(difficulty) {
    const target = '0'.repeat(difficulty);
    while (!this.hash.startsWith(target)) {
      this.nonce += 1;
      this.hash = this.calculateHash();
    }
  }
}

class Blockchain {
  constructor({ chain = null, difficulty = 2 } = {}) {
    this.difficulty = difficulty;
    this.chain = chain && chain.length ? chain : [this.createGenesisBlock()];
    this.pendingTransactions = [];
  }

  createGenesisBlock() {
    return new Block({
      timestamp: Date.parse('2024-01-01'),
      transactions: [],
      previousHash: '0',
    });
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  addTransaction(transaction) {
    this.pendingTransactions.push(transaction);
  }

  minePendingTransactions() {
    if (this.pendingTransactions.length === 0) {
      return null;
    }

    const block = new Block({
      timestamp: Date.now(),
      transactions: this.pendingTransactions,
      previousHash: this.getLatestBlock().hash,
    });

    block.mineBlock(this.difficulty);
    this.chain.push(block);
    this.pendingTransactions = [];

    return block;
  }

  isChainValid() {
    for (let i = 1; i < this.chain.length; i += 1) {
      const current = this.chain[i];
      const previous = this.chain[i - 1];

      if (current.hash !== current.calculateHash()) {
        return false;
      }

      if (current.previousHash !== previous.hash) {
        return false;
      }
    }

    return true;
  }
}

module.exports = {
  Block,
  Blockchain,
};

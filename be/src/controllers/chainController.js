const blockchainService = require('../services/blockchainService');

async function mineBlock(req, res) {
  try {
    const block = await blockchainService.minePendingTransactions();

    if (!block) {
      return res.status(400).json({ message: 'No pending transactions to mine.' });
    }

    return res.json({
      message: 'Block mined.',
      block,
      chainLength: blockchainService.getChain().length,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

function getChain(req, res) {
  try {
    return res.json({
      chain: blockchainService.getChain(),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

module.exports = {
  mineBlock,
  getChain,
};

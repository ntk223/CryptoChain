const blockchainService = require('../services/blockchainService');

async function mineBlock(req, res) {
  try {
    const { minerAddress, nonce, timestamp } = { ...req.query, ...req.body };
    let block;

    if (nonce !== undefined && timestamp !== undefined) {
      block = await blockchainService.submitMinedBlock({
        minerAddress,
        nonce,
        timestamp,
      });
    } else {
      return res.status(400).json({ message: 'Nonce and timestamp are required for client-side mining verification.' });
    }

    if (!block) {
      return res.status(400).json({ message: 'No pending transactions to mine.' });
    }

    return res.json({
      message: 'Block mined successfully.',
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


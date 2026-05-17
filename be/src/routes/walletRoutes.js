const express = require('express');
const walletController = require('../controllers/walletController');

const router = express.Router();

router.post('/wallets', walletController.createWallet);
router.get('/wallet/:publicKey', walletController.getWalletByPublicKey);
router.get('/balance/:publicKey', walletController.getBalance);

module.exports = router;

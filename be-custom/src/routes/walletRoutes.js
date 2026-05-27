const express = require('express');
const walletController = require('../controllers/walletController');

const router = express.Router();

router.post('/wallets', walletController.createWallet);
router.post('/wallets/import', walletController.importWallet);
router.get('/wallet/:publicKey', walletController.getWalletByPublicKey);
router.get('/balance/:publicKey', walletController.getBalance);
router.put('/wallet/:publicKey/name', walletController.updateWalletName);

module.exports = router;

const express = require('express');

const chainRoutes = require('./chainRoutes');
const transactionRoutes = require('./transactionRoutes');
const walletRoutes = require('./walletRoutes');

const router = express.Router();

router.use(chainRoutes);
router.use(transactionRoutes);
router.use(walletRoutes);

module.exports = router;

const express = require('express');
const transactionController = require('../controllers/transactionController');

const router = express.Router();

router.post('/transaction', transactionController.createTransaction);
router.get('/transactions/pending', transactionController.getPendingTransactions);

module.exports = router;

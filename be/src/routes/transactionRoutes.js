const express = require('express');
const transactionController = require('../controllers/transactionController');

const router = express.Router();

router.post('/transaction', transactionController.createTransaction);

module.exports = router;

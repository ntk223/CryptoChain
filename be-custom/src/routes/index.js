const express = require('express');

const chainRoutes = require('./chainRoutes');
const transactionRoutes = require('./transactionRoutes');
const walletRoutes = require('./walletRoutes');
const notificationService = require('../services/notificationService');

const router = express.Router();

router.use(chainRoutes);
router.use(transactionRoutes);
router.use(walletRoutes);

// SSE Endpoint for real-time notifications
router.get('/events', (req, res) => {
  notificationService.registerClient(req, res);
});

module.exports = router;

const express = require('express');
const chainController = require('../controllers/chainController');

const router = express.Router();

router.get('/mine', chainController.mineBlock);
router.get('/chain', chainController.getChain);

module.exports = router;

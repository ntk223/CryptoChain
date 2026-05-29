const { Blockchain } = require('../domain/blockchain');
const pool = require('../db/pool');
const blockRepository = require('../repositories/blockRepository');
const transactionRepository = require('../repositories/transactionRepository');
const userRepository = require('../repositories/userRepository');
const notificationService = require('./notificationService');

let blockchain = null;

async function initBlockchain() {
  const storedBlocks = await blockRepository.getAllBlocks();

  if (storedBlocks.length === 0) {
    blockchain = new Blockchain();
    const genesisBlock = blockchain.chain[0];
    await blockRepository.insertBlock({
      height: 0,
      block: genesisBlock,
      difficulty: blockchain.difficulty,
    });
  } else {
    const chain = storedBlocks.map((item) => item.block);
    const difficulty = storedBlocks[storedBlocks.length - 1].difficulty || 4;
    blockchain = new Blockchain({ chain, difficulty });
  }

  // Khôi phục mempool từ Database (PENDING_MEMPOOL) vào bộ nhớ
  const pendingTx = await transactionRepository.getPendingTransactions();
  blockchain.pendingTransactions = pendingTx.map(tx => ({
    senderPublicKey: tx.fromAddress,
    recipient: tx.toAddress,
    amount: tx.amount,
    gas_fee: tx.gasFee,
    signature: tx.signature,
  }));

  return blockchain;
}

function ensureInitialized() {
  if (!blockchain) {
    throw new Error('Blockchain not initialized.');
  }
}

function getChain() {
  ensureInitialized();
  return blockchain.chain;
}

function getPendingCount() {
  ensureInitialized();
  return blockchain.pendingTransactions.length;
}

function addTransaction(transaction) {
  ensureInitialized();
  blockchain.addTransaction(transaction);
}

/**
 * Xác nhận khối được nộp bởi Miner thông qua Nonce và Timestamp.
 */
async function submitMinedBlock({ minerAddress, nonce, timestamp }) {
  ensureInitialized();

  if (!minerAddress) {
    throw new Error('Miner address is required.');
  }

  // Bước 1: Tính tổng số tiền Miner được nhận (Từ DB để đảm bảo tính nhất quán)
  const pendingTxs = await transactionRepository.getPendingTransactions();
  if (pendingTxs.length === 0) {
    throw new Error('No pending transactions to mine.');
  }

  const totalGasFee = pendingTxs.reduce((sum, tx) => sum + tx.gasFee, 0);
  const blockReward = 2.0; // Phần thưởng khối cố định
  const totalReward = blockReward + totalGasFee;

  // Cấu trúc lại các giao dịch cho Block
  const mappedUserTxs = pendingTxs.map(tx => ({
    senderPublicKey: tx.fromAddress,
    recipient: tx.toAddress,
    amount: tx.amount,
    gas_fee: tx.gasFee,
    signature: tx.signature,
  }));

  // Bước 2: Tự động sinh ra 1 giao dịch đặc biệt (Coinbase Transaction)
  const coinbaseTx = {
    senderPublicKey: 'SYSTEM_MINING_REWARD',
    recipient: minerAddress,
    amount: totalReward,
    gas_fee: 0,
    signature: '',
  };

  const blockTransactions = [...mappedUserTxs, coinbaseTx];

  // Tái tạo block để kiểm tra tính hợp lệ của Nonce nộp lên
  const latestBlock = blockchain.getLatestBlock();
  const previousHash = latestBlock.hash;
  const height = blockchain.chain.length;

  const BlockClass = require('../domain/blockchain').Block;
  const candidateBlock = new BlockClass({
    timestamp: Number(timestamp),
    transactions: blockTransactions,
    previousHash,
    nonce: Number(nonce),
  });

  // Kiểm tra độ khó của Hash thu được từ Nonce
  const target = '0'.repeat(blockchain.difficulty);
  if (!candidateBlock.hash.startsWith(target)) {
    throw new Error(`Invalid nonce. Hash ${candidateBlock.hash} does not start with ${target}`);
  }

  // Bước 3: Cập nhật trạng thái DB (Chốt sổ trong 1 Database Transaction)
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── BẢO VỆ 1: Khóa hàng latest block trong DB (Row-Level Lock) ──────────
    // SELECT ... FOR UPDATE buộc các request đến đồng thời phải xếp hàng chờ.
    // Chỉ 1 miner được vào đoạn code tiếp theo tại 1 thời điểm.
    const latestBlockRow = await client.query(
      `SELECT hash, height FROM blocks ORDER BY height DESC LIMIT 1 FOR UPDATE`
    );

    // ── BẢO VỆ 2: Kiểm tra previousHash so với DB thực tế ──────────────────
    // In-memory có thể stale, DB là nguồn sự thật duy nhất.
    if (latestBlockRow.rows.length > 0) {
      const dbLatestHash = latestBlockRow.rows[0].hash;
      const dbLatestHeight = latestBlockRow.rows[0].height;
      if (candidateBlock.previousHash !== dbLatestHash) {
        throw new Error(
          `Orphan Block: Khối này tham chiếu đến previousHash="${candidateBlock.previousHash.slice(0, 12)}..." ` +
          `nhưng block mới nhất trong chuỗi hiện tại là #${dbLatestHeight} hash="${dbLatestHash.slice(0, 12)}...". ` +
          `Miner khác đã đào thành công trước bạn!`
        );
      }
    }

    // ── BẢO VỆ 3: INSERT block — phát hiện Orphan Block qua UNIQUE constraint ─
    // insertBlock trả về null nếu ON CONFLICT (height) xảy ra.
    const inserted = await blockRepository.insertBlock({
      height,
      block: candidateBlock,
      difficulty: blockchain.difficulty,
    }, client);

    if (!inserted) {
      // Một miner khác đã INSERT block cùng height trước đó vài ms.
      throw new Error(
        `Orphan Block: Khối #${height} đã được miner khác đào thành công trước bạn!`
      );
    }

    // 2. Đổi trạng thái các giao dịch người dùng vừa đào từ PENDING_MEMPOOL => CONFIRMED
    const txIds = pendingTxs.map(tx => tx.id);
    await client.query(
      `
        UPDATE transactions
        SET status = 'CONFIRMED', block_hash = $1
        WHERE id = ANY($2::int[])
      `,
      [candidateBlock.hash, txIds]
    );

    // 3. Insert giao dịch thưởng SYSTEM_MINING_REWARD ở Bước 2 vào DB
    await client.query(
      `
        INSERT INTO transactions (
          from_address,
          to_address,
          amount,
          gas_fee,
          signature,
          status,
          block_hash
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        coinbaseTx.senderPublicKey,
        coinbaseTx.recipient,
        coinbaseTx.amount,
        coinbaseTx.gas_fee,
        coinbaseTx.signature,
        'CONFIRMED',
        candidateBlock.hash,
      ]
    );

    // Cập nhật số dư cho Miner (nếu miner tồn tại trong bảng users)
    const minerResult = await client.query(
      `SELECT balance FROM users WHERE public_key = $1 FOR UPDATE`,
      [minerAddress]
    );
    if (minerResult.rows.length > 0) {
      await client.query(
        `UPDATE users SET balance = balance + $1 WHERE public_key = $2`,
        [totalReward, minerAddress]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Cập nhật in-memory blockchain
  blockchain.chain.push(candidateBlock);
  blockchain.pendingTransactions = []; // Xoá mempool in-memory

  // Phát tín hiệu SSE cho client
  notificationService.broadcast('block-mined', {
    height,
    hash: candidateBlock.hash,
    previousHash: candidateBlock.previousHash,
    timestamp: candidateBlock.timestamp,
    nonce: candidateBlock.nonce,
    transactions: blockTransactions,
  });

  return candidateBlock;
}

/**
 * Hàm tự động đào (phục vụ legacy API / hoặc auto-mine nếu không nộp Nonce).
 * Giải mã PoW trực tiếp trên server và nộp.
 */
async function autoMinePendingTransactions({ minerAddress }) {
  ensureInitialized();

  // Tìm địa chỉ ví miner mặc định nếu không truyền vào
  let miner = minerAddress;
  if (!miner) {
    const users = await userRepository.getAllUsers();
    if (users.length > 0) {
      miner = users[0].public_key;
    } else {
      miner = 'SYSTEM_MINING_REWARD_RECIPIENT';
    }
  }

  // Lấy các giao dịch đang chờ từ DB
  const pendingTxs = await transactionRepository.getPendingTransactions();
  if (pendingTxs.length === 0) {
    return null;
  }

  const totalGasFee = pendingTxs.reduce((sum, tx) => sum + tx.gasFee, 0);
  const blockReward = 2.0;
  const totalReward = blockReward + totalGasFee;

  const mappedUserTxs = pendingTxs.map(tx => ({
    senderPublicKey: tx.fromAddress,
    recipient: tx.toAddress,
    amount: tx.amount,
    gas_fee: tx.gasFee,
    signature: tx.signature,
  }));

  const coinbaseTx = {
    senderPublicKey: 'SYSTEM_MINING_REWARD',
    recipient: miner,
    amount: totalReward,
    gas_fee: 0,
    signature: '',
  };

  const blockTransactions = [...mappedUserTxs, coinbaseTx];
  const latestBlock = blockchain.getLatestBlock();
  const previousHash = latestBlock.hash;
  const timestamp = Date.now();

  const BlockClass = require('../domain/blockchain').Block;
  const block = new BlockClass({
    timestamp,
    transactions: blockTransactions,
    previousHash,
  });

  // Tự tìm nonce trên server
  block.mineBlock(blockchain.difficulty);

  // Gọi logic nộp khối
  return submitMinedBlock({
    minerAddress: miner,
    nonce: block.nonce,
    timestamp: block.timestamp,
  });
}

// Wrapper cho minePendingTransactions để tương thích ngược
async function minePendingTransactions() {
  return autoMinePendingTransactions({});
}

module.exports = {
  initBlockchain,
  getChain,
  getPendingCount,
  addTransaction,
  submitMinedBlock,
  autoMinePendingTransactions,
  minePendingTransactions,
};


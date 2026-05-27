const pool = require('../db/pool');
const { Block } = require('../domain/blockchain');

async function insertBlock({ height, block, difficulty }) {
  const result = await pool.query(
    `
      INSERT INTO blocks (
        height,
        timestamp,
        previous_hash,
        hash,
        nonce,
        difficulty,
        transactions
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (height) DO NOTHING
      RETURNING id, height
    `,
    [
      height,
      block.timestamp,
      block.previousHash,
      block.hash,
      block.nonce,
      difficulty,
      JSON.stringify(block.transactions),
    ]
  );

  return result.rows[0] || null;
}

async function getAllBlocks() {
  const result = await pool.query(
    `
      SELECT height, timestamp, previous_hash, hash, nonce, difficulty, transactions
      FROM blocks
      ORDER BY height ASC
    `
  );

  return result.rows.map((row) => {
    // Normalize: pg JSONB có thể trả về [] hoặc {} (do bug cũ), đảm bảo luôn là mảng
    const transactions = Array.isArray(row.transactions) ? row.transactions : [];
    return {
      height: row.height,
      difficulty: row.difficulty,
      block: new Block({
        timestamp: Number(row.timestamp),
        transactions,
        previousHash: row.previous_hash,
        nonce: row.nonce,
        hash: row.hash,
      }),
    };
  });
}

module.exports = {
  insertBlock,
  getAllBlocks,
};

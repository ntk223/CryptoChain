const pool = require('../db/pool');

async function createTransaction({ fromAddress, toAddress, amount, gasFee, signature, status = 'PENDING_MEMPOOL' }) {
  const result = await pool.query(
    `
      INSERT INTO transactions (
        from_address,
        to_address,
        amount,
        gas_fee,
        signature,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, from_address, to_address, amount, gas_fee, signature, status, block_hash, created_at
    `,
    [fromAddress, toAddress, amount, gasFee, signature, status]
  );
  return result.rows[0];
}

async function getPendingTransactions() {
  const result = await pool.query(
    `
      SELECT id, from_address, to_address, amount, gas_fee, signature, status, block_hash, created_at
      FROM transactions
      WHERE status = 'PENDING_MEMPOOL'
      ORDER BY gas_fee DESC, id ASC
      LIMIT 3
    `
  );
  return result.rows.map(row => ({
    id: row.id,
    fromAddress: row.from_address,
    toAddress: row.to_address,
    amount: Number(row.amount),
    gasFee: Number(row.gas_fee),
    signature: row.signature,
    status: row.status,
    blockHash: row.block_hash,
    createdAt: row.created_at
  }));
}

async function getPendingGasFeeSum() {
  const result = await pool.query(
    `
      SELECT SUM(gas_fee) as total_gas
      FROM transactions
      WHERE status = 'PENDING_MEMPOOL'
    `
  );
  return Number(result.rows[0].total_gas || 0);
}

module.exports = {
  createTransaction,
  getPendingTransactions,
  getPendingGasFeeSum,
};

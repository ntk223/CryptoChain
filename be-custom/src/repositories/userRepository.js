const pool = require('../db/pool');

async function createUser({ name, publicKey, privateKey }) {
  const result = await pool.query(
    `INSERT INTO users (name, public_key, private_key)
     VALUES ($1, $2, $3)
     RETURNING id, name, public_key, private_key, balance, created_at`,
    [name, publicKey, privateKey]
  );
  return result.rows[0];
}

async function getUserById(id) {
  const result = await pool.query(
    `SELECT id, name, public_key, private_key, balance, created_at
     FROM users WHERE id = $1`,
    [id]
  );
  return result.rows[0];
}

async function getUserByPublicKey(publicKey) {
  const result = await pool.query(
    `SELECT id, name, public_key, private_key, balance, created_at
     FROM users WHERE public_key = $1`,
    [publicKey]
  );
  return result.rows[0] || null;
}

async function getUserByPrivateKey(privateKey) {
  const result = await pool.query(
    `SELECT id, name, public_key, private_key, balance, created_at
     FROM users WHERE private_key = $1`,
    [privateKey]
  );
  return result.rows[0] || null;
}

async function getAllUsers() {
  const result = await pool.query(
    `SELECT id, name, public_key, private_key, balance, created_at
     FROM users ORDER BY created_at ASC`
  );
  return result.rows;
}

/**
 * Cập nhật balance nguyên tử trong một DB transaction:
 *  - Trừ amount từ sender
 *  - Cộng amount vào recipient
 * Nếu sender không đủ balance → throw error, không thay đổi gì.
 */
async function updateBalances({ senderPublicKey, recipientPublicKey, amount }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Khoá hàng sender để tránh race condition
    const senderResult = await client.query(
      `SELECT balance FROM users WHERE public_key = $1 FOR UPDATE`,
      [senderPublicKey]
    );

    if (senderResult.rows.length === 0) {
      throw new Error('Sender not found.');
    }

    const senderBalance = Number(senderResult.rows[0].balance);
    if (senderBalance < amount) {
      throw new Error(
        `Insufficient balance. Available: ${senderBalance}, Required: ${amount}.`
      );
    }

    // Trừ balance người gửi
    await client.query(
      `UPDATE users SET balance = balance - $1 WHERE public_key = $2`,
      [amount, senderPublicKey]
    );

    // Cộng balance người nhận
    await client.query(
      `UPDATE users SET balance = balance + $1 WHERE public_key = $2`,
      [amount, recipientPublicKey]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function updateUsername(publicKey, name) {
  const result = await pool.query(
    `UPDATE users SET name = $1 WHERE public_key = $2
     RETURNING id, name, public_key, private_key, balance, created_at`,
    [name, publicKey]
  );
  return result.rows[0] || null;
}

module.exports = {
  createUser,
  getUserById,
  getUserByPublicKey,
  getUserByPrivateKey,
  getAllUsers,
  updateBalances,
  updateUsername,
};

const pool = require('./pool.js');

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      public_key TEXT NOT NULL UNIQUE,
      private_key TEXT NOT NULL,
      balance NUMERIC NOT NULL DEFAULT 50,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS blocks (
      id SERIAL PRIMARY KEY,
      height INTEGER NOT NULL UNIQUE,
      timestamp BIGINT NOT NULL,
      previous_hash TEXT NOT NULL,
      hash TEXT NOT NULL UNIQUE,
      nonce INTEGER NOT NULL,
      difficulty INTEGER NOT NULL,
      transactions JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Ensure unique constraint exists on blocks(hash) in case table was created before this change
  await pool.query(`
    ALTER TABLE blocks ADD CONSTRAINT blocks_hash_unique UNIQUE (hash);
  `).catch(() => {});

  // Create transactions table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      from_address TEXT NOT NULL,
      to_address TEXT NOT NULL,
      amount NUMERIC NOT NULL,
      gas_fee NUMERIC NOT NULL DEFAULT 0,
      signature TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING_MEMPOOL',
      block_hash TEXT REFERENCES blocks(hash) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Đảm bảo cột balance tồn tại (cho DB đã tạo trước khi có cột này)
  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS balance NUMERIC NOT NULL DEFAULT 50;
  `);
}

module.exports = {
  initDb,
};

if (require.main === module) {
  initDb()
    .then(() => {
      console.log('✅ Khởi tạo cơ sở dữ liệu (Database) thành công!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Lỗi khi khởi tạo cơ sở dữ liệu (Database):', err);
      process.exit(1);
    });
}


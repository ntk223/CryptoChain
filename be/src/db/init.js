const pool = require('./pool.js');

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      public_key TEXT NOT NULL UNIQUE,
      private_key TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS blocks (
      id SERIAL PRIMARY KEY,
      height INTEGER NOT NULL UNIQUE,
      timestamp BIGINT NOT NULL,
      previous_hash TEXT NOT NULL,
      hash TEXT NOT NULL,
      nonce INTEGER NOT NULL,
      difficulty INTEGER NOT NULL,
      transactions JSONB NOT NULL,
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

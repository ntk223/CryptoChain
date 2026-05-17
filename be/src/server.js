const { createApp } = require('./app');
const { initDb } = require('./db/init');
const { initBlockchain } = require('./services/blockchainService');
const env = require('./config/env');
// console.log(env);
async function startServer() {
  await initDb();
  await initBlockchain();

  const app = createApp();
  const PORT = env.APP_PORT;

  app.listen(PORT, () => {
    console.log(`Blockchain node running on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

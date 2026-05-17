const express = require('express');
const routes = require('./routes');

function createApp() {
  const app = express();

  // CORS – cho phép frontend dev server gọi API
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  app.use(express.json());
  app.use(routes);

  app.use((req, res) => {
    res.status(404).json({ message: 'Not found.' });
  });

  return app;
}

module.exports = { createApp };

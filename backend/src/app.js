const express = require('express');
const { checkDatabaseHealth } = require('./db/pool');

const app = express();

app.use(express.json({ limit: '1mb' }));

app.get('/health', async (req, res) => {
  try {
    const db = await checkDatabaseHealth();
    if (!db.ok) {
      return res.status(503).json({
        status: 'degraded',
        database: 'unavailable',
        detail: db.error || 'Database check failed',
      });
    }

    return res.status(200).json({
      status: 'ok',
      database: 'connected',
    });
  } catch (err) {
    return res.status(503).json({
      status: 'error',
      database: 'disconnected',
      detail: err.message,
    });
  }
});

module.exports = app;
const { Pool } = require('pg');
const env = require('../config/env');

const pool = new Pool({
  connectionString: env.databaseUrl || undefined,
});

async function checkDatabaseHealth() {
  if (!env.databaseUrl) {
    return {
      ok: false,
      error: 'DATABASE_URL is not configured',
    };
  }

  const result = await pool.query('SELECT 1 AS ok');
  return {
    ok: result.rows[0]?.ok === 1,
  };
}

module.exports = {
  pool,
  checkDatabaseHealth,
};
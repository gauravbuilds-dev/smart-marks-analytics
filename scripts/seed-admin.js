const { pool } = require('../backend/src/db/pool');
const { hashPassword } = require('../backend/src/utils/password');

async function seedAdmin() {
  const fullName = process.argv[2];
  const email = process.argv[3];
  const password = process.argv[4];

  if (!fullName || !email || !password) {
    console.error('Usage: node ../scripts/seed-admin.js "Admin Name" "admin@college.edu" "StrongPass123"');
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);

  try {
    const { rows } = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES ($1, LOWER($2), $3, 'admin')
       ON CONFLICT (email) DO NOTHING
       RETURNING id, full_name, email, role`,
      [fullName.trim(), email.trim(), passwordHash]
    );

    if (rows.length === 0) {
      console.log('Admin with this email already exists.');
    } else {
      console.log('Created admin user:', rows[0]);
    }
  } finally {
    await pool.end();
  }
}

seedAdmin().catch((err) => {
  console.error('Failed to seed admin:', err.message);
  process.exit(1);
});
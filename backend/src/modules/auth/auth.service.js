const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const { pool } = require('../../db/pool');
const { hashPassword, verifyPassword } = require('../../utils/password');

const VALID_ROLES = ['admin', 'hod', 'teacher'];

async function loginWithEmailAndPassword(email, password) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail || !password) {
    const err = new Error('Email and password are required');
    err.statusCode = 400;
    throw err;
  }

  if (!env.jwtSecret) {
    const err = new Error('JWT_SECRET is not configured on the server');
    err.statusCode = 500;
    throw err;
  }

  const { rows } = await pool.query(
    'SELECT id, full_name, email, password_hash, role, is_active FROM users WHERE LOWER(email) = $1',
    [normalizedEmail]
  );

  const user = rows[0];
  if (!user || !user.is_active) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    throw err;
  }

  const isMatch = await verifyPassword(password, user.password_hash);
  if (!isMatch) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    throw err;
  }

  const token = jwt.sign(
    { sub: user.id, role: user.role },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );

  return {
    token,
    user: {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
    },
  };
}

async function createUser({ fullName, email, password, role }) {
  const cleanName = String(fullName || '').trim();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const cleanRole = String(role || '').trim().toLowerCase();

  if (!cleanName || !normalizedEmail || !password || !VALID_ROLES.includes(cleanRole)) {
    const err = new Error('fullName, email, password (min 8 chars), and valid role (admin/hod/teacher) are required');
    err.statusCode = 400;
    throw err;
  }

  const passwordHash = await hashPassword(password);

  try {
    const { rows } = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, full_name, email, role, is_active, created_at`,
      [cleanName, normalizedEmail, passwordHash, cleanRole]
    );
    return rows[0];
  } catch (err) {
    if (err.code === '23505') {
      const conflictErr = new Error('A user with this email already exists');
      conflictErr.statusCode = 409;
      throw conflictErr;
    }
    throw err;
  }
}

module.exports = {
  loginWithEmailAndPassword,
  createUser,
};
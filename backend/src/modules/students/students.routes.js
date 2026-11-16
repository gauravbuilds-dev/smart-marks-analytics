const express = require('express');
const { pool } = require('../../db/pool');
const { requireAuth, requireRole } = require('../../middleware/auth.middleware');
const { normalizeRollNumber } = require('../../utils/validators');

const router = express.Router();

router.get('/', requireAuth, requireRole('admin', 'hod', 'teacher'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, roll_number, full_name, department, is_active, created_at FROM students ORDER BY roll_number ASC'
    );
    return res.json({ students: rows });
  } catch (err) {
    return next(err);
  }
});

router.post('/', requireAuth, requireRole('admin', 'hod'), async (req, res, next) => {
  try {
    const rollNumber = normalizeRollNumber(req.body?.rollNumber);
    const fullName = String(req.body?.fullName || '').trim();
    const department = String(req.body?.department || '').trim();

    if (!rollNumber || !fullName || !department) {
      return res.status(400).json({ error: 'rollNumber, fullName, and department are required' });
    }

    const { rows } = await pool.query(
      `INSERT INTO students (roll_number, full_name, department)
       VALUES ($1, $2, $3)
       RETURNING id, roll_number, full_name, department, is_active`,
      [rollNumber, fullName, department]
    );
    return res.status(201).json({ student: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A student with this roll number already exists' });
    }
    return next(err);
  }
});

router.post('/bulk', requireAuth, requireRole('admin', 'hod'), async (req, res, next) => {
  const list = Array.isArray(req.body?.students) ? req.body.students : null;
  if (!list || list.length === 0) {
    return res.status(400).json({ error: 'students array is required and cannot be empty' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inserted = [];

    for (const item of list) {
      const rollNumber = normalizeRollNumber(item.rollNumber);
      const fullName = String(item.fullName || '').trim();
      const department = String(item.department || '').trim();

      if (!rollNumber || !fullName || !department) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Every student row must include rollNumber, fullName, and department',
        });
      }

      const { rows } = await client.query(
        `INSERT INTO students (roll_number, full_name, department)
         VALUES ($1, $2, $3)
         ON CONFLICT (roll_number) DO UPDATE
           SET full_name = EXCLUDED.full_name,
               department = EXCLUDED.department,
               updated_at = NOW()
         RETURNING id, roll_number, full_name, department`,
        [rollNumber, fullName, department]
      );
      inserted.push(rows[0]);
    }

    await client.query('COMMIT');
    return res.status(201).json({ count: inserted.length, students: inserted });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    return next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
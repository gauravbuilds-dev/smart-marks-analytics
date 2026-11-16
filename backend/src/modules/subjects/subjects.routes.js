const express = require('express');
const { pool } = require('../../db/pool');
const { requireAuth, requireRole } = require('../../middleware/auth.middleware');

const router = express.Router();

router.get('/', requireAuth, requireRole('admin', 'hod', 'teacher'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, subject_code, subject_name, is_active FROM subjects ORDER BY id ASC'
    );
    return res.json({ subjects: rows });
  } catch (err) {
    return next(err);
  }
});

router.post('/', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const subjectCode = String(req.body?.subjectCode || '').trim().toUpperCase();
    const subjectName = String(req.body?.subjectName || '').trim();

    if (!subjectCode || !subjectName) {
      return res.status(400).json({ error: 'subjectCode and subjectName are required' });
    }

    const { rows } = await pool.query(
      `INSERT INTO subjects (subject_code, subject_name)
       VALUES ($1, $2)
       RETURNING id, subject_code, subject_name, is_active`,
      [subjectCode, subjectName]
    );
    return res.status(201).json({ subject: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Subject code already exists' });
    }
    return next(err);
  }
});

module.exports = router;
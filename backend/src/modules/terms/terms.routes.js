const express = require('express');
const { pool } = require('../../db/pool');
const { requireAuth, requireRole } = require('../../middleware/auth.middleware');

const router = express.Router();

router.get('/', requireAuth, requireRole('admin', 'hod', 'teacher'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, academic_year, semester_number, created_at FROM academic_terms ORDER BY academic_year DESC, semester_number ASC'
    );
    return res.json({ terms: rows });
  } catch (err) {
    return next(err);
  }
});

router.post('/', requireAuth, requireRole('admin', 'hod'), async (req, res, next) => {
  try {
    const academicYear = String(req.body?.academicYear || '').trim();
    const semesterNumber = Number(req.body?.semesterNumber);

    if (!academicYear || !Number.isInteger(semesterNumber) || semesterNumber < 1 || semesterNumber > 8) {
      return res.status(400).json({ error: 'academicYear and semesterNumber (1-8) are required' });
    }

    const { rows } = await pool.query(
      `INSERT INTO academic_terms (academic_year, semester_number)
       VALUES ($1, $2)
       RETURNING id, academic_year, semester_number`,
      [academicYear, semesterNumber]
    );
    return res.status(201).json({ term: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Academic term already exists' });
    }
    return next(err);
  }
});

router.get('/:termId/enrollments', requireAuth, requireRole('admin', 'hod', 'teacher'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT se.id, se.term_id, se.section, s.id AS student_id, s.roll_number, s.full_name, s.department
       FROM student_enrollments se
       JOIN students s ON s.id = se.student_id
       WHERE se.term_id = $1
       ORDER BY s.roll_number ASC`,
      [req.params.termId]
    );
    return res.json({ enrollments: rows });
  } catch (err) {
    return next(err);
  }
});

router.post('/:termId/enrollments', requireAuth, requireRole('admin', 'hod'), async (req, res, next) => {
  const termId = Number(req.params.termId);
  const studentIds = Array.isArray(req.body?.studentIds) ? req.body.studentIds : null;
  const section = String(req.body?.section || '').trim();

  if (!Number.isInteger(termId) || !studentIds || studentIds.length === 0 || !section) {
    return res.status(400).json({ error: 'Valid termId, studentIds array, and section are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const enrollments = [];

    for (const studentId of studentIds) {
      const { rows } = await client.query(
        `INSERT INTO student_enrollments (student_id, term_id, section)
         VALUES ($1, $2, $3)
         ON CONFLICT (student_id, term_id) DO UPDATE SET section = EXCLUDED.section
         RETURNING id, student_id, term_id, section`,
        [studentId, termId, section]
      );
      enrollments.push(rows[0]);
    }

    await client.query('COMMIT');
    return res.status(201).json({ count: enrollments.length, enrollments });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (err.code === '23503') {
      return res.status(400).json({ error: 'Invalid studentId or termId' });
    }
    return next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
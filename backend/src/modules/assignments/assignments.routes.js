const express = require('express');
const { pool } = require('../../db/pool');
const { requireAuth, requireRole } = require('../../middleware/auth.middleware');

const router = express.Router();

router.get('/', requireAuth, requireRole('admin', 'hod', 'teacher'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT sa.id, sa.teacher_id, u.full_name AS teacher_name, u.email AS teacher_email,
              sa.subject_id, s.subject_code, s.subject_name,
              sa.term_id, t.academic_year, t.semester_number
       FROM subject_assignments sa
       JOIN users u ON u.id = sa.teacher_id
       JOIN subjects s ON s.id = sa.subject_id
       JOIN academic_terms t ON t.id = sa.term_id
       ORDER BY t.academic_year DESC, t.semester_number ASC, s.subject_code ASC`
    );
    return res.json({ assignments: rows });
  } catch (err) {
    return next(err);
  }
});

router.post('/', requireAuth, requireRole('admin', 'hod'), async (req, res, next) => {
  try {
    const { teacherId, subjectId, termId } = req.body || {};
    if (!teacherId || !subjectId || !termId) {
      return res.status(400).json({ error: 'teacherId, subjectId, and termId are required' });
    }

    const teacherCheck = await pool.query(
      'SELECT id, role, is_active FROM users WHERE id = $1',
      [teacherId]
    );
    const teacher = teacherCheck.rows[0];
    if (!teacher || !teacher.is_active || teacher.role !== 'teacher') {
      return res.status(400).json({ error: 'Assigned user must be an active teacher account' });
    }

    const { rows } = await pool.query(
      `INSERT INTO subject_assignments (teacher_id, subject_id, term_id)
       VALUES ($1, $2, $3)
       RETURNING id, teacher_id, subject_id, term_id, created_at`,
      [teacherId, subjectId, termId]
    );
    return res.status(201).json({ assignment: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'This teacher is already assigned to this subject and term' });
    }
    if (err.code === '23503') {
      return res.status(400).json({ error: 'Invalid subjectId or termId' });
    }
    return next(err);
  }
});

module.exports = router;
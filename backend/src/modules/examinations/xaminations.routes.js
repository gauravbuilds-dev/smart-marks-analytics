const express = require('express');
const { pool } = require('../../db/pool');
const { requireAuth, requireRole } = require('../../middleware/auth.middleware');
const { validateExaminationInput } = require('../../utils/validators');

const router = express.Router();

router.get('/', requireAuth, requireRole('admin', 'hod', 'teacher'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT e.id, e.subject_id, s.subject_code, s.subject_name,
              e.term_id, t.academic_year, t.semester_number,
              e.exam_type, e.max_marks, e.passing_marks, e.exam_date
       FROM examinations e
       JOIN subjects s ON s.id = e.subject_id
       JOIN academic_terms t ON t.id = e.term_id
       ORDER BY t.academic_year DESC, t.semester_number ASC, e.exam_type ASC`
    );
    return res.json({ examinations: rows });
  } catch (err) {
    return next(err);
  }
});

router.post('/', requireAuth, requireRole('admin', 'hod'), async (req, res, next) => {
  try {
    const { subjectId, termId, examType, maxMarks, passingMarks, examDate } = req.body || {};
    const validationError = validateExaminationInput({
      subjectId,
      termId,
      examType,
      maxMarks,
      passingMarks,
    });

    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const { rows } = await pool.query(
      `INSERT INTO examinations (subject_id, term_id, exam_type, max_marks, passing_marks, exam_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, subject_id, term_id, exam_type, max_marks, passing_marks, exam_date`,
      [subjectId, termId, examType, Number(maxMarks), Number(passingMarks), examDate || null]
    );
    return res.status(201).json({ examination: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'This examination already exists for the subject and term' });
    }
    if (err.code === '23503') {
      return res.status(400).json({ error: 'Invalid subjectId or termId' });
    }
    return next(err);
  }
});

module.exports = router;
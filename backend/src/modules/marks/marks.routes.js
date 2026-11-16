const express = require('express');
const { pool } = require('../../db/pool');
const {
  requireAuth,
  requireRole,
  requireAssignedSubjectTeacher,
} = require('../../middleware/auth.middleware');
const {
  getMarksByExamination,
  approveUploadMarks,
  editOfficialMark,
} = require('./marks.service');

const router = express.Router();

router.get(
  '/examination/:examinationId',
  requireAuth,
  requireRole('admin', 'hod', 'teacher'),
  async (req, res, next) => {
    try {
      const marks = await getMarksByExamination(req.params.examinationId);
      return res.json({ marks });
    } catch (err) {
      return next(err);
    }
  }
);

router.post(
  '/approve-upload/:uploadedFileId',
  requireAuth,
  requireAssignedSubjectTeacher(async (req) => {
    const { rows } = await pool.query(
      `SELECT e.subject_id, e.term_id
       FROM uploaded_files uf
       JOIN examinations e ON e.id = uf.examination_id
       WHERE uf.id = $1`,
      [req.params.uploadedFileId]
    );
    if (!rows[0]) return null;
    return { subjectId: rows[0].subject_id, termId: rows[0].term_id };
  }),
  async (req, res, next) => {
    try {
      const result = await approveUploadMarks({
        uploadedFileId: Number(req.params.uploadedFileId),
        teacherId: req.user.id,
        omittedDecisions: req.body?.omittedDecisions || [],
        reason: req.body?.reason || 'OCR upload approved',
      });
      return res.status(200).json(result);
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({
          error: err.message,
          ...(err.omittedStudentIds ? { omittedStudentIds: err.omittedStudentIds } : {}),
        });
      }
      return next(err);
    }
  }
);

router.patch(
  '/:markId',
  requireAuth,
  requireAssignedSubjectTeacher(async (req) => {
    const { rows } = await pool.query(
      `SELECT e.subject_id, e.term_id
       FROM marks m
       JOIN examinations e ON e.id = m.examination_id
       WHERE m.id = $1`,
      [req.params.markId]
    );
    if (!rows[0]) return null;
    return { subjectId: rows[0].subject_id, termId: rows[0].term_id };
  }),
  async (req, res, next) => {
    try {
      const { attendanceStatus, marksObtained, reason } = req.body || {};
      const mark = await editOfficialMark({
        markId: Number(req.params.markId),
        teacherId: req.user.id,
        attendanceStatus,
        marksObtained,
        reason,
      });
      return res.status(200).json({ mark });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ error: err.message });
      }
      return next(err);
    }
  }
);

module.exports = router;
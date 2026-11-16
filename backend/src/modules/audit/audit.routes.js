const express = require('express');
const { pool } = require('../../db/pool');
const { requireAuth, requireRole } = require('../../middleware/auth.middleware');

const router = express.Router();

router.get(
  '/examination/:examinationId',
  requireAuth,
  requireRole('admin', 'hod', 'teacher'),
  async (req, res, next) => {
    try {
      const { rows } = await pool.query(
        `SELECT l.id, l.mark_id, l.examination_id, l.student_id, s.roll_number, s.full_name,
                l.action, l.old_marks, l.new_marks, l.old_status, l.new_status,
                l.changed_by, u.full_name AS changed_by_name, l.changed_at,
                l.upload_file_id, l.reason
         FROM marks_audit_logs l
         JOIN students s ON s.id = l.student_id
         JOIN users u ON u.id = l.changed_by
         WHERE l.examination_id = $1
         ORDER BY l.changed_at DESC, l.id DESC`,
        [req.params.examinationId]
      );
      return res.json({ auditLogs: rows });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
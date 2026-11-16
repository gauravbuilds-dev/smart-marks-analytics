const { pool } = require('../../db/pool');
const { validateSingleMarkRow, validateApprovalBatch } = require('./marks.validation');

async function getMarksByExamination(examinationId) {
  const { rows } = await pool.query(
    `SELECT m.id, m.examination_id, m.student_id, s.roll_number, s.full_name,
            m.marks_obtained, m.attendance_status, m.verified_by, m.verified_at,
            m.source_upload_file_id, m.updated_at
     FROM marks m
     JOIN students s ON s.id = m.student_id
     WHERE m.examination_id = $1
     ORDER BY s.roll_number ASC`,
    [examinationId]
  );
  return rows;
}

async function approveUploadMarks({ uploadedFileId, teacherId, omittedDecisions = [], reason = 'OCR upload approved' }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const fileRes = await client.query(
      `SELECT uf.id, uf.examination_id, uf.processing_status,
              e.subject_id, e.term_id, e.max_marks
       FROM uploaded_files uf
       JOIN examinations e ON e.id = uf.examination_id
       WHERE uf.id = $1
       FOR UPDATE`,
      [uploadedFileId]
    );
    const file = fileRes.rows[0];
    if (!file) {
      const err = new Error('Uploaded file or linked examination not found');
      err.statusCode = 404;
      throw err;
    }
    if (file.processing_status === 'approved') {
      const err = new Error('This uploaded file has already been approved');
      err.statusCode = 409;
      throw err;
    }

    const stagingRes = await client.query(
      `SELECT id, student_id, extracted_marks, attendance_status, verification_status
       FROM extracted_marks
       WHERE uploaded_file_id = $1`,
      [uploadedFileId]
    );

    const enrolledRes = await client.query(
      'SELECT student_id FROM student_enrollments WHERE term_id = $1',
      [file.term_id]
    );
    const enrolledStudentIds = enrolledRes.rows.map((r) => r.student_id);

    const validation = validateApprovalBatch({
      stagingRows: stagingRes.rows,
      enrolledStudentIds,
      maxMarks: Number(file.max_marks),
      omittedDecisions,
    });

    if (validation.error) {
      const err = new Error(validation.error);
      err.statusCode = 400;
      err.omittedStudentIds = validation.omittedStudentIds;
      throw err;
    }

    const existingRes = await client.query(
      'SELECT id, student_id, marks_obtained, attendance_status FROM marks WHERE examination_id = $1 FOR UPDATE',
      [file.examination_id]
    );
    const existingByStudent = new Map(existingRes.rows.map((r) => [r.student_id, r]));

    const appliedMarks = [];
    for (const row of validation.rowsToApply) {
      const existing = existingByStudent.get(row.studentId);

      const upsertRes = await client.query(
        `INSERT INTO marks (examination_id, student_id, marks_obtained, attendance_status, verified_by, verified_at, source_upload_file_id)
         VALUES ($1, $2, $3, $4, $5, NOW(), $6)
         ON CONFLICT (examination_id, student_id) DO UPDATE
           SET marks_obtained = EXCLUDED.marks_obtained,
               attendance_status = EXCLUDED.attendance_status,
               verified_by = EXCLUDED.verified_by,
               verified_at = NOW(),
               source_upload_file_id = EXCLUDED.source_upload_file_id,
               updated_at = NOW()
         RETURNING id, examination_id, student_id, marks_obtained, attendance_status`,
        [file.examination_id, row.studentId, row.marksObtained, row.attendanceStatus, teacherId, uploadedFileId]
      );

      const savedMark = upsertRes.rows[0];
      appliedMarks.push(savedMark);

      const oldMarks = existing ? (existing.marks_obtained !== null ? Number(existing.marks_obtained) : null) : null;
      const oldStatus = existing ? existing.attendance_status : null;
      const hasChanged = !existing || oldMarks !== row.marksObtained || oldStatus !== row.attendanceStatus;

      if (hasChanged) {
        await client.query(
          `INSERT INTO marks_audit_logs
             (mark_id, examination_id, student_id, action, old_marks, new_marks, old_status, new_status, changed_by, upload_file_id, reason)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            savedMark.id,
            file.examination_id,
            row.studentId,
            existing ? 'UPDATE' : 'INSERT',
            oldMarks,
            row.marksObtained,
            oldStatus,
            row.attendanceStatus,
            teacherId,
            uploadedFileId,
            reason,
          ]
        );
      }
    }

    await client.query(
      `UPDATE uploaded_files
       SET processing_status = 'approved', processed_at = NOW()
       WHERE id = $1`,
      [uploadedFileId]
    );

    await client.query(
      `INSERT INTO processing_events (uploaded_file_id, event_type, details)
       VALUES ($1, 'approval_completed', $2)`,
      [uploadedFileId, JSON.stringify({ approvedBy: teacherId, rowsApplied: appliedMarks.length })]
    );

    await client.query('COMMIT');
    return { approvedCount: appliedMarks.length, marks: appliedMarks };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function editOfficialMark({ markId, teacherId, attendanceStatus, marksObtained, reason }) {
  if (!reason || !String(reason).trim()) {
    const err = new Error('A reason is required when editing an official mark');
    err.statusCode = 400;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const currentRes = await client.query(
      `SELECT m.id, m.examination_id, m.student_id, m.marks_obtained, m.attendance_status, e.max_marks
       FROM marks m
       JOIN examinations e ON e.id = m.examination_id
       WHERE m.id = $1
       FOR UPDATE`,
      [markId]
    );
    const current = currentRes.rows[0];
    if (!current) {
      const err = new Error('Official mark record not found');
      err.statusCode = 404;
      throw err;
    }

    const rowError = validateSingleMarkRow(
      { studentId: current.student_id, attendanceStatus, marksObtained },
      Number(current.max_marks)
    );
    if (rowError) {
      const err = new Error(rowError);
      err.statusCode = 400;
      throw err;
    }

    const normalizedMarks = attendanceStatus === 'present' ? Number(marksObtained) : null;

    const updatedRes = await client.query(
      `UPDATE marks
       SET marks_obtained = $1,
           attendance_status = $2,
           verified_by = $3,
           verified_at = NOW(),
           updated_at = NOW()
       WHERE id = $4
       RETURNING id, examination_id, student_id, marks_obtained, attendance_status, verified_by, updated_at`,
      [normalizedMarks, attendanceStatus, teacherId, markId]
    );

    await client.query(
      `INSERT INTO marks_audit_logs
         (mark_id, examination_id, student_id, action, old_marks, new_marks, old_status, new_status, changed_by, reason)
       VALUES ($1, $2, $3, 'UPDATE', $4, $5, $6, $7, $8, $9)`,
      [
        current.id,
        current.examination_id,
        current.student_id,
        current.marks_obtained,
        normalizedMarks,
        current.attendance_status,
        attendanceStatus,
        teacherId,
        String(reason).trim(),
      ]
    );

    await client.query('COMMIT');
    return updatedRes.rows[0];
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  getMarksByExamination,
  approveUploadMarks,
  editOfficialMark,
};
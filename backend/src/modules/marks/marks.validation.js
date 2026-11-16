function validateSingleMarkRow(row, maxMarks) {
  const { studentId, attendanceStatus, marksObtained } = row;
  if (!studentId) {
    return 'Every row must be matched to a studentId';
  }
  if (!['present', 'absent', 'missing'].includes(attendanceStatus)) {
    return `Invalid attendanceStatus "${attendanceStatus}" for studentId ${studentId}`;
  }

  if (attendanceStatus === 'present') {
    const score = Number(marksObtained);
    if (marksObtained === null || marksObtained === undefined || !Number.isFinite(score)) {
      return `Present studentId ${studentId} must have numeric marks`;
    }
    if (score < 0 || score > Number(maxMarks)) {
      return `Marks for studentId ${studentId} must be between 0 and ${maxMarks}`;
    }
  } else if (marksObtained !== null && marksObtained !== undefined) {
    return `StudentId ${studentId} with status "${attendanceStatus}" must have null marks (absent is not 0)`;
  }

  return null;
}

function validateApprovalBatch({
  stagingRows,
  enrolledStudentIds,
  maxMarks,
  omittedDecisions = [],
}) {
  if (!Array.isArray(stagingRows) || stagingRows.length === 0) {
    return { error: 'No staging rows found to approve' };
  }

  const seenStudents = new Set();
  const normalizedRows = [];

  for (const row of stagingRows) {
    if (row.verification_status === 'rejected') {
      continue;
    }
    if (row.verification_status !== 'verified') {
      return {
        error: `All non-rejected rows must be verified before approval (row ${row.id} is ${row.verification_status})`,
      };
    }

    const rowError = validateSingleMarkRow(
      {
        studentId: row.student_id,
        attendanceStatus: row.attendance_status,
        marksObtained: row.extracted_marks,
      },
      maxMarks
    );
    if (rowError) {
      return { error: rowError };
    }

    if (seenStudents.has(row.student_id)) {
      return { error: `Duplicate student row detected for studentId ${row.student_id}` };
    }
    seenStudents.add(row.student_id);

    normalizedRows.push({
      studentId: row.student_id,
      attendanceStatus: row.attendance_status,
      marksObtained: row.attendance_status === 'present' ? Number(row.extracted_marks) : null,
    });
  }

  if (normalizedRows.length === 0) {
    return { error: 'At least one verified student row is required for approval' };
  }

  const decisionMap = new Map();
  for (const d of omittedDecisions) {
    if (!['absent', 'missing', 'keep_existing'].includes(d.action)) {
      return { error: `Invalid omitted student action "${d.action}" for studentId ${d.studentId}` };
    }
    decisionMap.set(d.studentId, d.action);
  }

  const missingStudents = [];
  for (const enrolledId of enrolledStudentIds) {
    if (seenStudents.has(enrolledId)) {
      continue;
    }
    const action = decisionMap.get(enrolledId);
    if (!action) {
      missingStudents.push(enrolledId);
    } else if (action === 'absent' || action === 'missing') {
      normalizedRows.push({
        studentId: enrolledId,
        attendanceStatus: action,
        marksObtained: null,
      });
    }
  }

  if (missingStudents.length > 0) {
    return {
      error: 'Omitted enrolled students require an explicit teacher decision before approval',
      omittedStudentIds: missingStudents,
    };
  }

  return { error: null, rowsToApply: normalizedRows };
}

module.exports = {
  validateSingleMarkRow,
  validateApprovalBatch,
};
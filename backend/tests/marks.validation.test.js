const test = require('node:test');
const assert = require('node:assert/strict');
const { validateSingleMarkRow, validateApprovalBatch } = require('../src/modules/marks/marks.validation');

test('present student with 0 marks is valid; absent must have null marks', () => {
  assert.equal(
    validateSingleMarkRow({ studentId: 1, attendanceStatus: 'present', marksObtained: 0 }, 40),
    null
  );
  assert.equal(
    validateSingleMarkRow({ studentId: 2, attendanceStatus: 'absent', marksObtained: null }, 40),
    null
  );
  assert.ok(
    validateSingleMarkRow({ studentId: 2, attendanceStatus: 'absent', marksObtained: 0 }, 40)
  );
});

test('marks above examination maxMarks or negative marks are rejected', () => {
  assert.ok(
    validateSingleMarkRow({ studentId: 1, attendanceStatus: 'present', marksObtained: 41 }, 40)
  );
  assert.ok(
    validateSingleMarkRow({ studentId: 1, attendanceStatus: 'present', marksObtained: -1 }, 40)
  );
});

test('duplicate students and omitted enrolled students are blocked unless teacher decides', () => {
  const dupResult = validateApprovalBatch({
    stagingRows: [
      { id: 1, student_id: 10, attendance_status: 'present', extracted_marks: 25, verification_status: 'verified' },
      { id: 2, student_id: 10, attendance_status: 'present', extracted_marks: 26, verification_status: 'verified' },
    ],
    enrolledStudentIds: [10],
    maxMarks: 40,
  });
  assert.ok(dupResult.error);

  const omittedBlocked = validateApprovalBatch({
    stagingRows: [
      { id: 1, student_id: 10, attendance_status: 'present', extracted_marks: 25, verification_status: 'verified' },
    ],
    enrolledStudentIds: [10, 11],
    maxMarks: 40,
  });
  assert.ok(omittedBlocked.error);
  assert.deepEqual(omittedBlocked.omittedStudentIds, [11]);

  const omittedResolved = validateApprovalBatch({
    stagingRows: [
      { id: 1, student_id: 10, attendance_status: 'present', extracted_marks: 25, verification_status: 'verified' },
    ],
    enrolledStudentIds: [10, 11],
    maxMarks: 40,
    omittedDecisions: [{ studentId: 11, action: 'absent' }],
  });
  assert.equal(omittedResolved.error, null);
  assert.equal(omittedResolved.rowsToApply.length, 2);
});
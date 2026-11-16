const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeRollNumber, validateExaminationInput } = require('../src/utils/validators');

test('normalizeRollNumber trims whitespace and uppercases', () => {
  assert.equal(normalizeRollNumber('  cs25001 '), 'CS25001');
  assert.equal(normalizeRollNumber(''), '');
});

test('validateExaminationInput accepts configurable maxMarks and passingMarks', () => {
  assert.equal(
    validateExaminationInput({
      subjectId: 1,
      termId: 1,
      examType: 'CT-1',
      maxMarks: 50,
      passingMarks: 20,
    }),
    null
  );
});

test('validateExaminationInput rejects invalid maxMarks, passingMarks, or examType', () => {
  assert.ok(
    validateExaminationInput({
      subjectId: 1,
      termId: 1,
      examType: 'CT-3',
      maxMarks: 40,
      passingMarks: 16,
    })
  );

  assert.ok(
    validateExaminationInput({
      subjectId: 1,
      termId: 1,
      examType: 'CT-1',
      maxMarks: 0,
      passingMarks: 0,
    })
  );

  assert.ok(
    validateExaminationInput({
      subjectId: 1,
      termId: 1,
      examType: 'CT-2',
      maxMarks: 40,
      passingMarks: 45,
    })
  );
});
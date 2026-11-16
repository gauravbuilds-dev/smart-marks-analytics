function normalizeRollNumber(rollNumber) {
  return String(rollNumber || '').trim().toUpperCase();
}

function validateExaminationInput({ subjectId, termId, examType, maxMarks, passingMarks }) {
  if (!subjectId || !termId) {
    return 'subjectId and termId are required';
  }
  if (!['CT-1', 'CT-2'].includes(examType)) {
    return 'examType must be CT-1 or CT-2';
  }

  const max = Number(maxMarks);
  const pass = Number(passingMarks);

  if (!Number.isFinite(max) || max <= 0) {
    return 'maxMarks must be a number greater than 0';
  }
  if (!Number.isFinite(pass) || pass < 0 || pass > max) {
    return 'passingMarks must be between 0 and maxMarks';
  }

  return null;
}

module.exports = {
  normalizeRollNumber,
  validateExaminationInput,
};
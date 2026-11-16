const test = require('node:test');
const assert = require('node:assert/strict');
const { createAuthMiddleware } = require('../src/middleware/auth.middleware');

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

test('requireRole allows admin, hod, and teacher for view and upload routes', () => {
  const { requireRole } = createAuthMiddleware();
  const canViewOrUpload = requireRole('admin', 'hod', 'teacher');

  for (const role of ['admin', 'hod', 'teacher']) {
    const req = { user: { id: 1, role } };
    const res = createMockRes();
    let calledNext = false;

    canViewOrUpload(req, res, () => {
      calledNext = true;
    });

    assert.equal(calledNext, true, `Expected ${role} to be allowed`);
  }
});

test('requireAssignedSubjectTeacher blocks admin and hod from approving or editing official marks', async () => {
  const { requireAssignedSubjectTeacher } = createAuthMiddleware({
    queryFn: async () => ({ rows: [{ id: 99 }] }),
  });

  const guard = requireAssignedSubjectTeacher(() => ({ subjectId: 1, termId: 1 }));

  for (const role of ['admin', 'hod']) {
    const req = { user: { id: 1, role } };
    const res = createMockRes();
    let calledNext = false;

    await guard(req, res, () => {
      calledNext = true;
    });

    assert.equal(calledNext, false, `Expected ${role} to be blocked`);
    assert.equal(res.statusCode, 403);
  }
});

test('requireAssignedSubjectTeacher allows assigned teacher and blocks unassigned teacher', async () => {
  const { requireAssignedSubjectTeacher } = createAuthMiddleware({
    queryFn: async (_sql, [teacherId, subjectId, termId]) => {
      if (teacherId === 10 && subjectId === 2 && termId === 1) {
        return { rows: [{ id: 5 }] };
      }
      return { rows: [] };
    },
  });

  const guard = requireAssignedSubjectTeacher((req) => req.target);

  const assignedReq = { user: { id: 10, role: 'teacher' }, target: { subjectId: 2, termId: 1 } };
  const assignedRes = createMockRes();
  let assignedNext = false;
  await guard(assignedReq, assignedRes, () => {
    assignedNext = true;
  });
  assert.equal(assignedNext, true);

  const unassignedReq = { user: { id: 11, role: 'teacher' }, target: { subjectId: 2, termId: 1 } };
  const unassignedRes = createMockRes();
  let unassignedNext = false;
  await guard(unassignedReq, unassignedRes, () => {
    unassignedNext = true;
  });
  assert.equal(unassignedNext, false);
  assert.equal(unassignedRes.statusCode, 403);
});
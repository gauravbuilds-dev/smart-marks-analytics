const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { pool } = require('../db/pool');

function createAuthMiddleware({ verifyToken = jwt.verify, queryFn = pool.query.bind(pool) } = {}) {
  async function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return res.status(401).json({ error: 'Authentication token missing' });
    }

    if (!env.jwtSecret) {
      return res.status(500).json({ error: 'Server JWT configuration missing' });
    }

    try {
      const payload = verifyToken(token, env.jwtSecret);
      const { rows } = await queryFn(
        'SELECT id, full_name, email, role, is_active FROM users WHERE id = $1',
        [payload.sub]
      );

      const user = rows[0];
      if (!user || !user.is_active) {
        return res.status(401).json({ error: 'User account is invalid or inactive' });
      }

      req.user = user;
      return next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  function requireRole(...allowedRoles) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          error: `Forbidden: requires one of [${allowedRoles.join(', ')}]`,
        });
      }
      return next();
    };
  }

  function requireAssignedSubjectTeacher(resolveTarget) {
    return async (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (req.user.role !== 'teacher') {
        return res.status(403).json({
          error: 'Forbidden: only the assigned subject teacher can approve or edit official marks',
        });
      }

      try {
        const target = await resolveTarget(req);
        if (!target || !target.subjectId || !target.termId) {
          return res.status(400).json({
            error: 'Subject and academic term are required to verify assignment',
          });
        }

        const { rows } = await queryFn(
          `SELECT id FROM subject_assignments
           WHERE teacher_id = $1 AND subject_id = $2 AND term_id = $3
           LIMIT 1`,
          [req.user.id, target.subjectId, target.termId]
        );

        if (rows.length === 0) {
          return res.status(403).json({
            error: 'Forbidden: you are not assigned to this subject for the selected term',
          });
        }

        return next();
      } catch (err) {
        return next(err);
      }
    };
  }

  return {
    requireAuth,
    requireRole,
    requireAssignedSubjectTeacher,
  };
}

const defaultAuthMiddleware = createAuthMiddleware();

module.exports = {
  createAuthMiddleware,
  ...defaultAuthMiddleware,
};
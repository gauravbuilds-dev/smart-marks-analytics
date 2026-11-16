const express = require('express');
const { checkDatabaseHealth } = require('./db/pool');
const authRoutes = require('./modules/auth/auth.routes');
const studentsRoutes = require('./modules/students/students.routes');
const subjectsRoutes = require('./modules/subjects/subjects.routes');
const termsRoutes = require('./modules/terms/terms.routes');
const assignmentsRoutes = require('./modules/assignments/assignments.routes');
const examinationsRoutes = require('./modules/examinations/examinations.routes');
const marksRoutes = require('./modules/marks/marks.routes');
const auditRoutes = require('./modules/audit/audit.routes');

const app = express();

app.use(express.json({ limit: '1mb' }));

app.get('/health', async (req, res) => {
  try {
    const db = await checkDatabaseHealth();
    if (!db.ok) {
      return res.status(503).json({
        status: 'degraded',
        database: 'unavailable',
        detail: db.error || 'Database check failed',
      });
    }

    return res.status(200).json({
      status: 'ok',
      database: 'connected',
    });
  } catch (err) {
    return res.status(503).json({
      status: 'error',
      database: 'disconnected',
      detail: err.message,
    });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/subjects', subjectsRoutes);
app.use('/api/terms', termsRoutes);
app.use('/api/assignments', assignmentsRoutes);
app.use('/api/examinations', examinationsRoutes);
app.use('/api/marks', marksRoutes);
app.use('/api/audit', auditRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  return res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
const express = require('express');
const { login, me, registerUser } = require('./auth.controller');
const { requireAuth, requireRole } = require('../../middleware/auth.middleware');

const router = express.Router();

router.post('/login', login);
router.get('/me', requireAuth, me);
router.post('/users', requireAuth, requireRole('admin'), registerUser);

module.exports = router;
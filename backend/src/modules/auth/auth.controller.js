const { loginWithEmailAndPassword, createUser } = require('./auth.service');

async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    const result = await loginWithEmailAndPassword(email, password);
    return res.status(200).json(result);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return next(err);
  }
}

async function me(req, res) {
  return res.status(200).json({
    user: {
      id: req.user.id,
      fullName: req.user.full_name,
      email: req.user.email,
      role: req.user.role,
    },
  });
}

async function registerUser(req, res, next) {
  try {
    const { fullName, email, password, role } = req.body || {};
    const user = await createUser({ fullName, email, password, role });
    return res.status(201).json({ user });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return next(err);
  }
}

module.exports = {
  login,
  me,
  registerUser,
};
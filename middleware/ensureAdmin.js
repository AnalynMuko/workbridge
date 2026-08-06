import { User } from '../models/userModel.js';

export default async function ensureAdmin(req, res, next) {
  try {
    // session flag set on admin login (fallback to DB lookup)
    if (req.session && req.session.isAdmin) return next();

    const userId = req.getUserId ? req.getUserId() : (req.session && req.session.userId);
    if (!userId) return res.redirect('/admin/login');

    const user = await User.findByPk(userId);
    if (user && user.isAdmin) return next();

    return res.status(403).send('Forbidden: admin only');
  } catch (err) {
    console.error('ensureAdmin error', err);
    return res.status(500).send('Server error');
  }
}

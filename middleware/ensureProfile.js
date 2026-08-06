import { Profile } from "../models/Profile.js";

export default async function ensureProfile(req, res, next) {
  try {
    const userId = req.getUserId ? req.getUserId() : (req.session && req.session.userId);
    if (!userId) return res.redirect('/login');

    const profile = await Profile.findOne({ where: { userId } });
    if (!profile) return res.redirect('/profile-setup');

    next();
  } catch (err) {
    console.error('ensureProfile error:', err);
    res.status(500).send('Server error');
  }
}

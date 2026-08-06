import bcrypt from 'bcrypt';
import { User } from '../models/userModel.js';
import { SocialPost } from '../models/SocialPost.js';
import fs from 'fs';
import path from 'path';
import { Job } from '../models/Job.js';
import { AuditLog } from '../models/AuditLog.js';
import { Op } from 'sequelize';
import { sendMail } from '../utils/mailer.js';

export const loginPage = (req, res) => {
  res.render('admin/login', { title: 'Admin Login' });
};

export const loginHandler = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Accept the special admin credentials or a user marked isAdmin
    const SPECIAL_EMAIL = 'mainadmin123@gmail.com';
    const SPECIAL_PASS = 'mainadmin123';

    let adminUser = await User.findOne({ where: { email } });

    if (email === SPECIAL_EMAIL && password === SPECIAL_PASS) {
      // ensure admin user exists
      if (!adminUser) {
        const hashed = await bcrypt.hash(password, 10);
        adminUser = await User.create({ name: 'Main Admin', email, password: hashed, isAdmin: true });
      } else {
        // mark as admin
        adminUser.isAdmin = true;
        await adminUser.save();
      }
      req.session.userId = adminUser.id;
      req.session.isAdmin = true;
      return res.redirect('/adminside');
    }

    // Otherwise, check user record for admin
    if (adminUser) {
      const match = await bcrypt.compare(password, adminUser.password);
      if (match && adminUser.isAdmin) {
        req.session.userId = adminUser.id;
        req.session.isAdmin = true;
        return res.redirect('/adminside');
      }
    }

    req.flash('error_msg', 'Invalid admin credentials');
    return res.redirect('/admin/login');
  } catch (err) {
    console.error('admin login error', err);
    res.status(500).send('Server error');
  }
};

export const logoutHandler = (req, res) => {
  try {
    if (req.session) {
      // destroy session fully on admin logout
      req.session.destroy((err) => {
        if (err) {
          console.error('Error destroying session on admin logout', err);
        }
        return res.redirect('/login');
      });
    } else {
      return res.redirect('/login');
    }
  } catch (err) {
    console.error('logoutHandler error', err);
    return res.redirect('/login');
  }
};

export const dashboardPage = async (req, res) => {
  try {
    const usersCount = await User.count();
    let jobsCount = 0;
    let postsCount = 0;
    let messagesCount = 0;
    let notificationsCount = 0;

    try {
      const jobMod = await import('../models/Job.js');
      if (jobMod && jobMod.Job) jobsCount = await jobMod.Job.count();
      else if (jobMod && jobMod.default) jobsCount = await jobMod.default.count();
    } catch (e) {}

    try {
      const postMod = await import('../models/SocialPost.js');
      if (postMod && postMod.SocialPost) postsCount = await postMod.SocialPost.count();
      else if (postMod && postMod.default) postsCount = await postMod.default.count();
    } catch (e) {}

    try {
      const msgMod = await import('../models/Message.js');
      if (msgMod && msgMod.Message) messagesCount = await msgMod.Message.count();
      else if (msgMod && msgMod.default) messagesCount = await msgMod.default.count();
    } catch (e) {}

    try {
      const nMod = await import('../models/Notification.js');
      if (nMod && nMod.Notification) notificationsCount = await nMod.Notification.count();
      else if (nMod && nMod.default) notificationsCount = await nMod.default.count();
    } catch (e) {}

    res.render('admin/dashboard', { title: 'Admin Dashboard', stats: { usersCount, jobsCount, postsCount, messagesCount, notificationsCount } });
  } catch (err) {
    console.error('admin dashboard error', err);
    res.status(500).send('Server error');
  }
};

export const listUsers = async (req, res) => {
  try {
    const users = await User.findAll({ attributes: ['id','name','email','isAdmin','createdAt'] , order: [['createdAt','DESC']] });
    res.render('admin/users', { title: 'Manage Users', users });
  } catch (err) {
    console.error('admin list users error', err);
    res.status(500).send('Server error');
  }
};

export const deleteUser = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.redirect('/admin/users');
    await User.destroy({ where: { id } });
    res.redirect('/admin/users');
  } catch (err) {
    console.error('admin delete user error', err);
    res.status(500).send('Server error');
  }
};

export const viewUserAdmin = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.redirect('/admin/users');
    const user = await User.findByPk(id, { attributes: ['id','name','email','isAdmin','createdAt'] });
    if (!user) return res.status(404).send('User not found');
    // try to load profile info if available
    let profile = null;
    try {
      const { Profile } = await import('../models/Profile.js');
      profile = await Profile.findOne({ where: { userId: id } });
    } catch (e) { profile = null; }
    res.render('admin/viewUser', { title: 'View User', user, profile });
  } catch (err) {
    console.error('admin view user error', err);
    res.status(500).send('Server error');
  }
};

export const changeUserRoleAdmin = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.redirect('/admin/users');
    const user = await User.findByPk(id);
    if (!user) return res.status(404).send('User not found');
    // form sends isAdmin as 'true' or 'false' (string)
    const desired = req.body.isAdmin;
    const makeAdmin = desired === 'true' || desired === 'on' || desired === '1';
    user.isAdmin = makeAdmin;
    await user.save();
    try { await AuditLog.create({ actorUserId: req.session && req.session.userId, action: makeAdmin ? 'promote_user' : 'demote_user', targetType: 'User', targetId: id, details: { isAdmin: user.isAdmin } }); } catch(e) { console.error('audit log error', e); }
    req.flash('success_msg', 'User role updated');
    res.redirect('/admin/users/' + id);
  } catch (err) {
    console.error('admin change user role error', err);
    res.status(500).send('Server error');
  }
};

export const adminSidePage = async (req, res) => {
  try {
    // reuse the same stats-gathering approach as dashboardPage
    const usersCount = await User.count();
    let jobsCount = 0;
    let postsCount = 0;
    let messagesCount = 0;
    let notificationsCount = 0;

    try {
      const jobMod = await import('../models/Job.js');
      if (jobMod && jobMod.Job) jobsCount = await jobMod.Job.count();
      else if (jobMod && jobMod.default) jobsCount = await jobMod.default.count();
    } catch (e) {}

    try {
      const postMod = await import('../models/SocialPost.js');
      if (postMod && postMod.SocialPost) postsCount = await postMod.SocialPost.count();
      else if (postMod && postMod.default) postsCount = await postMod.default.count();
    } catch (e) {}

    try {
      const msgMod = await import('../models/Message.js');
      if (msgMod && msgMod.Message) messagesCount = await msgMod.Message.count();
      else if (msgMod && msgMod.default) messagesCount = await msgMod.default.count();
    } catch (e) {}

    try {
      const nMod = await import('../models/Notification.js');
      if (nMod && nMod.Notification) notificationsCount = await nMod.Notification.count();
      else if (nMod && nMod.default) notificationsCount = await nMod.default.count();
    } catch (e) {}

    // Top jobs by proposals (dynamic, from DB)
    let topJobs = [];
    let topJobLabelsJson = '[]';
    let topJobCountsJson = '[]';
    try {
      const topRaw = await Job.findAll({ where: { removed: false }, order: [['proposalsCount','DESC']], limit: 6 });
      topJobs = topRaw.map(j => ({ id: j.id, title: j.title, proposalsCount: j.proposalsCount || 0 }));
      const labels = topJobs.map(j => (j.title && j.title.length > 40) ? j.title.slice(0, 37) + '...' : (j.title || `#${j.id}`));
      const counts = topJobs.map(j => j.proposalsCount || 0);
      topJobLabelsJson = JSON.stringify(labels);
      topJobCountsJson = JSON.stringify(counts);
    } catch (err) {
      console.error('Failed to load top jobs for admin chart', err);
    }

    res.render('adminside', { title: 'Admin Panel', stats: { usersCount, jobsCount, postsCount, messagesCount, notificationsCount }, topJobs, topJobLabelsJson, topJobCountsJson });
  } catch (err) {
    console.error('admin side error', err);
    res.status(500).send('Server error');
  }
};

export const listSocialPostsAdmin = async (req, res) => {
  try {
    // show all posts to admin (including removed) so they can restore if needed
    const posts = await SocialPost.findAll({ order: [['createdAt','DESC']] });
    // attach poster name and avatar
    const postsFormatted = await Promise.all(posts.map(async (p) => {
      const user = await User.findByPk(p.userId);
      let posterAvatar = null;
      try {
        const { Profile } = await import('../models/Profile.js');
        const profile = await Profile.findOne({ where: { userId: p.userId } });
        posterAvatar = profile ? profile.avatar : null;
      } catch (err) {
        posterAvatar = null;
      }
      return { id: p.id, content: p.content, image: p.image, createdAt: p.createdAt, posterName: user ? user.name : 'Unknown', posterAvatar, removed: p.removed };
    }));
    res.render('admin/posts', { title: 'Review Posts', posts: postsFormatted });
  } catch (err) {
    console.error('admin list posts error', err);
    res.status(500).send('Server error');
  }
};

export const viewSocialPostAdmin = async (req, res) => {
  try {
    const id = req.params.id;
    const post = await SocialPost.findByPk(id);
    if (!post) return res.status(404).send('Post not found');
    const user = await User.findByPk(post.userId);
    let posterAvatar = null;
    try {
      const { Profile } = await import('../models/Profile.js');
      const profile = await Profile.findOne({ where: { userId: post.userId } });
      posterAvatar = profile ? profile.avatar : null;
    } catch (err) { posterAvatar = null; }
    res.render('admin/viewPost', { title: 'View Post', post: { id: post.id, content: post.content, image: post.image, createdAt: post.createdAt, posterName: user ? user.name : 'Unknown', posterAvatar, removed: post.removed } });
  } catch (err) {
    console.error('admin view post error', err);
    res.status(500).send('Server error');
  }
};

export const deleteSocialPostAdmin = async (req, res) => {
  try {
    const id = req.params.id;
    const post = await SocialPost.findByPk(id);
    if (post && !post.removed) {
      post.removed = true;
      post.removedAt = new Date();
      await post.save();
      // record audit
      try { await AuditLog.create({ actorUserId: req.session && req.session.userId, action: 'soft_delete_post', targetType: 'SocialPost', targetId: id, details: { content: post.content } }); } catch(e) { console.error('audit log error', e); }
    }
    res.redirect('/admin/posts');
  } catch (err) {
    console.error('admin delete post error', err);
    res.status(500).send('Server error');
  }
};

export const restoreSocialPostAdmin = async (req, res) => {
  try {
    const id = req.params.id;
    const post = await SocialPost.findByPk(id);
    if (post && post.removed) {
      post.removed = false;
      post.removedAt = null;
      await post.save();
      try { await AuditLog.create({ actorUserId: req.session && req.session.userId, action: 'restore_post', targetType: 'SocialPost', targetId: id, details: {} }); } catch(e) { console.error('audit log error', e); }
    }
    res.redirect('/admin/posts');
  } catch (err) {
    console.error('admin restore post error', err);
    res.status(500).send('Server error');
  }
};

export const listJobsAdmin = async (req, res) => {
  try {
    // pagination & optional filter support
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(50, Math.max(5, parseInt(req.query.limit || '10', 10)));
    const offset = (page - 1) * limit;

    const filter = req.query.filter || 'all';
    const where = {};
    if (filter === 'removed') where.removed = true;
    else if (filter === 'active') where.removed = false;

    const { count, rows } = await Job.findAndCountAll({ where, order: [['createdAt','DESC']], limit, offset });
    const jobsFormatted = await Promise.all(rows.map(async (j) => {
      const user = await User.findByPk(j.userId);
      return { id: j.id, title: j.title, posterName: user ? user.name : 'Unknown', status: j.status, createdAt: j.createdAt, removed: j.removed };
    }));

    const totalPages = Math.max(1, Math.ceil(count / limit));
    res.render('admin/jobs', { title: 'Review Jobs', jobs: jobsFormatted, pagination: { page, limit, total: count, totalPages }, filter });
  } catch (err) {
    console.error('admin list jobs error', err);
    res.status(500).send('Server error');
  }
};

export const viewJobAdmin = async (req, res) => {
  try {
    const id = req.params.id;
    const job = await Job.findByPk(id);
    if (!job) return res.status(404).send('Job not found');
    const user = await User.findByPk(job.userId);
    res.render('admin/viewJob', { title: 'View Job', job: { id: job.id, title: job.title, position: job.position, description: job.description, budget: job.budget, currency: job.currency, deadline: job.deadline, status: job.status, posterName: user ? user.name : 'Unknown', removed: job.removed } });
  } catch (err) {
    console.error('admin view job error', err);
    res.status(500).send('Server error');
  }
};

export const changeJobStatusAdmin = async (req, res) => {
  try {
    const id = req.params.id;
    const { status } = req.body;
    const job = await Job.findByPk(id);
    if (!job) return res.status(404).send('Job not found');
    job.status = status || job.status;
    await job.save();
    try { await AuditLog.create({ actorUserId: req.session && req.session.userId, action: 'change_job_status', targetType: 'Job', targetId: id, details: { status: job.status } }); } catch(e) { console.error('audit log error', e); }
    res.redirect('/admin/jobs');
  } catch (err) {
    console.error('admin change job status error', err);
    res.status(500).send('Server error');
  }
};

export const deleteJobAdmin = async (req, res) => {
  try {
    const id = req.params.id;
    const job = await Job.findByPk(id);
    if (job && !job.removed) {
      job.removed = true;
      job.removedAt = new Date();
      await job.save();
      try { await AuditLog.create({ actorUserId: req.session && req.session.userId, action: 'soft_delete_job', targetType: 'Job', targetId: id, details: { title: job.title } }); } catch(e) { console.error('audit log error', e); }
    }
    res.redirect('/admin/jobs');
  } catch (err) {
    console.error('admin delete job error', err);
    res.status(500).send('Server error');
  }
};

export const restoreJobAdmin = async (req, res) => {
  try {
    const id = req.params.id;
    const job = await Job.findByPk(id);
    if (job && job.removed) {
      job.removed = false;
      job.removedAt = null;
      await job.save();
      try { await AuditLog.create({ actorUserId: req.session && req.session.userId, action: 'restore_job', targetType: 'Job', targetId: id, details: { title: job.title } }); } catch(e) { console.error('audit log error', e); }
    }
    res.redirect('/admin/jobs');
  } catch (err) {
    console.error('admin restore job error', err);
    res.status(500).send('Server error');
  }
};

export const listAuditLogsAdmin = async (req, res) => {
  try {
    // pagination + optional search
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(50, Math.max(10, parseInt(req.query.limit || '20', 10)));
    const offset = (page - 1) * limit;

    const q = (req.query.q || '').trim();
    const actionFilter = req.query.action || '';

    const where = {};
    if (actionFilter) where.action = actionFilter;
    if (q) {
      const or = [
        { action: { [Op.like]: `%${q}%` } },
        { targetType: { [Op.like]: `%${q}%` } }
      ];
      // if q is numeric, search by targetId as well
      const asNum = parseInt(q, 10);
      if (!isNaN(asNum)) or.push({ targetId: asNum });
      where[Op.or] = or;
    }

    const { count, rows } = await AuditLog.findAndCountAll({ where, order: [['createdAt','DESC']], limit, offset });
    const formatted = await Promise.all(rows.map(async (l) => {
      let actorName = 'System';
      if (l.actorUserId) {
        const u = await User.findByPk(l.actorUserId);
        actorName = u ? u.name : `#${l.actorUserId}`;
      }
      return { id: l.id, actorName, action: l.action, targetType: l.targetType, targetId: l.targetId, details: l.details, createdAt: l.createdAt };
    }));

    const totalPages = Math.max(1, Math.ceil(count / limit));
    res.render('admin/audit', { title: 'Audit Logs', logs: formatted, pagination: { page, limit, total: count, totalPages }, q, actionFilter });
  } catch (err) {
    console.error('admin list audit error', err);
    res.status(500).send('Server error');
  }
};

export const moderationPage = async (req, res) => {
  try {
    // provide counts for moderation center
    const totalPosts = await SocialPost.count();
    const removedPosts = await SocialPost.count({ where: { removed: true } });
    let totalJobs = 0;
    let removedJobs = 0;
    try {
      totalJobs = await Job.count();
      removedJobs = await Job.count({ where: { removed: true } });
    } catch (e) {}

    res.render('admin/moderation', { title: 'Moderation', stats: { totalPosts, removedPosts, totalJobs, removedJobs } });
  } catch (err) {
    console.error('admin moderation page error', err);
    res.status(500).send('Server error');
  }
};

export const reviewPostsAdmin = async (req, res) => {
  try {
    const posts = await SocialPost.findAll({ order: [['createdAt','DESC']] });
    const postsFormatted = await Promise.all(posts.map(async (p) => {
      const user = await User.findByPk(p.userId);
      let posterAvatar = null;
      try {
        const { Profile } = await import('../models/Profile.js');
        const profile = await Profile.findOne({ where: { userId: p.userId } });
        posterAvatar = profile ? profile.avatar : null;
      } catch (err) {
        posterAvatar = null;
      }
      return { id: p.id, content: p.content, image: p.image, createdAt: p.createdAt, posterName: user ? user.name : 'Unknown', posterAvatar, removed: p.removed };
    }));
    res.render('reviewpost', { title: 'Review Posts', posts: postsFormatted });
  } catch (err) {
    console.error('review posts admin error', err);
    res.status(500).send('Server error');
  }
};

export const sendWarningToUser = async (req, res) => {
  try {
    const id = req.params.id;
    const { message } = req.body;
    const post = await SocialPost.findByPk(id);
    if (!post) return res.status(404).send('Post not found');
    // create notification for the post owner
    try {
      const { Notification } = await import('../models/Notification.js');
      await Notification.create({ userId: post.userId, type: 'admin_warning', data: { postId: id, message }, read: false });
    } catch (e) { console.error('failed to create warning notification', e); }
    try { await AuditLog.create({ actorUserId: req.session && req.session.userId, action: 'warn_user_post', targetType: 'SocialPost', targetId: id, details: { message } }); } catch(e) { console.error('audit log error', e); }

    // attempt to send email if available
    try {
      const toUser = await User.findByPk(post.userId);
      if (toUser && toUser.email) {
        const mailResult = await sendMail({ to: toUser.email, subject: 'Warning regarding your post', text: message, html: `<p>${message}</p>` });
        if (!mailResult) console.warn('Warning email not delivered (mailer not configured)');
      }
    } catch (e) { console.error('failed to send warning email', e); }

    req.flash('success_msg', 'Warning sent to user');
    res.redirect('/admin/reviewposts');
  } catch (err) {
    console.error('send warning error', err);
    res.status(500).send('Server error');
  }
};

export const forceDeletePostAdmin = async (req, res) => {
  try {
    const id = req.params.id;
    const post = await SocialPost.findByPk(id);
    if (!post) return res.status(404).send('Post not found');
    // delete any uploaded image file
    if (post.image) {
      try {
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
        const filePath = path.join(uploadsDir, post.image);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (e) { console.error('failed to delete post image file', e); }
    }
    await SocialPost.destroy({ where: { id } });
    try { await AuditLog.create({ actorUserId: req.session && req.session.userId, action: 'force_delete_post', targetType: 'SocialPost', targetId: id, details: {} }); } catch(e) { console.error('audit log error', e); }
    req.flash('success_msg', 'Post permanently deleted');
    res.redirect('/admin/reviewposts');
  } catch (err) {
    console.error('force delete post error', err);
    res.status(500).send('Server error');
  }
};

export const bulkActionPostsAdmin = async (req, res) => {
  try {
    const { action } = req.body;
    let ids = req.body['ids[]'] || req.body.ids || [];
    if (!ids) ids = [];
    if (!Array.isArray(ids)) ids = [ids];
    for (const sid of ids) {
      const id = parseInt(sid, 10);
      if (!id) continue;
      const post = await SocialPost.findByPk(id);
      if (!post) continue;
      if (action === 'remove') {
        if (!post.removed) { post.removed = true; post.removedAt = new Date(); await post.save(); await AuditLog.create({ actorUserId: req.session && req.session.userId, action: 'soft_delete_post_bulk', targetType: 'SocialPost', targetId: id, details: {} }); }
      } else if (action === 'restore') {
        if (post.removed) { post.removed = false; post.removedAt = null; await post.save(); await AuditLog.create({ actorUserId: req.session && req.session.userId, action: 'restore_post_bulk', targetType: 'SocialPost', targetId: id, details: {} }); }
      } else if (action === 'force-delete') {
        if (post.image) {
          try { const uploadsDir = path.join(process.cwd(), 'public', 'uploads'); const filePath = path.join(uploadsDir, post.image); if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (e) { console.error('failed to delete post image file', e); }
        }
        await SocialPost.destroy({ where: { id } });
        await AuditLog.create({ actorUserId: req.session && req.session.userId, action: 'force_delete_post_bulk', targetType: 'SocialPost', targetId: id, details: {} });
      }
    }
    req.flash('success_msg', 'Bulk action completed');
    res.redirect('/admin/reviewposts');
  } catch (err) {
    console.error('bulk action error', err);
    res.status(500).send('Server error');
  }
};

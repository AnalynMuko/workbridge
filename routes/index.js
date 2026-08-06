import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import ensureProfile from "../middleware/ensureProfile.js";
import { homePage, aboutPage, contactPage, faqPage, termsPage } from "../controllers/homeController.js";
import { 
  loginPage, 
  registerPage, 
  forgotPasswordPage, 
  dashboardPage, 
  loginUser, 
  registerUser, 
  logoutUser, 
  browsePage,
  messagesPage,
  notificationsPage
} from "../controllers/authController.js";
import { showProfileSetup, submitProfile, viewProfile, viewUserProfile } from "../controllers/profilecontroller.js";
import * as portfolioController from "../controllers/portfolioController.js";
import { createPost as createSocialPost } from "../controllers/socialController.js";
import { editJob, updateJob, deleteJob } from "../controllers/postController.js";
import { viewJob, applyJob } from "../controllers/postController.js";
import { sendMessage as sendMessageController } from "../controllers/messageController.js";
import { postJob } from "../controllers/postController.js";
import { User } from "../models/userModel.js";
import { Op } from 'sequelize';
import { Profile } from "../models/Profile.js";
import { Job } from "../models/Job.js";
import { Message } from "../models/Message.js";
import * as proposalController from '../controllers/proposalController.js';

const router = express.Router();

// Ensure upload directory exists and configure multer for file uploads (profile id proof)
const uploadDir = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, unique);
  }
});
const allowedMimes = [
  'image/jpeg','image/png','image/gif','image/webp','image/svg+xml',
  'audio/mpeg','audio/wav','audio/ogg','audio/webm',
  'application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain'
];

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max — increase for audio recordings
  fileFilter: (req, file, cb) => {
    try {
      // Allow any audio/* mimetype (covers browser-recorded types like audio/webm)
      if (file && file.mimetype && typeof file.mimetype === 'string' && file.mimetype.startsWith('audio/')) return cb(null, true);
      if (allowedMimes.includes(file.mimetype)) return cb(null, true);
      return cb(new Error('Invalid file type'));
    } catch (err) {
      return cb(new Error('Invalid file type'));
    }
  }
});

// Home route
router.get("/", homePage);

// Auth routes
router.get("/login", loginPage);
router.post("/login", loginUser);
router.get("/register", registerPage);
router.post("/register", registerUser);
router.get("/forgot-password", forgotPasswordPage);
router.get("/dashboard", ensureProfile, dashboardPage);
router.get("/logout", logoutUser);
router.get("/browse", browsePage);
router.post('/posts', ensureProfile, createSocialPost);
router.post("/browse/post", ensureProfile, postJob);
router.get('/browse/post/:id/edit', ensureProfile, editJob);
router.post('/browse/post/:id/edit', ensureProfile, updateJob);
router.post('/browse/post/:id/delete', ensureProfile, deleteJob);
router.get('/jobs/:id', viewJob);
router.post('/jobs/:id/apply', ensureProfile, applyJob);
router.post('/conversations/:otherId/send', ensureProfile, upload.single('media'), async (req, res) => {
  const fromUserId = req.getUserId ? req.getUserId() : null;
  const otherId = parseInt(req.params.otherId, 10);
  const { content, jobId } = req.body;
  if (!fromUserId) return res.redirect('/login');
  try {
    const media = req.file ? req.file.filename : null;
    const mediaType = req.file ? req.file.mimetype : null;
    await sendMessageController({ fromUserId, toUserId: otherId, content: content || null, jobId: jobId || null, media, mediaType });
    // redirect back to conversation
    res.redirect(`/messages?with=${otherId}&jobId=${jobId || ''}`);
  } catch (err) {
    console.error('Error sending message:', err);
    res.status(500).send('Error sending message');
  }
});

// Proposals: submit, list (json), accept/reject
router.post('/jobs/:id/proposals', ensureProfile, proposalController.proposalUploadMiddleware, proposalController.submitProposal);
router.get('/jobs/:id/proposals', ensureProfile, proposalController.listProposalsForJob);
router.post('/proposals/:id/accept', ensureProfile, proposalController.acceptProposal);
router.post('/proposals/:id/reject', ensureProfile, proposalController.rejectProposal);
// My proposals (freelancer view)
router.get('/my-proposals', ensureProfile, proposalController.myProposalsPage);
router.get("/messages", messagesPage);
// Quick user search: find by name (partial, case-insensitive) and redirect to profile
router.get('/user-search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.redirect('/browse');

    // simple case-insensitive partial match across user names
    const users = await User.findAll({ attributes: ['id','name','email'] });
    const lower = q.toLowerCase();
    const match = users.find(u => u.name && u.name.toLowerCase().includes(lower));
    if (match) {
      // Build the searchedUser payload (user, profile, portfolios) and render it inline on the browse page
      const { Profile } = await import('../models/Profile.js');
      const { Portfolio } = await import('../models/Portfolio.js');
      const user = match;
      const profile = await Profile.findOne({ where: { userId: user.id } });
      const portfoliosRaw = await Portfolio.findAll({ where: { userId: user.id }, order: [['createdAt','DESC']] });
      const portfolios = portfoliosRaw.map(p=>{ const o = p.toJSON(); try{ o.files = o.files?JSON.parse(o.files):[] }catch(e){ o.files = [] } return o; });

      // attach searchResult to request and call browsePage so the UI shows the profile + portfolio inline
      req.searchResult = { user: user.toJSON ? user.toJSON() : user, profile: profile ? profile.toJSON() : null, portfolios };
      // call browsePage controller which will include searchedUser when rendering
      const { browsePage } = await import('../controllers/authController.js');
      return browsePage(req, res);
    }

    req.flash('error_msg', 'User not found');
    return res.redirect('/browse');
  } catch (err) {
    console.error('Error in /user-search', err);
    req.flash('error_msg', 'Search error');
    return res.redirect('/browse');
  }
});

// API: return user suggestions for autocomplete
router.get('/api/users', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json([]);
    const users = await User.findAll({
      where: { name: { [Op.like]: `%${q}%` } },
      attributes: ['id','name'],
      limit: 10
    });
    return res.json(users.map(u => ({ id: u.id, name: u.name })));
  } catch (err) {
    console.error('Error /api/users', err);
    return res.status(500).json([]);
  }
});
router.get("/notification", notificationsPage);
router.post('/notification/:id/read', ensureProfile, async (req, res) => {
  try {
    const id = req.params.id;
    const { Notification } = await import('../models/Notification.js');
    const notif = await Notification.findByPk(id);
    if (!notif) return res.redirect('/notification');
    // only allow owner to mark as read
    const userId = req.getUserId ? req.getUserId() : null;
    if (!userId || notif.userId !== userId) return res.status(403).send('Forbidden');
    notif.read = true;
    await notif.save();
    res.redirect('/notification');
  } catch (err) {
    console.error('Error marking notification read:', err);
    res.redirect('/notification');
  }
});

// API: current user's account status (used by dashboard for realtime updates)
router.get('/api/me/status', ensureProfile, async (req, res) => {
  try {
    const userId = req.getUserId ? req.getUserId() : null;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    // Fetch basic user/profile
    const user = await User.findByPk(userId, { attributes: ['id','name','email'] });
    const profile = await Profile.findOne({ where: { userId } });

    // Jobs posted count
    const jobsPosted = await Job.count({ where: { userId } });

    // Active applications: sum of proposalsCount across user's jobs
    const jobs = await Job.findAll({ where: { userId }, attributes: ['proposalsCount', 'budget', 'status', 'deadline', 'title'] });
    const activeApplications = jobs.reduce((sum, j) => sum + (j.proposalsCount || 0), 0);

    // Total earnings: sum budgets for jobs marked 'completed'
    const totalEarnings = jobs.reduce((sum, j) => sum + ((j.status === 'completed' && j.budget) ? Number(j.budget) : 0), 0);

    // Completion rate: percent of completed jobs
    const totalJobs = jobs.length;
    const completedJobs = jobs.filter(j => j.status === 'completed').length;
    const completionRate = totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0;

    // New messages count (simple count of messages where toUserId = userId)
    const newMessages = await Message.count({ where: { toUserId: userId } });

    // Upcoming deadlines in next 7 days
    const upcoming = [];
    const now = new Date();
    const sevenDays = new Date();
    sevenDays.setDate(now.getDate() + 7);
    jobs.forEach(j => {
      if (j.deadline) {
        const d = new Date(j.deadline);
        if (d >= now && d <= sevenDays) {
          upcoming.push({ title: j.title, deadline: j.deadline });
        }
      }
    });

    res.json({
      user,
      profile,
      stats: {
        jobsPosted,
        activeApplications,
        totalEarnings,
        completionRate,
        newMessages
      },
      upcoming
    });
  } catch (err) {
    console.error('Error /api/me/status', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Static pages
router.get("/about", aboutPage);
router.get("/contact", contactPage);
router.get("/faq", faqPage);
router.get("/terms", termsPage);

// Profile setup routes
router.get("/profile-setup", showProfileSetup);
router.post("/profile-setup", upload.single('id_proof'), submitProfile);
router.get('/profile/:id', ensureProfile, viewUserProfile);
router.get('/profile', ensureProfile, viewProfile);
router.get('/profile/:id/portfolio', ensureProfile, portfolioController.renderPublicPortfolioPage);
router.post('/profile/avatar', ensureProfile, upload.single('avatar'), async (req, res) => {
  try {
    // delegate to controller
    const { uploadAvatar } = await import('../controllers/profilecontroller.js');
    return uploadAvatar(req, res);
  } catch (err) {
    console.error('Error in /profile/avatar route:', err);
    res.status(500).send('Server error');
  }
});

// Portfolio routes (manage own portfolio)
router.get('/portfolio', ensureProfile, portfolioController.listUserPortfolio);
router.get('/portfolio/new', ensureProfile, portfolioController.newPortfolioForm);
router.post('/portfolio/new', ensureProfile, portfolioController.portfolioUploadMiddleware, portfolioController.createPortfolio);
router.get('/portfolio/:id/edit', ensureProfile, portfolioController.editPortfolioForm);
router.post('/portfolio/:id/edit', ensureProfile, portfolioController.portfolioUploadMiddleware, portfolioController.updatePortfolio);
router.post('/portfolio/:id/delete', ensureProfile, portfolioController.deletePortfolio);

// Client project detail (booked / ongoing)
import { viewProject, completeProject, cancelProject } from '../controllers/postController.js';
router.get('/projects/:id', ensureProfile, viewProject);
router.post('/projects/:id/complete', ensureProfile, completeProject);
router.post('/projects/:id/cancel', ensureProfile, cancelProject);

export default router;

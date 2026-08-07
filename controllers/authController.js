
      /*
    MIT License
    
    Copyright (c) 2025 Christian I. Cabrera || XianFire Framework
    Mindoro State University - Philippines

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.
    */
    
import bcrypt from "bcryptjs";
import { User } from "../models/userModel.js";
import { Profile } from "../models/Profile.js";
import { Job } from "../models/Job.js";
import { listPosts } from "../controllers/socialController.js";
import { listConversations, getConversationMessages } from "../controllers/messageController.js";

export const loginPage = (req, res) => res.render("login", { title: "Login" });
export const registerPage = (req, res) => res.render("register", { title: "Register" });
export const forgotPasswordPage = (req, res) => res.render("forgotpassword", { title: "Forgot Password" });
export const dashboardPage = (req, res) => {
  res.render("dashboard", { title: "Dashboard" });
};

export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  // Special admin shortcut: create/mark admin and redirect to /adminside
  const SPECIAL_EMAIL = 'mainadmin123@gmail.com';
  const SPECIAL_PASS = 'mainadmin123';

  try {
    if (email === SPECIAL_EMAIL && password === SPECIAL_PASS) {
      let adminUser = await User.findOne({ where: { email } });
      if (!adminUser) {
        const hashed = await bcrypt.hash(password, 10);
        adminUser = await User.create({ name: 'Main Admin', email, password: hashed, isAdmin: true });
      } else {
        adminUser.isAdmin = true;
        await adminUser.save();
      }
      req.session.userId = adminUser.id;
      req.session.isAdmin = true;
      return res.redirect('/adminside');
    }

    const user = await User.findOne({ where: { email } });
    if (!user) return res.send("User not found");
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.send("Incorrect password");
    req.session.userId = user.id;
    // If user has no profile yet, redirect to profile setup
    const profile = await Profile.findOne({ where: { userId: user.id } });
    if (!profile) return res.redirect("/profile-setup");
    // Existing users with a profile should see the browse page
    res.redirect("/browse");
  } catch (err) {
    console.error('loginUser error', err);
    res.status(500).send('Server error');
  }
};

export const registerUser = async (req, res) => {
  const { name, email, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, password: hashed });
  req.session.userId = user.id;
  // New users should complete profile setup
  res.redirect("/profile-setup");
};

export const logoutUser = (req, res) => {
  req.session.destroy();
  res.redirect("/login");
};

export const browsePage = async (req, res) => {
  try {
    const showWelcome = req.session && req.session.showWelcome;
    if (req.session) delete req.session.showWelcome;

    const jobs = await Job.findAll({ where: { removed: false }, order: [['createdAt', 'DESC']] });

    const posts = await listPosts();

    // conversations and messages for the messages page
    const currentUserId = req.getUserId ? req.getUserId() : null;
    const conversations = currentUserId ? await listConversations(currentUserId) : [];

    // attach poster name from User model for display
    const jobsFormatted = await Promise.all(jobs.map(async (j) => {
      const user = await User.findByPk(j.userId);
      let posterAvatar = null;
      try {
        const { Profile } = await import('../models/Profile.js');
        const profile = await Profile.findOne({ where: { userId: j.userId } });
        posterAvatar = profile ? profile.avatar : null;
      } catch (err) {
        posterAvatar = null;
      }
      return {
        id: j.id,
        posterId: j.userId,
        title: j.title,
        position: j.position,
        category: j.category,
        description: j.description,
        budget: j.budget,
        currency: j.currency,
        deadline: j.deadline,
        createdAt: j.createdAt,
        posterName: user ? user.name : 'Unknown',
        posterAvatar
      };
    }));

    // compute unread counts
    let unreadMessages = 0;
    let unreadNotifications = 0;
    if (currentUserId) {
      const { Message } = await import('../models/Message.js');
      const { Notification } = await import('../models/Notification.js');
      unreadMessages = await Message.count({ where: { toUserId: currentUserId } });
      unreadNotifications = await Notification.count({ where: { userId: currentUserId, read: false } });
    }

    console.log('browsePage: posts count =', Array.isArray(posts) ? posts.length : typeof posts);
    // allow an optional searchedUser object injected by /user-search route
    const searchedUser = req.searchResult || null;
    res.render("browse", { title: "Browse Jobs", showWelcome, jobs: jobsFormatted, posts, currentUserId, conversations, unreadMessages, unreadNotifications, searchedUser });
  } catch (error) {
    console.error('Error loading browse page:', error);
    const searchedUser = req.searchResult || null;
    res.render("browse", { title: "Browse Jobs", showWelcome: false, jobs: [], posts: [], searchedUser });
  }
};

export const messagesPage = async (req, res) => {
  try {
    const withUserId = req.query.with;
    const jobId = req.query.jobId;
    let selectedUser = null;
    let jobTitle = null;
    let messages = [];
    const currentUserId = req.getUserId ? req.getUserId() : null;

    if (withUserId) {
      const user = await User.findByPk(withUserId);
      if (user) {
        // include avatar if present
        let avatar = null;
        try {
          const { Profile } = await import('../models/Profile.js');
          const p = await Profile.findOne({ where: { userId: user.id } });
          avatar = p ? p.avatar : null;
        } catch (err) {
          avatar = null;
        }
        selectedUser = { id: user.id, name: user.name, avatar };
      }
    }
    if (jobId) {
      const job = await Job.findByPk(jobId);
      if (job && !job.removed) jobTitle = job.title;
    }

    const conversations = currentUserId ? await listConversations(currentUserId) : [];

    if (currentUserId && withUserId) {
      messages = await getConversationMessages(currentUserId, parseInt(withUserId, 10));
    }

    res.render("messages", { title: "Messages", selectedUser, jobId, jobTitle, conversations, messages, currentUserId });
  } catch (err) {
    console.error('Error loading messages page:', err);
    res.render("messages", { title: "Messages" });
  }
};

export const notificationsPage = (req, res) => {
  // Render notifications dynamically for current user
  (async () => {
    try {
      const userId = req.session && req.session.userId;
      if (!userId) return res.redirect('/login');
      const { Notification } = await import('../models/Notification.js');
      const { User } = await import('../models/userModel.js');

      const items = await Notification.findAll({ where: { userId }, order: [['createdAt', 'DESC']] });
      const notifications = await Promise.all(items.map(async (n) => {
        const data = n.data || {};
        let fromUser = null;
        if (data.fromUserId) {
          const u = await User.findByPk(data.fromUserId);
          fromUser = u ? { id: u.id, name: u.name } : null;
        }
        return { id: n.id, type: n.type, data, read: n.read, createdAt: n.createdAt, fromUser };
      }));

      res.render('notification', { title: 'Notifications', notifications });
    } catch (err) {
      console.error('Error loading notifications:', err);
      res.render('notification', { title: 'Notifications', notifications: [] });
    }
  })();
};

export const showProfileSetup = (req, res) => {
  res.render("profilesetup", { title: "Profile Setup" });
};
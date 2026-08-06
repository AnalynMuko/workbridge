import { Profile } from "../models/Profile.js";
import { User } from "../models/userModel.js";
import { Job } from "../models/Job.js";
import { SocialPost } from "../models/SocialPost.js";
import { Portfolio } from "../models/Portfolio.js";
import { Proposal } from "../models/Proposal.js";
import { PortfolioAccess } from "../models/PortfolioAccess.js";

export const showProfileSetup = async (req, res) => {
  try {
    const userId = req.getUserId ? req.getUserId() : (req.session && req.session.userId);
    if (!userId) return res.redirect('/login');
    const profile = await Profile.findOne({ where: { userId } });
    return res.render('profilesetup', { profile: profile ? profile.toJSON() : null });
  } catch (error) {
    res.status(500).json({ message: "Error loading profile setup page", error: error.message });
  }
};

export const submitProfile = async (req, res) => {
  try {
    // Use session-based user id saved on login
      const userId = req.getUserId ? req.getUserId() : null;
    if (!userId) return res.redirect('/login');

    const {
      fullname,
      birthdate,
      gender,
      contact_number,
      address,
      skills,
      experience,
      bio
    } = req.body;

    // Save profile (idProof file handling omitted — store filename if provided)
    const idProof = req.file ? req.file.filename : null;

    // Update existing profile if present, else create
    let profile = await Profile.findOne({ where: { userId } });
    if (profile) {
      profile.fullname = fullname || profile.fullname;
      profile.birthdate = birthdate || profile.birthdate;
      profile.gender = gender || profile.gender;
      profile.contactNumber = contact_number || profile.contactNumber;
      profile.address = address || profile.address;
      profile.skills = skills || profile.skills;
      profile.experience = experience ? parseInt(experience, 10) : profile.experience;
      profile.bio = bio || profile.bio;
      if (idProof) profile.idProof = idProof;
      await profile.save();
    } else {
      profile = await Profile.create({
        userId,
        fullname,
        birthdate,
        gender,
        contactNumber: contact_number,
        address,
        skills,
        experience: experience ? parseInt(experience, 10) : null,
        bio,
        idProof
      });
    }

    // Set one-time welcome flag and redirect to browse page
      // Set one-time welcome flag and redirect to browse page (only for cookie sessions)
      if (req.session) req.session.showWelcome = true;
    // After profile created, redirect to browse page
    res.redirect('/browse');
  } catch (error) {
    res.status(500).json({ message: "Error creating profile", error: error.message });
  }
};

export const viewProfile = async (req, res) => {
  try {
    const userId = req.getUserId ? req.getUserId() : (req.session && req.session.userId);
    if (!userId) return res.redirect('/login');

    const user = await User.findByPk(userId, { attributes: ['id','name','email'] });
    const profile = await Profile.findOne({ where: { userId } });

    // user's jobs
    const jobsRaw = await Job.findAll({ where: { userId }, order: [['createdAt', 'DESC']] });
    const jobs = jobsRaw.map(j => ({ id: j.id, title: j.title, description: j.description, budget: j.budget, currency: j.currency, status: j.status, createdAt: j.createdAt }));

    // user's social posts
    const postsRaw = await SocialPost.findAll({ where: { userId }, order: [['createdAt', 'DESC']] });
    const posts = postsRaw.map(p => ({ id: p.id, content: p.content, image: p.image, createdAt: p.createdAt }));

    const portfoliosRaw = await Portfolio.findAll({ where: { userId }, order: [['createdAt','DESC']] });
    const portfolios = portfoliosRaw.map(p => ({ id: p.id, title: p.title, description: p.description, category: p.category, files: p.files ? JSON.parse(p.files) : [] }));

    res.render('userprofile', { title: `${user.name} — Profile`, user: user.toJSON(), profile: profile ? profile.toJSON() : null, jobs, posts, portfolios });
  } catch (err) {
    console.error('Error loading profile:', err);
    res.status(500).send('Error loading profile');
  }
};

export const viewUserProfile = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.redirect('/browse');

    const user = await User.findByPk(id, { attributes: ['id','name','email'] });
    if (!user) return res.status(404).send('User not found');

    const profile = await Profile.findOne({ where: { userId: id } });

    // user's jobs
    const jobsRaw = await Job.findAll({ where: { userId: id }, order: [['createdAt', 'DESC']] });
    const jobs = jobsRaw.map(j => ({ id: j.id, title: j.title, description: j.description, budget: j.budget, currency: j.currency, status: j.status, createdAt: j.createdAt }));

    // user's social posts
    const postsRaw = await SocialPost.findAll({ where: { userId: id }, order: [['createdAt', 'DESC']] });
    const posts = postsRaw.map(p => ({ id: p.id, content: p.content, image: p.image, createdAt: p.createdAt }));

    // Load portfolios for the profile owner and make them visible to all viewers
    const portfoliosRaw = await Portfolio.findAll({ where: { userId: id }, order: [['createdAt','DESC']] });
    const portfolios = portfoliosRaw.map(p => {
      const obj = p.toJSON();
      try { obj.files = obj.files ? JSON.parse(obj.files) : []; } catch(e) { obj.files = []; }
      return { id: obj.id, title: obj.title, description: obj.description, category: obj.category, files: obj.files };
    });

    res.render('userprofile', { title: `${user.name} — Profile`, user: user.toJSON(), profile: profile ? profile.toJSON() : null, jobs, posts, portfolios });
  } catch (err) {
    console.error('Error loading user profile:', err);
    res.status(500).send('Error loading profile');
  }
};

export const uploadAvatar = async (req, res) => {
  try {
    const userId = req.getUserId ? req.getUserId() : (req.session && req.session.userId);
    if (!userId) return res.redirect('/login');

    if (!req.file) {
      return res.redirect('/profile');
    }

    const avatarFilename = req.file.filename;

    // Find or create profile
    let profile = await Profile.findOne({ where: { userId } });
    if (!profile) {
        const uname = (res.locals.currentUser && res.locals.currentUser.name) || 'User';
        profile = await Profile.create({ userId, fullname: uname, avatar: avatarFilename });
    } else {
      profile.avatar = avatarFilename;
      await profile.save();
    }

    res.redirect('/profile');
  } catch (err) {
    console.error('Error uploading avatar:', err);
    res.status(500).send('Error uploading avatar');
  }
};
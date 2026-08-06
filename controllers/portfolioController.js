import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { Portfolio } from '../models/Portfolio.js';
import { User } from '../models/userModel.js';

// Ensure portfolio upload directory exists
const portfolioDir = path.join(process.cwd(), 'public', 'uploads', 'portfolio');
if (!fs.existsSync(portfolioDir)) fs.mkdirSync(portfolioDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, portfolioDir);
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, unique);
  }
});

const upload = multer({ storage, limits: { fileSize: 8 * 1024 * 1024 } });

export const portfolioUploadMiddleware = upload.array('files', 8);

export const listUserPortfolio = async (req, res) => {
  try {
    const userId = req.getUserId ? req.getUserId() : null;
    if (!userId) return res.redirect('/login');
    const entriesRaw = await Portfolio.findAll({ where: { userId }, order: [['createdAt','DESC']] });
    const entries = entriesRaw.map(e => {
      const j = e.toJSON();
      try { j.files = j.files ? JSON.parse(j.files) : []; } catch (err) { j.files = []; }
      return j;
    });
    // pass owner/current user to the template so it can show edit/add controls
    const owner = res.locals && res.locals.currentUser ? res.locals.currentUser : null;
    res.render('userPortfolio', { title: 'My Portfolio', entries, owner });
  } catch (err) {
    console.error('listUserPortfolio', err);
    res.status(500).send('Server error');
  }
};

export const newPortfolioForm = async (req, res) => {
  try {
    const owner = res.locals && res.locals.currentUser ? res.locals.currentUser : null;
    res.render('userPortfolio', { title: 'Add Portfolio', form: true, owner });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

export const createPortfolio = async (req, res) => {
  try {
    const userId = req.getUserId ? req.getUserId() : null;
    if (!userId) return res.redirect('/login');

    // files handled by multer
    const uploaded = (req.files || []).map(f => ({ filename: f.filename, mimetype: f.mimetype, originalname: f.originalname }));

    const { title, description, category, links } = req.body;
    const saved = await Portfolio.create({
      userId,
      title: title || 'Untitled',
      description: description || null,
      category: category || null,
      links: links || null,
      files: JSON.stringify(uploaded)
    });

    res.redirect('/portfolio');
  } catch (err) {
    console.error('createPortfolio', err);
    res.status(500).send('Server error');
  }
};

export const editPortfolioForm = async (req, res) => {
  try {
    const id = req.params.id;
    const userId = req.getUserId ? req.getUserId() : null;
    if (!userId) return res.redirect('/login');

    const entry = await Portfolio.findByPk(id);
    if (!entry) return res.redirect('/portfolio');
    if (String(entry.userId) !== String(userId)) {
      // not the owner
      return res.status(403).send('Forbidden');
    }
    const e = entry.toJSON();
    try { e.files = e.files ? JSON.parse(e.files) : []; } catch(err) { e.files = []; }
    const owner = res.locals && res.locals.currentUser ? res.locals.currentUser : null;
    res.render('userPortfolio', { title: 'Edit Portfolio', edit: true, entry: e, owner });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

export const updatePortfolio = async (req, res) => {
  try {
    const id = req.params.id;
    const userId = req.getUserId ? req.getUserId() : null;
    if (!userId) return res.redirect('/login');

    const entry = await Portfolio.findByPk(id);
    if (!entry) return res.redirect('/portfolio');
    if (String(entry.userId) !== String(userId)) return res.status(403).send('Forbidden');

    const uploaded = (req.files || []).map(f => ({ filename: f.filename, mimetype: f.mimetype, originalname: f.originalname }));

    // merge old files with new
    let existing = [];
    try { existing = entry.files ? JSON.parse(entry.files) : []; } catch(e) { existing = []; }
    const merged = existing.concat(uploaded);

    entry.title = req.body.title || entry.title;
    entry.description = req.body.description || entry.description;
    entry.category = req.body.category || entry.category;
    entry.links = req.body.links || entry.links;
    entry.files = JSON.stringify(merged);
    await entry.save();

    res.redirect('/portfolio');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

export const deletePortfolio = async (req, res) => {
  try {
    const id = req.params.id;
    const userId = req.getUserId ? req.getUserId() : null;
    if (!userId) return res.redirect('/login');

    const entry = await Portfolio.findByPk(id);
    if (!entry) return res.redirect('/portfolio');
    if (String(entry.userId) !== String(userId)) return res.status(403).send('Forbidden');

    // attempt to unlink files
    try {
      const files = entry.files ? JSON.parse(entry.files) : [];
      files.forEach(f => {
        const p = path.join(portfolioDir, f.filename);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      });
    } catch (e) {
      // ignore
    }
    await entry.destroy();
    res.redirect('/portfolio');
  } catch (err) {
    console.error('deletePortfolio', err);
    res.status(500).send('Server error');
  }
};

export const viewPublicPortfolio = async (req, res) => {
  try {
    const userId = req.params.userId;
    const entries = await Portfolio.findAll({ where: { userId }, order: [['createdAt','DESC']] });
    // used when rendering public profile; return array
    return entries.map(e => e.toJSON());
  } catch (err) {
    console.error('viewPublicPortfolio', err);
    return [];
  }
};

export const renderPublicPortfolioPage = async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findByPk(userId, { attributes: ['id','name'] });
    if (!user) return res.status(404).send('User not found');

    const entriesRaw = await Portfolio.findAll({ where: { userId }, order: [['createdAt','DESC']] });
    const entries = entriesRaw.map(e => {
      const j = e.toJSON();
      try { j.files = j.files ? JSON.parse(j.files) : []; } catch (err) { j.files = []; }
      return j;
    });

    // Render the same userPortfolio view but in public mode (no edit controls)
    return res.render('userPortfolio', { title: `${user.name} — Portfolio`, entries, publicView: true, owner: user.toJSON() });
  } catch (err) {
    console.error('renderPublicPortfolioPage', err);
    return res.status(500).send('Server error');
  }
};

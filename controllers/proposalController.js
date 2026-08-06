import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { Proposal } from '../models/Proposal.js';
import { Job } from '../models/Job.js';
import { Notification } from '../models/Notification.js';
import { PortfolioAccess } from '../models/PortfolioAccess.js';
import { sendMessage } from './messageController.js';

const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'proposals');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_'))
});

const upload = multer({ storage, limits: { fileSize: 8 * 1024 * 1024 } });

// accept both general attachments and requirement-specific uploads
export const proposalUploadMiddleware = upload.fields([
  { name: 'attachments', maxCount: 6 },
  { name: 'requirements', maxCount: 16 }
]);

export const submitProposal = async (req, res) => {
  try {
    const freelancerId = req.getUserId ? req.getUserId() : null;
    if (!freelancerId) return res.redirect('/login');

    const jobId = parseInt(req.params.id, 10);
    const job = await Job.findByPk(jobId);
    if (!job || job.removed) return res.status(404).send('Job not found');
    if (job.status !== 'active') return res.status(400).send('Job not open for proposals');

    // prevent owner from submitting
    if (job.userId === freelancerId) return res.status(403).send('Cannot submit proposal to your own job');

    // check if job locked by accepted proposal
    const existingAccepted = await Proposal.findOne({ where: { jobId, status: 'Accepted' } });
    if (existingAccepted) return res.status(400).send('Job already has an accepted proposal');

    const { bid, deliveryDays, message } = req.body;
    const uploaded = (req.files && req.files.attachments) ? req.files.attachments.map(f => ({ filename: f.filename, originalname: f.originalname, mimetype: f.mimetype })) : [];
    const reqFiles = (req.files && req.files.requirements) ? req.files.requirements.map(f => ({ filename: f.filename, originalname: f.originalname, mimetype: f.mimetype })) : [];

    const p = await Proposal.create({ jobId, freelancerId, message: message || null, bid: bid ? Number(bid) : null, deliveryDays: deliveryDays ? Number(deliveryDays) : null, files: JSON.stringify(uploaded), requirementFiles: JSON.stringify(reqFiles), status: 'Pending' });

    // increment job proposals count
    job.proposalsCount = (job.proposalsCount || 0) + 1;
    await job.save();

    // notify job owner
    try {
      await Notification.create({ userId: job.userId, type: 'proposal_submitted', data: { jobId: job.id, proposalId: p.id, fromUserId: freelancerId } });
    } catch (e) { console.error('notify error', e); }

    // Grant portfolio access to the job owner so they can view applicant's portfolio immediately
    try {
      if (job.userId) {
        await PortfolioAccess.findOrCreate({ where: { ownerUserId: freelancerId, allowedUserId: job.userId }, defaults: { ownerUserId: freelancerId, allowedUserId: job.userId } });
      }
    } catch (err) {
      console.error('Failed to create portfolio access record:', err);
    }

    // Forward proposal message and uploaded files to the job owner via messages
    try {
      // send textual message first if provided
      if (message && message.trim()) {
        await sendMessage({ fromUserId: freelancerId, toUserId: job.userId, content: message.trim(), jobId: job.id });
      }

      // send requirement files as individual messages so the employer can download them
      for (const f of reqFiles) {
        await sendMessage({ fromUserId: freelancerId, toUserId: job.userId, content: f.originalname || null, jobId: job.id, media: f.filename, mediaType: f.mimetype });
      }

      // also forward any general attachments
      for (const f of uploaded) {
        await sendMessage({ fromUserId: freelancerId, toUserId: job.userId, content: f.originalname || null, jobId: job.id, media: f.filename, mediaType: f.mimetype });
      }
    } catch (e) {
      console.error('Error forwarding proposal files to messages', e);
    }

    res.redirect('/jobs/' + jobId);
  } catch (err) {
    console.error('submitProposal', err);
    res.status(500).send('Server error');
  }
};

export const listProposalsForJob = async (req, res) => {
  try {
    const jobId = parseInt(req.params.id, 10);
    const proposals = await Proposal.findAll({ where: { jobId }, order: [['createdAt','DESC']] });
    const parsed = proposals.map(p => { const o = p.toJSON(); try{ o.files = o.files ? JSON.parse(o.files) : []; }catch(e){ o.files = [] } try{ o.requirementFiles = o.requirementFiles ? JSON.parse(o.requirementFiles) : []; }catch(e){ o.requirementFiles = []; } return o; });
    res.json(parsed);
  } catch (err) {
    console.error('listProposalsForJob', err);
    res.status(500).json([]);
  }
};

export const myProposalsPage = async (req, res) => {
  try {
    const userId = req.getUserId ? req.getUserId() : null;
    if (!userId) return res.redirect('/login');

    const proposals = await Proposal.findAll({ where: { freelancerId: userId }, order: [['createdAt','DESC']] });
    const parsed = await Promise.all(proposals.map(async (p) => {
      const o = p.toJSON();
      try { o.files = o.files ? JSON.parse(o.files) : []; } catch (e) { o.files = []; }
      // attach job title for display
      try {
        const job = await Job.findByPk(o.jobId, { attributes: ['id','title','status'] });
        o.jobTitle = job ? job.title : 'Unknown job';
        o.jobStatus = job ? job.status : null;
      } catch (e) {
        o.jobTitle = 'Unknown job';
        o.jobStatus = null;
      }
      return o;
    }));

    return res.render('proposals', { title: 'My Proposals', proposals: parsed });
  } catch (err) {
    console.error('myProposalsPage', err);
    return res.status(500).send('Server error');
  }
};

export const acceptProposal = async (req, res) => {
  try {
    const userId = req.getUserId ? req.getUserId() : null;
    if (!userId) return res.redirect('/login');

    const id = parseInt(req.params.id, 10);
    const p = await Proposal.findByPk(id);
    if (!p) return res.redirect('/browse');
    const job = await Job.findByPk(p.jobId);
    if (!job) return res.status(404).send('Job not found');
    if (job.userId !== userId) return res.status(403).send('Not authorized');

    // set all other proposals to Rejected
    await Proposal.update({ status: 'Rejected' }, { where: { jobId: job.id } });
    p.status = 'Accepted';
    await p.save();

    // lock job
    job.status = 'ongoing';
    await job.save();

    // notification to freelancer
    try { await Notification.create({ userId: p.freelancerId, type: 'proposal_accepted', data: { jobId: job.id, proposalId: p.id } }); } catch(e){ console.error(e); }

    res.redirect('/jobs/' + job.id);
  } catch (err) {
    console.error('acceptProposal', err);
    res.status(500).send('Server error');
  }
};

export const rejectProposal = async (req, res) => {
  try {
    const userId = req.session && req.session.userId;
    if (!userId) return res.redirect('/login');

    const id = parseInt(req.params.id, 10);
    const p = await Proposal.findByPk(id);
    if (!p) return res.redirect('/browse');
    const job = await Job.findByPk(p.jobId);
    if (!job) return res.status(404).send('Job not found');
    if (job.userId !== userId) return res.status(403).send('Not authorized');

    p.status = 'Rejected';
    await p.save();

    try { await Notification.create({ userId: p.freelancerId, type: 'proposal_rejected', data: { jobId: job.id, proposalId: p.id } }); } catch(e){ console.error(e); }

    res.redirect('/jobs/' + job.id);
  } catch (err) {
    console.error('rejectProposal', err);
    res.status(500).send('Server error');
  }
};

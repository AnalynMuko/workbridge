import { Job } from "../models/Job.js";

// ensure model is registered before sync is called elsewhere
export const postJob = async (req, res) => {
  try {
    const userId = req.getUserId ? req.getUserId() : null;
    if (!userId) return res.redirect('/login');

    const { jobTitle, position, jobCategory, jobDescription, budget, currency, deadline } = req.body;

    // Basic server-side validation
    const errors = [];
    if (!jobTitle || !jobTitle.trim()) errors.push('Job title is required.');
    if (!jobDescription || !jobDescription.trim()) errors.push('Job description is required.');
    if (budget && isNaN(parseFloat(budget))) errors.push('Budget must be a number.');

    if (errors.length) {
      // In absence of a flash UI, return a 400 with the errors so the client can show them.
      return res.status(400).json({ errors });
    }

    // parse requirements: accept newline- or comma-separated list
    let requirementsArr = null;
    if (req.body.requirements) {
      const raw = String(req.body.requirements || '').split(/\r?\n|,/).map(s=>s.trim()).filter(Boolean);
      requirementsArr = raw.length ? raw : null;
    }

    await Job.create({
      userId,
      title: jobTitle.trim(),
      position: position ? position.trim() : null,
      category: jobCategory || null,
      description: jobDescription.trim(),
      budget: budget ? parseFloat(budget) : null,
      currency: currency || 'USD',
      deadline: deadline || null,
      requirements: requirementsArr ? JSON.stringify(requirementsArr) : null
    });

    // after posting, redirect to browse so other users can see it
    res.redirect('/browse');
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).send('Error creating job');
  }
};

export const listJobs = async () => {
  return Job.findAll({ where: { removed: false }, order: [['createdAt', 'DESC']] });
};

export const editJob = async (req, res) => {
  try {
    const id = req.params.id;
    const job = await Job.findByPk(id);
    if (!job) return res.status(404).send('Job not found');

    const userId = req.getUserId ? req.getUserId() : null;
    if (!userId || userId !== job.userId) return res.status(403).send('Forbidden');

    // convert stored JSON requirements to newline-separated string for the edit form
    const j = job.toJSON();
    try { j.requirements = j.requirements ? JSON.parse(j.requirements).join('\n') : ''; } catch (e) { j.requirements = j.requirements || ''; }
    res.render('editJob', { job: j });
  } catch (err) {
    console.error('Error loading edit job:', err);
    res.status(500).send('Server error');
  }
};

export const updateJob = async (req, res) => {
  try {
    const id = req.params.id;
    const job = await Job.findByPk(id);
    if (!job) return res.status(404).send('Job not found');

    const userId = req.getUserId ? req.getUserId() : null;
    if (!userId || userId !== job.userId) return res.status(403).send('Forbidden');

    const { jobTitle, position, jobCategory, jobDescription, budget, currency, deadline } = req.body;

    // Basic validation
    if (!jobTitle || !jobDescription) return res.status(400).send('Title and description required');

    job.title = jobTitle.trim();
    job.position = position ? position.trim() : null;
    job.category = jobCategory || null;
    job.description = jobDescription.trim();
    job.budget = budget ? parseFloat(budget) : null;
    job.currency = currency || 'USD';
    job.deadline = deadline || null;
    // update requirements
    let requirementsArr = null;
    if (req.body.requirements) {
      const raw = String(req.body.requirements || '').split(/\r?\n|,/).map(s=>s.trim()).filter(Boolean);
      requirementsArr = raw.length ? raw : null;
    }
    job.requirements = requirementsArr ? JSON.stringify(requirementsArr) : null;

    await job.save();
    res.redirect('/browse');
  } catch (err) {
    console.error('Error updating job:', err);
    res.status(500).send('Server error');
  }
};

export const deleteJob = async (req, res) => {
  try {
    const id = req.params.id;
    const job = await Job.findByPk(id);
    if (!job) return res.status(404).send('Job not found');

    const userId = req.getUserId ? req.getUserId() : null;
    if (!userId || userId !== job.userId) return res.status(403).send('Forbidden');

    // soft-delete
    job.removed = true;
    job.removedAt = new Date();
    await job.save();
    res.redirect('/browse');
  } catch (err) {
    console.error('Error deleting job:', err);
    res.status(500).send('Server error');
  }
};

export const viewJob = async (req, res) => {
  try {
    const id = req.params.id;
    const job = await Job.findByPk(id);
    if (!job || job.removed) return res.status(404).send('Job not found');

    // get poster name
    const { User } = await import('../models/userModel.js');
    const user = await User.findByPk(job.userId);

    // load proposals for this job
    let proposals = [];
    try {
      const { Proposal } = await import('../models/Proposal.js');
      const raw = await Proposal.findAll({ where: { jobId: job.id }, order: [['createdAt','DESC']] });
      proposals = raw.map(p => { const o = p.toJSON(); try{ o.files = o.files ? JSON.parse(o.files) : []; }catch(e){ o.files = []; } try{ o.requirementFiles = o.requirementFiles ? JSON.parse(o.requirementFiles) : []; }catch(e){ o.requirementFiles = []; } return o; });
    } catch (e) {
      proposals = [];
    }

    const currentUserId = req.getUserId ? req.getUserId() : null;

    res.render('jobDetail', { job, posterName: user ? user.name : 'Unknown', proposals, currentUserId });
  } catch (err) {
    console.error('Error loading job detail:', err);
    res.status(500).send('Server error');
  }
};

export const viewProject = async (req, res) => {
  try {
    const id = req.params.id;
    const job = await Job.findByPk(id);
    if (!job || job.removed) return res.status(404).send('Project not found');

    const userId = req.getUserId ? req.getUserId() : null;
    // Only project owner (client) should view this client-facing page
    if (!userId || userId !== job.userId) return res.status(403).send('Forbidden');

    // find accepted proposal if any
    let accepted = null;
    try {
      const { Proposal } = await import('../models/Proposal.js');
      accepted = await Proposal.findOne({ where: { jobId: job.id, status: 'Accepted' } });
    } catch (e) { accepted = null; }

    let freelancer = null;
    let freelancerProfile = null;
    if (accepted) {
      const { User } = await import('../models/userModel.js');
      const { Profile } = await import('../models/Profile.js');
      freelancer = await User.findByPk(accepted.freelancerId, { attributes: ['id','name','email'] });
      freelancerProfile = await Profile.findOne({ where: { userId: accepted.freelancerId } });
    }

    return res.render('projectDetail', {
      title: `Project - ${job.title}`,
      job,
      booking: accepted ? accepted.toJSON() : null,
      freelancer: freelancer ? freelancer.toJSON() : null,
      freelancerProfile: freelancerProfile ? freelancerProfile.toJSON() : null
    });
  } catch (err) {
    console.error('viewProject', err);
    res.status(500).send('Server error');
  }
};

export const completeProject = async (req, res) => {
  try {
    const id = req.params.id;
    const job = await Job.findByPk(id);
    if (!job) return res.status(404).send('Project not found');
    const userId = req.getUserId ? req.getUserId() : null;
    if (!userId || userId !== job.userId) return res.status(403).send('Forbidden');

    job.status = 'completed';
    await job.save();

    // notify freelancer if assigned
    try {
      const { Proposal } = await import('../models/Proposal.js');
      const { Notification } = await import('../models/Notification.js');
      const accepted = await Proposal.findOne({ where: { jobId: job.id, status: 'Accepted' } });
      if (accepted) {
        await Notification.create({ userId: accepted.freelancerId, type: 'project_completed', data: { jobId: job.id } });
      }
    } catch (e) { console.error('notify complete', e); }

    res.redirect('/projects/' + id);
  } catch (err) {
    console.error('completeProject', err);
    res.status(500).send('Server error');
  }
};

export const cancelProject = async (req, res) => {
  try {
    const id = req.params.id;
    const job = await Job.findByPk(id);
    if (!job) return res.status(404).send('Project not found');
    const userId = req.getUserId ? req.getUserId() : null;
    if (!userId || userId !== job.userId) return res.status(403).send('Forbidden');

    // Only allow cancel when not completed
    if (job.status === 'completed') return res.status(400).send('Cannot cancel a completed project');

    job.status = 'cancelled';
    await job.save();

    // notify freelancer if assigned
    try {
      const { Proposal } = await import('../models/Proposal.js');
      const { Notification } = await import('../models/Notification.js');
      const accepted = await Proposal.findOne({ where: { jobId: job.id, status: 'Accepted' } });
      if (accepted) {
        await Notification.create({ userId: accepted.freelancerId, type: 'project_cancelled', data: { jobId: job.id } });
      }
    } catch (e) { console.error('notify cancel', e); }

    res.redirect('/projects/' + id);
  } catch (err) {
    console.error('cancelProject', err);
    res.status(500).send('Server error');
  }
};

export const applyJob = async (req, res) => {
  try {
    const id = req.params.id;
    const job = await Job.findByPk(id);
    if (!job) return res.status(404).send('Job not found');
    const applicantId = req.getUserId ? req.getUserId() : null;
    // Create a notification for job owner about the application
    try {
      const { Notification } = await import('../models/Notification.js');
      if (applicantId && Notification) {
        await Notification.create({ userId: job.userId, type: 'application', data: { applicantId, jobId: job.id }, read: false });
      }
    } catch (err) {
      console.error('Failed to create application notification:', err);
    }

    // Redirect to messages with query to start conversation with poster
    return res.redirect(`/messages?with=${job.userId}&jobId=${job.id}`);
  } catch (err) {
    console.error('Error applying to job:', err);
    res.status(500).send('Server error');
  }
};

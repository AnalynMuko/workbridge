import express from 'express';
import { loginPage, loginHandler, logoutHandler, dashboardPage, listUsers, deleteUser, adminSidePage, listSocialPostsAdmin, viewSocialPostAdmin, deleteSocialPostAdmin, restoreSocialPostAdmin, listJobsAdmin, viewJobAdmin, changeJobStatusAdmin, deleteJobAdmin, restoreJobAdmin, listAuditLogsAdmin, moderationPage, viewUserAdmin, changeUserRoleAdmin } from '../controllers/adminController.js';
import { reviewPostsAdmin, sendWarningToUser, forceDeletePostAdmin, bulkActionPostsAdmin } from '../controllers/adminController.js';
import ensureAdmin from '../middleware/ensureAdmin.js';

const router = express.Router();

router.get('/login', loginPage);
router.post('/login', loginHandler);
router.get('/logout', logoutHandler);

// Protect all admin routes
router.use(ensureAdmin);

router.get('/', dashboardPage);
router.get('/side', adminSidePage);
router.get('/posts', listSocialPostsAdmin);
router.get('/reviewposts', reviewPostsAdmin);
router.post('/posts/bulk', bulkActionPostsAdmin);
router.get('/posts/:id', viewSocialPostAdmin);
router.post('/posts/:id/delete', deleteSocialPostAdmin);
router.post('/posts/:id/restore', restoreSocialPostAdmin);
router.post('/posts/:id/warn', sendWarningToUser);
router.post('/posts/:id/force-delete', forceDeletePostAdmin);
router.get('/moderation', moderationPage);

router.get('/jobs', listJobsAdmin);
router.get('/jobs/:id', viewJobAdmin);
router.post('/jobs/:id/status', changeJobStatusAdmin);
router.post('/jobs/:id/delete', deleteJobAdmin);
router.post('/jobs/:id/restore', restoreJobAdmin);
router.get('/users', listUsers);
router.get('/users/:id', viewUserAdmin);
router.post('/users/:id/delete', deleteUser);
router.post('/users/:id/role', changeUserRoleAdmin);
router.get('/audit', listAuditLogsAdmin);

export default router;

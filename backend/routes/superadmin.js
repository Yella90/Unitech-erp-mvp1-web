const express = require('express');
const controller = require('../controllers/superadminController');
const { requireSuperAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireSuperAdmin);

router.get('/dashboard', controller.getDashboard);
router.post('/schools/:id/activate', controller.activateSchool);
router.post('/schools/:id/deactivate', controller.deactivateSchool);
router.post('/schools/:id/plan', controller.changePlan);
router.post('/schools/:id/update', controller.updateSchoolInfo);
router.post('/schools/:id/reset-admin-password', controller.resetSchoolAdminPassword);
router.post('/subscriptions/:id/validate', controller.validateSubscription);
router.post('/subscriptions/:id/suspend', controller.suspendSubscription);
router.post('/subscriptions/:id/activate', controller.activateSubscription);

module.exports = router;

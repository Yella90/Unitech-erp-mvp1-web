const express = require('express');
const router = express.Router();
const financesController = require('../controllers/financesControleur');
const { requirePermission } = require('../middleware/authMiddleware');

router.get('/', requirePermission('finances', 'read'), financesController.getFinances);
router.post('/transactions', requirePermission('finances', 'create'), financesController.addTransaction);

module.exports = router;

const express = require('express');
const router = express.Router();
const { requirePermissionByMethod } = require('../middleware/authMiddleware');
const { addClass, getClasses, getClassById,updateClass } = require('../controllers/classesControleur');
router.post('/', requirePermissionByMethod('classes'), addClass);
router.get('/', requirePermissionByMethod('classes'), getClasses);
router.get('/:id', requirePermissionByMethod('classes'), getClassById);
router.put('/:id', requirePermissionByMethod('classes'), updateClass);


module.exports = router;

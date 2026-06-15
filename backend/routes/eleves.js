const express = require('express');
const router = express.Router();
const { requirePermissionByMethod } = require('../middleware/authMiddleware');
const { addEleve, getEleves, getEleveById, updateEleve, deactivateEleve } = require('../controllers/elevesControleur');
router.post('/', requirePermissionByMethod('students'), addEleve);
router.get('/', requirePermissionByMethod('students'), getEleves);
router.get('/:id', requirePermissionByMethod('students'), getEleveById);
router.put('/:id', requirePermissionByMethod('students'), updateEleve);
router.patch('/:id/deactivate', requirePermissionByMethod('students'), deactivateEleve);


module.exports = router;

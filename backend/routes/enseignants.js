const express = require('express');
const router = express.Router();
const { requirePermissionByMethod } = require('../middleware/authMiddleware');
const { addEnseignant, getEnseignants, getEnseignantById, updateEnseignant, suspendEnseignant, deleteEnseignant } = require('../controllers/enseignants');

router.post('/', requirePermissionByMethod('teachers'), addEnseignant);
router.get('/', requirePermissionByMethod('teachers'), getEnseignants);
router.get('/:id', requirePermissionByMethod('teachers'), getEnseignantById);
router.put('/:id', requirePermissionByMethod('teachers'), updateEnseignant);
router.patch('/:id', requirePermissionByMethod('teachers'), suspendEnseignant);
router.delete('/:id', requirePermissionByMethod('teachers'), deleteEnseignant);

module.exports = router;

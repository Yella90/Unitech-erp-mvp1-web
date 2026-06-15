const express = require('express');
const router = express.Router();
const { requirePermissionByMethod } = require('../middleware/authMiddleware');
const { ajouterMatiere, getMatieres, getMatiereById, updateMatiere, deleteMatiere } = require('../controllers/matiereControlleur');

router.post('/', requirePermissionByMethod('subjects'), ajouterMatiere);
router.get('/', requirePermissionByMethod('subjects'), getMatieres);
router.get('/:id', requirePermissionByMethod('subjects'), getMatiereById);
router.put('/:id', requirePermissionByMethod('subjects'), updateMatiere);
router.delete('/:id', requirePermissionByMethod('subjects'), deleteMatiere);

module.exports = router;

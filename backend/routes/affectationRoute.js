const express = require('express');
const router = express.Router();
const { requirePermissionByMethod } = require('../middleware/authMiddleware');
const {
  ajouteAffectation,
  getAffectation,
  deleteAffectation,
} = require('../controllers/affectationControleur');

router.post('/', requirePermissionByMethod('assignments'), ajouteAffectation);
router.get('/', requirePermissionByMethod('assignments'), getAffectation);
router.delete('/:id', requirePermissionByMethod('assignments'), deleteAffectation);

module.exports=router

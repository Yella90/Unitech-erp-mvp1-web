const express = require('express');
const router = express.Router();
const { requirePermissionByMethod } = require('../middleware/authMiddleware');
const {
  addpersonnel,
  getpersonnel,
  getpersonnelById,
  updatepersonnel,
  deletepersonnel,
} = require('../controllers/personnels');

router.post('/', requirePermissionByMethod('personnels'), addpersonnel);
router.get('/', requirePermissionByMethod('personnels'), getpersonnel);
router.get('/:id', requirePermissionByMethod('personnels'), getpersonnelById);
router.put('/:id', requirePermissionByMethod('personnels'), updatepersonnel);
router.delete('/:id', requirePermissionByMethod('personnels'), deletepersonnel);


module.exports= router ;

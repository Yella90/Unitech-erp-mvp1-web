const express = require('express');
const router = express.Router();
const administrateurController = require('../controllers/administrateurControleur');
const { requirePermissionByMethod } = require('../middleware/authMiddleware');

router.post('/utilisateurs', requirePermissionByMethod('users'), administrateurController.addUtilisateur);
router.get('/utilisateurs', requirePermissionByMethod('users'), administrateurController.getUtilisateurs);
router.put('/utilisateurs/:id', requirePermissionByMethod('users'), administrateurController.updateUtilisateur);
router.delete('/utilisateurs/:id', requirePermissionByMethod('users'), administrateurController.deleteUtilisateur);

module.exports = router;

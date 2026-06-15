const express = require('express');
const router = express.Router();
const { registerSchool, login, logout, changePassword } = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const { normalizeRole } = require('../middleware/authMiddleware');
const db = require('../database/db');

router.post('/register', registerSchool);
router.post('/login', login);
router.post('/logout', authMiddleware, logout);
router.post('/change-password', authMiddleware, changePassword);

router.get('/me', authMiddleware, (req, res) => {
  const schoolId = req.user.school_id;

  db.get('SELECT id, name, email, phone, address, plan, billing FROM schools WHERE id = ?', [schoolId], (schoolErr, school) => {
    if (schoolErr || !school) {
      return res.status(404).json({ error: 'Ecole non trouvee' });
    }

    db.get('SELECT id, name, email, role, phone, matricule, school_id, is_active FROM users WHERE id = ?', [req.user.id], (userErr, user) => {
      if (userErr) {
        return res.status(500).json({ error: 'Utilisateur introuvable' });
      }

      if (!user) {
        return res.json({
          ...school,
          user: null,
        });
      }

      const normalizedUser = { ...user, role: normalizeRole(user.role) };
      const profileLookupParams = [schoolId, user.email || '', user.matricule || null];

      db.get(
        `SELECT nomComplet, poste
         FROM personnels
         WHERE school_id = ?
           AND (lower(trim(email)) = lower(trim(?)) OR (matricule IS NOT NULL AND matricule = ?))
         ORDER BY id DESC
         LIMIT 1`,
        profileLookupParams,
        (personnelErr, personnelProfile) => {
          if (personnelErr) {
            return res.status(500).json({ error: 'Profil utilisateur introuvable' });
          }

          if (personnelProfile) {
            return res.json({
              ...school,
              user: {
                ...normalizedUser,
                display_name: personnelProfile.nomComplet || normalizedUser.name,
                occupied_post: personnelProfile.poste || normalizedUser.role,
              },
            });
          }

          db.get(
            `SELECT nomComplet, matiere
             FROM enseignants
             WHERE school_id = ?
               AND (lower(trim(email)) = lower(trim(?)) OR (matricule IS NOT NULL AND matricule = ?))
             ORDER BY id DESC
             LIMIT 1`,
            profileLookupParams,
            (teacherErr, teacherProfile) => {
              if (teacherErr) {
                return res.status(500).json({ error: 'Profil enseignant introuvable' });
              }

              return res.json({
                ...school,
                user: {
                  ...normalizedUser,
                  display_name: teacherProfile?.nomComplet || normalizedUser.name,
                  occupied_post: teacherProfile?.matiere ? `Professeur de ${teacherProfile.matiere}` : normalizedUser.role,
                },
              });
            }
          );
        }
      );
    });
  });
});

module.exports = router;

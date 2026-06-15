const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const { normalizeRole } = require('../middleware/authMiddleware');

function addAuthActivityLog(schoolId, actorUserId, action, details = {}) {
  db.run(
    'INSERT INTO activity_logs (actor_user_id, school_id, action, details) VALUES (?, ?, ?, ?)',
    [actorUserId || null, schoolId || null, action, JSON.stringify(details || {})],
    (error) => {
      if (error) {
        console.error('Erreur journalisation authentification:', error);
      }
    }
  );
}

function fetchActiveSchoolYearLabel(schoolId, callback) {
  if (!schoolId) return callback('');
  db.get(
    'SELECT label FROM school_years WHERE school_id = ? AND is_active = 1 ORDER BY id DESC LIMIT 1',
    [schoolId],
    (error, row) => {
      if (error) {
        console.error('Erreur lecture annee scolaire active:', error);
        return callback('');
      }
      return callback(row?.label || '');
    }
  );
}

function normalizePlanCode(plan) {
  const value = String(plan || 'basic').trim().toLowerCase();
  if (value === 'smart') return 'pro';
  return value || 'basic';
}

function getDefaultRouteForRole(role) {
  const normalizedRole = normalizeRole(role);
  if (['super@admin', 'superadmin'].includes(normalizedRole)) return '/super-admin';
  if (normalizedRole === 'enseignant') return '/notes';
  if (normalizedRole === 'comptable') return '/finances';
  if (normalizedRole === 'secretaire') return '/eleves';
  if (normalizedRole === 'censeur') return '/notes';
  if (normalizedRole === 'surveillant') return '/emplois-du-temps';
  if (normalizedRole === 'promoteur') return '/rapports';
  return '/';
}

exports.registerSchool = (req, res) => {
  const { ecoleName, ecoleEmail, ecolePhone, ecoleAddress, plan, billing, adminName, adminEmail, adminPassword } = req.body;

  if (!ecoleName || !ecoleEmail || !adminEmail || !adminPassword) {
    return res.status(400).json({ error: 'Tous les champs obligatoires doivent etre remplis' });
  }

  if (adminPassword.length < 8) {
    return res.status(400).json({ error: 'Le mot de passe doit avoir au moins 8 caracteres' });
  }

  db.get('SELECT id FROM users WHERE email = ?', [adminEmail], (userErr, existingUser) => {
    if (userErr) {
      return res.status(500).json({ error: 'Erreur verification utilisateur' });
    }
    if (existingUser) {
      return res.status(400).json({ error: 'Cet email est deja utilise' });
    }

    db.get('SELECT id FROM schools WHERE email = ?', [ecoleEmail], (schoolErr, existingSchool) => {
      if (schoolErr) {
        return res.status(500).json({ error: 'Erreur verification ecole' });
      }
      if (existingSchool) {
        return res.status(400).json({ error: "Cet email d'ecole est deja utilise" });
      }

      const selectedPlan = normalizePlanCode(plan);
      const selectedBilling = String(billing || 'monthly').trim().toLowerCase() === 'annual' ? 'annual' : 'monthly';

      db.run(
        `INSERT INTO schools (name, email, phone, address, plan, billing, subscription_plan, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [ecoleName, ecoleEmail, ecolePhone || null, ecoleAddress || null, selectedPlan, selectedBilling, selectedPlan],
        function onSchoolInserted(insertErr) {
          if (insertErr) {
            return res.status(500).json({ error: 'Erreur creation ecole' });
          }

          const schoolId = this.lastID;
          const hashedPassword = bcrypt.hashSync(adminPassword, 10);

          db.run(
            `INSERT INTO users (name, email, password, role, school_id)
             VALUES (?, ?, ?, 'promoteur', ?)`,
            [adminName, adminEmail, hashedPassword, schoolId],
            (accountErr) => {
              if (accountErr) {
                return res.status(500).json({ error: 'Erreur creation compte' });
              }

              db.get(
                'SELECT code, price_monthly, price_annual FROM subscription_plans WHERE code = ?',
                [selectedPlan],
                (planErr, planRow) => {
                  if (planErr) {
                    console.error('Erreur lecture plan abonnement:', planErr);
                    return res.status(201).json({ message: 'Compte cree avec succes' });
                  }

                  const amount = selectedBilling === 'annual'
                    ? Number(planRow?.price_annual || 0)
                    : Number(planRow?.price_monthly || 0);

                  db.run(
                    `INSERT INTO saas_subscriptions
                     (school_id, plan_code, amount, billing_cycle, status, notes)
                     VALUES (?, ?, ?, ?, 'pending', ?)`,
                    [
                      schoolId,
                      planRow?.code || selectedPlan,
                      amount,
                      selectedBilling,
                      'Abonnement cree lors de l inscription de l ecole',
                    ],
                    (subscriptionErr) => {
                      if (subscriptionErr) {
                        console.error('Erreur creation abonnement initial:', subscriptionErr);
                      }
                      return res.status(201).json({ message: 'Compte cree avec succes' });
                    }
                  );
                }
              );
            }
          );
        }
      );
    });
  });
};

exports.login = (req, res) => {
  const identifier = String(req.body?.email || req.body?.identifier || '').trim();
  const { password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Identifiant et mot de passe requis' });
  }

  db.get(
    `SELECT *
     FROM users
     WHERE lower(trim(email)) = lower(trim(?))
        OR (matricule IS NOT NULL AND lower(trim(matricule)) = lower(trim(?)))
     LIMIT 1`,
    [identifier, identifier],
    (err, user) => {
    if (err || !user) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    if (Number(user.is_active ?? 1) === 0) {
      return res.status(403).json({ error: 'Ce compte a ete desactive. Contactez la direction.' });
    }

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    const normalizedRole = normalizeRole(user.role);
    const token = jwt.sign(
      { id: user.id, email: user.email, role: normalizedRole, school_id: user.school_id },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    fetchActiveSchoolYearLabel(user.school_id, (schoolYearLabel) => {
      addAuthActivityLog(user.school_id, user.id, 'auth_login', {
        email: user.email,
        role: normalizedRole,
        schoolYearLabel,
        userAgent: req.get('user-agent') || '',
        ip: req.ip || req.socket?.remoteAddress || '',
      });
    });

    res.json({
      token,
      role: normalizedRole,
      school_id: user.school_id,
      default_route: getDefaultRouteForRole(normalizedRole),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: normalizedRole,
        school_id: user.school_id,
      },
    });
    }
  );
};

exports.logout = (req, res) => {
  fetchActiveSchoolYearLabel(req.user?.school_id, (schoolYearLabel) => {
    addAuthActivityLog(req.user?.school_id, req.user?.id, 'auth_logout', {
      role: normalizeRole(req.user?.role),
      schoolYearLabel,
      userAgent: req.get('user-agent') || '',
      ip: req.ip || req.socket?.remoteAddress || '',
    });
  });
  res.json({ message: 'Deconnexion effectuee avec succes' });
};

exports.changePassword = (req, res) => {
  const userId = req.user?.id;
  const schoolId = req.user?.school_id;
  const currentPassword = String(req.body?.currentPassword || '');
  const newPassword = String(req.body?.newPassword || '');

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Mot de passe actuel et nouveau mot de passe requis' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Le nouveau mot de passe doit avoir au moins 8 caracteres' });
  }

  if (currentPassword === newPassword) {
    return res.status(400).json({ error: 'Le nouveau mot de passe doit etre different de l ancien' });
  }

  db.get('SELECT id, password FROM users WHERE id = ? AND school_id = ?', [userId, schoolId], (err, user) => {
    if (err) {
      console.error('Erreur lecture utilisateur changement mot de passe:', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    const valid = bcrypt.compareSync(currentPassword, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    db.run('UPDATE users SET password = ? WHERE id = ? AND school_id = ?', [hashedPassword, userId, schoolId], function(updateErr) {
      if (updateErr) {
        console.error('Erreur mise a jour mot de passe:', updateErr);
        return res.status(500).json({ error: 'Impossible de mettre a jour le mot de passe' });
      }

      fetchActiveSchoolYearLabel(schoolId, (schoolYearLabel) => {
        addAuthActivityLog(schoolId, userId, 'auth_change_password', {
          schoolYearLabel,
          userAgent: req.get('user-agent') || '',
          ip: req.ip || req.socket?.remoteAddress || '',
        });
      });

      return res.json({ message: 'Mot de passe modifie avec succes' });
    });
  });
};

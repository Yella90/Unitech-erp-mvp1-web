const db = require('../database/db');
const { normalizeRole } = require('../middleware/authMiddleware');

function resolveTeacherIdForUser(user, callback) {
  if (normalizeRole(user?.role) !== 'enseignant') return callback(null, null);
  db.get(
    `SELECT id
     FROM enseignants
     WHERE school_id = ?
       AND lower(trim(email)) = lower(trim(?))
     ORDER BY id DESC
     LIMIT 1`,
    [user.school_id, user.email || ''],
    (err, row) => {
      if (err) return callback(err);
      return callback(null, row?.id || null);
    }
  );
}

exports.ajouteAffectation = (req, res) => {
  const { nom_matiere, classe_id, enseignant_id } = req.body;

  if (!nom_matiere || !classe_id || !enseignant_id) {
    return res.status(400).json({ err: 'Les donnees ne sont pas valides' });
  }

  db.get(
    `SELECT * FROM affectation
     WHERE school_id = ? AND nom_matiere = ? AND classe_id = ? AND enseignant_id = ?`,
    [req.user.school_id, nom_matiere, classe_id, enseignant_id],
    (err, row) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ err: 'Erreur de base de donnees' });
      }
      if (row) {
        return res.status(409).json({ err: 'Cette matiere est deja affectee a cet enseignant' });
      }

      db.run(
        `INSERT INTO affectation (nom_matiere, classe_id, enseignant_id, school_id)
         VALUES (?, ?, ?, ?)`,
        [nom_matiere, classe_id, enseignant_id, req.user.school_id],
        (insertErr) => {
          if (insertErr) {
            console.error(insertErr);
            return res.status(500).json({ err: "Erreur lors de l'ajout de l'affectation" });
          }
          return res.json({ succes: 'Affectation enregistree' });
        }
      );
    }
  );
};

exports.getAffectation = (req, res) => {
  resolveTeacherIdForUser(req.user, (teacherErr, teacherId) => {
    if (teacherErr) {
      console.error('Erreur resolution enseignant:', teacherErr);
      return res.status(500).json({ error: 'Erreur serveur' });
    }

    if (normalizeRole(req.user?.role) === 'enseignant' && !teacherId) {
      return res.status(403).json({ error: 'Compte enseignant non relie a une fiche enseignant' });
    }

    const params = [req.user.school_id];
    const teacherFilter = teacherId ? ' AND CAST(a.enseignant_id AS TEXT) = CAST(? AS TEXT)' : '';
    if (teacherId) params.push(teacherId);

    db.all(
      `SELECT a.*, e.nomComplet AS enseignant_nom, e.matricule AS enseignant_matricule, c.name AS classe_nom
       FROM affectation a
       LEFT JOIN enseignants e ON CAST(e.id AS TEXT) = CAST(a.enseignant_id AS TEXT)
       LEFT JOIN classes c ON CAST(c.id AS TEXT) = CAST(a.classe_id AS TEXT)
       WHERE a.school_id = ?${teacherFilter}`,
      params,
      (err, rows) => {
        if (err) {
          console.error('Erreur recuperation affectations:', err);
          return res.status(500).json({ error: 'Erreur serveur' });
        }
        return res.json(rows);
      }
    );
  });
};

exports.deleteAffectation = (req, res) => {
  db.run(
    'DELETE FROM affectation WHERE id = ? AND school_id = ?',
    [req.params.id, req.user.school_id],
    function onDelete(err) {
      if (err) {
        console.error('Erreur suppression affectation:', err);
        return res.status(500).json({ error: 'Erreur serveur' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Affectation non trouvee' });
      }
      return res.json({ message: 'Affectation supprimee' });
    }
  );
};

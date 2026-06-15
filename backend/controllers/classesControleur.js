const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/db');

function normalizeClassName(value) {
  return String(value || '').trim();
}

function findDuplicateClassByName(schoolId, className, excludeId, callback) {
  const sql = excludeId
    ? 'SELECT id FROM classes WHERE school_id = ? AND lower(trim(name)) = lower(trim(?)) AND id != ? LIMIT 1'
    : 'SELECT id FROM classes WHERE school_id = ? AND lower(trim(name)) = lower(trim(?)) LIMIT 1';
  const params = excludeId ? [schoolId, className, excludeId] : [schoolId, className];
  db.get(sql, params, callback);
}

exports.addClass = (req, res) => {
  console.log("Requete d'ajout de classe recue avec donnees:", req.body);
  const { className, cycle, niveau, mensualite, fraisInscription, maxEffectif } = req.body;
  const schoolId = req.user.school_id;
  const normalizedClassName = normalizeClassName(className);

  console.log("Validation des donnees de la classe:", { className, cycle, niveau, mensualite, fraisInscription, maxEffectif });
  if (!normalizedClassName || !cycle || !niveau || !mensualite || !maxEffectif) {
    return res.status(400).json({ error: 'Tous les champs obligatoires doivent etre remplis' });
  }
  if (isNaN(mensualite) || mensualite <= 0) {
    return res.status(400).json({ error: 'Mensualite valide requise' });
  }
  if (isNaN(fraisInscription) || fraisInscription < 0) {
    return res.status(400).json({ error: "Frais d'inscription valide" });
  }
  if (isNaN(maxEffectif) || maxEffectif <= 0) {
    return res.status(400).json({ error: 'Effectif maximum valide requis' });
  }

  findDuplicateClassByName(schoolId, normalizedClassName, null, (duplicateErr, duplicateRow) => {
    if (duplicateErr) {
      console.error("Erreur lors de la verification du doublon de classe:", duplicateErr);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
    if (duplicateRow) {
      return res.status(409).json({ error: 'Une classe avec ce nom existe deja' });
    }

    db.run(
      'INSERT INTO classes (name, cycle, niveau, mensualite, frais_inscription, max_effectif, school_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [normalizedClassName, cycle, niveau, mensualite, fraisInscription, maxEffectif, schoolId],
      function onInsert(err) {
        if (err) {
          console.error("Erreur lors de l'ajout de la classe:", err);
          return res.status(500).json({ error: 'Erreur serveur' });
        }
        res.status(201).json({ message: 'Classe ajoutee avec succes', classId: this.lastID });
      }
    );
  });
};

exports.getClasses = (req, res) => {
  const schoolId = req.user.school_id;
  db.all('SELECT * FROM classes WHERE school_id = ?', [schoolId], (err, classes) => {
    if (err) {
      console.error('Erreur lors de la recuperation des classes:', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
    res.json(classes);
  });
};

exports.getClassById = (req, res) => {
  const schoolId = req.user.school_id;
  const classId = req.params.id;
  db.get('SELECT * FROM classes WHERE id = ? AND school_id = ?', [classId, schoolId], (err, classe) => {
    if (err) {
      console.error('Erreur lors de la recuperation de la classe:', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
    if (!classe) {
      return res.status(404).json({ error: 'Classe non trouvee' });
    }
    res.json(classe);
  });
};

exports.updateClass = (req, res) => {
  const schoolId = req.user.school_id;
  const classId = req.params.id;
  const { className, cycle, niveau, mensualite, fraisInscription, maxEffectif } = req.body;
  const normalizedClassName = normalizeClassName(className);

  if (!normalizedClassName) {
    return res.status(400).json({ error: 'Nom de classe requis' });
  }

  findDuplicateClassByName(schoolId, normalizedClassName, classId, (duplicateErr, duplicateRow) => {
    if (duplicateErr) {
      console.error("Erreur lors de la verification du doublon de classe:", duplicateErr);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
    if (duplicateRow) {
      return res.status(409).json({ error: 'Une classe avec ce nom existe deja' });
    }

    db.run(
      'UPDATE classes SET name = ?, cycle = ?, niveau = ?, mensualite = ?, frais_inscription = ?, max_effectif = ? WHERE id = ? AND school_id = ?',
      [normalizedClassName, cycle, niveau, mensualite, fraisInscription, maxEffectif, classId, schoolId],
      function onUpdate(err) {
        if (err) {
          console.error('Erreur lors de la mise a jour de la classe:', err);
          return res.status(500).json({ error: 'Erreur serveur' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Classe non trouvee ou pas autorisee' });
        }
        res.json({ message: 'Classe mise a jour avec succes' });
      }
    );
  });
};

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/db');

exports.ajouterMatiere = (req, res) => {
  const { nom, description, niveau, coefficient } = req.body;
  console.log(req.body)
  const schoolId = req.user.school_id;
  console.log(schoolId)
  db.run(`INSERT INTO matieres (nom, description, coefficient, school_id) VALUES ( ?, ?, ?, ?)`,
    [nom, description, coefficient, schoolId],
    function (err) {
      if (err) {
        console.log(err)
        return res.status(500).json({ error: 'Erreur lors de l\'ajout de la matière' });
      }
      res.status(201).json({ message: 'Matière ajoutée avec succès', matiereId: this.lastID });
    });
};

exports.getMatieres = (req, res) => {
  const schoolId = req.user.school_id;
  db.all(`SELECT * FROM matieres WHERE school_id = ?`, [schoolId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Erreur lors de la récupération des matières' });
    }
    res.json(rows);
  });
};

exports.getMatiereById = (req, res) => {
  const { id } = req.params;
  const schoolId = req.user.school_id;
  db.get(`SELECT * FROM matieres WHERE id = ? AND school_id = ?`, [id, schoolId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Erreur lors de la récupération de la matière' });
    }
    if (!row) {
      return res.status(404).json({ error: 'Matière non trouvée' });
    }
    res.json(row);
  });
};

exports.updateMatiere = (req, res) => {
  const { id } = req.params;
  const { nom, description, niveau, coefficient } = req.body;
  const schoolId = req.user.school_id;
  db.run(`UPDATE matieres SET nom = ?, description = ?, niveau = ?, coefficient = ? WHERE id = ? AND school_id = ?`,
    [nom, description, niveau, coefficient, id, schoolId],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Erreur lors de la mise à jour de la matière' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Matière non trouvée' });
      }
      res.json({ message: 'Matière mise à jour avec succès' });
    });
};

exports.deleteMatiere = (req, res) => {
  const { id } = req.params;
  const schoolId = req.user.school_id;
  db.run(`DELETE FROM matieres WHERE id = ? AND school_id = ?`, [id, schoolId], function (err) {
    if (err) {
      return res.status(500).json({ error: 'Erreur lors de la suppression de la matière' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Matière non trouvée' });
    }
    res.json({ message: 'Matière supprimée avec succès' });
  });
};

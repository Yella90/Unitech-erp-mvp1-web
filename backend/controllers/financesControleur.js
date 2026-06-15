const { computeFinanceOverviewRaw } = require('./systemController');

exports.getFinances = async (req, res) => {
  try {
    const schoolId = req.user.school_id;
    const overview = await computeFinanceOverviewRaw(schoolId);
    res.json({
      school_id: schoolId,
      ...overview,
    });
  } catch (error) {
    console.error('Erreur recuperation finances:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

exports.addTransaction = async (req, res) => {
  try {
    res.status(400).json({
      error: 'Utilisez les routes /system/paiements, /system/depenses, /system/salaires ou /system/retraits pour enregistrer une transaction.',
    });
  } catch (error) {
    console.error('Erreur ajout transaction finances:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

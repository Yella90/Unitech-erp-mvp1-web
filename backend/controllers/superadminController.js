const SuperAdminService = require('../services/superadminService');

exports.getDashboard = async (req, res) => {
  try {
    res.json(await SuperAdminService.getDashboard());
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur chargement dashboard super admin' });
  }
};

exports.activateSchool = async (req, res) => {
  try {
    await SuperAdminService.toggleSchoolStatus(Number(req.params.id), true, Number(req.user.id));
    res.json({ message: 'Ecole activee' });
  } catch (error) {
    res.status(400).json({ error: error.message || "Impossible d'activer l'ecole" });
  }
};

exports.deactivateSchool = async (req, res) => {
  try {
    await SuperAdminService.toggleSchoolStatus(Number(req.params.id), false, Number(req.user.id));
    res.json({ message: 'Ecole suspendue' });
  } catch (error) {
    res.status(400).json({ error: error.message || "Impossible de suspendre l'ecole" });
  }
};

exports.validateSubscription = async (req, res) => {
  try {
    await SuperAdminService.validateSubscription({
      subscriptionId: Number(req.params.id),
      actorUserId: Number(req.user.id),
    });
    res.json({ message: 'Abonnement valide' });
  } catch (error) {
    res.status(400).json({ error: error.message || "Impossible de valider l'abonnement" });
  }
};

exports.suspendSubscription = async (req, res) => {
  try {
    await SuperAdminService.setSubscriptionStatus({
      subscriptionId: Number(req.params.id),
      status: 'suspended',
      actorUserId: Number(req.user.id),
    });
    res.json({ message: 'Abonnement suspendu' });
  } catch (error) {
    res.status(400).json({ error: error.message || "Impossible de suspendre l'abonnement" });
  }
};

exports.activateSubscription = async (req, res) => {
  try {
    await SuperAdminService.setSubscriptionStatus({
      subscriptionId: Number(req.params.id),
      status: 'active',
      actorUserId: Number(req.user.id),
    });
    res.json({ message: 'Abonnement reactive' });
  } catch (error) {
    res.status(400).json({ error: error.message || "Impossible de reactiver l'abonnement" });
  }
};

exports.changePlan = async (req, res) => {
  try {
    await SuperAdminService.updateSchoolPlan({
      schoolId: Number(req.params.id),
      planCode: String(req.body.plan_code || '').trim(),
      billingCycle: String(req.body.billing_cycle || 'monthly').trim(),
      actorUserId: Number(req.user.id),
    });
    res.json({ message: 'Plan modifie avec succes' });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Impossible de modifier le plan' });
  }
};

exports.updateSchoolInfo = async (req, res) => {
  try {
    await SuperAdminService.updateSchoolInformation({
      schoolId: Number(req.params.id),
      payload: req.body || {},
      actorUserId: Number(req.user.id),
    });
    res.json({ message: "Informations de l'etablissement mises a jour" });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Impossible de modifier les informations' });
  }
};

exports.resetSchoolAdminPassword = async (req, res) => {
  try {
    await SuperAdminService.resetSchoolAdminPassword({
      schoolId: Number(req.params.id),
      newPassword: req.body?.new_password || '',
      actorUserId: Number(req.user.id),
    });
    res.json({ message: 'Mot de passe admin ecole reinitialise' });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Impossible de reinitialiser le mot de passe' });
  }
};

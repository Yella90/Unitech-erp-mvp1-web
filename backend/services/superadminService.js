const bcrypt = require('bcryptjs');
const DashboardModel = require('../models/superadmin/dashboardModel');
const { buildSubscriptionAccessStatus } = require('../utils/subscriptionAccess');

function addMonths(date, months) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

const SuperAdminService = {
  getDashboard: async () => {
    const [stats, schools, pendingSubscriptions, logs, plans] = await Promise.all([
      DashboardModel.stats(),
      DashboardModel.listSchools(),
      DashboardModel.listPendingSubscriptions(),
      DashboardModel.listActivityLogs(25),
      DashboardModel.listPlans(),
    ]);

    const decoratedSchools = (schools || []).map((school) => ({
      ...school,
      subscriptionStatus: buildSubscriptionAccessStatus({
        status: school.subscription_status,
        created_at: school.subscription_created_at || school.created_at,
        starts_at: school.subscription_starts_at,
        expires_at: school.subscription_expires_at,
        billing_cycle: school.billing_cycle,
        plan_name: school.plan_name,
        plan_code: school.subscription_plan_code || school.subscription_plan || school.plan,
      }),
    }));

    return { stats, schools: decoratedSchools, pendingSubscriptions, logs, plans };
  },

  toggleSchoolStatus: async (schoolId, isActive, actorUserId = null) => {
    const school = await DashboardModel.getSchoolById(schoolId);
    if (!school) throw new Error('Ecole introuvable');
    await DashboardModel.setSchoolStatus(schoolId, isActive);
    await DashboardModel.logActivity({
      actorUserId,
      schoolId,
      action: isActive ? 'school_activated' : 'school_suspended',
      details: isActive ? 'Ecole activee' : 'Ecole suspendue',
    });
  },

  validateSubscription: async ({ subscriptionId, actorUserId }) => {
    const target = await DashboardModel.getSubscriptionById(subscriptionId);
    if (!target) throw new Error('Abonnement introuvable');

    const now = new Date();
    const startsAt = now.toISOString().slice(0, 10);
    const durationMonths = String(target.billing_cycle || 'monthly').toLowerCase() === 'annual' ? 12 : 1;
    const expiresAt = addMonths(now, durationMonths).toISOString().slice(0, 10);

    await DashboardModel.updateSubscriptionStatus(subscriptionId, 'active', actorUserId, 'Valide par super admin');
    await DashboardModel.updateSubscriptionLifecycle(subscriptionId, {
      startsAt,
      expiresAt,
    });
    await DashboardModel.changeSchoolPlan(target.school_id, target.plan_code, target.billing_cycle || 'monthly');
    await DashboardModel.logActivity({
      actorUserId,
      schoolId: target.school_id,
      action: 'subscription_validated',
      details: `Abonnement ${subscriptionId} valide (${target.plan_code})`,
    });
  },

  setSubscriptionStatus: async ({ subscriptionId, status, actorUserId }) => {
    const target = await DashboardModel.getSubscriptionById(subscriptionId);
    if (!target) throw new Error('Abonnement introuvable');

    const safeStatus = String(status || '').trim().toLowerCase();
    if (!['active', 'suspended'].includes(safeStatus)) {
      throw new Error('Statut abonnement invalide');
    }

    await DashboardModel.updateSubscriptionStatus(
      subscriptionId,
      safeStatus,
      actorUserId,
      safeStatus === 'active' ? 'Abonnement reactive' : 'Abonnement suspendu'
    );

    if (safeStatus === 'active') {
      const now = new Date();
      const startsAt = target.starts_at || now.toISOString().slice(0, 10);
      const expiresAt = target.expires_at && new Date(target.expires_at).getTime() > now.getTime()
        ? target.expires_at
        : addMonths(now, String(target.billing_cycle || 'monthly').toLowerCase() === 'annual' ? 12 : 1).toISOString().slice(0, 10);
      await DashboardModel.updateSubscriptionLifecycle(subscriptionId, { startsAt, expiresAt });
    }

    await DashboardModel.logActivity({
      actorUserId,
      schoolId: target.school_id,
      action: safeStatus === 'active' ? 'subscription_reactivated' : 'subscription_suspended',
      details: `Abonnement ${subscriptionId} -> ${safeStatus}`,
    });
  },

  updateSchoolPlan: async ({ schoolId, planCode, billingCycle = 'monthly', actorUserId }) => {
    const school = await DashboardModel.getSchoolById(schoolId);
    if (!school) throw new Error('Ecole introuvable');

    const plan = await DashboardModel.getPlanByCode(planCode);
    if (!plan) throw new Error('Plan introuvable');

    const cycle = String(billingCycle || '').trim().toLowerCase() === 'annual' ? 'annual' : 'monthly';
    const amount = cycle === 'annual' ? Number(plan.price_annual || 0) : Number(plan.price_monthly || 0);
    const now = new Date();
    const expires = cycle === 'annual' ? addMonths(now, 12) : addMonths(now, 1);

    await DashboardModel.changeSchoolPlan(schoolId, plan.code, cycle);
    await DashboardModel.createSubscriptionRecord({
      schoolId,
      planCode: plan.code,
      amount,
      billingCycle: cycle,
      status: 'active',
      startsAt: now.toISOString().slice(0, 10),
      expiresAt: expires.toISOString().slice(0, 10),
      notes: 'Plan modifie par super admin',
    });
    await DashboardModel.logActivity({
      actorUserId,
      schoolId,
      action: 'plan_changed',
      details: `Nouveau plan ${plan.code} (${cycle})`,
    });
  },

  updateSchoolInformation: async ({ schoolId, payload, actorUserId }) => {
    const school = await DashboardModel.getSchoolById(schoolId);
    if (!school) throw new Error('Ecole introuvable');

    const name = String(payload.name || '').trim();
    const email = String(payload.email || '').trim().toLowerCase();
    if (!name || !email) throw new Error("Nom et email de l'etablissement sont obligatoires");

    await DashboardModel.updateSchoolInfo(schoolId, {
      ...payload,
      name,
      email,
    });
    await DashboardModel.logActivity({
      actorUserId,
      schoolId,
      action: 'school_info_updated',
      details: 'Informations etablissement modifiees',
    });
  },

  resetSchoolAdminPassword: async ({ schoolId, newPassword, actorUserId }) => {
    if (String(newPassword || '').length < 8) {
      throw new Error('Mot de passe minimum 8 caracteres');
    }
    const adminUser = await DashboardModel.getSchoolAdminUser(schoolId);
    if (!adminUser) throw new Error('Aucun administrateur ecole trouve');

    const hash = await bcrypt.hash(String(newPassword), 10);
    await DashboardModel.updateUserPassword(adminUser.id, hash);
    await DashboardModel.logActivity({
      actorUserId,
      schoolId,
      action: 'school_admin_password_reset',
      details: `Mot de passe admin ecole reinitialise (${adminUser.email})`,
    });
  },
};

module.exports = SuperAdminService;

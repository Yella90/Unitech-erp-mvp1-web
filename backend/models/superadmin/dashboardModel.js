const db = require('../../database/db');

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

const DashboardModel = {
  stats: async () => {
    const [totalSchoolsRow, activeSubsRow, expiredSubsRow, pendingSubsRow, revenueRow] = await Promise.all([
      get('SELECT COUNT(*) AS total FROM schools'),
      get(
        `SELECT COUNT(*) AS total
         FROM schools s
         JOIN saas_subscriptions ss ON ss.id = (
           SELECT x.id
           FROM saas_subscriptions x
           WHERE x.school_id = s.id
           ORDER BY x.created_at DESC, x.id DESC
           LIMIT 1
         )
         WHERE LOWER(TRIM(COALESCE(ss.status, ''))) = 'active'
           AND (ss.expires_at IS NULL OR DATE(ss.expires_at) >= DATE('now'))`
      ),
      get(
        `SELECT COUNT(*) AS total
         FROM schools s
         JOIN saas_subscriptions ss ON ss.id = (
           SELECT x.id
           FROM saas_subscriptions x
           WHERE x.school_id = s.id
           ORDER BY x.created_at DESC, x.id DESC
           LIMIT 1
         )
         WHERE LOWER(TRIM(COALESCE(ss.status, ''))) = 'expired'
            OR (ss.expires_at IS NOT NULL AND DATE(ss.expires_at) < DATE('now'))`
      ),
      get(
        `SELECT COUNT(*) AS total
         FROM schools s
         JOIN saas_subscriptions ss ON ss.id = (
           SELECT x.id
           FROM saas_subscriptions x
           WHERE x.school_id = s.id
           ORDER BY x.created_at DESC, x.id DESC
           LIMIT 1
         )
         WHERE LOWER(TRIM(COALESCE(ss.status, ''))) = 'pending'`
      ),
      get(
        `SELECT COALESCE(SUM(ss.amount), 0) AS total
         FROM schools s
         JOIN saas_subscriptions ss ON ss.id = (
           SELECT x.id
           FROM saas_subscriptions x
           WHERE x.school_id = s.id
           ORDER BY x.created_at DESC, x.id DESC
           LIMIT 1
         )
         WHERE LOWER(TRIM(COALESCE(ss.status, ''))) = 'active'
           AND (ss.expires_at IS NULL OR DATE(ss.expires_at) >= DATE('now'))`
      ),
    ]);

    return {
      totalSchools: Number(totalSchoolsRow?.total || 0),
      saasRevenue: Number(revenueRow?.total || 0),
      activeSubscriptions: Number(activeSubsRow?.total || 0),
      expiredSubscriptions: Number(expiredSubsRow?.total || 0),
      pendingSubscriptions: Number(pendingSubsRow?.total || 0),
    };
  },

  listSchools: async () => all(
    `SELECT s.*,
            COALESCE(s.is_active, 1) AS is_active,
            COALESCE(NULLIF(s.subscription_plan, ''), s.plan, 'basic') AS subscription_plan,
            sp.name AS plan_name,
            sp.price_monthly,
            sp.price_annual,
            ss.id AS subscription_id,
            ss.plan_code AS subscription_plan_code,
            ss.status AS subscription_status,
            ss.created_at AS subscription_created_at,
            ss.starts_at AS subscription_starts_at,
            ss.expires_at AS subscription_expires_at,
            ss.billing_cycle,
            ss.amount AS subscription_amount
     FROM schools s
     LEFT JOIN subscription_plans sp ON sp.code = COALESCE(NULLIF(s.subscription_plan, ''), s.plan)
     LEFT JOIN saas_subscriptions ss ON ss.id = (
       SELECT x.id
       FROM saas_subscriptions x
       WHERE x.school_id = s.id
       ORDER BY x.created_at DESC, x.id DESC
       LIMIT 1
     )
     ORDER BY s.created_at DESC, s.id DESC`
  ),

  listPendingSubscriptions: async () => all(
    `SELECT ss.*,
            s.name AS school_name,
            s.email AS school_email,
            sp.name AS plan_name,
            sp.price_monthly,
            sp.price_annual
     FROM saas_subscriptions ss
     JOIN schools s ON s.id = ss.school_id
     LEFT JOIN subscription_plans sp ON sp.code = ss.plan_code
     WHERE LOWER(TRIM(COALESCE(ss.status, ''))) = 'pending'
     ORDER BY ss.created_at DESC, ss.id DESC`
  ),

  listActivityLogs: async (limit = 25) => all(
    `SELECT l.*,
            u.name AS actor_name,
            s.name AS school_name
     FROM activity_logs l
     LEFT JOIN users u ON u.id = l.actor_user_id
     LEFT JOIN schools s ON s.id = l.school_id
     ORDER BY l.created_at DESC, l.id DESC
     LIMIT ?`,
    [Number(limit) || 25]
  ),

  listPlans: async () => all(
    'SELECT code, name, price_monthly, price_annual, annual_discount_percent FROM subscription_plans ORDER BY price_monthly ASC, id ASC'
  ),

  getPlanByCode: async (planCode) => get('SELECT * FROM subscription_plans WHERE code = ?', [planCode]),
  getSubscriptionById: async (subscriptionId) => get('SELECT * FROM saas_subscriptions WHERE id = ?', [subscriptionId]),
  getSchoolById: async (schoolId) => get('SELECT * FROM schools WHERE id = ?', [schoolId]),

  setSchoolStatus: async (schoolId, isActive) => run('UPDATE schools SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, schoolId]),

  updateSubscriptionStatus: async (subscriptionId, status, actorUserId = null, notes = null) => run(
    `UPDATE saas_subscriptions
     SET status = ?,
         notes = COALESCE(?, notes),
         validated_at = CASE WHEN ? = 'active' THEN CURRENT_TIMESTAMP ELSE validated_at END,
         validated_by = CASE WHEN ? = 'active' THEN ? ELSE validated_by END
     WHERE id = ?`,
    [status, notes, status, status, actorUserId, subscriptionId]
  ),

  updateSubscriptionLifecycle: async (subscriptionId, { startsAt = null, expiresAt = null } = {}) => run(
    `UPDATE saas_subscriptions
     SET starts_at = COALESCE(?, starts_at),
         expires_at = COALESCE(?, expires_at)
     WHERE id = ?`,
    [startsAt || null, expiresAt || null, subscriptionId]
  ),

  changeSchoolPlan: async (schoolId, planCode, billingCycle) => run(
    'UPDATE schools SET subscription_plan = ?, plan = ?, billing = ? WHERE id = ?',
    [planCode, planCode, billingCycle, schoolId]
  ),

  createSubscriptionRecord: async ({ schoolId, planCode, amount, billingCycle, status, startsAt, expiresAt, notes }) => run(
    `INSERT INTO saas_subscriptions
     (school_id, plan_code, amount, billing_cycle, status, starts_at, expires_at, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [schoolId, planCode, amount || 0, billingCycle || 'monthly', status || 'active', startsAt || null, expiresAt || null, notes || null]
  ),

  updateSchoolInfo: async (schoolId, payload) => run(
    `UPDATE schools
     SET name = ?, email = ?, phone = ?, address = ?, localisation = ?, code_postal = ?, logo_url = ?,
         promoter_name = ?, director_name = ?
     WHERE id = ?`,
    [
      payload.name,
      payload.email,
      payload.phone || null,
      payload.address || null,
      payload.localisation || null,
      payload.code_postal || null,
      payload.logo_url || null,
      payload.promoter_name || null,
      payload.director_name || null,
      schoolId,
    ]
  ),

  getSchoolAdminUser: async (schoolId) => get(
    `SELECT id, name, email
     FROM users
     WHERE school_id = ?
       AND lower(trim(role)) IN ('administrateur ecole', 'administrateur_ecole', 'administrateur', 'admin', 'directeur')
     ORDER BY created_at ASC, id ASC
     LIMIT 1`,
    [schoolId]
  ),

  updateUserPassword: async (userId, passwordHash) => run('UPDATE users SET password = ? WHERE id = ?', [passwordHash, userId]),

  logActivity: async ({ actorUserId, schoolId, action, details }) => run(
    'INSERT INTO activity_logs (actor_user_id, school_id, action, details) VALUES (?, ?, ?, ?)',
    [actorUserId || null, schoolId || null, action, details || null]
  ),
};

module.exports = DashboardModel;

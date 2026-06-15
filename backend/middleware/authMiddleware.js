const jwt = require('jsonwebtoken');
const db = require('../database/db');
const { buildSubscriptionAccessStatus } = require('../utils/subscriptionAccess');

function normalizeRole(role) {
  const normalized = String(role || '').trim().toLowerCase();
  if (['administrateur ecole', 'administrateur_ecole', 'administrateur', 'admin'].includes(normalized)) {
    return 'directeur';
  }
  return normalized;
}

const rolePermissions = {
  'super@admin': { all: ['manage'] },
  superadmin: { all: ['manage'] },
  directeur: { all: ['manage'] },
  promoteur: {
    all: ['manage'],
  },
  comptable: {
    classes: ['read'],
    students: ['read', 'create', 'update'],
    payments: ['read', 'create', 'update', 'delete'],
    salaries: ['read', 'create', 'update', 'delete'],
    expenses: ['read', 'create', 'update', 'delete'],
    finances: ['read'],
    dashboard: ['read'],
    reports: ['read'],
    personnels: ['read'],
    teachers: ['read'],
    users: ['read'],
  },
  secretaire: {
    classes: ['read'],
    students: ['read', 'create', 'update'],
    payments: ['read', 'create', 'update', 'delete'],
    salaries: ['read', 'create', 'update', 'delete'],
    expenses: ['read', 'create', 'update', 'delete'],
    finances: ['read'],
    dashboard: ['read'],
    reports: ['read'],
    personnels: ['read'],
    teachers: ['read'],
  },
  censeur: {
    classes: ['read', 'create', 'update'],
    attendance: ['read', 'create', 'update'],
    schedules: ['read', 'create', 'update', 'delete'],
    notes: ['read', 'create', 'update', 'delete'],
    bulletins: ['read'],
    trimestres: ['read', 'create', 'update', 'delete'],
    assignments: ['read', 'create', 'update', 'delete'],
    students: ['read'],
    teachers: ['read'],
    subjects: ['read'],
    dashboard: ['read'],
    reports: ['read'],
  },
  surveillant: {
    classes: ['read', 'create', 'update'],
    attendance: ['read', 'create', 'update'],
    schedules: ['read', 'create', 'update', 'delete'],
    notes: ['read', 'create', 'update', 'delete'],
    bulletins: ['read'],
    trimestres: ['read', 'create', 'update', 'delete'],
    assignments: ['read', 'create', 'update', 'delete'],
    students: ['read'],
    teachers: ['read'],
    subjects: ['read'],
    dashboard: ['read'],
    reports: ['read'],
  },
  enseignant: {
    attendance: ['read', 'create'],
    notes: ['read', 'create'],
    bulletins: ['read'],
    schedules: ['read'],
    assignments: ['read'],
    classes: ['read'],
    students: ['read'],
    subjects: ['read'],
    trimestres: ['read'],
    dashboard: ['read'],
  },
  personnel: {
    dashboard: ['read'],
  },
};

function hasPermission(role, resource, action = 'read') {
  if (resource === 'users') {
    return ['directeur', 'promoteur', 'super@admin', 'superadmin'].includes(normalizeRole(role));
  }
  if (resource === 'transfer_notifications') {
    return ['directeur', 'promoteur', 'super@admin', 'superadmin'].includes(normalizeRole(role));
  }
  if (resource === 'activity_logs') {
    return ['directeur', 'promoteur', 'super@admin', 'superadmin'].includes(normalizeRole(role));
  }
  const permissions = rolePermissions[normalizeRole(role)] || {};
  const allPermissions = permissions.all || [];
  const resourcePermissions = permissions[resource] || [];
  if (allPermissions.includes('manage') || resourcePermissions.includes('manage')) return true;
  if (action === 'read' && allPermissions.includes('read')) return true;
  return allPermissions.includes(action) || resourcePermissions.includes(action);
}

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Acces non autorise' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    const normalizedRole = normalizeRole(decoded?.role);
    if (['super@admin', 'superadmin'].includes(normalizedRole)) {
      return next();
    }

    if (String(req.path || '').replace(/\/+$/, '') === '/dashboard/summary') {
      return next();
    }

    db.get(
      `SELECT ss.status, ss.created_at, ss.starts_at, ss.expires_at, ss.billing_cycle, sp.name AS plan_name
       FROM saas_subscriptions ss
       LEFT JOIN subscription_plans sp ON sp.code = ss.plan_code
       WHERE ss.school_id = ?
       ORDER BY ss.created_at DESC, ss.id DESC
       LIMIT 1`,
      [decoded.school_id],
      (subscriptionErr, subscriptionRow) => {
        if (subscriptionErr) {
          console.error('Erreur lecture abonnement:', subscriptionErr);
          return next();
        }

        const accessStatus = buildSubscriptionAccessStatus(subscriptionRow);
        if (accessStatus?.accessBlocked) {
          return res.status(403).json({
            error: accessStatus.message,
            code: accessStatus.code,
            subscriptionStatus: accessStatus,
          });
        }

        req.subscriptionStatus = accessStatus;
        return next();
      }
    );
  } catch (err) {
    return res.status(401).json({ error: 'Token invalide ou expire' });
  }
};

const isSuperAdminRole = (role) => ['super@admin', 'superadmin'].includes(normalizeRole(role));

function requirePermission(resource, action = 'read') {
  return (req, res, next) => {
    authMiddleware(req, res, () => {
      if (!hasPermission(req.user?.role, resource, action)) {
        return res.status(403).json({ error: 'Acces non autorise pour ce role' });
      }
      return next();
    });
  };
}

function requirePermissionByMethod(resource) {
  return (req, res, next) => {
    const methodMap = {
      GET: 'read',
      POST: 'create',
      PUT: 'update',
      PATCH: 'update',
      DELETE: 'delete',
    };
    return requirePermission(resource, methodMap[req.method] || 'read')(req, res, next);
  };
}

const requireSuperAdmin = (req, res, next) => {
  authMiddleware(req, res, () => {
    if (!isSuperAdminRole(req.user?.role)) {
      return res.status(403).json({ error: 'Acces reserve au super administrateur' });
    }
    return next();
  });
};

module.exports = authMiddleware;
module.exports.requireSuperAdmin = requireSuperAdmin;
module.exports.isSuperAdminRole = isSuperAdminRole;
module.exports.normalizeRole = normalizeRole;
module.exports.hasPermission = hasPermission;
module.exports.requirePermission = requirePermission;
module.exports.requirePermissionByMethod = requirePermissionByMethod;

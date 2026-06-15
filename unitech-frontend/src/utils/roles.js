const DEFAULT_ROUTE_BY_ROLE = {
  superadmin: '/superadmin',
  'super-admin': '/superadmin',
  'super admin': '/superadmin',
  promoteur: '/dashboard',
  directeur: '/dashboard',
  comptable: '/finances',
  secretaire: '/dashboard',
  censeur: '/dashboard',
  surveillant: '/dashboard',
  enseignant: '/dashboard',
  personnel: '/dashboard',
};

const FULL_ACCESS_ROLES = new Set(['superadmin', 'super-admin', 'super admin', 'promoteur', 'directeur']);
const WRITE_ROLES = new Set(['superadmin', 'super-admin', 'super admin', 'promoteur', 'directeur', 'comptable', 'secretaire']);

export function normalizeRole(role) {
  return String(role || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/_/g, '-');
}

export function isSuperAdminRole(role) {
  const normalized = normalizeRole(role);
  return normalized === 'superadmin' || normalized === 'super-admin' || normalized === 'super admin';
}

export function getDefaultRouteForRole(role) {
  const normalized = normalizeRole(role);
  return DEFAULT_ROUTE_BY_ROLE[normalized] || '/dashboard';
}

export function hasPermission(role, resource, action) {
  const normalizedRole = normalizeRole(role);
  const normalizedResource = String(resource || '').trim().toLowerCase();
  const normalizedAction = String(action || '').trim().toLowerCase();

  if (FULL_ACCESS_ROLES.has(normalizedRole)) {
    return true;
  }

  if (normalizedResource === 'notes') {
    if (normalizedAction === 'read' || normalizedAction === 'view') {
      return true;
    }
    if (normalizedAction === 'delete' || normalizedAction === 'create' || normalizedAction === 'update') {
      return WRITE_ROLES.has(normalizedRole);
    }
  }

  if (normalizedAction === 'read' || normalizedAction === 'view') {
    return WRITE_ROLES.has(normalizedRole) || ['censeur', 'surveillant', 'enseignant', 'personnel'].includes(normalizedRole);
  }

  return false;
}

const AUTH_STORAGE_KEYS = ['token', 'role', 'schoolId', 'etablissement'];
const LOGIN_PORTAL_KEY = 'loginPortal';

export function setLoginPortal(portal) {
  if (portal === 'staff' || portal === 'admin') {
    localStorage.setItem(LOGIN_PORTAL_KEY, portal);
  }
}

export function getLoginPortal() {
  const stored = localStorage.getItem(LOGIN_PORTAL_KEY);
  if (stored === 'staff' || stored === 'admin') return stored;
  return null;
}

export function clearStoredAuth() {
  AUTH_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
}

export function getLoginRouteForCurrentPath() {
  if (window.location.pathname === '/connexion-personnel') return '/connexion-personnel';
  if (window.location.pathname === '/login') return '/login';
  return getLoginPortal() === 'staff' ? '/connexion-personnel' : '/login';
}

export async function logoutUser(options = {}) {
  const { redirect = true, apiClient = null } = options;

  try {
    if (apiClient) {
      await apiClient.post('/auth/logout');
    }
  } catch {
    // La session locale doit etre videe meme si le serveur ne repond pas.
  } finally {
    clearStoredAuth();
    if (redirect) {
      window.location.assign(getLoginRouteForCurrentPath());
    }
  }
}

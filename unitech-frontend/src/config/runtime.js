const DEFAULT_API_BASE_URL = '/api';

function trimTrailingSlash(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

export const API_BASE_URL = trimTrailingSlash(import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL);

export function apiUrl(path = '') {
  const normalizedPath = String(path || '');
  if (!normalizedPath) {
    return API_BASE_URL;
  }

  return `${API_BASE_URL}${normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`}`;
}

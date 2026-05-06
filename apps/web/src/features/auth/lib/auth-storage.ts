const LEGACY_AUTH_STORAGE_KEY = 'promptoon_auth';
const AUTH_SESSION_HINT_KEY = 'promptoon_auth_session';

export function clearLegacyAuthStorage(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
}

export function markCookieSessionHint(): void {
  if (typeof window === 'undefined') {
    return;
  }

  clearLegacyAuthStorage();
  window.localStorage.setItem(AUTH_SESSION_HINT_KEY, '1');
}

export function clearCookieSessionHint(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(AUTH_SESSION_HINT_KEY);
}

export function hasCookieSessionHint(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  clearLegacyAuthStorage();
  return window.localStorage.getItem(AUTH_SESSION_HINT_KEY) === '1';
}

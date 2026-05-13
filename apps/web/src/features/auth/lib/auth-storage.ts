const LEGACY_AUTH_STORAGE_KEY = 'promptoon_auth';
const AUTH_SESSION_HINT_KEY = 'promptoon_auth_session';
const AUTH_SESSION_HINT_COOKIE_NAME = 'pt_auth_session';
const AUTH_SESSION_HINT_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  for (const cookie of document.cookie.split(';')) {
    const [rawKey, ...rawValue] = cookie.trim().split('=');
    if (rawKey === name) {
      return decodeURIComponent(rawValue.join('='));
    }
  }

  return null;
}

function setSessionHintCookie(): void {
  if (typeof document === 'undefined') {
    return;
  }

  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${AUTH_SESSION_HINT_COOKIE_NAME}=1; Path=/; Max-Age=${AUTH_SESSION_HINT_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

function clearSessionHintCookie(): void {
  if (typeof document === 'undefined') {
    return;
  }

  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${AUTH_SESSION_HINT_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}

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
  setSessionHintCookie();
}

export function clearCookieSessionHint(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(AUTH_SESSION_HINT_KEY);
  clearSessionHintCookie();
}

export function hasCookieSessionHint(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  clearLegacyAuthStorage();
  return window.localStorage.getItem(AUTH_SESSION_HINT_KEY) === '1' || getCookieValue(AUTH_SESSION_HINT_COOKIE_NAME) === '1';
}

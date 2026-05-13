import { queryClient } from '../../app/query-client';
import { useAdminAuthStore } from './use-admin-auth-store';

export function clearAdminAuthSession(): void {
  useAdminAuthStore.getState().logout();
  queryClient.clear();
}

function defaultRedirect(path: string): void {
  window.location.replace(path);
}

export function handleUnauthorizedResponse(redirect: (path: string) => void = defaultRedirect): void {
  clearAdminAuthSession();

  if (typeof window === 'undefined') {
    return;
  }

  if (window.location.pathname === '/login') {
    return;
  }

  redirect('/login');
}

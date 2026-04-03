import { queryClient } from '../../../app/query-client';
import { useAuthStore } from '../store/use-auth-store';

export function clearAuthSession(): void {
  useAuthStore.getState().logout();
  queryClient.clear();
}

function defaultRedirect(path: string): void {
  window.location.replace(path);
}

export function handleUnauthorizedResponse(redirect: (path: string) => void = defaultRedirect): void {
  clearAuthSession();

  if (typeof window === 'undefined') {
    return;
  }

  const { pathname } = window.location;
  if (pathname === '/login' || pathname === '/register') {
    return;
  }

  redirect('/login');
}

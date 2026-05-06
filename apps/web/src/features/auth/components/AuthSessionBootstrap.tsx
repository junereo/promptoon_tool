import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';

import { authApi } from '../../../shared/api/auth.api';
import { clearCookieSessionHint, hasCookieSessionHint } from '../lib/auth-storage';
import { handleUnauthorizedResponse } from '../lib/auth-session';
import { useAuthStore } from '../store/use-auth-store';

export function AuthSessionBootstrap({ children }: { children: ReactNode }) {
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const sessionStatus = useAuthStore((state) => state.sessionStatus);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const activeBootstrapKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!hasHydrated || sessionStatus !== 'idle') {
      return;
    }

    const hasRefreshHint = hasCookieSessionHint();
    if (!isAuthenticated && !hasRefreshHint) {
      useAuthStore.getState().markSessionInvalid();
      return;
    }

    const bootstrapKey = isAuthenticated ? `auth:${userId ?? 'unknown'}` : 'cookie-session';
    if (activeBootstrapKeyRef.current === bootstrapKey) {
      return;
    }
    activeBootstrapKeyRef.current = bootstrapKey;

    useAuthStore.getState().markSessionChecking();

    const bootstrap = isAuthenticated
      ? authApi.me()
      : authApi.refresh().then(async (authResponse) => {
          useAuthStore.getState().login(authResponse);
          useAuthStore.getState().markSessionChecking();
          return authApi.me();
        });

    void bootstrap
      .then((response) => {
        useAuthStore.getState().confirmSession({
          user: response.user,
          session: response.session,
          studioRole: response.studioRole ?? null
        });
      })
      .catch(() => {
        if (isAuthenticated) {
          handleUnauthorizedResponse();
          useAuthStore.getState().markSessionInvalid();
          return;
        }

        clearCookieSessionHint();
        useAuthStore.getState().markSessionInvalid();
      })
      .finally(() => {
        if (activeBootstrapKeyRef.current === bootstrapKey) {
          activeBootstrapKeyRef.current = null;
        }
      });
  }, [hasHydrated, isAuthenticated, sessionStatus, userId]);

  return <>{children}</>;
}

import type { ReactNode } from 'react';
import { useEffect } from 'react';

import { authApi } from '../../../shared/api/auth.api';
import { handleUnauthorizedResponse } from '../lib/auth-session';
import { useAuthStore } from '../store/use-auth-store';

export function AuthSessionBootstrap({ children }: { children: ReactNode }) {
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const token = useAuthStore((state) => state.token);
  const sessionStatus = useAuthStore((state) => state.sessionStatus);

  useEffect(() => {
    if (!hasHydrated || !token || sessionStatus !== 'idle') {
      return;
    }

    useAuthStore.getState().markSessionChecking();
    void authApi
      .me()
      .then((response) => {
        useAuthStore.getState().confirmSession({
          user: response.user,
          session: response.session,
          studioRole: response.studioRole ?? null
        });
      })
      .catch(() => {
        if (useAuthStore.getState().token) {
          handleUnauthorizedResponse();
        }
      });
  }, [hasHydrated, sessionStatus, token]);

  return <>{children}</>;
}

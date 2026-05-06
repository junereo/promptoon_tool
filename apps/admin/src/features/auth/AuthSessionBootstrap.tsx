import type { ReactNode } from 'react';
import { useEffect } from 'react';

import { adminApi } from '../../shared/api/admin.api';
import { ApiError } from '../../shared/api/client';
import { handleUnauthorizedResponse } from './auth-session';
import { useAdminAuthStore } from './use-admin-auth-store';

export function AuthSessionBootstrap({ children }: { children: ReactNode }) {
  const hasHydrated = useAdminAuthStore((state) => state.hasHydrated);
  const token = useAdminAuthStore((state) => state.token);
  const sessionStatus = useAdminAuthStore((state) => state.sessionStatus);

  useEffect(() => {
    if (!hasHydrated || !token || sessionStatus !== 'idle') {
      return;
    }

    useAdminAuthStore.getState().markSessionChecking();
    void adminApi
      .me()
      .then((response) => {
        useAdminAuthStore.getState().confirmAdminSession(response);
      })
      .catch((error) => {
        if (error instanceof ApiError && error.status === 403) {
          useAdminAuthStore.getState().markAccessDenied();
          return;
        }

        if (useAdminAuthStore.getState().token) {
          handleUnauthorizedResponse();
        }
      });
  }, [hasHydrated, sessionStatus, token]);

  return <>{children}</>;
}

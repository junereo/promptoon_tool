import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';

import { useAdminAuthStore } from './use-admin-auth-store';

function LoadingScreen() {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="rounded-[28px] border border-admin-border bg-white/85 px-8 py-6 text-admin-muted shadow-admin-card">
        관리자 세션을 확인하고 있습니다.
      </div>
    </main>
  );
}

function AccessDeniedScreen() {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="w-full max-w-lg rounded-[28px] border border-admin-border bg-white/90 p-8 text-center shadow-admin-card">
        <p className="text-2xl font-black text-admin-ink">Platform Admin 권한이 필요합니다.</p>
        <p className="mt-3 text-sm leading-6 text-admin-muted">
          사용자, Studio 권한, 발행, 커뮤니티 운영은 platform_admin 권한이 있는 계정으로만 접근할 수 있습니다.
        </p>
        <Link className="mt-6 inline-flex rounded-full bg-admin-blue px-4 py-2 text-sm font-bold text-white" to="/login">
          관리자 로그인
        </Link>
      </div>
    </main>
  );
}

export function AdminRouteGuard({ children }: { children: ReactNode }) {
  const location = useLocation();
  const hasHydrated = useAdminAuthStore((state) => state.hasHydrated);
  const isAuthenticated = useAdminAuthStore((state) => state.isAuthenticated);
  const token = useAdminAuthStore((state) => state.token);
  const platformRole = useAdminAuthStore((state) => state.platformRole);
  const sessionStatus = useAdminAuthStore((state) => state.sessionStatus);

  if (!hasHydrated || (token && (sessionStatus === 'idle' || sessionStatus === 'checking'))) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />;
  }

  if (sessionStatus === 'denied' || !platformRole) {
    return <AccessDeniedScreen />;
  }

  return <>{children}</>;
}

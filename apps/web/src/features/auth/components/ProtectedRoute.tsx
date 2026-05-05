import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';

import { useAuthStore } from '../store/use-auth-store';

function AuthLoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md rounded-[28px] border border-editor-border bg-editor-panel/85 p-8 text-center text-zinc-300 shadow-2xl shadow-black/30">
        인증 상태를 확인하고 있습니다.
      </div>
    </main>
  );
}

function StudioAccessDeniedScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md rounded-[28px] border border-editor-border bg-editor-panel/85 p-8 text-center shadow-2xl shadow-black/30">
        <p className="font-display text-2xl font-semibold text-zinc-50">Studio 권한이 필요합니다.</p>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          프로젝트 제작, 발행, 분석 관리는 Studio 멤버 권한이 있는 계정으로만 접근할 수 있습니다.
        </p>
        <Link className="mt-6 inline-flex rounded-full border border-editor-border px-4 py-2 text-sm text-zinc-200 transition hover:border-zinc-500" to="/">
          피드로 이동
        </Link>
      </div>
    </main>
  );
}

export function ProtectedRoute({ children, requireStudio = false }: { children: ReactNode; requireStudio?: boolean }) {
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const token = useAuthStore((state) => state.token);
  const sessionStatus = useAuthStore((state) => state.sessionStatus);
  const studioRole = useAuthStore((state) => state.studioRole);
  const location = useLocation();

  if (!hasHydrated || (token && (sessionStatus === 'idle' || sessionStatus === 'checking'))) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />;
  }

  if (requireStudio && !studioRole) {
    return <StudioAccessDeniedScreen />;
  }

  return <>{children}</>;
}

import type { ReactNode } from 'react';
import { ArrowLeftLg as ArrowLeft } from 'react-coolicons';
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
    <main className="min-h-dvh bg-[#050506] text-white">
      <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-[linear-gradient(180deg,#012d28_0%,#001512_27%,#000_55%)] px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-[max(env(safe-area-inset-top),1rem)] shadow-[0_0_80px_rgba(0,0,0,0.42)]">
        <header className="flex h-12 items-center">
          <Link
            aria-label="마이로 이동"
            className="inline-flex h-11 w-11 items-center justify-center text-white transition hover:text-white/75 focus:outline-none focus:ring-2 focus:ring-white/70"
            to="/my"
          >
            <ArrowLeft aria-hidden className="h-7 w-7" />
          </Link>
        </header>

        <section className="flex flex-1 flex-col">
          <div className="flex min-h-[50dvh] flex-1 flex-col items-center justify-center text-center">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#1fffe6]/72">Studio</p>
            <h1 className="mt-4 font-display text-[clamp(1.85rem,8vw,2.75rem)] font-black leading-tight tracking-normal text-white">
              Studio 권한이 필요합니다.
            </h1>
            <p className="mt-5 max-w-[21rem] text-sm leading-6 text-white/62">
              프로젝트 제작, 발행, 분석 관리는 Studio 멤버 권한이 있는 계정으로만 접근할 수 있습니다.
            </p>
          </div>

          <Link
            className="inline-flex h-14 w-full items-center justify-center rounded-xl bg-[#146bff] px-5 text-base font-bold text-white transition hover:bg-[#0e5be2]"
            to="/my"
          >
            마이로 이동
          </Link>
          <p className="mt-5 text-center text-xs leading-5 text-white/36">
            권한이 부여된 계정으로 다시 로그인하면 Studio에 접근할 수 있습니다.
          </p>
        </section>
      </div>
    </main>
  );
}

export function ProtectedRoute({ children, requireStudio = false }: { children: ReactNode; requireStudio?: boolean }) {
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const sessionStatus = useAuthStore((state) => state.sessionStatus);
  const studioRole = useAuthStore((state) => state.studioRole);
  const location = useLocation();

  if (!hasHydrated || sessionStatus === 'idle' || sessionStatus === 'checking') {
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

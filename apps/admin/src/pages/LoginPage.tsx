import { useState } from 'react';
import { ShieldCheck } from 'react-coolicons';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { useAdminAuthStore } from '../features/auth/use-admin-auth-store';
import { adminApi } from '../shared/api/admin.api';
import { authApi } from '../shared/api/auth.api';
import { ApiError } from '../shared/api/client';

function getValidationError(loginId: string, password: string): string | null {
  if (!loginId.trim()) {
    return '아이디를 입력해 주세요.';
  }

  if (password.trim().length < 8) {
    return '비밀번호는 최소 8자 이상이어야 합니다.';
  }

  return null;
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAdminAuthStore((state) => state.login);
  const confirmAdminSession = useAdminAuthStore((state) => state.confirmAdminSession);
  const logout = useAdminAuthStore((state) => state.logout);
  const isAuthenticated = useAdminAuthStore((state) => state.isAuthenticated);
  const platformRole = useAdminAuthStore((state) => state.platformRole);
  const hasHydrated = useAdminAuthStore((state) => state.hasHydrated);

  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!hasHydrated) {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <div className="rounded-[28px] border border-admin-border bg-white/85 px-8 py-6 text-admin-muted shadow-admin-card">
          관리자 인증 상태를 확인하고 있습니다.
        </div>
      </main>
    );
  }

  if (isAuthenticated && platformRole) {
    return <Navigate replace to="/" />;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = getValidationError(loginId, password);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const authResponse = await authApi.login({
        loginId: loginId.trim(),
        password: password.trim()
      });
      login(authResponse);
      const adminResponse = await adminApi.me();
      confirmAdminSession(adminResponse);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from || '/', { replace: true });
    } catch (error) {
      logout();
      setErrorMessage(error instanceof ApiError ? error.message : '관리자 로그인에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-6 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[36px] border border-admin-border bg-white shadow-admin-card lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative overflow-hidden bg-gradient-to-br from-admin-blue to-admin-purple p-10 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.25),transparent_30%)]" />
          <div className="relative">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/15">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <p className="mt-8 text-xs font-black uppercase tracking-[0.28em] text-white/70">Promptoon Admin</p>
            <h1 className="mt-4 text-4xl font-black tracking-tight">플랫폼 운영 콘솔</h1>
            <p className="mt-4 max-w-md text-sm leading-7 text-white/80">
              사용자 권한, Studio 멤버십, 발행 상태, Community/Discourse, Telemetry를 분리된 관리자 앱에서 관리합니다.
            </p>
          </div>
        </section>

        <section className="p-8 sm:p-10">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="mb-2 block text-sm font-bold text-admin-ink" htmlFor="admin-login-id">
                아이디
              </label>
              <input
                className="w-full rounded-2xl border border-admin-border bg-white px-4 py-3 text-sm outline-none transition focus:border-admin-blue"
                id="admin-login-id"
                onChange={(event) => setLoginId(event.target.value)}
                placeholder="admin"
                type="text"
                value={loginId}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-admin-ink" htmlFor="admin-login-password">
                비밀번호
              </label>
              <input
                className="w-full rounded-2xl border border-admin-border bg-white px-4 py-3 text-sm outline-none transition focus:border-admin-blue"
                id="admin-login-password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="minimum 8 characters"
                type="password"
                value={password}
              />
            </div>

            {errorMessage ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{errorMessage}</p> : null}

            <button
              className="w-full rounded-2xl bg-admin-blue px-5 py-3 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? '확인 중...' : '관리자 로그인'}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

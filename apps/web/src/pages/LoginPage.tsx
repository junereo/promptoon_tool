import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';

import { useLogin } from '../features/auth/hooks/use-auth-query';
import { useAuthStore } from '../features/auth/store/use-auth-store';
import { ApiError } from '../shared/api/client';

function getValidationError(loginId: string, password: string): string | null {
  if (loginId.trim().length < 8) {
    return '아이디는 최소 8자 이상이어야 합니다.';
  }

  if (password.trim().length < 8) {
    return '비밀번호는 최소 8자 이상이어야 합니다.';
  }

  return null;
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const loginMutation = useLogin();
  const login = useAuthStore((state) => state.login);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);

  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!hasHydrated) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-md rounded-[28px] border border-editor-border bg-editor-panel/85 p-8 text-center text-zinc-300 shadow-2xl shadow-black/30">
          인증 상태를 확인하고 있습니다.
        </div>
      </main>
    );
  }

  if (hasHydrated && isAuthenticated) {
    return <Navigate replace to="/promptoon/projects" />;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = getValidationError(loginId, password);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    try {
      const response = await loginMutation.mutateAsync({
        loginId: loginId.trim(),
        password: password.trim()
      });

      login(response);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from || '/promptoon/projects', { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : '로그인에 실패했습니다.');
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="grid w-full max-w-5xl gap-8 overflow-hidden rounded-[36px] border border-editor-border bg-editor-panel/90 shadow-[0_32px_120px_rgba(0,0,0,0.45)] lg:grid-cols-[1.1fr_0.9fr]">
        <section className="relative overflow-hidden border-b border-editor-border/80 p-10 lg:border-b-0 lg:border-r">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(122,48,64,0.28),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent)]" />
          <div className="relative">
            <p className="text-[11px] uppercase tracking-[0.28em] text-editor-accentSoft">Promptoon Auth</p>
            <h1 className="mt-4 font-display text-5xl font-semibold tracking-tight text-zinc-50">Login</h1>
            <p className="mt-5 max-w-lg text-sm leading-7 text-zinc-300">
              로그인 후 내 프로젝트만 조회하고, authoring 에디터와 분석 화면에 접근할 수 있습니다.
            </p>
          </div>
        </section>

        <section className="p-8 sm:p-10">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-200" htmlFor="login-id">
                아이디
              </label>
              <input
                className="w-full rounded-2xl border border-editor-border bg-black/20 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-editor-accentSoft"
                id="login-id"
                onChange={(event) => setLoginId(event.target.value)}
                placeholder="minimum 8 characters"
                type="text"
                value={loginId}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-200" htmlFor="login-password">
                비밀번호
              </label>
              <input
                className="w-full rounded-2xl border border-editor-border bg-black/20 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-editor-accentSoft"
                id="login-password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="minimum 8 characters"
                type="password"
                value={password}
              />
            </div>

            {errorMessage ? <p className="text-sm text-rose-200">{errorMessage}</p> : null}

            <button
              className="w-full rounded-2xl bg-editor-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-editor-accentSoft disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loginMutation.isPending}
              type="submit"
            >
              {loginMutation.isPending ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          <p className="mt-6 text-sm text-zinc-400">
            계정이 없다면{' '}
            <Link className="text-editor-accentSoft transition hover:text-white" to="/register">
              회원가입
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}

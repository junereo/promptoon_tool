import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { useRegister } from '../features/auth/hooks/use-auth-query';
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

export function RegisterPage() {
  const navigate = useNavigate();
  const registerMutation = useRegister();
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
      const response = await registerMutation.mutateAsync({
        loginId: loginId.trim(),
        password: password.trim()
      });

      login(response);
      navigate('/promptoon/projects', { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : '회원가입에 실패했습니다.');
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="grid w-full max-w-5xl gap-8 overflow-hidden rounded-[36px] border border-editor-border bg-editor-panel/90 shadow-[0_32px_120px_rgba(0,0,0,0.45)] lg:grid-cols-[0.95fr_1.05fr]">
        <section className="p-8 sm:p-10">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-200" htmlFor="register-login-id">
                아이디
              </label>
              <input
                className="w-full rounded-2xl border border-editor-border bg-black/20 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-editor-accentSoft"
                id="register-login-id"
                onChange={(event) => setLoginId(event.target.value)}
                placeholder="minimum 8 characters"
                type="text"
                value={loginId}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-200" htmlFor="register-password">
                비밀번호
              </label>
              <input
                className="w-full rounded-2xl border border-editor-border bg-black/20 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-editor-accentSoft"
                id="register-password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="minimum 8 characters"
                type="password"
                value={password}
              />
            </div>

            {errorMessage ? <p className="text-sm text-rose-200">{errorMessage}</p> : null}

            <button
              className="w-full rounded-2xl bg-editor-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-editor-accentSoft disabled:cursor-not-allowed disabled:opacity-60"
              disabled={registerMutation.isPending}
              type="submit"
            >
              {registerMutation.isPending ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <p className="mt-6 text-sm text-zinc-400">
            이미 계정이 있다면{' '}
            <Link className="text-editor-accentSoft transition hover:text-white" to="/login">
              로그인
            </Link>
          </p>
        </section>

        <section className="relative overflow-hidden border-t border-editor-border/80 p-10 lg:border-l lg:border-t-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(72,117,160,0.24),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent)]" />
          <div className="relative">
            <p className="text-[11px] uppercase tracking-[0.28em] text-sky-200">Promptoon Auth</p>
            <h1 className="mt-4 font-display text-5xl font-semibold tracking-tight text-zinc-50">Register</h1>
            <p className="mt-5 max-w-lg text-sm leading-7 text-zinc-300">
              계정을 만들면 내 프로젝트만 보이는 authoring 대시보드와 보호된 편집 API를 바로 사용할 수 있습니다.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

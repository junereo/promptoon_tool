import { useEffect, useState } from 'react';
import { ArrowLeftLg as ArrowLeft } from 'react-coolicons';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { useLogin } from '../features/auth/hooks/use-auth-query';
import { useAuthStore } from '../features/auth/store/use-auth-store';
import { authService, isLocalCredentialAuthEnabled } from '../shared/api/auth.service';
import { ApiError } from '../shared/api/client';

const POST_LOGIN_REDIRECT_PATH = '/';

function getRedirectPath(state: unknown): string {
  if (
    typeof state === 'object' &&
    state !== null &&
    'from' in state &&
    typeof (state as { from?: unknown }).from === 'string' &&
    (state as { from: string }).from.startsWith('/') &&
    !(state as { from: string }).from.startsWith('//')
  ) {
    return (state as { from: string }).from;
  }

  return POST_LOGIN_REDIRECT_PATH;
}

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
  const [searchParams] = useSearchParams();
  const loginMutation = useLogin();
  const login = useAuthStore((state) => state.login);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);

  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOauthChecking, setIsOauthChecking] = useState(false);
  const redirectPath = getRedirectPath(location.state);

  useEffect(() => {
    if (!hasHydrated || searchParams.get('oauth') !== '1') {
      return;
    }

    let isMounted = true;
    setIsOauthChecking(true);
    setErrorMessage(null);

    void authService
      .refresh()
      .then((response) => {
        login(response);
        navigate(redirectPath, { replace: true });
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }
        setErrorMessage(error instanceof ApiError ? error.message : 'SNS 로그인 세션을 확인할 수 없습니다.');
      })
      .finally(() => {
        if (isMounted) {
          setIsOauthChecking(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [hasHydrated, login, navigate, redirectPath, searchParams]);

  if (!hasHydrated || isOauthChecking) {
    return (
      <main className="min-h-dvh bg-[#050506] text-white">
        <div className="mx-auto flex min-h-dvh w-full max-w-[480px] items-center justify-center bg-[linear-gradient(180deg,#012d28_0%,#000_54%)] px-6 shadow-[0_0_80px_rgba(0,0,0,0.42)]">
          <div className="text-center text-sm text-white/70">
            인증 상태를 확인하고 있습니다.
          </div>
        </div>
      </main>
    );
  }

  if (hasHydrated && isAuthenticated) {
    return <Navigate replace to={redirectPath} />;
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
      navigate(redirectPath, { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : '로그인에 실패했습니다.');
    }
  }

  async function handleGoogleLogin() {
    try {
      setErrorMessage(null);
      const authorizationUrl = await authService.getGoogleAuthorizationUrl();
      window.location.assign(authorizationUrl);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Google 로그인을 시작할 수 없습니다.');
    }
  }

  function handleBack() {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate('/', { replace: true });
  }

  return (
    <main className="min-h-dvh bg-[#050506] text-white">
      <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-[linear-gradient(180deg,#012d28_0%,#001512_27%,#000_55%)] px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-[max(env(safe-area-inset-top),1rem)] shadow-[0_0_80px_rgba(0,0,0,0.42)]">
        <header className="flex h-12 items-center">
          <button
            aria-label="뒤로가기"
            className="inline-flex h-11 w-11 items-center justify-center text-white transition hover:text-white/75 focus:outline-none focus:ring-2 focus:ring-white/70"
            onClick={handleBack}
            type="button"
          >
            <ArrowLeft aria-hidden className="h-7 w-7" />
          </button>
        </header>

        <section className="flex flex-1 flex-col">
          <div className="flex min-h-[42dvh] flex-1 flex-col items-center justify-center text-center">
            <h1 className="font-display text-[clamp(2rem,9vw,3rem)] font-black uppercase tracking-[0.08em] text-[#1fffe6] drop-shadow-[0_0_28px_rgba(31,255,230,0.2)]">
              PROMPTOON
            </h1>
            <p className="mt-5 text-base font-medium tracking-normal text-white">새로운 선택지가 필요할 때, 프롬툰</p>
          </div>

          {isLocalCredentialAuthEnabled ? (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="mb-2 block text-sm font-medium text-white/78" htmlFor="login-id">
                  아이디
                </label>
                <input
                  className="h-12 w-full rounded-md border border-white/12 bg-white px-4 text-sm font-semibold text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-[#1fffe6] focus:ring-2 focus:ring-[#1fffe6]/40"
                  id="login-id"
                  onChange={(event) => setLoginId(event.target.value)}
                  placeholder="minimum 8 characters"
                  type="text"
                  value={loginId}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-white/78" htmlFor="login-password">
                  비밀번호
                </label>
                <input
                  className="h-12 w-full rounded-md border border-white/12 bg-white px-4 text-sm font-semibold text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-[#1fffe6] focus:ring-2 focus:ring-[#1fffe6]/40"
                  id="login-password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="minimum 8 characters"
                  type="password"
                  value={password}
                />
              </div>

              {errorMessage ? <p className="text-sm text-rose-200">{errorMessage}</p> : null}

              <button
                className="h-14 w-full rounded-xl bg-[#146bff] px-5 text-base font-bold text-white transition hover:bg-[#0e5be2] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={loginMutation.isPending}
                type="submit"
              >
                {loginMutation.isPending ? 'Signing In...' : 'Sign In'}
              </button>
            </form>
          ) : null}

          {!isLocalCredentialAuthEnabled && errorMessage ? <p className="text-sm text-rose-200">{errorMessage}</p> : null}

          <button
            className={`${isLocalCredentialAuthEnabled ? 'mt-4' : ''} h-14 w-full rounded-xl bg-white px-5 text-base font-bold text-zinc-950 transition hover:bg-zinc-100`}
            onClick={handleGoogleLogin}
            type="button"
          >
            Google로 로그인
          </button>

          {isLocalCredentialAuthEnabled ? (
            <p className="mt-7 text-center text-sm leading-6 text-white/48">
              계정이 없다면{' '}
              <Link className="font-semibold text-white/82 underline underline-offset-4 transition hover:text-white" to="/register">
                회원가입
              </Link>
            </p>
          ) : null}
          <p className="mt-5 text-center text-xs leading-5 text-white/36">
            시작하면 서비스 이용약관에 동의하게 됩니다.
          </p>
        </section>
      </div>
    </main>
  );
}

import type { AuthUser } from '@promptoon/shared';
import { type FormEvent, useEffect, useState } from 'react';
import { BookOpen, Check, ChevronRight, CloseMd as X, EditPencilLine01 as Pencil, PaperPlane as Send, User01 as User } from 'react-coolicons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';

import { clearAuthSession } from '../../../features/auth/lib/auth-session';
import { useAuthStore } from '../../../features/auth/store/use-auth-store';
import { authService } from '../../../shared/api/auth.service';
import { experimentalApi } from '../../../shared/api/experimental.api';
import { promptoonKeys } from '../../../shared/api/query-keys';
import { ConsumerResponsiveFrame } from '../components/ConsumerResponsiveFrame';

function getUserInitial(name: string | null | undefined): string {
  return name?.trim().slice(0, 1).toUpperCase() || 'P';
}

function getAccountDisplayName(user: AuthUser | null): string {
  const displayName = user?.displayName?.trim();
  if (displayName) {
    return displayName;
  }

  if (user?.authProvider === 'google') {
    return 'Google 사용자';
  }

  if (user?.authProvider === 'facebook') {
    return 'Facebook 사용자';
  }

  return user?.loginId?.trim() || 'Promptoon 사용자';
}

function getAuthProviderLabel(provider: AuthUser['authProvider'] | undefined): string {
  if (provider === 'google') {
    return 'Google 계정';
  }

  if (provider === 'facebook') {
    return 'Facebook 계정';
  }

  return 'Promptoon 계정';
}

export function ConsumerMyPage() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const studioRole = useAuthStore((state) => state.studioRole);
  const updateUser = useAuthStore((state) => state.updateUser);
  const accountDisplayName = getAccountDisplayName(user);
  const accountProviderLabel = getAuthProviderLabel(user?.authProvider);
  const initial = getUserInitial(accountDisplayName);
  const snsProfileImageUrl = user?.snsProfileImageUrl?.trim() || null;
  const [isEditingName, setIsEditingName] = useState(false);
  const [displayNameDraft, setDisplayNameDraft] = useState(accountDisplayName);
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);
  const experimentalAccessQuery = useQuery({
    enabled: isAuthenticated,
    queryKey: promptoonKeys.experimentalAccess(),
    queryFn: experimentalApi.getMyAccess
  });
  const updateProfileMutation = useMutation({
    mutationFn: authService.updateProfile,
    onSuccess: (response) => {
      updateUser(response.user);
      setIsEditingName(false);
      setDisplayNameError(null);
    }
  });
  const experimentalMenuStatus = !isAuthenticated
    ? '로그인 필요'
    : (experimentalAccessQuery.data?.grantCount ?? 0) > 0
      ? `${experimentalAccessQuery.data?.grantCount ?? 0}개 접근 가능`
      : '권한 필요';

  useEffect(() => {
    if (!isEditingName) {
      setDisplayNameDraft(accountDisplayName);
    }
  }, [accountDisplayName, isEditingName]);

  async function handleDisplayNameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextDisplayName = displayNameDraft.trim().replace(/\s+/g, ' ');
    if (!nextDisplayName) {
      setDisplayNameError('이름을 입력해주세요.');
      return;
    }

    if (nextDisplayName.length > 64) {
      setDisplayNameError('이름은 64자 이하로 입력해주세요.');
      return;
    }

    if (nextDisplayName === accountDisplayName) {
      setIsEditingName(false);
      setDisplayNameError(null);
      return;
    }

    try {
      await updateProfileMutation.mutateAsync({ displayName: nextDisplayName });
    } catch {
      setDisplayNameError('이름을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.');
    }
  }

  function handleDisplayNameCancel() {
    setDisplayNameDraft(accountDisplayName);
    setDisplayNameError(null);
    setIsEditingName(false);
  }

  function handleLogout() {
    clearAuthSession();
    navigate('/', { replace: true });
  }

  return (
    <ConsumerResponsiveFrame>
      <header className="px-5 pb-6 pt-[max(env(safe-area-inset-top),1.25rem)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-white/42">My</p>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-normal">마이</h1>
          </div>
          <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-full bg-white text-base font-black text-zinc-950">
            {isAuthenticated && snsProfileImageUrl ? (
              <img alt="" className="h-full w-full object-cover" src={snsProfileImageUrl} />
            ) : isAuthenticated ? (
              initial
            ) : (
              <User aria-hidden className="h-6 w-6" />
            )}
          </div>
        </div>

        {isAuthenticated ? (
          <div className="mt-6">
            {isEditingName ? (
              <form className="space-y-2" onSubmit={handleDisplayNameSubmit}>
                <div className="flex items-center gap-2">
                  <input
                    aria-label="이름"
                    className="h-10 min-w-0 flex-1 rounded-md border border-white/14 bg-black/24 px-3 text-base font-bold text-white outline-none transition focus:border-white/42"
                    maxLength={64}
                    onChange={(event) => {
                      setDisplayNameDraft(event.target.value);
                      setDisplayNameError(null);
                    }}
                    value={displayNameDraft}
                  />
                  <button
                    aria-label="이름 저장"
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-white text-zinc-950 transition disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={updateProfileMutation.isPending || !displayNameDraft.trim()}
                    type="submit"
                  >
                    <Check aria-hidden className="h-5 w-5" />
                  </button>
                  <button
                    aria-label="이름 편집 취소"
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-white/12 bg-white/[0.04] text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={updateProfileMutation.isPending}
                    onClick={handleDisplayNameCancel}
                    type="button"
                  >
                    <X aria-hidden className="h-5 w-5" />
                  </button>
                </div>
                {displayNameError ? <p className="text-xs font-semibold text-rose-200">{displayNameError}</p> : null}
              </form>
            ) : (
              <div className="flex min-w-0 items-center gap-2">
                <p className="min-w-0 truncate text-lg font-bold text-white">{accountDisplayName}</p>
                <button
                  aria-label="이름 편집"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-white/12 bg-white/[0.04] text-white/72 transition hover:bg-white/10 hover:text-white"
                  onClick={() => {
                    setDisplayNameDraft(accountDisplayName);
                    setDisplayNameError(null);
                    setIsEditingName(true);
                  }}
                  type="button"
                >
                  <Pencil aria-hidden className="h-4 w-4" />
                </button>
              </div>
            )}
            <p className="mt-1 text-sm text-white/52">{accountProviderLabel}으로 로그인 중입니다.</p>
          </div>
        ) : (
          <div className="mt-6">
            <p className="text-lg font-bold text-white">로그인하고 내 콘텐츠를 이어보세요.</p>
            <p className="mt-2 text-sm leading-6 text-white/58">저장한 콘텐츠와 제작 도구 진입점을 한곳에서 관리할 수 있습니다.</p>
            <Link className="mt-5 inline-flex h-11 items-center rounded-md bg-white px-4 text-sm font-bold text-zinc-950" to="/login">
              로그인
            </Link>
          </div>
        )}
      </header>

      <section className="border-y border-white/10 bg-white/[0.04] px-5 py-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white">멤버십 구독</h2>
            <p className="mt-1 text-sm leading-6 text-white/56">광고 없이 더 많은 콘텐츠를 즐기는 구독 영역입니다.</p>
          </div>
          <button className="h-10 shrink-0 rounded-md bg-white px-3 text-xs font-bold text-zinc-950" type="button">
            준비중
          </button>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2 text-center">
          {['무제한 시청', '광고 제거', '선물 기능'].map((label) => (
            <div className="rounded-lg border border-white/10 bg-black/18 px-2 py-3 text-xs font-semibold text-white/72" key={label}>
              {label}
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 py-5">
        <h2 className="mb-3 text-base font-bold text-white">내 메뉴</h2>
        <div className="divide-y divide-white/10 overflow-hidden rounded-lg border border-white/10">
          <Link className="flex min-h-14 items-center gap-3 bg-white/[0.03] px-4 text-sm font-semibold text-white" to="/library">
            <BookOpen aria-hidden className="h-5 w-5 text-white/62" />
            <span className="min-w-0 flex-1">보관함</span>
            <ChevronRight aria-hidden className="h-4 w-4 text-white/42" />
          </Link>
          <div className="flex min-h-14 items-center gap-3 bg-white/[0.03] px-4 text-sm font-semibold text-white">
            <span className="grid h-5 w-5 place-items-center text-xs font-black text-white/62">₩</span>
            <span className="min-w-0 flex-1">내 지갑</span>
            <span className="text-xs text-white/44">0 코인</span>
          </div>
          <Link className="flex min-h-14 items-center gap-3 bg-white/[0.03] px-4 text-sm font-semibold text-white" to="/experimental">
            <span className="grid h-5 w-5 place-items-center text-base text-white/72">🧪</span>
            <span className="min-w-0 flex-1">실험형 콘텐츠</span>
            <span className="text-xs text-white/44">{experimentalMenuStatus}</span>
          </Link>
          <Link className="flex min-h-14 items-center gap-3 bg-white/[0.03] px-4 text-sm font-semibold text-white" to="/studio/projects">
            <Send aria-hidden className="h-5 w-5 text-white/62" />
            <span className="min-w-0 flex-1">Studio</span>
            <span className="text-xs text-white/44">{studioRole ? '접근 가능' : '권한 필요'}</span>
          </Link>
        </div>
      </section>

      <section className="px-5 pb-8">
        <h2 className="mb-3 text-base font-bold text-white">설정</h2>
        <div className="divide-y divide-white/10 overflow-hidden rounded-lg border border-white/10">
          {['자주 묻는 질문', '언어: 한국어', '설정'].map((label) => (
            <button
              className="flex min-h-14 w-full items-center justify-between bg-white/[0.03] px-4 text-left text-sm font-semibold text-white"
              key={label}
              type="button"
            >
              <span>{label}</span>
              <ChevronRight aria-hidden className="h-4 w-4 text-white/42" />
            </button>
          ))}
          {isAuthenticated ? (
            <button
              className="flex min-h-14 w-full items-center bg-white/[0.03] px-4 text-left text-sm font-semibold text-rose-200"
              onClick={handleLogout}
              type="button"
            >
              로그아웃
            </button>
          ) : null}
        </div>
      </section>
    </ConsumerResponsiveFrame>
  );
}

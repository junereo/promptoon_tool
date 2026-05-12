import { BookOpen, ChevronRight, PaperPlane as Send, User01 as User } from 'react-coolicons';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';

import { clearAuthSession } from '../../../features/auth/lib/auth-session';
import { useAuthStore } from '../../../features/auth/store/use-auth-store';
import { experimentalApi } from '../../../shared/api/experimental.api';
import { promptoonKeys } from '../../../shared/api/query-keys';
import { ConsumerResponsiveFrame } from '../components/ConsumerResponsiveFrame';

function getUserInitial(loginId: string | null | undefined): string {
  return loginId?.trim().slice(0, 1).toUpperCase() || 'P';
}

export function ConsumerMyPage() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const studioRole = useAuthStore((state) => state.studioRole);
  const initial = getUserInitial(user?.loginId);
  const snsProfileImageUrl = user?.snsProfileImageUrl?.trim() || null;
  const experimentalAccessQuery = useQuery({
    enabled: isAuthenticated,
    queryKey: promptoonKeys.experimentalAccess(),
    queryFn: experimentalApi.getMyAccess
  });
  const experimentalMenuStatus = !isAuthenticated
    ? '로그인 필요'
    : (experimentalAccessQuery.data?.grantCount ?? 0) > 0
      ? `${experimentalAccessQuery.data?.grantCount ?? 0}개 접근 가능`
      : '권한 필요';

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
            <p className="text-lg font-bold text-white">{user?.loginId}</p>
            <p className="mt-1 text-sm text-white/52">Promptoon 계정으로 로그인 중입니다.</p>
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

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuthStore } from '../../../features/auth/store/use-auth-store';
import { ApiError } from '../../../shared/api/client';
import { experimentalApi } from '../../../shared/api/experimental.api';
import { promptoonKeys } from '../../../shared/api/query-keys';
import { ConsumerContentCard } from '../components/ConsumerContentCard';
import { ConsumerResponsiveFrame } from '../components/ConsumerResponsiveFrame';

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  return '초대 코드를 확인해 주세요.';
}

export function ConsumerExperimentalPage() {
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [code, setCode] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const accessQuery = useQuery({
    enabled: isAuthenticated,
    queryKey: promptoonKeys.experimentalAccess(),
    queryFn: experimentalApi.getMyAccess
  });
  const feedQuery = useQuery({
    enabled: isAuthenticated,
    queryKey: promptoonKeys.experimentalFeed(),
    queryFn: experimentalApi.getMyFeed
  });
  const redeemMutation = useMutation({
    mutationFn: experimentalApi.redeemInviteCode,
    onSuccess: async () => {
      setCode('');
      setSuccessMessage('실험형 콘텐츠 권한이 추가되었습니다.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: promptoonKeys.experimentalAccess() }),
        queryClient.invalidateQueries({ queryKey: promptoonKeys.experimentalFeed() }),
        queryClient.invalidateQueries({ queryKey: promptoonKeys.feedHome() }),
        queryClient.invalidateQueries({ queryKey: promptoonKeys.feed() })
      ]);
    }
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccessMessage(null);
    const normalizedCode = code.trim();
    if (!normalizedCode) {
      return;
    }

    redeemMutation.mutate(normalizedCode);
  }

  return (
    <ConsumerResponsiveFrame>
      <header className="px-5 pb-5 pt-[max(env(safe-area-inset-top),1.25rem)]">
        <p className="text-xs font-semibold uppercase text-white/42">Experimental</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-normal">실험형 콘텐츠</h1>
        <p className="mt-2 text-sm leading-6 text-white/58">초대 코드를 입력하면 제한 공개 콘텐츠를 볼 수 있습니다.</p>
      </header>

      {!isAuthenticated ? (
        <section className="px-5 pb-8">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] px-5 py-10 text-center">
            <p className="text-sm font-semibold text-white">로그인이 필요합니다.</p>
            <p className="mt-2 text-sm leading-6 text-white/52">초대 코드는 로그인한 계정에 권한을 부여합니다.</p>
            <Link className="mt-5 inline-flex h-11 items-center rounded-md bg-white px-4 text-sm font-bold text-zinc-950" to="/login">
              로그인
            </Link>
          </div>
        </section>
      ) : (
        <>
          <section className="px-5 pb-5">
            <form className="rounded-lg border border-white/10 bg-white/[0.04] p-4" onSubmit={handleSubmit}>
              <label className="text-sm font-bold text-white" htmlFor="experimental-code">
                초대 코드
              </label>
              <div className="mt-3 flex gap-2">
                <input
                  autoComplete="one-time-code"
                  className="h-11 min-w-0 flex-1 rounded-md border border-white/12 bg-black/35 px-3 text-sm font-semibold text-white outline-none transition placeholder:text-white/30 focus:border-white/38"
                  id="experimental-code"
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  value={code}
                />
                <button
                  className="h-11 shrink-0 rounded-md bg-white px-4 text-sm font-bold text-zinc-950 disabled:cursor-wait disabled:opacity-60"
                  disabled={redeemMutation.isPending}
                  type="submit"
                >
                  등록
                </button>
              </div>
              {successMessage ? <p className="mt-3 text-sm font-semibold text-emerald-300">{successMessage}</p> : null}
              {redeemMutation.isError ? <p className="mt-3 text-sm font-semibold text-rose-200">{getErrorMessage(redeemMutation.error)}</p> : null}
            </form>
          </section>

          <section className="px-5 pb-8">
            <div className="mb-3 flex items-end justify-between gap-4">
              <h2 className="text-base font-bold text-white">접근 가능한 콘텐츠</h2>
              <span className="text-xs text-white/44">{accessQuery.data?.grantCount ?? 0}개 권한</span>
            </div>

            {feedQuery.isLoading ? <p className="py-10 text-sm text-white/56">실험형 콘텐츠를 불러오는 중입니다.</p> : null}
            {feedQuery.isError ? <p className="py-10 text-sm text-white/56">실험형 콘텐츠를 불러오지 못했습니다.</p> : null}
            {!feedQuery.isLoading && (feedQuery.data?.items.length ?? 0) === 0 ? (
              <div className="rounded-lg border border-dashed border-white/12 px-5 py-10 text-center text-sm text-white/52">
                아직 접근 가능한 실험형 콘텐츠가 없습니다.
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-x-3 gap-y-6">
              {(feedQuery.data?.items ?? []).map((item) => (
                <ConsumerContentCard item={item} key={item.publishId} />
              ))}
            </div>
          </section>
        </>
      )}
    </ConsumerResponsiveFrame>
  );
}

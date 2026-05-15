import type { FeedItem } from '@promptoon/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FormEvent } from 'react';
import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { preloadViewerForPublish } from '../../../features/viewer/lib/preload-viewer';
import { useAuthStore } from '../../../features/auth/store/use-auth-store';
import { ApiError } from '../../../shared/api/client';
import { landingApi } from '../../../shared/api/landing.api';
import { platformAccessApi } from '../../../shared/api/platform-access.api';
import { promptoonKeys } from '../../../shared/api/query-keys';
import {
  CONSUMER_FRAME_CLASS,
  CONSUMER_RIGHT_FRAME_CLASS,
  ConsumerDesktopLandingPanel
} from '../../consumer/components/ConsumerResponsiveFrame';
import { MovingtoonVideoPlayer } from '../../../widgets/public-feed/MovingtoonVideoPlayer';
import { FeedActionRail } from '../components/FeedActionRail';
import { FeedCommentsPanel } from '../components/FeedCommentsPanel';

const DEMO_FEED_LIMIT = 10;
const VIEWER_NAVIGATION_DELAY_MS = 120;
const GATE_SUCCESS_NAVIGATION_DELAY_MS = 650;
const ACCESS_CODE_CHARACTER_LIMIT = 16;
const ACCESS_CODE_GROUP_SIZE = 4;
const ACCESS_CODE_PLACEHOLDER = '    -    -    -    ';

type DemoGateStatus = 'idle' | 'verifying' | 'success' | 'failed';

function getAccessCodeCharacters(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

function formatAccessCodeInput(value: string) {
  const characters = getAccessCodeCharacters(value).slice(0, ACCESS_CODE_CHARACTER_LIMIT);
  const groups = characters.match(new RegExp(`.{1,${ACCESS_CODE_GROUP_SIZE}}`, 'g')) ?? [];
  return groups.join('-');
}

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function flattenDemoItems(data: Awaited<ReturnType<typeof landingApi.getLanding>> | undefined): FeedItem[] {
  return (data?.items ?? []).slice(0, DEMO_FEED_LIMIT);
}

function getRedeemErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.message === 'Invalid platform access code.') {
      return '코드를 다시 확인하거나 다음 초대를 기다려 주세요.';
    }

    if (error.message === 'This platform access code has expired.') {
      return '초대 코드의 사용 기간이 지났습니다.';
    }

    if (error.message.includes('already been used')) {
      return '이미 사용된 초대 코드입니다.';
    }

    return error.message;
  }

  return '특별 코드를 확인해 주세요.';
}

function getDemoPosterUrl(item: FeedItem) {
  return item.coverImageUrl ?? item.startCut.assetUrl;
}

function getDemoMetrics(item: FeedItem) {
  return item.metrics ?? { comments: 0, likes: 0, shares: 0, views: 0 };
}

function DemoPosterSlide({
  isOpening,
  isSidePanelVisible,
  item,
  onComment,
  onOpen,
  onPreloadIntent
}: {
  isOpening?: boolean;
  isSidePanelVisible?: boolean;
  item: FeedItem;
  onComment: () => void;
  onOpen: () => void;
  onPreloadIntent?: () => void;
}) {
  const posterUrl = getDemoPosterUrl(item);
  const shouldRenderVideo = item.type === 'short_drama' && Boolean(item.videoUrl);
  const visibilityClass = isSidePanelVisible ? 'opacity-100' : 'pointer-events-none opacity-0';

  return (
    <section className="feed-snap-slide relative flex snap-start snap-always items-center justify-center overflow-hidden bg-[#050506] text-white" data-feed-slide>
      <div className="feed-viewport-frame relative overflow-hidden bg-black shadow-[0_0_80px_rgba(0,0,0,0.5)]">
        {shouldRenderVideo ? (
          <MovingtoonVideoPlayer
            className="absolute inset-0 h-full w-full bg-black"
            posterUrl={posterUrl}
            title={item.episodeTitle}
            videoUrl={item.videoUrl ?? ''}
          />
        ) : posterUrl ? (
          <img alt={item.episodeTitle} className="absolute inset-0 h-full w-full object-cover" src={posterUrl} />
        ) : (
          <div className="absolute inset-0 bg-[linear-gradient(135deg,#131316,#202327_52%,#050506)]" />
        )}
        <button
          aria-label={`${item.episodeTitle} 보기`}
          className="absolute inset-0 z-10 cursor-pointer bg-transparent"
          disabled={isOpening}
          onClick={onOpen}
          onFocus={onPreloadIntent}
          onPointerEnter={onPreloadIntent}
          type="button"
        />
      </div>

      <div
        className={[
          'absolute bottom-0 right-3 z-20 flex items-end pb-3 transition-opacity duration-200 ease-out sm:right-5',
          visibilityClass
        ].join(' ')}
      >
        <FeedActionRail metrics={getDemoMetrics(item)} onComment={onComment} />
      </div>

      <div
        className={[
          'absolute inset-x-0 bottom-8 z-10 flex justify-center px-5 transition-opacity duration-200 ease-out sm:bottom-10 sm:px-6',
          visibilityClass
        ].join(' ')}
      >
        <button
          aria-busy={isOpening ? 'true' : undefined}
          className="inline-flex h-14 w-[72%] min-w-[15rem] max-w-[21rem] items-center justify-center rounded-full bg-[linear-gradient(135deg,#37ffd8_0%,#fff06a_100%)] px-7 text-base font-black text-[#06110f] shadow-[0_18px_44px_rgba(55,255,216,0.28)] ring-1 ring-white/35 transition hover:scale-[1.02] hover:shadow-[0_22px_54px_rgba(255,240,106,0.26)] disabled:cursor-wait disabled:opacity-75"
          disabled={isOpening}
          onClick={onOpen}
          onFocus={onPreloadIntent}
          onPointerEnter={onPreloadIntent}
          type="button"
        >
          {isOpening ? '여는 중...' : '보러가기'}
        </button>
      </div>
    </section>
  );
}

function DemoGateSlide({
  code,
  errorMessage,
  gateStatus,
  isPending,
  onCodeChange,
  onExplorePreview,
  onSubmit
}: {
  code: string;
  errorMessage?: string | null;
  gateStatus: DemoGateStatus;
  isPending?: boolean;
  onCodeChange: (value: string) => void;
  onExplorePreview: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const codeCharacterCount = getAccessCodeCharacters(code).length;
  const isCodeComplete = codeCharacterCount === ACCESS_CODE_CHARACTER_LIMIT;
  const isVerifying = isPending || gateStatus === 'verifying';
  const activeStep = isVerifying ? 3 : gateStatus === 'success' || gateStatus === 'failed' ? 4 : codeCharacterCount > 0 ? 2 : 1;
  const steps = [
    { label: '초대', step: 1 },
    { label: '사전 코드', step: 2 },
    { label: '인증', step: 3 },
    { label: '입장', step: 4 }
  ];
  const statusLabel = gateStatus === 'success' ? '접근 성공' : gateStatus === 'failed' ? '접근 실패' : isVerifying ? '인증 중' : isCodeComplete ? '인증 준비 완료' : '초대 확인 대기';

  return (
    <section className="feed-snap-slide flex snap-start snap-always items-center justify-center bg-[#050506] text-white">
      <div className="feed-viewport-frame relative flex flex-col overflow-hidden bg-[radial-gradient(circle_at_50%_12%,rgba(55,255,216,0.22),transparent_32%),linear-gradient(180deg,#021d1a_0%,#00100e_46%,#030304_100%)] px-6 py-7 text-center shadow-[0_0_80px_rgba(0,0,0,0.5)]">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),transparent_26%,rgba(0,0,0,0.38)_100%)]" />
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 pt-1">
            <img alt="Promptoon" className="mx-auto h-auto w-full max-w-[13.5rem] rounded-lg object-contain" src="/promptoon-logo.webp" />
          </div>

          <div className="mt-7 text-left">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#37ffd8]">Step 1</p>
            <h1 className="mt-2 font-display text-3xl font-black tracking-normal text-white">초대 받으셨나요?</h1>
            <p className="mt-3 text-sm font-semibold leading-6 text-white/68">사전 코드를 인증하면 준비된 입장권이 열립니다.</p>
          </div>

          <div className="mt-5 grid grid-cols-4 gap-1.5">
            {steps.map((step) => {
              const isActive = activeStep === step.step;
              const isComplete = activeStep > step.step || gateStatus === 'success';
              return (
                <div
                  className={[
                    'rounded-xl border px-2 py-2 text-left transition',
                    isActive
                      ? 'border-[#37ffd8] bg-[#37ffd8]/15 text-white shadow-[0_0_24px_rgba(55,255,216,0.14)]'
                      : isComplete
                        ? 'border-[#37ffd8]/35 bg-white/[0.06] text-white/78'
                        : 'border-white/10 bg-white/[0.035] text-white/42'
                  ].join(' ')}
                  key={step.step}
                >
                  <p className="text-[0.62rem] font-black uppercase leading-none tracking-[0.16em]">Step {step.step}</p>
                  <p className="mt-1 truncate text-[0.68rem] font-bold leading-tight">{step.label}</p>
                </div>
              );
            })}
          </div>

          <form className="mt-6 shrink-0 space-y-4 text-left" onSubmit={onSubmit}>
            <div>
              <label className="text-sm font-black text-white" htmlFor="platform-access-code">
                사전 코드 입력
              </label>
              <input
                aria-describedby="platform-access-status"
                autoComplete="one-time-code"
                className="mt-2 h-14 w-full rounded-2xl border border-[#37ffd8]/45 bg-black/38 px-4 text-center font-mono text-lg font-black uppercase tracking-[0.22em] text-white outline-none transition placeholder:text-white/35 focus:border-[#fff06a] focus:ring-4 focus:ring-[#37ffd8]/20 sm:text-xl"
                id="platform-access-code"
                inputMode="text"
                maxLength={19}
                onChange={(event) => onCodeChange(event.target.value)}
                pattern="[A-Za-z0-9-]*"
                placeholder={ACCESS_CODE_PLACEHOLDER}
                value={code}
              />
            </div>

            <div
              className={[
                'flex min-h-12 items-center justify-between rounded-2xl border px-4 py-3 text-sm font-bold transition',
                gateStatus === 'failed'
                  ? 'border-rose-300/35 bg-rose-500/12 text-rose-100'
                  : gateStatus === 'success'
                    ? 'border-[#37ffd8]/45 bg-[#37ffd8]/14 text-[#dffff8]'
                    : 'border-white/10 bg-white/[0.045] text-white/72'
              ].join(' ')}
              id="platform-access-status"
            >
              <span>{statusLabel}</span>
              {isVerifying ? <span aria-hidden className="h-5 w-5 animate-spin rounded-full border-2 border-[#37ffd8]/20 border-t-[#37ffd8]" /> : null}
              {gateStatus === 'success' ? <span aria-hidden className="text-lg text-[#37ffd8]">✓</span> : null}
              {gateStatus === 'failed' ? <span aria-hidden className="text-lg text-rose-200">!</span> : null}
            </div>

            <button
              className="h-[3.25rem] w-full rounded-2xl bg-[linear-gradient(135deg,#37ffd8_0%,#fff06a_100%)] px-5 py-3 text-base font-black text-[#06110f] shadow-[0_18px_44px_rgba(55,255,216,0.22)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isVerifying || !isCodeComplete}
              type="submit"
            >
              {isVerifying ? '인증 중...' : '접근 인증'}
            </button>

            {gateStatus === 'failed' ? (
              <div className="rounded-2xl border border-rose-300/35 bg-[#230711]/88 p-4 text-left shadow-[0_18px_44px_rgba(0,0,0,0.24)]">
                <p className="text-base font-black text-white">아직 초대받지 않았습니다</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-rose-100/78">{errorMessage ?? '코드를 다시 확인하거나 다음 초대를 기다려 주세요.'}</p>
                <button
                  className="mt-3 inline-flex h-10 items-center justify-center rounded-full border border-white/14 bg-white/10 px-4 text-sm font-black text-white transition hover:bg-white/16"
                  onClick={onExplorePreview}
                  type="button"
                >
                  공개 프리뷰 보기
                </button>
              </div>
            ) : null}
          </form>
        </div>
      </div>
    </section>
  );
}

export function DemoEntryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [openingPublishId, setOpeningPublishId] = useState<string | null>(null);
  const [isCommentsPanelOpen, setIsCommentsPanelOpen] = useState(false);
  const [commentsPanelItem, setCommentsPanelItem] = useState<FeedItem | null>(null);
  const [code, setCode] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [gateStatus, setGateStatus] = useState<DemoGateStatus>('idle');
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const landingQuery = useQuery({
    queryKey: promptoonKeys.landing(),
    queryFn: landingApi.getLanding
  });
  const feedItems = useMemo(() => flattenDemoItems(landingQuery.data), [landingQuery.data]);
  const redeemMutation = useMutation({
    mutationFn: platformAccessApi.redeemCode,
    onMutate: () => {
      setGateStatus('verifying');
    },
    onSuccess: async () => {
      setGateStatus('success');
      setErrorMessage(null);
      await wait(GATE_SUCCESS_NAVIGATION_DELAY_MS);
      setCode('');
      await queryClient.invalidateQueries({ queryKey: promptoonKeys.platformAccess() });
      navigate('/platform', { replace: true });
    },
    onError: (error) => {
      setGateStatus('failed');
      setErrorMessage(getRedeemErrorMessage(error));
    }
  });

  useEffect(() => {
    if (landingQuery.data?.enabled === false) {
      navigate('/platform', { replace: true });
    }
  }, [landingQuery.data?.enabled, navigate]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        let nextIndex = -1;
        let nextRatio = 0;

        for (const entry of entries) {
          if (entry.intersectionRatio < 0.75) {
            continue;
          }

          const rawIndex = Number((entry.target as HTMLElement).dataset.demoIndex);
          if (Number.isNaN(rawIndex) || entry.intersectionRatio <= nextRatio) {
            continue;
          }

          nextIndex = rawIndex;
          nextRatio = entry.intersectionRatio;
        }

        if (nextIndex >= 0) {
          startTransition(() => setActiveIndex(nextIndex));
        }
      },
      {
        root: container,
        threshold: [0.75, 0.9, 1]
      }
    );

    const slides = Array.from(container.querySelectorAll<HTMLElement>('[data-demo-slide]'));
    for (const [index, slide] of slides.entries()) {
      slide.dataset.demoIndex = String(index);
      observer.observe(slide);
    }

    return () => observer.disconnect();
  }, [feedItems.length]);

  useEffect(() => {
    if (searchParams.get('gate') !== '1' || feedItems.length === 0) {
      return;
    }

    window.setTimeout(() => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      container.scrollTo({
        top: container.clientHeight * feedItems.length,
        behavior: 'smooth'
      });
    }, 120);
  }, [feedItems.length, searchParams]);

  async function handleOpenFeedItem(item: FeedItem) {
    if (openingPublishId) {
      return;
    }

    setOpeningPublishId(item.publishId);

    if (item.type === 'short_drama') {
      navigate(item.entry?.href ?? `/shorts/${item.publishId}`);
      setOpeningPublishId(null);
      return;
    }

    try {
      await preloadViewerForPublish(item.publishId);
    } catch {
      // Viewer route has its own loading state.
    }

    await new Promise((resolve) => {
      window.setTimeout(resolve, VIEWER_NAVIGATION_DELAY_MS);
    });

    navigate(`/v/${item.publishId}`);
  }

  function handleCommentFeedItem(item: FeedItem) {
    setCommentsPanelItem(item);
    setIsCommentsPanelOpen(true);
  }

  function handlePreloadFeedItem(item: FeedItem) {
    if (item.type === 'short_drama') {
      return;
    }

    void preloadViewerForPublish(item.publishId).catch(() => undefined);
  }

  function handleGateCodeChange(value: string) {
    setCode(formatAccessCodeInput(value));
    setErrorMessage(null);
    setGateStatus('idle');
  }

  function handleExplorePreviewFromGate() {
    setErrorMessage(null);
    setGateStatus('idle');
    containerRef.current?.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }

  function handleCommentCreated() {
    if (!commentsPanelItem) {
      return;
    }

    void Promise.all([
      queryClient.invalidateQueries({ queryKey: promptoonKeys.landing() }),
      queryClient.invalidateQueries({ queryKey: promptoonKeys.communityComments(commentsPanelItem.publishId) }),
      queryClient.invalidateQueries({ queryKey: promptoonKeys.communityCommentsMeta(commentsPanelItem.publishId) })
    ]).catch(() => undefined);
  }

  function handleGateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    const normalizedCode = formatAccessCodeInput(code);
    if (getAccessCodeCharacters(normalizedCode).length < ACCESS_CODE_CHARACTER_LIMIT) {
      setGateStatus('failed');
      setErrorMessage('코드는 4자리씩 4칸을 채워야 합니다.');
      return;
    }

    if (!isAuthenticated) {
      navigate('/login', {
        state: {
          from: '/?gate=1'
        }
      });
      return;
    }

    redeemMutation.mutate(normalizedCode);
  }

  const content = landingQuery.isLoading || landingQuery.data?.enabled === false ? (
    <section className="feed-snap-slide flex snap-start snap-always items-center justify-center bg-[#050506] text-center text-white/60">
      <div className="feed-viewport-frame flex items-center justify-center overflow-hidden bg-black shadow-[0_0_80px_rgba(0,0,0,0.5)]">
        데모를 불러오는 중입니다.
      </div>
    </section>
  ) : landingQuery.isError || feedItems.length === 0 ? (
    <section className="feed-snap-slide flex snap-start snap-always items-center justify-center bg-[#050506] text-center text-white/60">
      <div className="feed-viewport-frame flex items-center justify-center overflow-hidden bg-black shadow-[0_0_80px_rgba(0,0,0,0.5)]">
        공개된 대문 콘텐츠가 없습니다.
      </div>
    </section>
  ) : (
    <>
      {feedItems.map((item, index) => (
        <div data-demo-slide key={item.publishId}>
          <DemoPosterSlide
            isOpening={openingPublishId === item.publishId}
            isSidePanelVisible={activeIndex === index}
            item={item}
            onComment={() => handleCommentFeedItem(item)}
            onOpen={() => {
              void handleOpenFeedItem(item);
            }}
            onPreloadIntent={() => handlePreloadFeedItem(item)}
          />
        </div>
      ))}
      <div data-demo-slide>
        <DemoGateSlide
          code={code}
          errorMessage={errorMessage}
          gateStatus={gateStatus}
          isPending={redeemMutation.isPending}
          onCodeChange={handleGateCodeChange}
          onExplorePreview={handleExplorePreviewFromGate}
          onSubmit={handleGateSubmit}
        />
      </div>
    </>
  );

  return (
    <main className={`min-h-dvh bg-[#050506] text-white ${isCommentsPanelOpen && commentsPanelItem ? 'feed-comments-open' : ''}`}>
      <div className={`${CONSUMER_FRAME_CLASS} demo-entry-shell`}>
        <ConsumerDesktopLandingPanel />
        <section className={`${CONSUMER_RIGHT_FRAME_CLASS} demo-entry-page feed-page relative overflow-hidden !bg-black shadow-[0_0_80px_rgba(0,0,0,0.42)]`}>
          <div className="feed-snap-scroller overflow-y-auto snap-y snap-mandatory scrollbar-hidden" ref={containerRef}>
            {content}
          </div>
        </section>
      </div>

      {isCommentsPanelOpen && commentsPanelItem ? (
        <FeedCommentsPanel
          item={commentsPanelItem}
          onClose={() => setIsCommentsPanelOpen(false)}
          onCommentCreated={handleCommentCreated}
        />
      ) : null}
    </main>
  );
}

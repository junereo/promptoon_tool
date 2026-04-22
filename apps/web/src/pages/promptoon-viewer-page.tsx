import type { PublishManifest } from '@promptoon/shared';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { usePublishedEpisode } from '../features/viewer/hooks/use-published-episode';
import { useViewerTelemetry } from '../features/viewer/hooks/use-viewer-telemetry';
import { useViewerStore } from '../features/viewer/store/use-viewer-store';
import { ViewerShell } from '../widgets/public-viewer/ViewerShell';

type ViewerCut = PublishManifest['cuts'][number];
type ViewerChoice = ViewerCut['choices'][number];

interface ViewerPathStep {
  cut: ViewerCut;
  visibleChoices: ViewerChoice[];
}

function getSortedViewerChoices(cut: ViewerCut): ViewerChoice[] {
  return [...cut.choices].sort(compareViewerChoices);
}

function getStartCutId(manifest: PublishManifest): string | null {
  if (manifest.episode.startCutId && manifest.cuts.some((cut) => cut.id === manifest.episode.startCutId)) {
    return manifest.episode.startCutId;
  }

  return (
    manifest.cuts.find((cut) => cut.isStart)?.id ??
    [...manifest.cuts].sort((left, right) => left.orderIndex - right.orderIndex)[0]?.id ??
    null
  );
}

function getFeedEntryCutId(manifest: PublishManifest, startChoiceId: string | null): string | null {
  if (!startChoiceId) {
    return null;
  }

  const startCutId = getStartCutId(manifest);
  if (!startCutId) {
    return null;
  }

  const startCut = manifest.cuts.find((cut) => cut.id === startCutId) ?? null;
  const selectedChoice = startCut?.choices.find((choice) => choice.id === startChoiceId) ?? null;
  const nextCutId = selectedChoice?.nextCutId ?? null;

  if (!nextCutId || !manifest.cuts.some((cut) => cut.id === nextCutId)) {
    return null;
  }

  return nextCutId;
}

function preloadConnectedAssets(currentCut: ViewerCut | null, cutsById: Map<string, ViewerCut>) {
  if (!currentCut) {
    return;
  }

  const preloadTargets = currentCut.choices
    .map((choice) => choice.nextCutId)
    .filter((cutId): cutId is string => Boolean(cutId))
    .map((cutId) => cutsById.get(cutId)?.assetUrl)
    .filter((assetUrl): assetUrl is string => Boolean(assetUrl));

  for (const assetUrl of preloadTargets) {
    const image = new Image();
    image.src = assetUrl;
  }
}

function compareViewerChoices(left: ViewerChoice, right: ViewerChoice) {
  return left.orderIndex - right.orderIndex;
}

function buildViewerPathSteps(startCut: ViewerCut | null, cutsById: Map<string, ViewerCut>): ViewerPathStep[] {
  if (!startCut || !cutsById.has(startCut.id)) {
    return [];
  }

  const steps: ViewerPathStep[] = [];
  const visitedCutIds = new Set<string>();
  let currentCut: ViewerCut | null = startCut;

  while (currentCut && !visitedCutIds.has(currentCut.id)) {
    visitedCutIds.add(currentCut.id);
    const sortedChoices = getSortedViewerChoices(currentCut);

    steps.push({
      cut: currentCut,
      visibleChoices: currentCut.kind === 'scene' ? [] : sortedChoices
    });

    if (currentCut.isEnding || currentCut.kind === 'ending' || currentCut.kind !== 'scene') {
      break;
    }

    const linkedChoices = sortedChoices.filter((choice) => choice.nextCutId && cutsById.has(choice.nextCutId));
    if (linkedChoices.length !== 1) {
      break;
    }

    currentCut = cutsById.get(linkedChoices[0].nextCutId!) ?? null;
  }

  return steps;
}

export function PromptoonViewerPage() {
  const navigate = useNavigate();
  const { publishId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const publishedEpisode = usePublishedEpisode(publishId);
  const currentCutId = useViewerStore((state) => state.currentCutId);
  const hideChrome = useViewerStore((state) => state.hideChrome);
  const historyStack = useViewerStore((state) => state.historyStack);
  const initialize = useViewerStore((state) => state.initialize);
  const initializeFromFeed = useViewerStore((state) => state.initializeFromFeed);
  const isChromeVisible = useViewerStore((state) => state.isChromeVisible);
  const pop = useViewerStore((state) => state.pop);
  const push = useViewerStore((state) => state.push);
  const reset = useViewerStore((state) => state.reset);
  const showChrome = useViewerStore((state) => state.showChrome);
  const [shareBannerDismissed, setShareBannerDismissed] = useState(false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [pendingChoice, setPendingChoice] = useState<{ cutId: string; choiceId: string; reactionText: string | null } | null>(null);

  const manifest = publishedEpisode.data?.manifest ?? null;
  const startCutId = useMemo(() => (manifest ? getStartCutId(manifest) : null), [manifest]);
  const cutsById = useMemo(() => new Map(manifest?.cuts.map((cut) => [cut.id, cut]) ?? []), [manifest]);
  const startChoiceId = searchParams.get('startChoice');
  const sharedEndingCutId = searchParams.get('e');
  const feedEntryCutId = useMemo(() => (manifest ? getFeedEntryCutId(manifest, startChoiceId) : null), [manifest, startChoiceId]);
  const sharedEndingCut = useMemo(
    () =>
      sharedEndingCutId
        ? manifest?.cuts.find((cut) => cut.id === sharedEndingCutId && (cut.isEnding || cut.kind === 'ending')) ?? null
        : null,
    [manifest, sharedEndingCutId]
  );
  const resolvedCutId = currentCutId ?? startCutId;
  const activeCut = resolvedCutId ? cutsById.get(resolvedCutId) ?? null : null;
  const pathSteps = useMemo(() => buildViewerPathSteps(activeCut, cutsById), [activeCut, cutsById]);
  const visibleCuts = useMemo(() => pathSteps.map((step) => step.cut), [pathSteps]);
  const terminalCut = pathSteps[pathSteps.length - 1]?.cut ?? null;
  const { startNewSession, trackChoiceClick, trackEndingShare } = useViewerTelemetry({
    publishId,
    visibleCuts
  });
  const shareBanner =
    sharedEndingCut && !shareBannerDismissed
      ? `친구가 "${sharedEndingCut.title}" 엔딩을 봤습니다. 당신도 찾아보세요.`
      : null;

  useEffect(() => {
    if (publishId && startCutId) {
      if (feedEntryCutId) {
        initializeFromFeed(publishId, startCutId, feedEntryCutId);
        return;
      }

      initialize(publishId, startCutId);
    }
  }, [feedEntryCutId, initialize, initializeFromFeed, publishId, startCutId]);

  useEffect(() => {
    setShareBannerDismissed(false);
  }, [publishId, sharedEndingCut?.id]);

  useEffect(() => {
    setUserName('');
  }, [publishId]);

  useEffect(() => {
    preloadConnectedAssets(terminalCut, cutsById);
  }, [cutsById, terminalCut]);

  useEffect(() => {
    setPendingChoice(null);
  }, [activeCut?.id]);

  useEffect(() => {
    showChrome();
  }, [activeCut?.id, showChrome]);

  useEffect(() => {
    if (!isChromeVisible) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      hideChrome();
    }, 2000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [hideChrome, isChromeVisible]);

  useEffect(() => {
    if (!shareNotice) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShareNotice(null);
    }, 3000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [shareNotice]);

  useEffect(() => {
    if (historyStack.length > 0 && sharedEndingCut && !shareBannerDismissed) {
      setShareBannerDismissed(true);
    }
  }, [historyStack.length, shareBannerDismissed, sharedEndingCut]);

  function clearPendingTransition() {
    setPendingChoice(null);
  }

  function queueChoiceTransition(choice: ViewerChoice, cutId: string) {
    if (!choice.nextCutId || pendingChoice) {
      return;
    }

    trackChoiceClick(choice, cutId);
    setPendingChoice({
      cutId,
      choiceId: choice.id,
      reactionText: choice.afterSelectReactionText ?? null
    });
    push(choice.nextCutId!);
  }

  function handleClose() {
    clearPendingTransition();
    const historyIndex =
      typeof window !== 'undefined' &&
      typeof window.history.state === 'object' &&
      window.history.state !== null &&
      'idx' in window.history.state &&
      typeof (window.history.state as { idx?: unknown }).idx === 'number'
        ? ((window.history.state as { idx: number }).idx ?? 0)
        : 0;

    if (historyIndex > 0) {
      navigate(-1);
      return;
    }

    navigate('/', { replace: true });
  }

  if (publishedEpisode.isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-black text-zinc-400">
        발행된 에피소드를 불러오는 중입니다.
      </div>
    );
  }

  if (publishedEpisode.isError || !manifest || !startCutId || !activeCut || !terminalCut) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-black px-6 text-center text-zinc-400">
        발행된 에피소드를 찾을 수 없습니다.
      </div>
    );
  }

  async function handleShare() {
    if (!manifest || !(terminalCut.isEnding || terminalCut.kind === 'ending')) {
      return;
    }

    const shareUrl = `${window.location.origin}/api/promptoon/share/${publishId}?e=${encodeURIComponent(terminalCut.id)}`;
    const shareTitle = `${manifest.episode.title} - 나는 "${terminalCut.title}" 엔딩을 봤어!`;
    const shareText = `${shareTitle} 넌 어떤 엔딩이 나올까?`;

    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl
        });
        trackEndingShare(terminalCut.id);
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        trackEndingShare(terminalCut.id);
        setShareNotice('링크가 복사되었습니다.');
        return;
      }

      setShareNotice('공유 링크를 복사하지 못했습니다.');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }

      setShareNotice('공유를 완료하지 못했습니다.');
    }
  }

  return (
    <ViewerShell
      canGoBack={historyStack.length > 0}
      episodeTitle={manifest.episode.title}
      isChromeVisible={isChromeVisible}
      onBack={() => {
        clearPendingTransition();
        pop();
      }}
      onChoiceClick={(choice, cutId) => queueChoiceTransition(choice, cutId)}
      onClose={handleClose}
      onDismissShareBanner={() => setShareBannerDismissed(true)}
      onInteraction={() => showChrome()}
      onReset={() => {
        clearPendingTransition();
        startNewSession();
        reset(startCutId);
      }}
      onUserNameChange={setUserName}
      onShare={handleShare}
      pathSteps={pathSteps}
      pendingChoice={pendingChoice}
      shareBanner={shareBanner}
      shareNotice={shareNotice}
      terminalCut={terminalCut}
      userName={userName}
    />
  );
}

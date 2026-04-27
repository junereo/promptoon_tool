import type { PublishManifest } from '@promptoon/shared';
import { AnimatePresence, motion } from 'framer-motion';
import type { TouchEvent, WheelEvent } from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { buildCutEffectMotionCustom, cutEffectVariants } from '../../shared/lib/cut-effects';
import { ViewerContent } from './ViewerContent';
import { ViewerControls } from './ViewerControls';

type ViewerCut = PublishManifest['cuts'][number];
type ViewerChoice = ViewerCut['choices'][number];

interface ViewerPathStep {
  cut: ViewerCut;
  visibleChoices: ViewerChoice[];
}

interface ViewerShellProps {
  canGoBack: boolean;
  episodeTitle: string;
  isChromeVisible: boolean;
  isPathCompact: boolean;
  onBack: () => void;
  onChoiceClick: (choice: ViewerChoice, cutId: string) => void;
  onClose: () => void;
  onDismissShareBanner: () => void;
  onInteraction: () => void;
  onPathEnterComplete: (pathStartCutId: string) => void;
  onReset: () => void;
  onUserNameChange: (value: string) => void;
  onShare?: () => void;
  pathSteps: ViewerPathStep[];
  pendingChoice: { cutId: string; choiceId: string; reactionText: string | null } | null;
  shareBanner: string | null;
  shareNotice: string | null;
  terminalCut: ViewerCut;
  userName: string;
}

export function ViewerShell({
  canGoBack,
  episodeTitle,
  isChromeVisible,
  isPathCompact,
  onBack,
  onChoiceClick,
  onClose,
  onDismissShareBanner,
  onInteraction,
  onPathEnterComplete,
  onReset,
  onUserNameChange,
  onShare,
  pathSteps,
  pendingChoice,
  shareBanner,
  shareNotice,
  terminalCut,
  userName
}: ViewerShellProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const forwardedTouchYRef = useRef<number | null>(null);
  const [isScrollBoundary, setIsScrollBoundary] = useState(true);
  const terminalStep = pathSteps[pathSteps.length - 1] ?? null;
  const pathStartStep = pathSteps[0] ?? null;
  const areControlsVisible = isChromeVisible && isScrollBoundary;
  const pathStepKey = pathSteps.map((step) => step.cut.id).join('|');
  const pathStartKey = pathStartStep?.cut.id ?? 'empty-path';

  const updateScrollBoundary = useCallback(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) {
      setIsScrollBoundary(true);
      return true;
    }

    const boundaryThreshold = 2;
    const isAtTop = scrollContainer.scrollTop <= boundaryThreshold;
    const isAtBottom =
      scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - boundaryThreshold;
    const isAtBoundary = isAtTop || isAtBottom;

    setIsScrollBoundary(isAtBoundary);
    return isAtBoundary;
  }, []);

  useEffect(() => {
    const animationFrameId = window.requestAnimationFrame(() => {
      updateScrollBoundary();
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [pathSteps, updateScrollBoundary]);

  useLayoutEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) {
      return;
    }

    scrollContainer.scrollTop = 0;
    setIsScrollBoundary(true);
  }, [pathStartKey]);

  function handleViewerScroll() {
    if (updateScrollBoundary()) {
      onInteraction();
    }
  }

  function isInsideScrollContainer(target: EventTarget | null) {
    const scrollContainer = scrollContainerRef.current;
    return Boolean(scrollContainer && target instanceof Node && scrollContainer.contains(target));
  }

  function handleViewerSurfaceWheel(event: WheelEvent<HTMLElement>) {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer || isInsideScrollContainer(event.target)) {
      return;
    }

    scrollContainer.scrollTop += event.deltaY;
    updateScrollBoundary();
  }

  function handleViewerSurfaceTouchStart(event: TouchEvent<HTMLElement>) {
    if (isInsideScrollContainer(event.target)) {
      forwardedTouchYRef.current = null;
      return;
    }

    forwardedTouchYRef.current = event.touches[0]?.clientY ?? null;
  }

  function handleViewerSurfaceTouchMove(event: TouchEvent<HTMLElement>) {
    const scrollContainer = scrollContainerRef.current;
    const previousY = forwardedTouchYRef.current;
    const nextY = event.touches[0]?.clientY ?? null;

    if (!scrollContainer || previousY === null || nextY === null) {
      return;
    }

    scrollContainer.scrollTop += previousY - nextY;
    forwardedTouchYRef.current = nextY;
    updateScrollBoundary();
  }

  function handleViewerSurfaceTouchEnd() {
    forwardedTouchYRef.current = null;
  }

  return (
    <section
      className="relative min-h-dvh overflow-hidden bg-black text-white"
      onClick={onInteraction}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#18181d] via-[#111115] to-black" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(122,48,64,0.18),transparent_42%)]" />

      <ViewerControls
        canGoBack={canGoBack}
        isVisible={areControlsVisible}
        onBack={onBack}
        onClose={onClose}
        onReset={onReset}
      />

      {shareBanner ? (
        <div className="pointer-events-none absolute inset-x-0 top-20 z-20 flex justify-center px-4 sm:top-24">
          <div className="pointer-events-auto flex w-full max-w-2xl items-start justify-between gap-4 rounded-2xl border border-amber-300/20 bg-black/55 px-4 py-3 text-sm text-amber-50/90 backdrop-blur">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-amber-200/70">Shared Ending</p>
              <p className="mt-1 leading-6">{shareBanner}</p>
            </div>
            <button
              aria-label="공유 배너 닫기"
              className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80 transition hover:bg-white/10"
              onClick={onDismissShareBanner}
              type="button"
            >
              닫기
            </button>
          </div>
        </div>
      ) : null}

      <div
        className="relative flex h-dvh overflow-hidden items-stretch justify-stretch sm:items-center sm:justify-center"
        data-testid="viewer-scroll-surface"
        onTouchCancel={handleViewerSurfaceTouchEnd}
        onTouchEnd={handleViewerSurfaceTouchEnd}
        onTouchMove={handleViewerSurfaceTouchMove}
        onTouchStart={handleViewerSurfaceTouchStart}
        onWheel={handleViewerSurfaceWheel}
      >
        <div className="flex h-full w-full items-stretch justify-stretch overflow-hidden sm:items-center sm:justify-center">
          <div
            className="relative h-dvh w-full overflow-hidden bg-black sm:h-[min(100dvh,calc(100vw*16/9))] sm:w-[min(100vw,calc(100dvh*9/16))] sm:rounded-[34px] sm:border sm:border-white/10 sm:shadow-[0_32px_120px_rgba(0,0,0,0.55)]"
            data-testid="viewer-frame"
          >
            <div className="relative h-full w-full bg-[#101015]">
              <div
                className="scrollbar-hidden relative z-10 h-full overflow-x-hidden overflow-y-auto"
                data-testid="viewer-scroll-container"
                onScroll={handleViewerScroll}
                ref={scrollContainerRef}
              >
                <AnimatePresence mode="wait">
                  {pathStartStep && terminalStep ? (
                    <motion.div
                      animate="animate"
                      className="w-full overflow-hidden will-change-transform"
                      custom={buildCutEffectMotionCustom(
                        pathStartStep.cut.startEffect,
                        terminalStep.cut.endEffect,
                        pathStartStep.cut.startEffectDurationMs,
                        terminalStep.cut.endEffectDurationMs
                      )}
                      data-active-cut-end-effect={terminalStep.cut.endEffect ?? 'none'}
                      data-active-cut-end-duration-ms={terminalStep.cut.endEffectDurationMs ?? ''}
                      data-active-cut-id={pathStartStep.cut.id}
                      data-active-cut-start-effect={pathStartStep.cut.startEffect ?? 'none'}
                      data-active-cut-start-duration-ms={pathStartStep.cut.startEffectDurationMs ?? ''}
                      data-cut-id={pathStartStep.cut.id}
                      data-end-effect={terminalStep.cut.endEffect ?? 'none'}
                      data-path-step-key={pathStepKey}
                      data-start-effect={pathStartStep.cut.startEffect ?? 'none'}
                      exit="exit"
                      initial="initial"
                      key={pathStartKey}
                      onAnimationComplete={(definition) => {
                        if (definition === 'animate') {
                          onPathEnterComplete(pathStartStep.cut.id);
                        }
                      }}
                      variants={cutEffectVariants}
                    >
                      {pathSteps.map((step, index) => {
                        const isTerminalStep = index === pathSteps.length - 1;

                        return (
                          <ViewerContent
                            canGoBack={canGoBack}
                            compact={isPathCompact}
                            cut={step.cut}
                            isTerminal={isTerminalStep}
                            key={step.cut.id}
                            onChoiceClick={(choice) => onChoiceClick(choice, step.cut.id)}
                            onReset={onReset}
                            onUserNameChange={onUserNameChange}
                            onShare={isTerminalStep && (terminalCut.isEnding || terminalCut.kind === 'ending') ? onShare : undefined}
                            pendingChoice={pendingChoice && pendingChoice.cutId === step.cut.id ? pendingChoice : null}
                            userName={userName}
                            visibleChoices={step.visibleChoices}
                          />
                        );
                      })}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>

      {shareNotice ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 z-30 flex justify-center px-4">
          <div
            aria-live="polite"
            className="rounded-full border border-white/10 bg-black/70 px-4 py-2 text-sm text-white/90 shadow-2xl backdrop-blur"
            role="status"
          >
            {shareNotice}
          </div>
        </div>
      ) : null}

      <div className="sr-only">{episodeTitle}</div>
    </section>
  );
}

import type { PublishManifest } from '@promptoon/shared';
import { AnimatePresence } from 'framer-motion';
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
  onBack: () => void;
  onChoiceClick: (choice: ViewerChoice, cutId: string) => void;
  onClose: () => void;
  onDismissShareBanner: () => void;
  onInteraction: () => void;
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
  onBack,
  onChoiceClick,
  onClose,
  onDismissShareBanner,
  onInteraction,
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
  const useCompactLayout = pathSteps.length > 1;
  const terminalStep = pathSteps[pathSteps.length - 1] ?? null;
  const leadingSteps = terminalStep ? pathSteps.slice(0, -1) : [];

  return (
    <section
      className="relative min-h-dvh overflow-hidden bg-black text-white"
      onClick={onInteraction}
      onPointerMove={onInteraction}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#18181d] via-[#111115] to-black" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(122,48,64,0.18),transparent_42%)]" />

      <ViewerControls
        canGoBack={canGoBack}
        isVisible={isChromeVisible}
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

      <div className="relative flex min-h-dvh items-stretch justify-stretch sm:items-center sm:justify-center sm:px-[max(1rem,env(safe-area-inset-left))] sm:pb-[max(1rem,env(safe-area-inset-bottom))] sm:pr-[max(1rem,env(safe-area-inset-right))] sm:pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex min-h-dvh w-full items-stretch justify-stretch sm:min-h-0 sm:items-center sm:justify-center sm:py-24">
          <div className="relative h-dvh w-full overflow-hidden bg-black sm:h-auto sm:max-w-[420px] sm:rounded-[34px] sm:border sm:border-white/10 sm:shadow-[0_32px_120px_rgba(0,0,0,0.55)]">
            <div className="relative h-full w-full bg-[#101015] sm:aspect-[9/16] sm:h-auto">
              <div className="scrollbar-hidden relative z-10 h-full overflow-x-hidden overflow-y-auto">
                {leadingSteps.map((step) => (
                  <ViewerContent
                    canGoBack={canGoBack}
                    compact={useCompactLayout}
                    cut={step.cut}
                    isTerminal={false}
                    key={step.cut.id}
                    onChoiceClick={(choice) => onChoiceClick(choice, step.cut.id)}
                    onReset={onReset}
                    onUserNameChange={onUserNameChange}
                    pendingChoice={pendingChoice && pendingChoice.cutId === step.cut.id ? pendingChoice : null}
                    userName={userName}
                    visibleChoices={step.visibleChoices}
                  />
                ))}

                <AnimatePresence mode="wait">
                  {terminalStep ? (
                    <ViewerContent
                      animated
                      canGoBack={canGoBack}
                      compact={useCompactLayout}
                      cut={terminalStep.cut}
                      isTerminal
                      key={terminalStep.cut.id}
                      onChoiceClick={(choice) => onChoiceClick(choice, terminalStep.cut.id)}
                      onReset={onReset}
                      onUserNameChange={onUserNameChange}
                      onShare={terminalCut.isEnding || terminalCut.kind === 'ending' ? onShare : undefined}
                      pendingChoice={pendingChoice && pendingChoice.cutId === terminalStep.cut.id ? pendingChoice : null}
                      userName={userName}
                      visibleChoices={terminalStep.visibleChoices}
                    />
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

import type { PublishManifest } from '@promptoon/shared';
import type { CSSProperties } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { getEdgeFadeOverlayClassNames, getEdgeFadeStyle } from '../../shared/lib/cut-effects';
import { getContentSpacingClassName, getContentSpacingMinHeight, getCutContentBlocksByPlacement } from '../../shared/lib/cut-content';
import { CutContentBlocksView } from '../content-blocks/CutContentBlocksView';

type ViewerCut = PublishManifest['cuts'][number];
type ViewerChoice = ViewerCut['choices'][number];

interface ViewerCutCardProps {
  canGoBack?: boolean;
  compact?: boolean;
  cut: ViewerCut;
  disableCutBottomSpacing?: boolean;
  onChoiceClick?: (choice: ViewerChoice) => void;
  onReset?: () => void;
  onUserNameChange?: (value: string) => void;
  onShare?: () => void;
  pendingChoice?: { choiceId: string; reactionText: string | null } | null;
  showChoices: boolean;
  showEndingActions: boolean;
  userName?: string;
  visibleChoices: ViewerChoice[];
}

function getDialogPlacementClasses(cut: ViewerCut): string {
  const dialogAnchorX = cut.dialogAnchorX ?? 'left';
  const dialogAnchorY = cut.dialogAnchorY ?? 'bottom';
  const horizontalClassName =
    dialogAnchorX === 'left' ? 'justify-start' : dialogAnchorX === 'center' ? 'justify-center' : 'justify-end';

  return [
    'pointer-events-none absolute inset-0 z-10 flex p-4 sm:p-6',
    horizontalClassName,
    dialogAnchorY === 'bottom' ? 'items-end' : 'items-start'
  ].join(' ');
}

function getDialogAnchorTop(dialogAnchorY: ViewerCut['dialogAnchorY']): string | undefined {
  switch (dialogAnchorY) {
    case 'upper':
      return '25%';
    case 'center':
      return '50%';
    case 'lower':
      return '75%';
    default:
      return undefined;
  }
}

function getDialogPlacementStyle(cut: ViewerCut): CSSProperties {
  const dialogAnchorX = cut.dialogAnchorX ?? 'left';
  const dialogAnchorY = cut.dialogAnchorY ?? 'bottom';
  const dialogOffsetX = Math.min(160, Math.max(0, cut.dialogOffsetX ?? 0));
  const dialogOffsetY = Math.min(160, Math.max(0, cut.dialogOffsetY ?? 0));
  const dialogTextAlign = cut.dialogTextAlign ?? 'left';
  const anchorTop = getDialogAnchorTop(dialogAnchorY);
  const translateX = dialogAnchorX === 'center' ? `translateX(${dialogOffsetX}px)` : undefined;
  const translateY = anchorTop ? `translateY(calc(-50% + ${dialogOffsetY}px))` : undefined;
  const transform = [translateX, translateY].filter(Boolean).join(' ') || undefined;

  return {
    marginBottom: dialogAnchorY === 'bottom' ? `${dialogOffsetY}px` : undefined,
    marginLeft: dialogAnchorX === 'left' ? `${dialogOffsetX}px` : undefined,
    marginRight: dialogAnchorX === 'right' ? `${dialogOffsetX}px` : undefined,
    marginTop: dialogAnchorY === 'top' ? `${dialogOffsetY}px` : undefined,
    maxWidth: 'min(22rem, calc(100% - 2rem))',
    position: anchorTop ? 'relative' : undefined,
    textAlign: dialogTextAlign,
    top: anchorTop,
    transform
  };
}

function getContentPanelClassName(cut: ViewerCut): string {
  return (cut.contentViewMode ?? 'default') === 'inverse'
    ? 'rounded-[28px] border border-zinc-900/10 bg-white/88 px-5 py-4 text-zinc-950 shadow-[0_18px_48px_rgba(255,255,255,0.12)] backdrop-blur-sm'
    : 'rounded-[28px] border border-white/10 bg-black/20 px-5 py-4 backdrop-blur-sm';
}

function getRevealSyncedFrameClassName(className: string, isRevealed: boolean): string {
  return [
    className,
    'transition-opacity duration-500 ease-out',
    isRevealed ? 'opacity-100' : 'pointer-events-none opacity-0'
  ].join(' ');
}

function ViewerContentPanel({
  cut,
  frameClassName,
  frameStyle,
  onUserNameChange,
  placement,
  userName
}: {
  cut: ViewerCut;
  frameClassName: string;
  frameStyle?: CSSProperties;
  onUserNameChange?: (value: string) => void;
  placement: 'overlay' | 'flow';
  userName: string;
}) {
  const [isFrameRevealed, setIsFrameRevealed] = useState(false);
  const handleContainerRevealSyncChange = useCallback((isRevealed: boolean) => {
    setIsFrameRevealed(isRevealed);
  }, []);

  return (
    <div
      className={getRevealSyncedFrameClassName(frameClassName, isFrameRevealed)}
      data-content-frame-revealed={isFrameRevealed ? 'true' : 'false'}
      data-testid={`viewer-content-frame-${cut.id}:${placement}`}
      style={frameStyle}
    >
      <CutContentBlocksView
        bindings={{ userName }}
        className="space-y-3"
        cut={cut}
        onBindingChange={(_bindingKey, value) => onUserNameChange?.(value)}
        onContainerRevealSyncChange={handleContainerRevealSyncChange}
        placement={placement}
        syncContainerVisibilityWithReveal
      />
    </div>
  );
}

export function ViewerCutCard({
  canGoBack = false,
  compact = false,
  cut,
  disableCutBottomSpacing = false,
  onChoiceClick,
  onReset,
  onUserNameChange,
  onShare,
  pendingChoice = null,
  showChoices,
  showEndingActions,
  userName = '',
  visibleChoices
}: ViewerCutCardProps) {
  const [isImageFailed, setIsImageFailed] = useState(false);
  const hasImage = Boolean(cut.assetUrl) && !isImageFailed;
  const hasOverlayContent = getCutContentBlocksByPlacement(cut, 'overlay').length > 0;
  const hasFlowContent = getCutContentBlocksByPlacement(cut, 'flow').length > 0;
  const cutBottomSpacingClassName = disableCutBottomSpacing || hasFlowContent ? '' : getContentSpacingClassName('mb', cut.marginBottomToken);
  const flowContentMinHeight = disableCutBottomSpacing ? undefined : getContentSpacingMinHeight(cut.marginBottomToken);

  useEffect(() => {
    setIsImageFailed(false);
  }, [cut.assetUrl, cut.id]);

  function renderFooter() {
    if (showEndingActions) {
      return (
        <div className="mt-6 flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              className="rounded-2xl bg-editor-accent px-5 py-4 text-base font-semibold text-white transition hover:brightness-110"
              onClick={onReset}
              type="button"
            >
              다시 보기
            </button>
            {onShare ? (
              <button
                className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4 text-base font-semibold text-white transition hover:bg-white/15"
                onClick={onShare}
                type="button"
              >
                결과 공유하기
              </button>
            ) : null}
          </div>
          {!canGoBack ? <p className="text-sm text-white/55">이번 경로의 마지막 장면입니다.</p> : null}
        </div>
      );
    }

    if (!showChoices) {
      return null;
    }

    return (
      <div className="mt-6 flex flex-col gap-3">
        {visibleChoices.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/15 bg-black/15 px-4 py-5 text-center text-sm text-white/55">
            아직 연결된 선택지가 없습니다.
          </p>
        ) : (
          visibleChoices.map((choice) => {
            const isLinked = Boolean(choice.nextCutId);
            const isSelected = pendingChoice?.choiceId === choice.id;

            return (
              <button
                className={[
                  'rounded-2xl px-5 py-4 text-left text-sm font-medium transition backdrop-blur',
                  isSelected
                    ? 'border border-editor-accentSoft bg-editor-accent text-white'
                    : isLinked
                      ? 'border border-white/15 bg-white/10 text-white hover:bg-white/15'
                    : 'border border-dashed border-amber-400/35 bg-amber-400/10 text-amber-100/70'
                ].join(' ')}
                disabled={!isLinked || Boolean(pendingChoice)}
                key={choice.id}
                onClick={() => onChoiceClick?.(choice)}
                type="button"
              >
                <span className="flex items-center justify-between gap-3">
                  <span>{choice.label || '내용 없는 선택지'}</span>
                  {!isLinked ? <span className="text-xs">미연결</span> : null}
                </span>
              </button>
            );
          })
        )}

        {pendingChoice?.reactionText ? <p className="text-sm leading-6 text-white/65">{pendingChoice.reactionText}</p> : null}
      </div>
    );
  }

  const footer = renderFooter();

  function renderOverlayContent() {
    if (!hasOverlayContent) {
      return null;
    }

    return (
      <div className={getDialogPlacementClasses(cut)}>
        <ViewerContentPanel
          cut={cut}
          frameClassName={getContentPanelClassName(cut)}
          frameStyle={getDialogPlacementStyle(cut)}
          onUserNameChange={onUserNameChange}
          placement="overlay"
          userName={userName}
        />
      </div>
    );
  }

  function renderFlowContent(className = 'relative z-10 flex items-center px-5 py-5 sm:px-8') {
    if (!hasFlowContent) {
      return null;
    }

    return (
      <div className={className} data-testid="viewer-flow-content" style={{ minHeight: flowContentMinHeight }}>
        <ViewerContentPanel
          cut={cut}
          frameClassName={`${getContentPanelClassName(cut)} w-full`}
          onUserNameChange={onUserNameChange}
          placement="flow"
          userName={userName}
        />
      </div>
    );
  }

  if (hasImage) {
    return (
      <article className={['relative w-full shrink-0 bg-[#101015]', cutBottomSpacingClassName].filter(Boolean).join(' ')} data-viewer-layout={compact ? 'compact' : 'fullscreen'}>
        <div className="relative overflow-hidden bg-[#101015]">
          <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a21] via-[#111115] to-black" />
          <img
            alt={cut.title}
            className="relative z-0 block h-auto w-full"
            onError={() => setIsImageFailed(true)}
            src={cut.assetUrl ?? undefined}
            style={getEdgeFadeStyle(cut.edgeFade, cut.edgeFadeIntensity)}
          />
          {getEdgeFadeOverlayClassNames(cut.edgeFade, cut.edgeFadeIntensity, cut.edgeFadeColor).map((className) => (
            <div className={className} key={className} />
          ))}

          {renderOverlayContent()}
        </div>
        {renderFlowContent()}
        {footer ? <div className="relative z-20 px-5 pb-7 pt-4 sm:px-8 sm:pb-9">{footer}</div> : null}
      </article>
    );
  }

  if (compact) {
    return (
      <article className={['relative w-full shrink-0 bg-[#101015]', cutBottomSpacingClassName].filter(Boolean).join(' ')} data-viewer-layout="compact">
        <div className="relative min-h-[280px]">
          <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a21] via-[#111115] to-black" />
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/35 to-transparent" />
          {renderOverlayContent()}
        </div>

        {renderFlowContent()}
        {footer ? <div className="relative z-10 px-5 pb-6 pt-4 sm:px-8 sm:pb-8">{footer}</div> : null}
      </article>
    );
  }

  return (
    <article className="relative flex min-h-full shrink-0 flex-col justify-end bg-[#101015]" data-viewer-layout="fullscreen">
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a21] via-[#111115] to-black" />
      <div className="absolute inset-x-0 bottom-0 top-1/3 bg-gradient-to-t from-black via-black/70 to-transparent" />
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/35 to-transparent" />

      {renderOverlayContent()}

      {hasFlowContent || footer ? (
        <div className="relative z-10 flex min-h-full flex-col justify-end px-5 pb-7 pt-20 sm:px-8 sm:pb-9">
          {hasFlowContent ? (
            <div className={`${getContentPanelClassName(cut)} w-full`} data-testid="viewer-flow-content">
              <CutContentBlocksView
                bindings={{ userName }}
                className="space-y-3"
                cut={cut}
                onBindingChange={(_bindingKey, value) => onUserNameChange?.(value)}
                placement="flow"
              />
            </div>
          ) : null}
          {footer ? <div className={hasFlowContent ? 'mt-6' : undefined}>{footer}</div> : null}
        </div>
      ) : null}
    </article>
  );
}

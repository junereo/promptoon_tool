import type { Choice, Cut } from '@promptoon/shared';
import type { CSSProperties } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import { buildCutEffectMotionCustom, cutEffectVariants, getEdgeFadeOverlayClassNames, getEdgeFadeStyle } from '../../shared/lib/cut-effects';
import { getContentSpacingMinHeight, getCutContentBlocksByPlacement } from '../../shared/lib/cut-content';
import { CutContentBlocksView } from '../content-blocks/CutContentBlocksView';

const PREVIEW_BASE_WIDTH = 320;
const PREVIEW_BASE_HEIGHT = (PREVIEW_BASE_WIDTH * 16) / 9;
const DEFAULT_PREVIEW_SCALE = 1;
const PREVIEW_FRAME_BORDER_WIDTH = 6;
const PREVIEW_FRAME_BORDER_TOTAL = PREVIEW_FRAME_BORDER_WIDTH * 2;

function parsePixelSize(value?: string): number {
  if (!value?.endsWith('px')) {
    return 0;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getStableFrameContentWidth(frameElement: HTMLDivElement): number {
  const frameRect = frameElement.getBoundingClientRect();
  if (frameRect.width <= 0) {
    return frameElement.clientWidth;
  }

  const computedStyle = window.getComputedStyle(frameElement);
  const borderLeftWidth = Number.parseFloat(computedStyle.borderLeftWidth) || 0;
  const borderRightWidth = Number.parseFloat(computedStyle.borderRightWidth) || 0;

  return Math.max(0, frameRect.width - borderLeftWidth - borderRightWidth);
}

function getStableFrameContentHeight(frameElement: HTMLDivElement): number {
  const frameRect = frameElement.getBoundingClientRect();
  if (frameRect.height <= 0) {
    return frameElement.clientHeight;
  }

  const computedStyle = window.getComputedStyle(frameElement);
  const borderTopWidth = Number.parseFloat(computedStyle.borderTopWidth) || 0;
  const borderBottomWidth = Number.parseFloat(computedStyle.borderBottomWidth) || 0;

  return Math.max(0, frameRect.height - borderTopWidth - borderBottomWidth);
}

function getDialogPlacementClasses(cut: Cut): string {
  const dialogAnchorX = cut.dialogAnchorX ?? 'left';
  const dialogAnchorY = cut.dialogAnchorY ?? 'bottom';
  const horizontalClassName =
    dialogAnchorX === 'left' ? 'justify-start' : dialogAnchorX === 'center' ? 'justify-center' : 'justify-end';

  return [
    'pointer-events-none absolute inset-0 z-10 flex p-4',
    horizontalClassName,
    dialogAnchorY === 'bottom' ? 'items-end' : 'items-start'
  ].join(' ');
}

function getDialogAnchorTop(dialogAnchorY: Cut['dialogAnchorY']): string | undefined {
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

function getDialogPlacementStyle(cut: Cut): CSSProperties {
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
    maxWidth: 'min(20rem, calc(100% - 2rem))',
    position: anchorTop ? 'relative' : undefined,
    textAlign: dialogTextAlign,
    top: anchorTop,
    transform
  };
}

function getContentPanelClassName(cut: Cut): string {
  return (cut.contentViewMode ?? 'default') === 'inverse'
    ? 'rounded-[28px] border border-zinc-900/10 bg-white/88 p-5 text-zinc-950 shadow-[0_18px_48px_rgba(255,255,255,0.12)] backdrop-blur-sm'
    : 'rounded-[28px] border border-white/10 bg-black/20 p-5 backdrop-blur-sm';
}

export function PreviewPlayer({
  cut,
  choices,
  selectedChoiceId,
  onSelectChoice,
  onSelectCut,
  title = 'Live Preview',
  description = '',
  framed = true,
  previousCutId,
  nextCutId,
  onNavigateCut,
  onTitleClick
}: {
  cut: Cut | null;
  choices: Choice[];
  selectedChoiceId: string | null;
  onSelectChoice: (choiceId: string) => void;
  onSelectCut: (cutId: string) => void;
  title?: string;
  description?: string;
  framed?: boolean;
  previousCutId?: string | null;
  nextCutId?: string | null;
  onNavigateCut?: (cutId: string) => void;
  onTitleClick?: () => void;
}) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [userName, setUserName] = useState('');
  const [pendingChoiceId, setPendingChoiceId] = useState<string | null>(null);
  const [reactionText, setReactionText] = useState<string | null>(null);
  const [previewScale, setPreviewScale] = useState(DEFAULT_PREVIEW_SCALE);
  const [previewFrameSize, setPreviewFrameSize] = useState({
    height: PREVIEW_BASE_HEIGHT,
    width: PREVIEW_BASE_WIDTH
  });
  const [measuredPreviewBaseContentHeight, setMeasuredPreviewBaseContentHeight] = useState(PREVIEW_BASE_HEIGHT);
  const previewViewportRef = useRef<HTMLDivElement | null>(null);
  const phoneFrameRef = useRef<HTMLDivElement | null>(null);
  const previewContentRef = useRef<HTMLDivElement | null>(null);
  const showChoices = cut !== null && !cut.isEnding && cut.kind !== 'ending' && choices.length > 1;
  const showEndingButton = cut?.kind === 'ending';
  const hasPreviewFooterContent = showChoices || Boolean(reactionText) || showEndingButton;
  const activeSelectedChoiceId = pendingChoiceId ?? selectedChoiceId;
  const hasOverlayContent = cut ? getCutContentBlocksByPlacement(cut, 'overlay').length > 0 : false;
  const hasFlowContent = cut ? getCutContentBlocksByPlacement(cut, 'flow').length > 0 : false;
  const flowContentMinHeight = cut ? getContentSpacingMinHeight(cut.marginBottomToken) : undefined;
  const previewImageBottomSpacingHeight = cut?.assetUrl && !imageFailed && !hasFlowContent ? getContentSpacingMinHeight(cut.marginBottomToken) : undefined;
  const previewBottomContentHeight = hasFlowContent ? flowContentMinHeight : previewImageBottomSpacingHeight;
  const previewMinimumBaseContentHeight = PREVIEW_BASE_HEIGHT + parsePixelSize(previewBottomContentHeight);
  const previewBaseContentHeight = Math.max(previewMinimumBaseContentHeight, measuredPreviewBaseContentHeight);
  const previewScaledContentHeight = previewBaseContentHeight * previewScale;
  const showNavigation = Boolean(onNavigateCut);

  function navigationButtonClassName(cutId?: string | null): string {
    return [
      'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-editor-border bg-black/20 text-sm font-semibold text-zinc-200 transition hover:border-editor-accentSoft hover:text-white disabled:cursor-default',
      cutId ? '' : 'invisible pointer-events-none'
    ].join(' ');
  }

  function renderTitle(className: string) {
    if (!onTitleClick) {
      return <p className={className}>{title}</p>;
    }

    return (
      <button
        className={`${className} rounded-md outline-none transition hover:text-editor-accentSoft focus-visible:ring-2 focus-visible:ring-editor-accentSoft`}
        onClick={onTitleClick}
        type="button"
      >
        {title}
      </button>
    );
  }

  useEffect(() => {
    setImageLoaded(false);
    setImageFailed(false);
  }, [cut?.assetUrl, cut?.id]);

  useEffect(() => {
    setPendingChoiceId(null);
    setReactionText(null);
  }, [cut?.id]);

  useLayoutEffect(() => {
    const viewportElement = previewViewportRef.current;
    if (!viewportElement) {
      return;
    }

    const updateFrameSize = () => {
      const viewportRect = viewportElement.getBoundingClientRect();
      if (viewportRect.width <= 0 || viewportRect.height <= 0) {
        return;
      }

      const maxContentWidth = Math.max(0, viewportRect.width - PREVIEW_FRAME_BORDER_TOTAL);
      const maxContentHeight = Math.max(0, viewportRect.height - PREVIEW_FRAME_BORDER_TOTAL);
      const previewContentRatio = PREVIEW_BASE_WIDTH / previewBaseContentHeight;
      const contentWidth = Math.min(maxContentWidth, maxContentHeight * previewContentRatio);
      if (contentWidth <= 0) {
        return;
      }

      const contentHeight = contentWidth / previewContentRatio;
      const width = Math.floor(contentWidth + PREVIEW_FRAME_BORDER_TOTAL);
      const height = Math.floor(contentHeight + PREVIEW_FRAME_BORDER_TOTAL);
      setPreviewFrameSize((current) =>
        Math.abs(current.width - width) > 0.5 || Math.abs(current.height - height) > 0.5
          ? { height, width }
          : current
      );
    };

    updateFrameSize();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      updateFrameSize();
    });
    resizeObserver.observe(viewportElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, [cut?.id, previewBaseContentHeight]);

  useLayoutEffect(() => {
    const frameElement = phoneFrameRef.current;
    if (!frameElement) {
      return;
    }

    const updatePreviewScale = () => {
      const frameWidth = getStableFrameContentWidth(frameElement);
      if (frameWidth > 0) {
        setPreviewScale(frameWidth / PREVIEW_BASE_WIDTH);
        return;
      }

      const fallbackFrameHeight = getStableFrameContentHeight(frameElement);
      if (fallbackFrameHeight > 0) {
        setPreviewScale(fallbackFrameHeight / PREVIEW_BASE_HEIGHT);
      }
    };

    updatePreviewScale();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      updatePreviewScale();
    });
    resizeObserver.observe(frameElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, [cut?.id]);

  useLayoutEffect(() => {
    const contentElement = previewContentRef.current;
    if (!contentElement) {
      setMeasuredPreviewBaseContentHeight(previewMinimumBaseContentHeight);
      return;
    }

    const updatePreviewContentHeight = () => {
      const nextHeight = Math.max(previewMinimumBaseContentHeight, contentElement.scrollHeight);
      setMeasuredPreviewBaseContentHeight((current) => (Math.abs(current - nextHeight) > 0.5 ? nextHeight : current));
    };

    updatePreviewContentHeight();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      updatePreviewContentHeight();
    });
    resizeObserver.observe(contentElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, [cut?.id, flowContentMinHeight, hasFlowContent, previewImageBottomSpacingHeight, previewMinimumBaseContentHeight]);

  function handleLinkedChoiceClick(choice: Choice) {
    if (!choice.nextCutId || pendingChoiceId) {
      return;
    }

    setPendingChoiceId(choice.id);
    setReactionText(choice.afterSelectReactionText ?? null);
    onSelectCut(choice.nextCutId!);
  }

  return (
    <section
      className={[
        'flex h-full max-h-full min-h-0 w-full max-w-full flex-col overflow-hidden p-2.5',
        framed ? 'rounded-[18px] border border-editor-border bg-editor-panel/80' : ''
      ].join(' ')}
    >
      <div className="min-w-0">
        {showNavigation ? (
          <div className="grid grid-cols-[1.75rem_minmax(0,1fr)_1.75rem] items-center gap-1.5">
            <button
              aria-label="이전 컷으로 이동"
              className={navigationButtonClassName(previousCutId)}
              disabled={!previousCutId}
              onClick={() => {
                if (previousCutId && onNavigateCut) {
                  onNavigateCut(previousCutId);
                }
              }}
              type="button"
            >
              {'<'}
            </button>
            {renderTitle('truncate text-center font-display text-lg font-semibold text-zinc-50')}
            <button
              aria-label="다음 컷으로 이동"
              className={navigationButtonClassName(nextCutId)}
              disabled={!nextCutId}
              onClick={() => {
                if (nextCutId && onNavigateCut) {
                  onNavigateCut(nextCutId);
                }
              }}
              type="button"
            >
              {'>'}
            </button>
          </div>
        ) : (
          renderTitle('truncate font-display text-lg font-semibold text-zinc-50')
        )}
        {description ? <p className="text-xs text-zinc-400">{description}</p> : null}
      </div>

      <div className="mt-2 flex min-h-0 w-full flex-1 items-start justify-center overflow-hidden" ref={previewViewportRef}>
        {!cut ? (
          <div className="flex h-full min-h-[360px] w-full items-center justify-center rounded-[20px] border border-dashed border-editor-border bg-black/10 text-center text-sm text-zinc-500">
            표시할 컷이 없습니다.
          </div>
        ) : (
          <div
            ref={phoneFrameRef}
            className="relative max-w-full shrink-0 overflow-hidden rounded-[2rem] border-[6px] border-editor-panel bg-black shadow-phone"
            style={{
              height: `${previewFrameSize.height}px`,
              width: `${previewFrameSize.width}px`
            }}
          >
            <AnimatePresence initial={false} mode="wait">
              <motion.div
                animate="animate"
                className="relative"
                custom={buildCutEffectMotionCustom(cut.startEffect, cut.endEffect, cut.startEffectDurationMs, cut.endEffectDurationMs)}
                data-end-effect={cut.endEffect ?? 'none'}
                data-end-effect-duration-ms={cut.endEffectDurationMs}
                data-start-effect={cut.startEffect ?? 'none'}
                data-start-effect-duration-ms={cut.startEffectDurationMs}
                data-testid="preview-cut-motion"
                exit="exit"
                initial="initial"
                key={cut.id}
                style={{ height: `${previewScaledContentHeight}px` }}
                variants={cutEffectVariants}
              >
                <div
                  className="absolute left-0 top-0 bg-[#101015]"
                  ref={previewContentRef}
                  style={{
                    minHeight: `${previewMinimumBaseContentHeight}px`,
                    transform: `scale(${previewScale})`,
                    transformOrigin: 'top left',
                    width: `${PREVIEW_BASE_WIDTH}px`
                  }}
                >
                  <div
                    className="relative w-full overflow-hidden bg-[#101015]"
                    data-testid="preview-image-area"
                    style={{ height: `${PREVIEW_BASE_HEIGHT}px` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-900 to-[#09090d]" />

                    {cut.assetUrl && !imageFailed ? (
                      <img
                        alt={cut.title}
                        className={[
                          'absolute inset-0 h-full w-full object-cover transition-opacity duration-300',
                          imageLoaded ? 'opacity-100' : 'opacity-0'
                        ].join(' ')}
                        onError={() => setImageFailed(true)}
                        onLoad={() => setImageLoaded(true)}
                        src={cut.assetUrl}
                        style={getEdgeFadeStyle(cut.edgeFade, cut.edgeFadeIntensity)}
                      />
                    ) : null}
                    {cut.assetUrl && !imageFailed
                      ? getEdgeFadeOverlayClassNames(cut.edgeFade, cut.edgeFadeIntensity, cut.edgeFadeColor).map((className) => (
                          <div className={className} key={className} />
                        ))
                      : null}

                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-transparent" />
                    <div className="absolute left-1/2 top-3 h-1.5 w-20 -translate-x-1/2 rounded-full bg-white/10" />

                    <div className="absolute left-0 right-0 top-5 z-10 flex justify-center">
                      <span className="rounded-full border border-white/10 bg-black/45 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-white/75 backdrop-blur-md">
                        {cut.kind} cut
                      </span>
                    </div>

                    {hasOverlayContent ? (
                      <div className={getDialogPlacementClasses(cut)}>
                        <div
                          className={getContentPanelClassName(cut)}
                          style={getDialogPlacementStyle(cut)}
                        >
                          <CutContentBlocksView
                            bindings={{ userName }}
                            className="space-y-3"
                            cut={cut}
                            onBindingChange={(_bindingKey, value) => setUserName(value)}
                            placement="overlay"
                            revealImmediately
                            textAlignOverride={cut.dialogTextAlign ?? 'left'}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {previewImageBottomSpacingHeight ? (
                    <div
                      className="relative border-t border-white/10 bg-[#101015]"
                      data-testid="preview-cut-bottom-spacing"
                      style={{ height: previewImageBottomSpacingHeight }}
                    />
                  ) : null}

                  {hasFlowContent ? (
                    <div
                      className="relative z-10 flex items-center px-6 py-6"
                      data-testid="preview-flow-content"
                      style={{ minHeight: flowContentMinHeight }}
                    >
                      <div className={`${getContentPanelClassName(cut)} w-full`}>
                        <CutContentBlocksView
                          bindings={{ userName }}
                          className="space-y-3"
                          cut={cut}
                          onBindingChange={(_bindingKey, value) => setUserName(value)}
                          placement="flow"
                          revealImmediately
                        />
                      </div>
                    </div>
                  ) : null}

                  {hasPreviewFooterContent ? (
                  <div className="absolute left-0 top-0 z-10 flex flex-col justify-end p-6" style={{ height: `${PREVIEW_BASE_HEIGHT}px`, width: `${PREVIEW_BASE_WIDTH}px` }}>
                    <div className="rounded-[28px] border border-white/10 bg-black/20 p-5 backdrop-blur-sm" data-testid="preview-footer-panel">
                      {showChoices ? (
                        <div className="space-y-3">
                          {choices.map((choice) => {
                            const linked = Boolean(choice.nextCutId);
                            const selected = activeSelectedChoiceId === choice.id;

                            return (
                              <button
                                key={choice.id}
                                className={[
                                  'w-full rounded-2xl border px-4 py-3 text-left text-sm font-medium transition',
                                  selected
                                    ? 'border-white bg-editor-accent text-white'
                                    : linked
                                      ? 'border-white/20 bg-white/10 text-white hover:bg-white/20'
                                      : 'border-dashed border-amber-300/35 bg-amber-400/10 text-amber-100 hover:bg-amber-400/15'
                                ].join(' ')}
                                onClick={() => {
                                  if (choice.nextCutId) {
                                    handleLinkedChoiceClick(choice);
                                    return;
                                  }

                                  onSelectChoice(choice.id);
                                }}
                                disabled={pendingChoiceId !== null && pendingChoiceId !== choice.id}
                                type="button"
                              >
                                <span className="flex items-center justify-between gap-3">
                                  <span>{choice.label || '내용 없음'}</span>
                                  {!linked ? <span className="text-xs text-amber-200">WARN</span> : null}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : null}

                      {reactionText ? <p className={showChoices ? 'mt-4 text-sm leading-6 text-white/70' : 'text-sm leading-6 text-white/70'}>{reactionText}</p> : null}

                      {showEndingButton ? (
                        <div className={showChoices || reactionText ? 'mt-4' : ''}>
                          <button
                            className="w-full cursor-not-allowed rounded-2xl bg-editor-accent px-4 py-3 text-sm font-bold text-white/85 opacity-80"
                            disabled
                            type="button"
                          >
                            엔딩 도달
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  ) : null}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </div>
    </section>
  );
}

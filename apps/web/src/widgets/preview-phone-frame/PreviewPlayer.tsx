import type { Choice, Cut } from '@promptoon/shared';
import type { CSSProperties } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import { buildCutEffectMotionCustom, cutEffectVariants } from '../../shared/lib/cut-effects';
import { getCutContentBlocksByPlacement } from '../../shared/lib/cut-content';
import { CutContentBlocksView } from '../content-blocks/CutContentBlocksView';

const PREVIEW_BASE_WIDTH = 320;
const PREVIEW_BASE_HEIGHT = (PREVIEW_BASE_WIDTH * 16) / 9;
const DEFAULT_PREVIEW_SCALE = 1;

function getDialogPlacementClasses(cut: Cut): string {
  const dialogAnchorX = cut.dialogAnchorX ?? 'left';
  const dialogAnchorY = cut.dialogAnchorY ?? 'bottom';

  return [
    'pointer-events-none absolute inset-0 z-10 flex p-4',
    dialogAnchorX === 'left' ? 'justify-start' : 'justify-end',
    dialogAnchorY === 'top' ? 'items-start' : 'items-end'
  ].join(' ');
}

function getDialogPlacementStyle(cut: Cut): CSSProperties {
  const dialogAnchorX = cut.dialogAnchorX ?? 'left';
  const dialogAnchorY = cut.dialogAnchorY ?? 'bottom';
  const dialogOffsetX = Math.min(160, Math.max(0, cut.dialogOffsetX ?? 0));
  const dialogOffsetY = Math.min(160, Math.max(0, cut.dialogOffsetY ?? 0));
  const dialogTextAlign = cut.dialogTextAlign ?? 'left';

  return {
    marginBottom: dialogAnchorY === 'bottom' ? `${dialogOffsetY}px` : undefined,
    marginLeft: dialogAnchorX === 'left' ? `${dialogOffsetX}px` : undefined,
    marginRight: dialogAnchorX === 'right' ? `${dialogOffsetX}px` : undefined,
    marginTop: dialogAnchorY === 'top' ? `${dialogOffsetY}px` : undefined,
    maxWidth: 'min(20rem, calc(100% - 2rem))',
    textAlign: dialogTextAlign
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
  onSelectCut
}: {
  cut: Cut | null;
  choices: Choice[];
  selectedChoiceId: string | null;
  onSelectChoice: (choiceId: string) => void;
  onSelectCut: (cutId: string) => void;
}) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [userName, setUserName] = useState('');
  const [pendingChoiceId, setPendingChoiceId] = useState<string | null>(null);
  const [reactionText, setReactionText] = useState<string | null>(null);
  const [previewScale, setPreviewScale] = useState(DEFAULT_PREVIEW_SCALE);
  const phoneFrameRef = useRef<HTMLDivElement | null>(null);
  const showChoices = cut !== null && !cut.isEnding && cut.kind !== 'ending' && choices.length > 0;
  const activeSelectedChoiceId = pendingChoiceId ?? selectedChoiceId;
  const hasOverlayContent = cut ? getCutContentBlocksByPlacement(cut, 'overlay').length > 0 : false;
  const hasFlowContent = cut ? getCutContentBlocksByPlacement(cut, 'flow').length > 0 : false;

  useEffect(() => {
    setImageLoaded(false);
    setImageFailed(false);
  }, [cut?.assetUrl, cut?.id]);

  useEffect(() => {
    setPendingChoiceId(null);
    setReactionText(null);
  }, [cut?.id]);

  useLayoutEffect(() => {
    const frameElement = phoneFrameRef.current;
    if (!frameElement) {
      return;
    }

    const updatePreviewScale = () => {
      const frameWidth = frameElement.clientWidth;
      if (frameWidth > 0) {
        setPreviewScale(frameWidth / PREVIEW_BASE_WIDTH);
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
  }, []);

  function handleLinkedChoiceClick(choice: Choice) {
    if (!choice.nextCutId || pendingChoiceId) {
      return;
    }

    setPendingChoiceId(choice.id);
    setReactionText(choice.afterSelectReactionText ?? null);
    onSelectCut(choice.nextCutId!);
  }

  return (
    <section className="flex h-full min-h-0 flex-col rounded-[32px] border border-editor-border bg-editor-panel/80 p-5">
      <div>
        <p className="font-display text-xl font-semibold text-zinc-50">Live Preview</p>
        <p className="text-sm text-zinc-400">Dynamic phone-frame preview synced with the current editor selection.</p>
      </div>

      <div className="mt-6 flex min-h-0 flex-1 items-start justify-center">
        {!cut ? (
          <div className="flex h-full min-h-[420px] w-full items-center justify-center rounded-[32px] border border-dashed border-editor-border bg-black/10 text-center text-sm text-zinc-500">
            표시할 컷이 없습니다.
          </div>
        ) : (
          <div
            ref={phoneFrameRef}
            className="relative aspect-[9/16] max-h-full w-full max-w-full overflow-hidden rounded-[2.5rem] border-[8px] border-editor-panel bg-black shadow-phone"
          >
            <AnimatePresence initial={false} mode="wait">
              <motion.div
                animate="animate"
                className="absolute inset-0 overflow-hidden"
                custom={buildCutEffectMotionCustom(cut.startEffect, cut.endEffect, cut.startEffectDurationMs, cut.endEffectDurationMs)}
                data-end-effect={cut.endEffect ?? 'none'}
                data-start-effect={cut.startEffect ?? 'none'}
                data-testid="preview-cut-motion"
                exit="exit"
                initial="initial"
                key={cut.id}
                variants={cutEffectVariants}
              >
                <div
                  className="absolute left-0 top-0"
                  style={{
                    height: `${PREVIEW_BASE_HEIGHT}px`,
                    transform: `scale(${previewScale})`,
                    transformOrigin: 'top left',
                    width: `${PREVIEW_BASE_WIDTH}px`
                  }}
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
                    />
                  ) : null}

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
                        />
                      </div>
                    </div>
                  ) : null}

                  <div className="relative z-10 flex h-full flex-col justify-end p-6">
                    {hasFlowContent ? (
                      <div className={`${getContentPanelClassName(cut)} mb-4`}>
                        <CutContentBlocksView
                          bindings={{ userName }}
                          className="space-y-3"
                          cut={cut}
                          onBindingChange={(_bindingKey, value) => setUserName(value)}
                          placement="flow"
                        />
                      </div>
                    ) : null}

                    <div className="rounded-[28px] border border-white/10 bg-black/20 p-5 backdrop-blur-sm">
                      <p className="text-xs uppercase tracking-[0.24em] text-white/45">{cut.title}</p>

                      {showChoices ? (
                        <div className="mt-4 space-y-3">
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

                      {reactionText ? <p className="mt-4 text-sm leading-6 text-white/70">{reactionText}</p> : null}

                      {cut.kind === 'ending' ? (
                        <div className="mt-4">
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
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </div>
    </section>
  );
}

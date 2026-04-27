import type { Cut, PromptoonContentPlacement, PromptoonContentTextAlign, PublishManifest } from '@promptoon/shared';
import type { CSSProperties, ReactNode } from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import {
  getContentFontFamily,
  getContentFontSizeClassName,
  getContentLineHeightClassName,
  getContentSpacingClassName,
  getCutContentBlocksByPlacement,
  normalizeCutContentBlocks,
  replaceContentBindings,
  type ViewerBindings
} from '../../shared/lib/cut-content';

type RenderableCut =
  | Pick<Cut, 'id' | 'body' | 'contentBlocks' | 'contentViewMode'>
  | Pick<PublishManifest['cuts'][number], 'id' | 'body' | 'contentBlocks' | 'contentViewMode'>;

interface CutContentBlocksViewProps {
  bindings: ViewerBindings;
  className?: string;
  cut: RenderableCut;
  dialogueAnimationScope?: string;
  emptyLabel?: string;
  onContainerRevealSyncChange?: (isRevealed: boolean) => void;
  onBindingChange?: (bindingKey: 'userName', value: string) => void;
  placement?: PromptoonContentPlacement;
  revealImmediately?: boolean;
  syncContainerVisibilityWithReveal?: boolean;
  textAlignOverride?: PromptoonContentTextAlign;
}

const DIALOGUE_TYPEWRITER_INTERVAL_MS = 28;
const CONTENT_REVEAL_TRIGGER_VIEWPORT_RATIO = 0.8;
const playedDialogueAnimationKeys = new Set<string>();
const playedContentRevealKeys = new Set<string>();

function getTextAlignStyle(textAlign: 'left' | 'center' | 'right'): CSSProperties {
  return {
    textAlign
  };
}

function getScrollableAncestor(element: HTMLElement): HTMLElement | null {
  let currentElement = element.parentElement;

  while (currentElement) {
    const overflowY = window.getComputedStyle(currentElement).overflowY;

    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
      return currentElement;
    }

    currentElement = currentElement.parentElement;
  }

  return null;
}

function hasReachedRevealTrigger(element: HTMLElement, scrollRoot: HTMLElement | null): boolean {
  const rect = element.getBoundingClientRect();
  const hasMeasuredBox = rect.width > 0 || rect.height > 0 || rect.top > 0 || rect.bottom > 0;

  if (!hasMeasuredBox || typeof window === 'undefined') {
    return false;
  }

  const viewportRect = scrollRoot?.getBoundingClientRect();
  const viewportTop = viewportRect?.top ?? 0;
  const viewportHeight = viewportRect?.height && viewportRect.height > 0 ? viewportRect.height : window.innerHeight;
  const triggerY = viewportTop + viewportHeight * CONTENT_REVEAL_TRIGGER_VIEWPORT_RATIO;
  const viewportBottom = viewportTop + viewportHeight;

  return rect.top <= triggerY && rect.bottom >= viewportTop && rect.top <= viewportBottom;
}

function TypewriterText({
  animationKey,
  isRevealed,
  text
}: {
  animationKey: string;
  isRevealed: boolean;
  text: string;
}) {
  const characters = useMemo(() => Array.from(text), [text]);
  const canAnimate = text.length > 0 && !playedDialogueAnimationKeys.has(animationKey);
  const [visibleCharacterCount, setVisibleCharacterCount] = useState(() => (canAnimate ? 0 : characters.length));
  const shouldType = canAnimate && isRevealed;
  const visibleText = canAnimate ? characters.slice(0, visibleCharacterCount).join('') : text;
  const isTyping = shouldType && visibleCharacterCount < characters.length;

  useEffect(() => {
    if (!canAnimate) {
      setVisibleCharacterCount(characters.length);
      return;
    }

    setVisibleCharacterCount(0);
  }, [animationKey, canAnimate, characters.length]);

  useEffect(() => {
    if (!shouldType) {
      return;
    }

    if (visibleCharacterCount === 0 && characters.length > 0) {
      setVisibleCharacterCount(1);
      return;
    }

    if (visibleCharacterCount >= characters.length) {
      playedDialogueAnimationKeys.add(animationKey);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setVisibleCharacterCount((currentCount) => Math.min(currentCount + 1, characters.length));
    }, DIALOGUE_TYPEWRITER_INTERVAL_MS);

    return () => window.clearTimeout(timeoutId);
  }, [animationKey, characters.length, shouldType, visibleCharacterCount]);

  return (
    <span className="relative block" data-testid={`dialogue-typewriter-${animationKey}`}>
      <span aria-hidden="true" className="invisible whitespace-pre-wrap">
        {text || '\u00a0'}
      </span>
      <span aria-hidden="true" className="absolute inset-0 whitespace-pre-wrap" data-testid={`dialogue-typewriter-visible-${animationKey}`}>
        {visibleText}
        {isTyping ? <span className="ml-0.5 inline-block h-[1em] w-px translate-y-0.5 animate-pulse bg-current opacity-70" /> : null}
      </span>
    </span>
  );
}

function RevealBlock({
  children,
  className,
  onRevealChange,
  revealImmediately = false,
  revealKey
}: {
  children: (isRevealed: boolean) => ReactNode;
  className?: string;
  onRevealChange?: (revealKey: string, isRevealed: boolean) => void;
  revealImmediately?: boolean;
  revealKey: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canAnimate = !revealImmediately && !playedContentRevealKeys.has(revealKey);
  const [isRevealed, setIsRevealed] = useState(() => revealImmediately || !canAnimate);

  useEffect(() => {
    if (revealImmediately) {
      setIsRevealed(true);
      return;
    }

    if (!canAnimate) {
      setIsRevealed(true);
      return;
    }

    setIsRevealed(false);
  }, [canAnimate, revealImmediately, revealKey]);

  useEffect(() => {
    onRevealChange?.(revealKey, isRevealed);
  }, [isRevealed, onRevealChange, revealKey]);

  useEffect(() => {
    if (revealImmediately || !canAnimate || isRevealed) {
      return;
    }

    const element = containerRef.current;

    if (!element || typeof IntersectionObserver === 'undefined') {
      playedContentRevealKeys.add(revealKey);
      setIsRevealed(true);
      return;
    }

    const revealElement = element;
    const scrollRoot = getScrollableAncestor(revealElement);
    const scrollTarget: HTMLElement | Window = scrollRoot ?? window;

    function reveal() {
      playedContentRevealKeys.add(revealKey);
      setIsRevealed(true);
    }

    let pendingFrameId: number | null = null;

    function checkRevealPosition() {
      if (hasReachedRevealTrigger(revealElement, scrollRoot)) {
        reveal();
        observer.disconnect();
      }
    }

    function scheduleRevealCheck() {
      if (pendingFrameId !== null) {
        return;
      }

      pendingFrameId = window.requestAnimationFrame(() => {
        pendingFrameId = null;
        checkRevealPosition();
      });
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting && entry.intersectionRatio > 0)) {
          checkRevealPosition();
        }
      },
      {
        root: scrollRoot,
        threshold: 0.01
      }
    );

    observer.observe(revealElement);
    scheduleRevealCheck();
    window.addEventListener('resize', scheduleRevealCheck);
    scrollTarget.addEventListener('scroll', scheduleRevealCheck, { passive: true });

    return () => {
      if (pendingFrameId !== null) {
        window.cancelAnimationFrame(pendingFrameId);
      }

      window.removeEventListener('resize', scheduleRevealCheck);
      scrollTarget.removeEventListener('scroll', scheduleRevealCheck);
      observer.disconnect();
    };
  }, [canAnimate, isRevealed, revealImmediately, revealKey]);

  return (
    <div
      className={[
        'transform-gpu transition duration-500 ease-out',
        isRevealed ? 'translate-y-0 opacity-100 blur-0' : 'translate-y-4 opacity-0 blur-[2px]',
        className
      ]
        .filter(Boolean)
        .join(' ')}
      data-content-revealed={isRevealed ? 'true' : 'false'}
      data-testid={`content-block-reveal-${revealKey}`}
      ref={containerRef}
    >
      {children(isRevealed)}
    </div>
  );
}

export function CutContentBlocksView({
  bindings,
  className,
  cut,
  dialogueAnimationScope,
  emptyLabel = 'No dialogue yet.',
  onContainerRevealSyncChange,
  onBindingChange,
  placement,
  revealImmediately = false,
  syncContainerVisibilityWithReveal = false,
  textAlignOverride
}: CutContentBlocksViewProps) {
  const blocks = placement ? getCutContentBlocksByPlacement(cut, placement) : normalizeCutContentBlocks(cut);
  const isInverse = (cut.contentViewMode ?? 'default') === 'inverse';
  const revealKeys = blocks.map((block) => [dialogueAnimationScope ?? cut.id, placement ?? 'all', block.id].join(':'));
  const revealKeysSignature = revealKeys.join('\u0000');
  const [revealedBlockKeys, setRevealedBlockKeys] = useState(() => {
    return new Set(revealKeys.filter((revealKey) => playedContentRevealKeys.has(revealKey)));
  });
  const isContainerRevealSynced = !syncContainerVisibilityWithReveal || revealedBlockKeys.size > 0;

  useEffect(() => {
    const currentRevealKeys = revealKeysSignature.length > 0 ? revealKeysSignature.split('\u0000') : [];

    setRevealedBlockKeys(new Set(currentRevealKeys.filter((revealKey) => playedContentRevealKeys.has(revealKey))));
  }, [revealKeysSignature]);

  const handleBlockRevealChange = useCallback((revealKey: string, isRevealed: boolean) => {
    setRevealedBlockKeys((currentKeys) => {
      const nextKeys = new Set(currentKeys);

      if (isRevealed) {
        nextKeys.add(revealKey);
      } else {
        nextKeys.delete(revealKey);
      }

      return nextKeys;
    });
  }, []);

  useLayoutEffect(() => {
    onContainerRevealSyncChange?.(isContainerRevealSynced);
  }, [isContainerRevealSynced, onContainerRevealSyncChange]);

  if (blocks.length === 0) {
    return <p className={className ? className : isInverse ? 'text-base leading-7 text-zinc-800/80' : 'text-base leading-7 text-white/80'}>{emptyLabel}</p>;
  }

  return (
    <div
      className={[
        syncContainerVisibilityWithReveal ? 'transition-opacity duration-500 ease-out' : '',
        syncContainerVisibilityWithReveal && !isContainerRevealSynced ? 'pointer-events-none opacity-0' : '',
        syncContainerVisibilityWithReveal && isContainerRevealSynced ? 'opacity-100' : '',
        className ?? 'space-y-3'
      ]
        .filter(Boolean)
        .join(' ')}
      data-testid="cut-content-blocks"
    >
      {blocks.map((block) => {
        const revealKey = [dialogueAnimationScope ?? cut.id, placement ?? 'all', block.id].join(':');
        const handleRevealChange = syncContainerVisibilityWithReveal ? handleBlockRevealChange : undefined;

        if (block.type === 'image') {
          return (
            <RevealBlock key={block.id} onRevealChange={handleRevealChange} revealImmediately={revealImmediately} revealKey={revealKey}>
              {() =>
                block.assetUrl ? (
                  <div
                    className={isInverse ? 'overflow-hidden rounded-[24px] border border-zinc-900/10 bg-zinc-950/5' : 'overflow-hidden rounded-[24px] border border-white/10 bg-black/20'}
                  >
                    <img alt={block.alt || cut.id} className="h-auto w-full object-cover" src={block.assetUrl} />
                  </div>
                ) : (
                  <div
                    className={
                      isInverse
                        ? 'flex h-36 items-center justify-center rounded-[24px] border border-dashed border-zinc-900/15 bg-zinc-950/5 text-sm text-zinc-600'
                        : 'flex h-36 items-center justify-center rounded-[24px] border border-dashed border-white/15 bg-black/15 text-sm text-white/45'
                    }
                  >
                    이미지가 비어 있습니다.
                  </div>
                )
              }
            </RevealBlock>
          );
        }

        if (block.type === 'nameInput') {
          return (
            <RevealBlock key={block.id} onRevealChange={handleRevealChange} revealImmediately={revealImmediately} revealKey={revealKey}>
              {() => (
                <input
                  className={
                    isInverse
                      ? 'w-full rounded-[22px] border border-zinc-900/10 bg-white/85 px-4 py-3 text-base text-zinc-950 outline-none transition focus:border-zinc-900/25'
                      : 'w-full rounded-[22px] border border-white/10 bg-black/25 px-4 py-3 text-base text-white outline-none transition focus:border-white/30'
                  }
                  maxLength={block.maxLength}
                  onChange={(event) => onBindingChange?.(block.bindingKey, event.target.value)}
                  placeholder={block.placeholder}
                  readOnly={!onBindingChange}
                  required={block.required}
                  type="text"
                  value={bindings.userName}
                />
              )}
            </RevealBlock>
          );
        }

        const textStyle: CSSProperties = {
          ...getTextAlignStyle(textAlignOverride ?? block.textAlign),
          fontFamily: getContentFontFamily(block.fontToken)
        };
        const textSizeClassName = getContentFontSizeClassName(block.fontSizeToken);
        const lineHeightClassName = getContentLineHeightClassName(block.lineHeightToken);
        const spacingClassName = [
          getContentSpacingClassName('mt', block.marginTopToken),
          getContentSpacingClassName('mb', block.marginBottomToken)
        ]
          .filter(Boolean)
          .join(' ');
        if (block.type === 'heading') {
          return (
            <RevealBlock className={spacingClassName} key={block.id} onRevealChange={handleRevealChange} revealImmediately={revealImmediately} revealKey={revealKey}>
              {() => (
                <p className={isInverse ? `${textSizeClassName} whitespace-pre-wrap ${lineHeightClassName} text-zinc-950` : `${textSizeClassName} whitespace-pre-wrap ${lineHeightClassName} text-white`} style={textStyle}>
                  {replaceContentBindings(block.text, bindings)}
                </p>
              )}
            </RevealBlock>
          );
        }

        if (block.type === 'quote') {
          return (
            <RevealBlock className={spacingClassName} key={block.id} onRevealChange={handleRevealChange} revealImmediately={revealImmediately} revealKey={revealKey}>
              {() => (
                <div
                  className={
                    isInverse
                      ? 'rounded-[24px] border border-zinc-900/10 bg-zinc-950/5 px-4 py-4'
                      : 'rounded-[24px] border border-white/10 bg-black/15 px-4 py-4'
                  }
                  style={textStyle}
                >
                  {block.title?.trim() ? (
                    <p className={isInverse ? 'mb-2 text-xs uppercase tracking-[0.22em] text-zinc-500' : 'mb-2 text-xs uppercase tracking-[0.22em] text-white/45'}>
                      {replaceContentBindings(block.title, bindings)}
                    </p>
                  ) : null}
                  <p className={isInverse ? `${textSizeClassName} whitespace-pre-wrap ${lineHeightClassName} text-zinc-900/88` : `${textSizeClassName} whitespace-pre-wrap ${lineHeightClassName} text-white/88`}>
                    {replaceContentBindings(block.text, bindings)}
                  </p>
                </div>
              )}
            </RevealBlock>
          );
        }

        if (block.type === 'dialogue') {
          const dialogueText = replaceContentBindings(block.text, bindings);
          const typewriterAnimationKey = [dialogueAnimationScope ?? cut.id, placement ?? 'all', block.id, dialogueText].join(':');

          return (
            <RevealBlock className={spacingClassName} key={block.id} onRevealChange={handleRevealChange} revealImmediately={revealImmediately} revealKey={revealKey}>
              {(isRevealed) => (
                <div
                  className={
                    isInverse
                      ? 'rounded-[24px] border border-zinc-900/10 bg-zinc-950/5 px-4 py-4'
                      : 'rounded-[24px] border border-white/10 bg-black/15 px-4 py-4'
                  }
                  style={textStyle}
                >
                  {block.speaker?.trim() ? (
                    <p className={isInverse ? 'mb-2 text-xs uppercase tracking-[0.22em] text-zinc-500' : 'mb-2 text-xs uppercase tracking-[0.22em] text-white/45'}>
                      {replaceContentBindings(block.speaker, bindings)}
                    </p>
                  ) : null}
                  <p
                    aria-label={dialogueText}
                    className={isInverse ? `${textSizeClassName} whitespace-pre-wrap ${lineHeightClassName} text-zinc-900/88` : `${textSizeClassName} whitespace-pre-wrap ${lineHeightClassName} text-white/88`}
                  >
                    <TypewriterText animationKey={typewriterAnimationKey} isRevealed={isRevealed} key={typewriterAnimationKey} text={dialogueText} />
                  </p>
                </div>
              )}
            </RevealBlock>
          );
        }

        if (block.type === 'emphasis') {
          return (
            <RevealBlock className={spacingClassName} key={block.id} onRevealChange={handleRevealChange} revealImmediately={revealImmediately} revealKey={revealKey}>
              {() => (
                <p className={isInverse ? `${textSizeClassName} whitespace-pre-wrap ${lineHeightClassName} font-semibold text-zinc-950` : `${textSizeClassName} whitespace-pre-wrap ${lineHeightClassName} font-semibold text-white`} style={textStyle}>
                  {replaceContentBindings(block.text, bindings)}
                </p>
              )}
            </RevealBlock>
          );
        }

        return (
          <RevealBlock className={spacingClassName} key={block.id} onRevealChange={handleRevealChange} revealImmediately={revealImmediately} revealKey={revealKey}>
            {() => (
              <p className={isInverse ? `${textSizeClassName} whitespace-pre-wrap ${lineHeightClassName} text-zinc-900/88` : `${textSizeClassName} whitespace-pre-wrap ${lineHeightClassName} text-white/88`} style={textStyle}>
                {replaceContentBindings(block.text, bindings)}
              </p>
            )}
          </RevealBlock>
        );
      })}
    </div>
  );
}

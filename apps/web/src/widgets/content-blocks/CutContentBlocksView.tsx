import type { Cut, PromptoonContentPlacement, PublishManifest } from '@promptoon/shared';
import type { CSSProperties } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

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
  onBindingChange?: (bindingKey: 'userName', value: string) => void;
  placement?: PromptoonContentPlacement;
}

const DIALOGUE_TYPEWRITER_INTERVAL_MS = 28;
const playedDialogueAnimationKeys = new Set<string>();

function getTextAlignStyle(textAlign: 'left' | 'center' | 'right'): CSSProperties {
  return {
    textAlign
  };
}

function TypewriterText({
  animationKey,
  text
}: {
  animationKey: string;
  text: string;
}) {
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const characters = useMemo(() => Array.from(text), [text]);
  const canAnimate = text.length > 0 && !playedDialogueAnimationKeys.has(animationKey);
  const [hasReachedTriggerPosition, setHasReachedTriggerPosition] = useState(() => !canAnimate);
  const [visibleCharacterCount, setVisibleCharacterCount] = useState(() => (canAnimate ? 0 : characters.length));
  const shouldType = canAnimate && hasReachedTriggerPosition;
  const visibleText = canAnimate ? characters.slice(0, visibleCharacterCount).join('') : text;
  const isTyping = shouldType && visibleCharacterCount < characters.length;

  useEffect(() => {
    if (!canAnimate) {
      setHasReachedTriggerPosition(true);
      setVisibleCharacterCount(characters.length);
      return;
    }

    setHasReachedTriggerPosition(false);
    setVisibleCharacterCount(0);
  }, [animationKey, canAnimate, characters.length]);

  useEffect(() => {
    if (!canAnimate || hasReachedTriggerPosition) {
      return;
    }

    const element = containerRef.current;

    if (!element || typeof IntersectionObserver === 'undefined') {
      setHasReachedTriggerPosition(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting && entry.intersectionRatio > 0)) {
          setHasReachedTriggerPosition(true);
          observer.disconnect();
        }
      },
      {
        root: null,
        rootMargin: '-45% 0px -45% 0px',
        threshold: 0.01
      }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [canAnimate, hasReachedTriggerPosition]);

  useEffect(() => {
    if (!shouldType) {
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
    <span className="relative block" data-testid={`dialogue-typewriter-${animationKey}`} ref={containerRef}>
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

export function CutContentBlocksView({
  bindings,
  className,
  cut,
  dialogueAnimationScope,
  emptyLabel = 'No dialogue yet.',
  onBindingChange,
  placement
}: CutContentBlocksViewProps) {
  const blocks = placement ? getCutContentBlocksByPlacement(cut, placement) : normalizeCutContentBlocks(cut);
  const isInverse = (cut.contentViewMode ?? 'default') === 'inverse';

  if (blocks.length === 0) {
    return <p className={className ? className : isInverse ? 'text-base leading-7 text-zinc-800/80' : 'text-base leading-7 text-white/80'}>{emptyLabel}</p>;
  }

  return (
    <div className={className ?? 'space-y-3'} data-testid="cut-content-blocks">
      {blocks.map((block) => {
        if (block.type === 'image') {
          return block.assetUrl ? (
            <div
              className={isInverse ? 'overflow-hidden rounded-[24px] border border-zinc-900/10 bg-zinc-950/5' : 'overflow-hidden rounded-[24px] border border-white/10 bg-black/20'}
              key={block.id}
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
              key={block.id}
            >
              이미지가 비어 있습니다.
            </div>
          );
        }

        if (block.type === 'nameInput') {
          return (
            <input
              className={
                isInverse
                  ? 'w-full rounded-[22px] border border-zinc-900/10 bg-white/85 px-4 py-3 text-base text-zinc-950 outline-none transition focus:border-zinc-900/25'
                  : 'w-full rounded-[22px] border border-white/10 bg-black/25 px-4 py-3 text-base text-white outline-none transition focus:border-white/30'
              }
              key={block.id}
              maxLength={block.maxLength}
              onChange={(event) => onBindingChange?.(block.bindingKey, event.target.value)}
              placeholder={block.placeholder}
              readOnly={!onBindingChange}
              required={block.required}
              type="text"
              value={bindings.userName}
            />
          );
        }

        const textStyle: CSSProperties = {
          ...getTextAlignStyle(block.textAlign),
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
        const textClassName = [textSizeClassName, 'whitespace-pre-wrap', lineHeightClassName, spacingClassName].filter(Boolean).join(' ');

        if (block.type === 'heading') {
          return (
            <p className={isInverse ? `${textClassName} text-zinc-950` : `${textClassName} text-white`} key={block.id} style={textStyle}>
              {replaceContentBindings(block.text, bindings)}
            </p>
          );
        }

        if (block.type === 'quote') {
          return (
            <div
              className={
                isInverse
                  ? `${spacingClassName} rounded-[24px] border border-zinc-900/10 bg-zinc-950/5 px-4 py-4`
                  : `${spacingClassName} rounded-[24px] border border-white/10 bg-black/15 px-4 py-4`
              }
              key={block.id}
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
          );
        }

        if (block.type === 'dialogue') {
          const dialogueText = replaceContentBindings(block.text, bindings);
          const typewriterAnimationKey = [dialogueAnimationScope ?? cut.id, placement ?? 'all', block.id, dialogueText].join(':');

          return (
            <div
              className={
                isInverse
                  ? `${spacingClassName} rounded-[24px] border border-zinc-900/10 bg-zinc-950/5 px-4 py-4`
                  : `${spacingClassName} rounded-[24px] border border-white/10 bg-black/15 px-4 py-4`
              }
              key={block.id}
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
                <TypewriterText animationKey={typewriterAnimationKey} key={typewriterAnimationKey} text={dialogueText} />
              </p>
            </div>
          );
        }

        if (block.type === 'emphasis') {
          return (
            <p className={isInverse ? `${textClassName} font-semibold text-zinc-950` : `${textClassName} font-semibold text-white`} key={block.id} style={textStyle}>
              {replaceContentBindings(block.text, bindings)}
            </p>
          );
        }

        return (
          <p className={isInverse ? `${textClassName} text-zinc-900/88` : `${textClassName} text-white/88`} key={block.id} style={textStyle}>
            {replaceContentBindings(block.text, bindings)}
          </p>
        );
      })}
    </div>
  );
}

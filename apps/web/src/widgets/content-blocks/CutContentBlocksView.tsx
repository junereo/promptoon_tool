import type { Cut, PromptoonContentPlacement, PublishManifest } from '@promptoon/shared';
import type { CSSProperties } from 'react';

import {
  getContentFontFamily,
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
  emptyLabel?: string;
  onBindingChange?: (bindingKey: 'userName', value: string) => void;
  placement?: PromptoonContentPlacement;
}

function getTextAlignStyle(textAlign: 'left' | 'center' | 'right'): CSSProperties {
  return {
    textAlign
  };
}

export function CutContentBlocksView({
  bindings,
  className,
  cut,
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

        if (block.type === 'heading') {
          return (
            <p className={isInverse ? 'whitespace-pre-wrap text-2xl leading-tight text-zinc-950' : 'whitespace-pre-wrap text-2xl leading-tight text-white'} key={block.id} style={textStyle}>
              {replaceContentBindings(block.text, bindings)}
            </p>
          );
        }

        if (block.type === 'quote') {
          return (
            <div
              className={isInverse ? 'rounded-[24px] border border-zinc-900/10 bg-zinc-950/5 px-4 py-4' : 'rounded-[24px] border border-white/10 bg-black/15 px-4 py-4'}
              key={block.id}
              style={textStyle}
            >
              {block.title?.trim() ? (
                <p className={isInverse ? 'mb-2 text-xs uppercase tracking-[0.22em] text-zinc-500' : 'mb-2 text-xs uppercase tracking-[0.22em] text-white/45'}>
                  {replaceContentBindings(block.title, bindings)}
                </p>
              ) : null}
              <p className={isInverse ? 'whitespace-pre-wrap text-base leading-7 text-zinc-900/88 sm:text-lg' : 'whitespace-pre-wrap text-base leading-7 text-white/88 sm:text-lg'}>
                {replaceContentBindings(block.text, bindings)}
              </p>
            </div>
          );
        }

        if (block.type === 'emphasis') {
          return (
            <p className={isInverse ? 'whitespace-pre-wrap text-lg font-semibold leading-7 text-zinc-950 sm:text-xl' : 'whitespace-pre-wrap text-lg font-semibold leading-7 text-white sm:text-xl'} key={block.id} style={textStyle}>
              {replaceContentBindings(block.text, bindings)}
            </p>
          );
        }

        return (
          <p className={isInverse ? 'whitespace-pre-wrap text-base leading-7 text-zinc-900/88 sm:text-lg' : 'whitespace-pre-wrap text-base leading-7 text-white/88 sm:text-lg'} key={block.id} style={textStyle}>
            {replaceContentBindings(block.text, bindings)}
          </p>
        );
      })}
    </div>
  );
}

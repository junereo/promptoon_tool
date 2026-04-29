import type { PromptoonResultCardContentBlock } from '@promptoon/shared';
import { forwardRef, type CSSProperties } from 'react';

import { RESULT_CARD_STAMP_ASSET_URL, RESULT_CARD_THEME_STYLES } from '../../shared/lib/result-card';

interface ResultCardProps {
  assetUrl?: string | null;
  block: PromptoonResultCardContentBlock;
  className?: string;
}

export const ResultCard = forwardRef<HTMLDivElement, ResultCardProps>(function ResultCard({ assetUrl, block, className }, ref) {
  const themeStyle = RESULT_CARD_THEME_STYLES[block.theme] ?? RESULT_CARD_THEME_STYLES.blue;
  const backgroundImageStyle: CSSProperties = assetUrl
    ? {
        backgroundImage: `url("${assetUrl}")`
      }
    : {};

  return (
    <div
      className={['relative grid aspect-square w-full max-w-[30rem] grid-rows-[35%_65%] overflow-hidden rounded-[10px] border-2 bg-[#060608] shadow-[0_24px_80px_rgba(0,0,0,0.45)]', className]
        .filter(Boolean)
        .join(' ')}
      data-testid="result-card"
      ref={ref}
      style={{ borderColor: themeStyle.border }}
    >
      <div className="relative min-h-0 overflow-hidden">
        {assetUrl ? (
          <div
            aria-hidden
            className="absolute inset-0 bg-cover bg-[center_28%]"
            style={backgroundImageStyle}
          />
        ) : (
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ background: `linear-gradient(135deg, ${themeStyle.bottomFrom}, #111, ${themeStyle.bottomTo})` }}
          />
        )}
        <div aria-hidden className="absolute inset-0" style={{ backgroundColor: themeStyle.imageTint }} />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/80 to-transparent" />
        <span
          className="absolute left-4 top-4 rounded-full border px-2.5 py-1 text-[0.62rem] font-semibold tracking-[0.16em]"
          style={{ borderColor: themeStyle.inflowBorder, color: themeStyle.text }}
        >
          {block.badge}
        </span>
      </div>

      <div
        className="relative flex min-h-0 flex-col px-5 py-4"
        style={{ background: `linear-gradient(160deg, ${themeStyle.bottomFrom}, ${themeStyle.bottomTo})`, color: themeStyle.text }}
      >
        <div>
          <h2 className="font-display text-[1.28rem] font-semibold leading-tight">{block.resultName}</h2>
          <p
            className="mt-1.5 inline-flex rounded-full border px-2.5 py-0.5 text-[0.7rem] font-medium"
            style={{ borderColor: themeStyle.taglineBorder, color: themeStyle.text }}
          >
            {block.tagline}
          </p>
        </div>

        <div className="mt-2 min-h-0 space-y-1 overflow-hidden pr-24 text-[0.72rem] leading-snug" style={{ color: themeStyle.mutedText }}>
          {block.lines.map((line, index) => (
            <p key={`${block.id}-line-${index}`}>{line}</p>
          ))}
        </div>

        <div
          aria-hidden
          className="absolute right-5 top-[6.25rem] h-[4.9rem] w-[4.9rem] -rotate-[8deg] overflow-hidden rounded-full border bg-black/15 p-1 opacity-75 shadow-[0_12px_28px_rgba(0,0,0,0.28)]"
          style={{ borderColor: themeStyle.inflowBorder }}
        >
          <img
            alt=""
            className="h-full w-full rounded-full object-cover"
            draggable={false}
            src={RESULT_CARD_STAMP_ASSET_URL}
          />
        </div>

        <div
          className="mt-auto flex shrink-0 items-center justify-between gap-3 rounded-[8px] border bg-black/18 px-3 py-2"
          style={{ borderColor: themeStyle.inflowBorder }}
        >
          <div className="min-w-0">
            <p className="text-[0.56rem] font-semibold tracking-[0.18em]" style={{ color: themeStyle.mutedText }}>
              {block.inflowLabel}
            </p>
            <p className="truncate text-[0.76rem] font-semibold">{block.inflowUrl}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[0.66rem] font-semibold">{block.inflowBrand}</p>
            <p className="text-[0.56rem]" style={{ color: themeStyle.mutedText }}>
              {block.inflowTagline}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});

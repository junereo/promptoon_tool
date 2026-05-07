import type { Cut } from '@promptoon/shared';
import type { HTMLAttributes } from 'react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TrashFull as TrashIcon } from 'react-coolicons';

const KIND_STYLES: Record<Cut['kind'], string> = {
  scene: 'border-zinc-700 bg-zinc-900/70 text-zinc-200',
  choice: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  ending: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  transition: 'border-sky-500/40 bg-sky-500/10 text-sky-200',
  stateRouter: 'border-violet-500/40 bg-violet-500/10 text-violet-200',
  resultCard: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
  loopStage: 'border-lime-500/40 bg-lime-500/10 text-lime-200',
  loopVariant: 'border-teal-500/40 bg-teal-500/10 text-teal-200',
  loopSpacer: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200'
};

export type CutCardSize = 'small' | 'normal' | 'large';

const CUT_CARD_SIZE_STYLES: Record<
  CutCardSize,
  {
    bodyClassName: string;
    frameClassName: string;
    loopClassName: string;
    showBody: boolean;
    showFlags: boolean;
    showLoopSummary: boolean;
    titleClassName: string;
  }
> = {
  small: {
    bodyClassName: '',
    frameClassName: 'h-[76px] py-2',
    loopClassName: '',
    showBody: false,
    showFlags: false,
    showLoopSummary: false,
    titleClassName: 'truncate text-sm leading-5'
  },
  normal: {
    bodyClassName: 'line-clamp-1',
    frameClassName: 'h-[112px] py-2.5',
    loopClassName: 'line-clamp-1',
    showBody: true,
    showFlags: false,
    showLoopSummary: true,
    titleClassName: 'line-clamp-1 text-sm leading-5'
  },
  large: {
    bodyClassName: 'line-clamp-3',
    frameClassName: 'h-[160px] py-3',
    loopClassName: 'line-clamp-2',
    showBody: true,
    showFlags: true,
    showLoopSummary: true,
    titleClassName: 'line-clamp-2 text-base leading-6'
  }
};

interface DetailPosition {
  left: number;
  top: number;
}

function getCutBodyPreview(cut: Cut): string {
  return cut.body.trim() || 'No body yet.';
}

function getLoopMetadataSummary(cut: Cut): string | null {
  if (cut.loopMetadata?.kind !== 'exitLoop') {
    return null;
  }

  const variantCount = cut.loopMetadata.variantCutIds?.length ?? 0;
  const parts = [
    cut.loopMetadata.groupLabel ?? cut.loopMetadata.groupId,
    cut.loopMetadata.role,
    cut.loopMetadata.stageIndex ? `Stage ${cut.loopMetadata.stageIndex}` : null,
    cut.loopMetadata.role === 'stageBase' ? `${variantCount} variant${variantCount === 1 ? '' : 's'}` : null,
    cut.loopMetadata.truth ?? null
  ].filter((part): part is string => Boolean(part));

  return parts.join(' · ');
}

function getCutFlags(cut: Cut): string {
  const flags = [
    cut.isStart ? 'Start' : null,
    cut.isEnding ? 'Ending' : null,
    cut.assetUrl ? 'Asset' : null
  ].filter((flag): flag is string => Boolean(flag));

  return flags.length > 0 ? flags.join(' · ') : 'None';
}

function CutDetailPopover({
  cut,
  position,
  rank
}: {
  cut: Cut;
  position: DetailPosition;
  rank: string;
}) {
  const loopSummary = getLoopMetadataSummary(cut);

  return (
    <div
      className="fixed z-[90] w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-editor-border bg-[#18181d]/95 p-4 text-left shadow-2xl shadow-black/50 backdrop-blur"
      data-testid="cut-detail-popover"
      role="dialog"
      style={{
        left: position.left,
        top: position.top
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Cut
            {' '}
            {rank}
          </p>
          <h3 className="mt-1 break-words font-display text-lg font-semibold leading-6 text-zinc-50">{cut.title}</h3>
        </div>
        <span
          className={[
            'shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em]',
            KIND_STYLES[cut.kind]
          ].join(' ')}
        >
          {cut.kind}
        </span>
      </div>

      <div className="mt-3 space-y-3 text-xs leading-5 text-zinc-300">
        <div>
          <p className="font-semibold uppercase tracking-[0.16em] text-zinc-500">Body</p>
          <p className="mt-1 max-h-36 overflow-y-auto whitespace-pre-wrap break-words text-zinc-200">{getCutBodyPreview(cut)}</p>
        </div>

        {loopSummary ? (
          <div>
            <p className="font-semibold uppercase tracking-[0.16em] text-zinc-500">LoopState</p>
            <p className="mt-1 break-words text-lime-100/90">{loopSummary}</p>
          </div>
        ) : null}

        <dl className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-zinc-400">
          <dt className="uppercase tracking-[0.14em] text-zinc-600">Flags</dt>
          <dd className="min-w-0 break-words text-zinc-300">{getCutFlags(cut)}</dd>
          <dt className="uppercase tracking-[0.14em] text-zinc-600">ID</dt>
          <dd className="min-w-0 break-all font-mono text-[11px] text-zinc-400">{cut.id}</dd>
          {cut.assetUrl ? (
            <>
              <dt className="uppercase tracking-[0.14em] text-zinc-600">Asset</dt>
              <dd className="min-w-0 break-all font-mono text-[11px] text-zinc-400">{cut.assetUrl}</dd>
            </>
          ) : null}
        </dl>
      </div>
    </div>
  );
}

export function CutItem({
  cut,
  indentLevel = 0,
  rank,
  selected,
  onDelete,
  onCreateAfter,
  onCreateLoopVariant,
  onSelect,
  dragHandleProps,
  dragDisabled = false,
  createAfterDisabled = false,
  cardSize = 'normal'
}: {
  cut: Cut;
  cardSize?: CutCardSize;
  indentLevel?: number;
  rank: string;
  selected: boolean;
  onDelete: () => void;
  onCreateAfter: () => void;
  onCreateLoopVariant?: () => void;
  onSelect: () => void;
  dragHandleProps?: HTMLAttributes<HTMLButtonElement>;
  dragDisabled?: boolean;
  createAfterDisabled?: boolean;
}) {
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [detailPosition, setDetailPosition] = useState<DetailPosition | null>(null);
  const loopSummary = getLoopMetadataSummary(cut);
  const sizeStyles = CUT_CARD_SIZE_STYLES[cardSize];

  function clearHoverTimer() {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }

  function hideDetails() {
    clearHoverTimer();
    setDetailPosition(null);
  }

  function scheduleDetails() {
    clearHoverTimer();
    hoverTimerRef.current = setTimeout(() => {
      const card = cardRef.current;
      if (!card || typeof window === 'undefined') {
        return;
      }

      const rect = card.getBoundingClientRect();
      const popoverWidth = Math.min(352, Math.max(240, window.innerWidth - 24));
      const preferredLeft = rect.right + 12;
      const fallbackLeft = rect.left - popoverWidth - 12;
      const left =
        preferredLeft + popoverWidth <= window.innerWidth - 12
          ? preferredLeft
          : Math.max(12, fallbackLeft);
      const top = Math.max(12, Math.min(rect.top, window.innerHeight - 260));

      setDetailPosition({ left, top });
    }, 1000);
  }

  useEffect(() => () => clearHoverTimer(), []);

  return (
    <>
      <div
        ref={cardRef}
        className={[
          'group relative grid w-full grid-cols-[1.75rem_minmax(0,1fr)_7rem] gap-2 overflow-hidden rounded-xl border pr-2.5 transition',
          sizeStyles.frameClassName,
          selected
            ? 'border-editor-accent bg-[#2A2A30] text-white shadow-[0_0_0_1px_rgba(122,48,64,0.15)]'
            : 'border-transparent bg-[#222227] text-zinc-300 hover:border-editor-border hover:text-zinc-100'
        ].join(' ')}
        data-cut-id={cut.id}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            hideDetails();
          }
        }}
        onFocus={scheduleDetails}
        onMouseEnter={scheduleDetails}
        onMouseLeave={hideDetails}
        style={{ paddingLeft: 10 + indentLevel * 10 }}
      >
        <div className="flex h-full shrink-0 flex-col items-center gap-1">
          <button
            aria-label={`Drag ${cut.title}`}
            className={[
              'flex h-7 w-7 items-center justify-center rounded-md border border-editor-border bg-black/30 text-xs text-zinc-400 transition',
              dragDisabled ? 'cursor-default opacity-50' : 'hover:border-zinc-500 hover:text-zinc-100'
            ].join(' ')}
            disabled={dragDisabled}
            type="button"
            {...(dragHandleProps ?? {})}
          >
            ::
          </button>
          <button
            aria-label={`Add cut after ${cut.title}`}
            className={[
              'flex h-7 w-7 items-center justify-center rounded-md border text-sm font-semibold transition',
              createAfterDisabled
                ? 'cursor-not-allowed border-editor-border bg-black/20 text-zinc-600'
                : 'border-red-400/35 bg-red-500/10 text-red-200 hover:border-red-300/60 hover:bg-red-500/20 hover:text-red-100'
            ].join(' ')}
            disabled={createAfterDisabled}
            onClick={onCreateAfter}
            type="button"
          >
            +
          </button>
        </div>

        <button className="flex min-w-0 flex-col overflow-hidden text-left" onClick={onSelect} type="button">
          <div className="min-w-0 overflow-hidden">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span
                className="max-w-[4.5rem] shrink-0 truncate rounded-full border border-editor-border bg-black/25 px-2 py-0.5 text-[11px] font-semibold text-zinc-300"
                title={rank}
              >
                {rank}
              </span>
              <span className="rounded-full border border-zinc-700/70 bg-black/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                {cut.isStart ? 'start' : cut.isEnding ? 'ending' : 'cut'}
              </span>
            </div>

            <p className={['mt-1.5 break-words font-medium text-zinc-50', sizeStyles.titleClassName].join(' ')}>
              {cut.title}
            </p>

            {sizeStyles.showBody ? (
              <p className={['mt-1 break-words text-xs leading-5 text-zinc-500', sizeStyles.bodyClassName].join(' ')}>
                {getCutBodyPreview(cut)}
              </p>
            ) : null}
            {sizeStyles.showLoopSummary && loopSummary ? (
              <p className={['mt-1 break-words text-[11px] font-medium leading-4 text-lime-200/80', sizeStyles.loopClassName].join(' ')}>
                {loopSummary}
              </p>
            ) : null}
            {sizeStyles.showFlags ? (
              <p className="mt-1 truncate text-[11px] uppercase tracking-[0.14em] text-zinc-600">
                {getCutFlags(cut)}
              </p>
            ) : null}
          </div>
        </button>

        <div className="flex h-full min-w-0 flex-col justify-between overflow-hidden">
          <div className="flex min-w-0 items-start gap-1">
            <span
              className={[
                'min-w-0 flex-1 truncate rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em]',
                KIND_STYLES[cut.kind]
              ].join(' ')}
            >
              {cut.kind}
            </span>
            <button
              aria-label={`Delete ${cut.title}`}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-transparent text-zinc-500 opacity-0 transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-200 group-hover:opacity-100 focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40"
              onClick={onDelete}
              type="button"
            >
              <TrashIcon aria-hidden className="h-3.5 w-3.5" />
            </button>
          </div>

          {cut.loopMetadata?.role === 'stageBase' && onCreateLoopVariant ? (
            <button
              className="max-w-full truncate rounded-lg border border-teal-400/30 px-2 py-1 text-[11px] font-medium text-teal-100 transition hover:bg-teal-400/10"
              onClick={onCreateLoopVariant}
              type="button"
            >
              + 파생
            </button>
          ) : (
            <span className="h-7" aria-hidden />
          )}
        </div>
      </div>
      {detailPosition && typeof document !== 'undefined'
        ? createPortal(<CutDetailPopover cut={cut} position={detailPosition} rank={rank} />, document.body)
        : null}
    </>
  );
}

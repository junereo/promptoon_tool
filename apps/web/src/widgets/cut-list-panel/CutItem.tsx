import type { Cut } from '@promptoon/shared';
import type { HTMLAttributes } from 'react';
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
  createAfterDisabled = false
}: {
  cut: Cut;
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
  return (
    <div
      className={[
        'group relative flex w-full items-start gap-2 rounded-xl border py-2.5 pr-2.5 transition',
        selected
          ? 'border-editor-accent bg-[#2A2A30] text-white shadow-[0_0_0_1px_rgba(122,48,64,0.15)]'
          : 'border-transparent bg-[#222227] text-zinc-300 hover:border-editor-border hover:text-zinc-100'
      ].join(' ')}
      data-cut-id={cut.id}
      style={{ paddingLeft: 10 + indentLevel * 10 }}
    >
      <div className="mt-0.5 flex shrink-0 flex-col items-center gap-1">
        <button
          aria-label={`Drag ${cut.title}`}
          className={[
            'rounded-md border border-editor-border bg-black/30 px-2 py-0.5 text-xs text-zinc-400 transition',
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
            'flex h-6 w-6 items-center justify-center rounded-md border text-sm font-semibold transition',
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

      <span
        className="mt-0.5 max-w-[3.75rem] shrink-0 truncate rounded-full border border-editor-border bg-black/25 px-2 py-0.5 text-[11px] font-semibold text-zinc-300"
        title={rank}
      >
        {rank}
      </span>

      <button
        className="min-w-0 flex-1 pr-8 text-left"
        onClick={onSelect}
        type="button"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{cut.title}</p>
            <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{cut.body || 'No body yet.'}</p>
            {cut.loopMetadata?.kind === 'exitLoop' ? (
              <p className="mt-1 truncate text-[11px] font-medium text-lime-200/80">
                {cut.loopMetadata.groupLabel ?? cut.loopMetadata.groupId}
                {cut.loopMetadata.stageIndex ? ` · Stage ${cut.loopMetadata.stageIndex}` : ''}
                {cut.loopMetadata.role === 'stageBase'
                  ? ` · ${(cut.loopMetadata.variantCutIds ?? []).length} variant${(cut.loopMetadata.variantCutIds ?? []).length === 1 ? '' : 's'}`
                  : ''}
                {cut.loopMetadata.truth ? ` · ${cut.loopMetadata.truth}` : ''}
              </p>
            ) : null}
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
      </button>

      {cut.loopMetadata?.role === 'stageBase' && onCreateLoopVariant ? (
        <button
          className="mt-0.5 shrink-0 rounded-lg border border-teal-400/30 px-2 py-1 text-[11px] font-medium text-teal-100 transition hover:bg-teal-400/10"
          onClick={onCreateLoopVariant}
          type="button"
        >
          + 파생
        </button>
      ) : null}

      <button
        aria-label={`Delete ${cut.title}`}
        className="absolute right-1.5 top-2 flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-zinc-500 opacity-0 transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-200 group-hover:opacity-100 focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40"
        onClick={onDelete}
        type="button"
      >
        <TrashIcon aria-hidden className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

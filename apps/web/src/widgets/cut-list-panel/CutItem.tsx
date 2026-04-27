import type { Cut } from '@promptoon/shared';
import type { HTMLAttributes } from 'react';

const KIND_STYLES: Record<Cut['kind'], string> = {
  scene: 'border-zinc-700 bg-zinc-900/70 text-zinc-200',
  choice: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  ending: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  transition: 'border-sky-500/40 bg-sky-500/10 text-sky-200'
};

export function CutItem({
  cut,
  indentLevel = 0,
  rank,
  selected,
  onDelete,
  onCreateAfter,
  onSelect,
  dragHandleProps,
  dragDisabled = false
}: {
  cut: Cut;
  indentLevel?: number;
  rank: string;
  selected: boolean;
  onDelete: () => void;
  onCreateAfter: () => void;
  onSelect: () => void;
  dragHandleProps?: HTMLAttributes<HTMLButtonElement>;
  dragDisabled?: boolean;
}) {
  return (
    <div
      className={[
        'group relative flex items-start gap-3 rounded-2xl border px-3 py-3 transition',
        selected
          ? 'border-editor-accent bg-[#2A2A30] text-white shadow-[0_0_0_1px_rgba(122,48,64,0.15)]'
          : 'border-transparent bg-[#222227] text-zinc-300 hover:border-editor-border hover:text-zinc-100'
      ].join(' ')}
      data-cut-id={cut.id}
      style={{ marginLeft: indentLevel * 6 }}
    >
      <div className="mt-1 flex shrink-0 flex-col items-center gap-1.5">
        <button
          aria-label={`Drag ${cut.title}`}
          className={[
            'rounded-lg border border-editor-border bg-black/30 px-2 py-1 text-xs text-zinc-400 transition',
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
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-red-400/35 bg-red-500/10 text-sm font-semibold text-red-200 transition hover:border-red-300/60 hover:bg-red-500/20 hover:text-red-100"
          onClick={onCreateAfter}
          type="button"
        >
          +
        </button>
      </div>

      <span
        className="mt-1 max-w-[3.75rem] shrink-0 truncate rounded-full border border-editor-border bg-black/25 px-2 py-1 text-[11px] font-semibold text-zinc-300"
        title={rank}
      >
        {rank}
      </span>

      <button
        className="min-w-0 flex-1 pr-10 text-left"
        onClick={onSelect}
        type="button"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{cut.title}</p>
            <p className="mt-2 line-clamp-2 text-xs text-zinc-500">{cut.body || 'No body yet.'}</p>
          </div>
          <span
            className={[
              'shrink-0 rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.2em]',
              KIND_STYLES[cut.kind]
            ].join(' ')}
          >
            {cut.kind}
          </span>
        </div>
      </button>

      <button
        aria-label={`Delete ${cut.title}`}
        className="absolute right-2 top-3 rounded-lg px-2 py-1 text-xs text-zinc-500 opacity-0 transition hover:bg-red-500/10 hover:text-red-200 group-hover:opacity-100 focus:opacity-100"
        onClick={onDelete}
        type="button"
      >
        Delete
      </button>
    </div>
  );
}

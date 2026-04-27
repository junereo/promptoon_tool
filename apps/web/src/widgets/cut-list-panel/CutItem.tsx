import type { Cut } from '@promptoon/shared';
import type { HTMLAttributes } from 'react';

const KIND_STYLES: Record<Cut['kind'], string> = {
  scene: 'border-zinc-700 bg-zinc-900/70 text-zinc-200',
  choice: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  ending: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  transition: 'border-sky-500/40 bg-sky-500/10 text-sky-200'
};

function TrashIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M6 6l1 15h10l1-15" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

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
        'group relative flex items-start gap-2 rounded-xl border px-2.5 py-2.5 transition',
        selected
          ? 'border-editor-accent bg-[#2A2A30] text-white shadow-[0_0_0_1px_rgba(122,48,64,0.15)]'
          : 'border-transparent bg-[#222227] text-zinc-300 hover:border-editor-border hover:text-zinc-100'
      ].join(' ')}
      data-cut-id={cut.id}
      style={{ marginLeft: indentLevel * 6 }}
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
          className="flex h-6 w-6 items-center justify-center rounded-md border border-red-400/35 bg-red-500/10 text-sm font-semibold text-red-200 transition hover:border-red-300/60 hover:bg-red-500/20 hover:text-red-100"
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

      <button
        aria-label={`Delete ${cut.title}`}
        className="absolute right-1.5 top-2 flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-zinc-500 opacity-0 transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-200 group-hover:opacity-100 focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40"
        onClick={onDelete}
        type="button"
      >
        <TrashIcon />
      </button>
    </div>
  );
}

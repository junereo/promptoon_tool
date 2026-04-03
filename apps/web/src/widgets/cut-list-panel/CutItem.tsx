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
  selected,
  onDelete,
  onSelect,
  dragHandleProps
}: {
  cut: Cut;
  selected: boolean;
  onDelete: () => void;
  onSelect: () => void;
  dragHandleProps: HTMLAttributes<HTMLButtonElement>;
}) {
  return (
    <div
      className={[
        'group flex items-start gap-3 rounded-2xl border px-3 py-3 transition',
        selected
          ? 'border-editor-accent bg-[#2A2A30] text-white shadow-[0_0_0_1px_rgba(122,48,64,0.15)]'
          : 'border-transparent bg-[#222227] text-zinc-300 hover:border-editor-border hover:text-zinc-100'
      ].join(' ')}
      data-cut-id={cut.id}
    >
      <button
        aria-label={`Drag ${cut.title}`}
        className="mt-1 rounded-lg border border-editor-border bg-black/30 px-2 py-1 text-xs text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-100"
        type="button"
        {...dragHandleProps}
      >
        ::
      </button>

      <button
        className="min-w-0 flex-1 text-left"
        onClick={onSelect}
        type="button"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
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
        className="mt-1 rounded-lg px-2 py-1 text-xs text-zinc-500 opacity-0 transition hover:bg-red-500/10 hover:text-red-200 group-hover:opacity-100"
        onClick={onDelete}
        type="button"
      >
        Delete
      </button>
    </div>
  );
}

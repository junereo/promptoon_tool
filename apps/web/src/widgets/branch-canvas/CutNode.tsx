import type { Choice, Cut } from '@promptoon/shared';
import { Handle, Position, type NodeProps } from '@xyflow/react';

import type { CutFlowNode } from './graph-mapping';
import { getChoiceSourceHandleId, getCreateSourceHandleId, getCutTargetHandleId } from './graph-mapping';

const KIND_BADGE_STYLES: Record<Cut['kind'], string> = {
  scene: 'border-zinc-700 bg-zinc-900/80 text-zinc-200',
  choice: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  ending: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  transition: 'border-sky-500/40 bg-sky-500/10 text-sky-200'
};

function ChoiceHandle({
  choice,
  selected
}: {
  choice: Choice;
  selected: boolean;
}) {
  return (
    <div className="relative flex flex-col items-center gap-1">
      <span className="max-w-[72px] truncate text-[10px] text-zinc-500">{choice.label || 'Untitled'}</span>
      <Handle
        className={selected ? '!h-3.5 !w-3.5 !border-editor-accent !bg-editor-accent' : '!h-3 !w-3 !border-zinc-500 !bg-zinc-800'}
        data-testid={`source-handle-${choice.id}`}
        id={getChoiceSourceHandleId(choice.id)}
        position={Position.Bottom}
        style={{
          position: 'relative',
          left: 'auto',
          right: 'auto',
          top: 'auto',
          bottom: 'auto',
          transform: 'none'
        }}
        type="source"
      />
    </div>
  );
}

export function CutNode({ data }: NodeProps<CutFlowNode>) {
  const { cut, choicesForCut, selected, selectedChoiceId } = data;
  const canCreateOutput = !cut.isEnding;

  return (
    <div
      className={[
        'relative min-w-[220px] max-w-[260px] rounded-[28px] border px-4 pt-5 shadow-xl shadow-black/30 transition',
        canCreateOutput ? 'pb-16' : 'pb-6',
        selected
          ? 'border-editor-accent bg-[#232329] ring-1 ring-editor-accent/30'
          : 'border-editor-border bg-editor-panel/95'
      ].join(' ')}
      data-testid={`graph-node-${cut.id}`}
    >
      <div className="absolute left-1/2 top-0 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1">
        <Handle
          className={[
            '!h-3.5 !w-3.5 !border-2',
            selected ? '!border-editor-accent !bg-editor-accent' : '!border-sky-400/70 !bg-sky-500'
          ].join(' ')}
          data-testid={`target-handle-${cut.id}`}
          id={getCutTargetHandleId(cut.id)}
          position={Position.Top}
          type="target"
        />
        <span className="rounded-full border border-sky-400/25 bg-sky-500/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] text-sky-200">
          In
        </span>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-semibold text-zinc-50">{cut.title}</p>
          <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-zinc-400">
            {cut.body || 'No dialogue yet.'}
          </p>
        </div>
        <span
          className={[
            'shrink-0 rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.2em]',
            KIND_BADGE_STYLES[cut.kind]
          ].join(' ')}
        >
          {cut.kind}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-zinc-500">
        {cut.isStart ? <span className="rounded-full border border-editor-accent/30 px-2 py-1 text-editor-accentSoft">Start</span> : null}
        {cut.isEnding ? <span className="rounded-full border border-emerald-500/25 px-2 py-1 text-emerald-200">End</span> : null}
        <span className="rounded-full border border-editor-border px-2 py-1">#{cut.orderIndex + 1}</span>
      </div>

      {canCreateOutput ? (
        <div className="absolute bottom-3 left-3 right-3 flex flex-col items-center gap-2">
          <div className="flex w-full justify-evenly gap-2">
            <div className="relative flex flex-col items-center gap-1">
              <span className="max-w-[72px] truncate text-[10px] text-editor-accentSoft">New</span>
              <Handle
                className={selected ? '!h-3.5 !w-3.5 !border-editor-accent !bg-editor-accent/80' : '!h-3 !w-3 !border-editor-accent/70 !bg-editor-accent/50'}
                data-testid={`source-handle-new-${cut.id}`}
                id={getCreateSourceHandleId(cut.id)}
                position={Position.Bottom}
                style={{
                  position: 'relative',
                  left: 'auto',
                  right: 'auto',
                  top: 'auto',
                  bottom: 'auto',
                  transform: 'none'
                }}
                type="source"
              />
              <span className="text-[9px] uppercase tracking-[0.2em] text-zinc-500">(out)</span>
            </div>
            {choicesForCut.map((choice: Choice) => (
              <ChoiceHandle key={choice.id} choice={choice} selected={selectedChoiceId === choice.id} />
            ))}
          </div>
        </div>
      ) : (
        <div className="absolute bottom-3 left-3 right-3 flex justify-center">
          <span className="rounded-full border border-editor-border/60 bg-black/20 px-2 py-1 text-[9px] uppercase tracking-[0.2em] text-zinc-500">
            No outputs
          </span>
        </div>
      )}
    </div>
  );
}

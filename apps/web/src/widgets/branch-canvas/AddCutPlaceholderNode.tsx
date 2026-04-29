import type { NodeProps } from '@xyflow/react';

import type { AddCutPlaceholderFlowNode } from './graph-mapping';

export function AddCutPlaceholderNode({ data }: NodeProps<AddCutPlaceholderFlowNode>) {
  return (
    <div
      className="flex min-h-[150px] min-w-[220px] max-w-[260px] items-center justify-center rounded-[28px] border border-dashed border-editor-accent/45 bg-editor-accent/5 px-4 py-6 text-center shadow-xl shadow-black/20"
      data-testid={`graph-add-placeholder-${data.sourceCutId}`}
    >
      <button
        aria-label="Add linked cut"
        className="flex h-12 w-12 items-center justify-center rounded-full border border-editor-accent/50 bg-editor-accent text-2xl font-semibold leading-none text-white transition hover:bg-editor-accentSoft"
        data-testid={`graph-add-placeholder-button-${data.sourceCutId}`}
        onClick={(event) => {
          event.stopPropagation();
          data.onCreate(data.sourceCutId, data.position);
        }}
        type="button"
      >
        +
      </button>
    </div>
  );
}

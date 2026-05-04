import type { NodeProps } from '@xyflow/react';
import { memo } from 'react';

import type { CutGroupFlowNode } from './graph-mapping';
import type { GraphLayoutMode } from './graph-layout';

const LOCAL_LAYOUT_OPTIONS: Array<{ mode: GraphLayoutMode; label: string }> = [
  { mode: 'custom', label: 'Custom' },
  { mode: 'vertical', label: 'Vertical' },
  { mode: 'horizontal', label: 'Horizontal' }
];

export const GroupFrameNode = memo(function GroupFrameNode({ data }: NodeProps<CutGroupFlowNode>) {
  return (
    <div
      className="relative rounded-[20px] border border-lime-500/30 bg-lime-500/[0.045] shadow-[0_0_0_1px_rgba(163,230,53,0.08),0_24px_80px_rgba(0,0,0,0.22)]"
      data-testid={`graph-group-${data.groupId}`}
      style={{
        height: data.height,
        width: data.width
      }}
    >
      <div className="nodrag absolute left-3 right-3 top-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-lime-100">{data.label}</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-lime-200/55">{data.cutIds.length} cuts</p>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-full border border-lime-500/25 bg-black/35 p-1">
          {LOCAL_LAYOUT_OPTIONS.map((option) => (
            <button
              aria-label={`Local ${option.label} ${data.label}`}
              className={[
                'rounded-full px-2 py-0.5 text-[10px] font-medium transition',
                data.layoutMode === option.mode ? 'bg-lime-200 text-zinc-950' : 'text-lime-100/70 hover:text-lime-50'
              ].join(' ')}
              data-testid={`graph-group-${data.groupId}-layout-${option.mode}`}
              key={option.mode}
              onClick={() => data.onApplyLocalLayout(data.groupId, option.mode)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});

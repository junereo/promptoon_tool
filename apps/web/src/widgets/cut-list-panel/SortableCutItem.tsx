import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Cut } from '@promptoon/shared';

import { CutItem, type CutCardSize } from './CutItem';

export function SortableCutItem({
  cardSize,
  cut,
  indentLevel,
  rank,
  selected,
  onCreateAfter,
  onCreateLoopVariant,
  createAfterDisabled = false,
  dragDisabled = false,
  onDelete,
  onSelect
}: {
  cardSize?: CutCardSize;
  cut: Cut;
  createAfterDisabled?: boolean;
  dragDisabled?: boolean;
  indentLevel?: number;
  rank: string;
  selected: boolean;
  onCreateAfter: () => void;
  onCreateLoopVariant?: () => void;
  onDelete: () => void;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cut.id,
    disabled: dragDisabled
  });

  return (
    <div
      ref={(element) => {
        setNodeRef(element);
      }}
      style={{
        transform: CSS.Transform.toString(transform),
        transition
      }}
      className={isDragging ? 'opacity-75' : ''}
    >
      <CutItem
        cardSize={cardSize}
        cut={cut}
        createAfterDisabled={createAfterDisabled}
        dragDisabled={dragDisabled}
        dragHandleProps={{ ...attributes, ...listeners }}
        indentLevel={indentLevel}
        onCreateAfter={onCreateAfter}
        onCreateLoopVariant={onCreateLoopVariant}
        onDelete={onDelete}
        onSelect={onSelect}
        rank={rank}
        selected={selected}
      />
    </div>
  );
}

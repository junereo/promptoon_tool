import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Cut } from '@promptoon/shared';

import { CutItem } from './CutItem';

export function SortableCutItem({
  cut,
  indentLevel,
  rank,
  selected,
  onCreateAfter,
  onDelete,
  onSelect
}: {
  cut: Cut;
  indentLevel?: number;
  rank: string;
  selected: boolean;
  onCreateAfter: () => void;
  onDelete: () => void;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cut.id });

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
        cut={cut}
        dragHandleProps={{ ...attributes, ...listeners }}
        indentLevel={indentLevel}
        onCreateAfter={onCreateAfter}
        onDelete={onDelete}
        onSelect={onSelect}
        rank={rank}
        selected={selected}
      />
    </div>
  );
}

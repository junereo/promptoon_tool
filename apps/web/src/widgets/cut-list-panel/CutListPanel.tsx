import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Cut } from '@promptoon/shared';
import { useState } from 'react';

import { DeleteCutConfirmModal } from './DeleteCutConfirmModal';
import { SortableCutItem } from './SortableCutItem';

export function CutListPanel({
  cuts,
  selectedCutId,
  onCreateCut,
  onDeleteCut,
  onDragEnd,
  onSelectCut
}: {
  cuts: Cut[];
  selectedCutId: string | null;
  onCreateCut: () => void;
  onDeleteCut: (cutId: string) => Promise<void> | void;
  onDragEnd: (activeId: string, overId: string) => void;
  onSelectCut: (cutId: string) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5
      }
    })
  );
  const [pendingDeleteCut, setPendingDeleteCut] = useState<Cut | null>(null);
  const [isDeletePending, setIsDeletePending] = useState(false);

  function handleDragEnd(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) {
      return;
    }

    onDragEnd(String(event.active.id), String(event.over.id));
  }

  async function handleConfirmDelete() {
    if (!pendingDeleteCut || isDeletePending) {
      return;
    }

    setIsDeletePending(true);

    try {
      await onDeleteCut(pendingDeleteCut.id);
      setPendingDeleteCut(null);
    } catch {
      // Keep the modal open so the user can retry if deletion fails.
    } finally {
      setIsDeletePending(false);
    }
  }

  return (
    <>
      <section className="flex h-full flex-col rounded-[28px] border border-editor-border bg-editor-panel/85 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-display text-xl font-semibold text-zinc-50">Cut List</p>
            <p className="text-sm text-zinc-400">Drag to reorder. Select, delete, and build the episode flow.</p>
          </div>
          <button
            className="rounded-full bg-editor-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-editor-accentSoft"
            onClick={onCreateCut}
            type="button"
          >
            + Cut
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-editor-border bg-black/10 px-4 py-3 text-xs uppercase tracking-[0.24em] text-zinc-500">
          {cuts.length} cut{cuts.length === 1 ? '' : 's'}
        </div>

        <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
          {cuts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-editor-border p-6 text-sm text-zinc-500">
              No cuts yet. Create the first scene to start the episode flow.
            </div>
          ) : (
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <SortableContext items={cuts.map((cut) => cut.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {cuts.map((cut) => (
                    <SortableCutItem
                      key={cut.id}
                      cut={cut}
                      onDelete={() => setPendingDeleteCut(cut)}
                      onSelect={() => onSelectCut(cut.id)}
                      selected={selectedCutId === cut.id}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </section>
      <DeleteCutConfirmModal
        cut={pendingDeleteCut}
        isDeleting={isDeletePending}
        onCancel={() => {
          if (isDeletePending) {
            return;
          }

          setPendingDeleteCut(null);
        }}
        onConfirm={() => {
          void handleConfirmDelete();
        }}
      />
    </>
  );
}

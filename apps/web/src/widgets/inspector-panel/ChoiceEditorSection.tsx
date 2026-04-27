import type { Choice, Cut, PatchChoiceRequest } from '@promptoon/shared';
import { useEffect, useRef, useState } from 'react';

import { useDebounce } from '../../shared/lib/use-debounce';

function FieldLabel({ children }: { children: string }) {
  return <label className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">{children}</label>;
}

function inputClassName() {
  return 'mt-2 w-full rounded-2xl border border-editor-border bg-black/20 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-editor-accentSoft';
}

interface ChoiceRowState {
  label: string;
  nextCutId: string;
  afterSelectReactionText: string;
}

function toChoiceState(choice: Choice): ChoiceRowState {
  return {
    label: choice.label,
    nextCutId: choice.nextCutId ?? '',
    afterSelectReactionText: choice.afterSelectReactionText ?? ''
  };
}

function buildChoicePatch(choice: Choice, rowState: ChoiceRowState): PatchChoiceRequest | null {
  const patch: PatchChoiceRequest = {};

  if (rowState.label !== choice.label) {
    patch.label = rowState.label;
  }

  const nextCutId = rowState.nextCutId || null;
  if (nextCutId !== choice.nextCutId) {
    patch.nextCutId = nextCutId;
  }

  if (rowState.afterSelectReactionText !== (choice.afterSelectReactionText ?? '')) {
    patch.afterSelectReactionText = rowState.afterSelectReactionText;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

function ChoiceRow({
  choice,
  selected,
  availableCuts,
  onSelect,
  onQueuePatch,
  onDeleteChoice
}: {
  choice: Choice;
  selected: boolean;
  availableCuts: Cut[];
  onSelect: () => void;
  onQueuePatch: (choiceId: string, patch: PatchChoiceRequest) => void;
  onDeleteChoice: (choiceId: string) => void;
}) {
  const [rowState, setRowState] = useState<ChoiceRowState>(() => toChoiceState(choice));
  const queuePatchRef = useRef(onQueuePatch);
  const latestChoiceRef = useRef(choice);

  useEffect(() => {
    queuePatchRef.current = onQueuePatch;
  }, [onQueuePatch]);

  useEffect(() => {
    latestChoiceRef.current = choice;
    setRowState(toChoiceState(choice));
  }, [choice.id, choice.label, choice.nextCutId, choice.afterSelectReactionText]);

  const debouncedDraft = useDebounce(
    {
      choiceId: choice.id,
      rowState
    },
    500
  );
  useEffect(() => {
    if (debouncedDraft.choiceId !== choice.id) {
      return;
    }

    const patch = buildChoicePatch(latestChoiceRef.current, debouncedDraft.rowState);
    if (!patch) {
      return;
    }

    queuePatchRef.current(choice.id, patch);
  }, [choice.id, debouncedDraft]);

  return (
    <div
      className={[
        'min-w-0 shrink-0 overflow-hidden rounded-2xl border p-3 transition',
        selected ? 'border-editor-accentSoft bg-editor-accent/10' : 'border-editor-border bg-editor-panelAlt/50'
      ].join(' ')}
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <button className="min-w-0 shrink text-left" onClick={onSelect} type="button">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Choice</p>
        </button>
        <button
          className="shrink-0 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-200 transition hover:bg-red-500/20"
          onClick={() => onDeleteChoice(choice.id)}
          type="button"
        >
          Delete
        </button>
      </div>

      <div className="inspector-choice-grid mt-2 grid min-w-0 gap-2">
        <input
          className={inputClassName()}
          onChange={(event) => setRowState((current) => ({ ...current, label: event.target.value }))}
          type="text"
          value={rowState.label}
        />

        <div>
          <FieldLabel>Next Cut</FieldLabel>
          <select
            className={inputClassName()}
            onChange={(event) => setRowState((current) => ({ ...current, nextCutId: event.target.value }))}
            value={rowState.nextCutId}
          >
            <option value="">No target</option>
            {availableCuts.map((cut) => (
              <option key={cut.id} value={cut.id}>
                {cut.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3">
        <FieldLabel>Reaction Text</FieldLabel>
        <textarea
          className={`${inputClassName()} min-h-20 resize-y`}
          onChange={(event) => setRowState((current) => ({ ...current, afterSelectReactionText: event.target.value }))}
          value={rowState.afterSelectReactionText}
        />
      </div>
    </div>
  );
}

export function ChoiceEditorSection({
  cut,
  choices,
  selectedChoiceId,
  availableCuts,
  onSelectChoice,
  onCreateChoice,
  onQueueChoicePatch,
  onDeleteChoice
}: {
  cut: Cut;
  choices: Choice[];
  selectedChoiceId: string | null;
  availableCuts: Cut[];
  onSelectChoice: (choiceId: string) => void;
  onCreateChoice: (cutId: string) => void;
  onQueueChoicePatch: (choiceId: string, patch: PatchChoiceRequest) => void;
  onDeleteChoice: (choiceId: string) => void;
}) {
  return (
    <section className="inspector-card min-w-0 shrink-0 overflow-hidden rounded-[24px] border border-editor-border bg-black/10 p-4">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-zinc-100">Choices</p>
        </div>
        <button
          className="shrink-0 rounded-full bg-editor-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-editor-accentSoft"
          onClick={() => onCreateChoice(cut.id)}
          type="button"
        >
          + Choice
        </button>
      </div>

      <div className="mt-3 min-w-0 space-y-3">
        {choices.length === 0 ? (
          <p className="text-sm text-zinc-500">No choices yet for this cut.</p>
        ) : (
          choices.map((choice) => (
            <ChoiceRow
              key={choice.id}
              availableCuts={availableCuts}
              choice={choice}
              onDeleteChoice={onDeleteChoice}
              onQueuePatch={onQueueChoicePatch}
              onSelect={() => onSelectChoice(choice.id)}
              selected={selectedChoiceId === choice.id}
            />
          ))
        )}
      </div>
    </section>
  );
}

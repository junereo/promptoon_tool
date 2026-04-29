import type { Choice, ChoiceStateWrite, Cut, PatchChoiceRequest } from '@promptoon/shared';
import { useEffect, useRef, useState } from 'react';

import { useDebounce } from '../../shared/lib/use-debounce';

function FieldLabel({ children }: { children: string }) {
  return <label className="text-[11px] font-medium text-zinc-500">{children}</label>;
}

function inputClassName() {
  return 'w-full rounded-lg border border-editor-border bg-black/20 px-2.5 py-1.5 text-xs text-zinc-100 outline-none transition focus:border-editor-accentSoft';
}

function fieldClassName() {
  return 'grid min-w-0 gap-1';
}

interface ChoiceRowState {
  label: string;
  nextCutId: string;
  afterSelectReactionText: string;
  stateWrites: ChoiceStateWrite[];
}

function toChoiceState(choice: Choice): ChoiceRowState {
  return {
    label: choice.label,
    nextCutId: choice.nextCutId ?? '',
    afterSelectReactionText: choice.afterSelectReactionText ?? '',
    stateWrites: choice.stateWrites ?? []
  };
}

function serializeStateWrites(stateWrites: ChoiceStateWrite[]): string {
  return JSON.stringify(stateWrites);
}

function normalizeStateWrites(stateWrites: ChoiceStateWrite[]): ChoiceStateWrite[] {
  return stateWrites
    .map((stateWrite) => ({
      key: stateWrite.key.trim(),
      value: stateWrite.value.trim()
    }))
    .filter((stateWrite) => stateWrite.key.length > 0 && stateWrite.value.length > 0);
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

  const nextStateWrites = normalizeStateWrites(rowState.stateWrites);
  if (serializeStateWrites(nextStateWrites) !== serializeStateWrites(choice.stateWrites ?? [])) {
    patch.stateWrites = nextStateWrites;
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
  }, [choice.id, choice.label, choice.nextCutId, choice.afterSelectReactionText, choice.stateWrites]);

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
        'min-w-0 shrink-0 overflow-hidden rounded-xl border p-2.5 transition',
        selected ? 'border-editor-accentSoft bg-editor-accent/10' : 'border-editor-border bg-editor-panelAlt/50'
      ].join(' ')}
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-1.5">
        <button className="min-w-0 shrink text-left" onClick={onSelect} type="button">
          <p className="text-xs font-medium text-zinc-500">선택지</p>
        </button>
        <button
          className="shrink-0 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-200 transition hover:bg-red-500/20"
          onClick={() => onDeleteChoice(choice.id)}
          type="button"
        >
          삭제
        </button>
      </div>

      <div className="inspector-choice-grid mt-2 grid min-w-0 items-start gap-2">
        <div className={fieldClassName()}>
          <FieldLabel>선택 문구</FieldLabel>
          <input
            className={inputClassName()}
            onChange={(event) => setRowState((current) => ({ ...current, label: event.target.value }))}
            type="text"
            value={rowState.label}
          />
        </div>

        <div className={fieldClassName()}>
          <FieldLabel>다음 컷</FieldLabel>
          <select
            className={inputClassName()}
            onChange={(event) => setRowState((current) => ({ ...current, nextCutId: event.target.value }))}
            value={rowState.nextCutId}
          >
            <option value="">연결 안 함</option>
            {availableCuts.map((cut) => (
              <option key={cut.id} value={cut.id}>
                {cut.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={`${fieldClassName()} mt-2`}>
        <FieldLabel>선택 후 반응 문구</FieldLabel>
        <textarea
          className={`${inputClassName()} min-h-[3.25rem] resize-y`}
          onChange={(event) => setRowState((current) => ({ ...current, afterSelectReactionText: event.target.value }))}
          value={rowState.afterSelectReactionText}
        />
      </div>

      <div className="mt-2 rounded-xl border border-editor-border bg-black/10 p-2">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <FieldLabel>상태 저장</FieldLabel>
          <button
            className="shrink-0 rounded-lg border border-editor-border bg-black/20 px-2 py-1 text-[11px] font-medium text-zinc-200 transition hover:border-editor-accentSoft"
            onClick={() =>
              setRowState((current) => ({
                ...current,
                stateWrites: [...current.stateWrites, { key: '', value: '' }]
              }))
            }
            type="button"
          >
            + 추가
          </button>
        </div>

        <div className="mt-2 space-y-2">
          {rowState.stateWrites.length === 0 ? (
            <p className="text-xs text-zinc-500">선택 시 저장할 상태가 없습니다.</p>
          ) : (
            rowState.stateWrites.map((stateWrite, index) => (
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-1.5" key={`${index}:${stateWrite.key}`}>
                <input
                  aria-label="State key"
                  className={inputClassName()}
                  onChange={(event) =>
                    setRowState((current) => ({
                      ...current,
                      stateWrites: current.stateWrites.map((currentStateWrite, currentIndex) =>
                        currentIndex === index ? { ...currentStateWrite, key: event.target.value } : currentStateWrite
                      )
                    }))
                  }
                  placeholder="first_route"
                  type="text"
                  value={stateWrite.key}
                />
                <input
                  aria-label="State value"
                  className={inputClassName()}
                  onChange={(event) =>
                    setRowState((current) => ({
                      ...current,
                      stateWrites: current.stateWrites.map((currentStateWrite, currentIndex) =>
                        currentIndex === index ? { ...currentStateWrite, value: event.target.value } : currentStateWrite
                      )
                    }))
                  }
                  placeholder="A"
                  type="text"
                  value={stateWrite.value}
                />
                <button
                  aria-label="상태 저장 삭제"
                  className="rounded-lg border border-editor-border bg-black/20 px-2 text-xs text-zinc-300 transition hover:border-red-400/60 hover:text-red-200"
                  onClick={() =>
                    setRowState((current) => ({
                      ...current,
                      stateWrites: current.stateWrites.filter((_, currentIndex) => currentIndex !== index)
                    }))
                  }
                  type="button"
                >
                  삭제
                </button>
              </div>
            ))
          )}
        </div>
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
    <section className="inspector-card ml-auto w-[26rem] max-w-full min-w-0 shrink-0 overflow-hidden rounded-[16px] border border-editor-border bg-black/10 p-2.5">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-1.5">
        <div className="min-w-0">
          <p className="font-medium text-zinc-100">선택지</p>
        </div>
        <button
          className="shrink-0 rounded-lg bg-editor-accent px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-editor-accentSoft"
          onClick={() => onCreateChoice(cut.id)}
          type="button"
        >
          + 선택지
        </button>
      </div>

      <div className="mt-2 min-w-0 space-y-2">
        {choices.length === 0 ? (
          <p className="rounded-xl border border-dashed border-editor-border bg-black/10 px-3 py-2 text-xs text-zinc-500">이 컷에는 아직 선택지가 없습니다.</p>
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

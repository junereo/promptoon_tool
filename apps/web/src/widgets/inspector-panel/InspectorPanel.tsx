import type { Choice, Cut, PatchChoiceRequest, PatchCutRequest } from '@promptoon/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { getChoicesForCut } from '../../entities/promptoon/selectors';
import { ChoiceEditorSection } from './ChoiceEditorSection';
import { CutEditorForm } from './CutEditorForm';

function EmptyState() {
  return (
    <section className="flex h-full flex-col items-center justify-center rounded-[28px] border border-editor-border bg-editor-panel/85 p-6 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-full border border-editor-border bg-black/20 text-4xl text-zinc-500">
        P
      </div>
      <p className="mt-6 font-display text-2xl font-semibold text-zinc-100">Inspector Ready</p>
      <p className="mt-3 max-w-sm text-sm leading-7 text-zinc-400">
        좌측 리스트에서 컷을 선택하여 편집하세요. 선택된 컷의 속성과 분기를 여기서 관리합니다.
      </p>
    </section>
  );
}

function EmptyChoiceState() {
  return (
    <section className="rounded-[24px] border border-editor-border bg-black/10 p-4">
      <div>
        <p className="font-medium text-zinc-100">Branching</p>
        <p className="mt-2 text-sm leading-7 text-zinc-500">
          이 컷은 아직 선택지 편집이 필요하지 않습니다. 컷 종류를 바꾸거나 선택지를 추가하면 여기서 분기를 관리할 수 있습니다.
        </p>
      </div>
    </section>
  );
}

export function InspectorPanel({
  cuts,
  choices,
  selectedCut,
  selectedChoice,
  pendingAutosaveCount,
  onSelectChoice,
  onUpdateCut,
  onCommitCut,
  onUploadAsset,
  onDeleteCut,
  onCreateChoice,
  onUpdateChoice,
  onDeleteChoice
}: {
  cuts: Cut[];
  choices: Choice[];
  selectedCut: Cut | null;
  selectedChoice: Choice | null;
  pendingAutosaveCount: number;
  onSelectChoice: (choiceId: string) => void;
  onUpdateCut: (cutId: string, patch: PatchCutRequest) => void;
  onCommitCut: (cutId: string, patch: PatchCutRequest) => Promise<void>;
  onUploadAsset: (file: File) => Promise<string>;
  onDeleteCut: (cutId: string) => void;
  onCreateChoice: (cutId: string) => void;
  onUpdateChoice: (choiceId: string, patch: PatchChoiceRequest) => void;
  onDeleteChoice: (choiceId: string) => void;
}) {
  const [activeKind, setActiveKind] = useState<Cut['kind'] | null>(selectedCut?.kind ?? null);
  const [dialoguePositionPortalTarget, setDialoguePositionPortalTarget] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    setActiveKind(selectedCut?.kind ?? null);
  }, [selectedCut?.id, selectedCut?.kind]);

  const selectedCutChoices = useMemo(
    () => (selectedCut ? getChoicesForCut(choices, selectedCut.id) : []),
    [choices, selectedCut]
  );
  const availableCuts = useMemo(
    () => (selectedCut ? cuts.filter((cut) => cut.id !== selectedCut.id) : []),
    [cuts, selectedCut]
  );
  const showChoiceEditor = activeKind === 'scene' || activeKind === 'choice' || selectedCutChoices.length > 0;

  const handleKindPreviewChange = useCallback((kind: Cut['kind']) => {
    setActiveKind(kind);
  }, []);

  if (!selectedCut) {
    return <EmptyState />;
  }

  return (
    <section className="grid h-full min-h-0 gap-5 overflow-hidden rounded-[28px] border border-editor-border bg-editor-panel/85 p-5 xl:grid-cols-2">
      <div className="min-h-0 overflow-y-auto pr-1">
        <CutEditorForm
          cut={selectedCut}
          dialoguePositionPortalTarget={dialoguePositionPortalTarget}
          onCommitPatch={onCommitCut}
          onDeleteCut={onDeleteCut}
          onKindPreviewChange={handleKindPreviewChange}
          onQueuePatch={onUpdateCut}
          onUploadAsset={onUploadAsset}
          pendingAutosaveCount={pendingAutosaveCount}
        />
      </div>

      <div className="flex min-h-0 flex-col gap-5 overflow-y-auto pr-1">
        <div ref={setDialoguePositionPortalTarget} />
        {showChoiceEditor ? (
          <ChoiceEditorSection
            availableCuts={availableCuts}
            choices={selectedCutChoices}
            cut={selectedCut}
            onCreateChoice={onCreateChoice}
            onDeleteChoice={onDeleteChoice}
            onQueueChoicePatch={onUpdateChoice}
            onSelectChoice={onSelectChoice}
            selectedChoiceId={selectedChoice?.id ?? null}
          />
        ) : (
          <EmptyChoiceState />
        )}
      </div>
    </section>
  );
}

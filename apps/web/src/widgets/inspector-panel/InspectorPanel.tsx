import type { Choice, Cut, PatchChoiceRequest, PatchCutRequest } from '@promptoon/shared';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { getChoicesForCut } from '../../entities/promptoon/selectors';
import { ChoiceEditorSection } from './ChoiceEditorSection';
import { CutEditorForm } from './CutEditorForm';

function EmptyState() {
  return (
    <section className="flex h-full flex-col items-center justify-center rounded-[22px] border border-editor-border bg-editor-panel/85 p-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full border border-editor-border bg-black/20 text-xl font-semibold text-zinc-500">
        편집
      </div>
      <p className="mt-5 font-display text-xl font-semibold text-zinc-100">인스펙터 준비됨</p>
      <p className="mt-3 max-w-sm text-sm leading-7 text-zinc-400">
        좌측 리스트에서 컷을 선택하여 편집하세요. 선택된 컷의 속성과 분기를 여기서 관리합니다.
      </p>
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
  onDeleteChoice,
  graphPreview,
  viewMode = 'list'
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
  graphPreview?: ReactNode;
  viewMode?: 'list' | 'graph';
}) {
  const [activeKind, setActiveKind] = useState<Cut['kind'] | null>(selectedCut?.kind ?? null);
  const [contentBlocksPortalTarget, setContentBlocksPortalTarget] = useState<HTMLDivElement | null>(null);
  const [dialoguePositionPortalTarget, setDialoguePositionPortalTarget] = useState<HTMLDivElement | null>(null);
  const isGraphMode = viewMode === 'graph';

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
  const showChoiceEditor = activeKind === 'choice';

  const handleKindPreviewChange = useCallback((kind: Cut['kind']) => {
    setActiveKind(kind);
  }, []);

  if (!selectedCut) {
    return <EmptyState />;
  }

  const choiceEditor = showChoiceEditor ? (
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
  ) : null;
  const cutEditorForm = (
    <CutEditorForm
      contentBlocksPortalEnabled={!isGraphMode}
      contentBlocksPortalTarget={contentBlocksPortalTarget}
      cut={selectedCut}
      dialoguePositionPortalTarget={dialoguePositionPortalTarget}
      onCommitPatch={onCommitCut}
      onDeleteCut={onDeleteCut}
      onKindPreviewChange={handleKindPreviewChange}
      onQueuePatch={onUpdateCut}
      onUploadAsset={onUploadAsset}
      pendingAutosaveCount={pendingAutosaveCount}
    />
  );

  return (
    <section
      className={
        isGraphMode
          ? 'inspector-compact inspector-frame flex h-full max-h-full min-h-0 flex-col gap-0 overflow-hidden rounded-[16px] border border-editor-border bg-editor-panel/85 p-0'
          : 'inspector-compact inspector-frame inline-grid h-full max-h-full min-h-0 w-[52rem] max-w-full grid-cols-[26rem_26rem] items-start justify-self-end gap-0 overflow-hidden rounded-[16px] border border-editor-border bg-editor-panel/85 p-0'
      }
      data-inspector-layout={isGraphMode ? 'graph' : 'list'}
      data-testid="inspector-panel"
    >
      <div
        className={
          isGraphMode
            ? 'grid min-h-0 w-full flex-1 grid-cols-[minmax(0,1fr)_minmax(0,26rem)] items-stretch gap-0 overflow-hidden'
            : 'grid h-full min-h-0 w-[26rem] max-w-full justify-self-end content-start justify-items-end overflow-y-auto overscroll-contain'
        }
      >
        {isGraphMode && graphPreview ? (
          <div className="h-full min-h-0 w-full min-w-0 overflow-hidden" data-testid="graph-preview-frame">
            {graphPreview}
          </div>
        ) : null}
        {isGraphMode ? (
          <div className="h-full min-h-0 w-[26rem] max-w-full justify-self-end overflow-y-auto overscroll-contain">
            {cutEditorForm}
          </div>
        ) : (
          cutEditorForm
        )}
        {!isGraphMode ? choiceEditor : null}
      </div>

      <div className={isGraphMode ? 'flex max-h-[40%] min-h-0 w-full shrink-0 flex-col items-end gap-0 overflow-y-auto overscroll-contain' : 'flex h-full min-h-0 w-[26rem] max-w-full flex-col items-end gap-0 justify-self-end overflow-y-auto overscroll-contain'}>
        {!isGraphMode ? <div className="grid w-full justify-items-end" ref={setContentBlocksPortalTarget} /> : null}
        {isGraphMode ? choiceEditor : null}
        <div className="grid w-full justify-items-end" ref={setDialoguePositionPortalTarget} />
      </div>
    </section>
  );
}

import type {
  Choice,
  Cut,
  EditorSelection,
  PatchChoiceRequest,
  PatchCutRequest
} from '@promptoon/shared';

import { CutListPanel } from '../cut-list-panel/CutListPanel';
import { InspectorPanel } from '../inspector-panel/InspectorPanel';
import { BranchCanvas } from '../branch-canvas/BranchCanvas';
import { PreviewPlayer } from '../preview-phone-frame/PreviewPlayer';
import { EditorToolbar } from './EditorToolbar';

export function EpisodeEditorShell({
  activeTab,
  episodeStatus,
  episodeTitle,
  orderedCuts,
  choices,
  selectedCut,
  selectedChoice,
  previewCut,
  previewChoices,
  previewSelectedChoiceId,
  viewMode,
  isDirty,
  pendingAutosaveCount,
  lastPublishedVersion,
  isPublishing,
  isValidating,
  highlightSaveOrder,
  publishedViewerPath,
  toolbarNotice,
  onBack,
  onTabChange,
  selected,
  onSelectCut,
  onSelectChoice,
  onCreateCut,
  onPreviewSelectChoice,
  onPreviewSelectCut,
  onUpdateCut,
  onCommitCut,
  onUploadAsset,
  onMoveCut,
  onDeleteCut,
  onCreateChoice,
  onCreateChoiceConnection,
  onUpdateChoice,
  onConnectChoice,
  onDeleteChoice,
  onDragEnd,
  onSaveOrder,
  onValidate,
  onPublish,
  onToggleViewMode
}: {
  activeTab: 'editor' | 'analytics';
  episodeStatus: 'draft' | 'published';
  episodeTitle: string;
  orderedCuts: Cut[];
  choices: Choice[];
  selectedCut: Cut | null;
  selectedChoice: Choice | null;
  previewCut: Cut | null;
  previewChoices: Choice[];
  previewSelectedChoiceId: string | null;
  viewMode: 'list' | 'graph';
  isDirty: boolean;
  pendingAutosaveCount: number;
  lastPublishedVersion: number | null;
  isPublishing: boolean;
  isValidating: boolean;
  highlightSaveOrder: boolean;
  publishedViewerPath: string | null;
  toolbarNotice: string | null;
  onBack: () => void;
  onTabChange: (tab: 'editor' | 'analytics') => void;
  selected: EditorSelection;
  onSelectCut: (cutId: string) => void;
  onSelectChoice: (choiceId: string) => void;
  onPreviewSelectCut: (cutId: string) => void;
  onPreviewSelectChoice: (choiceId: string) => void;
  onCreateCut: () => void;
  onUpdateCut: (cutId: string, patch: PatchCutRequest) => void;
  onCommitCut: (cutId: string, patch: PatchCutRequest) => Promise<void>;
  onUploadAsset: (file: File) => Promise<string>;
  onMoveCut: (cutId: string, position: { x: number; y: number }) => void;
  onDeleteCut: (cutId: string) => Promise<void> | void;
  onCreateChoice: (cutId: string) => void;
  onCreateChoiceConnection: (cutId: string, targetCutId: string) => void;
  onUpdateChoice: (choiceId: string, patch: PatchChoiceRequest) => void;
  onConnectChoice: (choiceId: string, targetCutId: string) => void;
  onDeleteChoice: (choiceId: string) => void;
  onDragEnd: (activeId: string, overId: string) => void;
  onSaveOrder: () => void;
  onValidate: () => void;
  onPublish: () => void;
  onToggleViewMode: () => void;
}) {
  return (
    <main className="flex w-full flex-col gap-6 px-4 py-8 sm:px-6">
      <EditorToolbar
        activeTab={activeTab}
        episodeStatus={episodeStatus}
        episodeTitle={episodeTitle}
        highlightSaveOrder={highlightSaveOrder}
        isDirty={isDirty}
        lastPublishedVersion={lastPublishedVersion}
        isPublishing={isPublishing}
        isValidating={isValidating}
        onBack={onBack}
        onPublish={onPublish}
        onSaveOrder={onSaveOrder}
        onTabChange={onTabChange}
        onToggleViewMode={onToggleViewMode}
        onValidate={onValidate}
        publishedViewerPath={publishedViewerPath}
        toolbarNotice={toolbarNotice}
        viewMode={viewMode}
      />

      <section
        className={[
          'grid min-h-[780px] gap-6',
          viewMode === 'graph'
            ? 'items-start xl:grid-cols-[minmax(0,1fr)_420px]'
            : 'xl:grid-cols-[320px_minmax(240px,0.5fr)_minmax(760px,1fr)]'
        ].join(' ')}
      >
        {viewMode === 'list' ? (
          <CutListPanel
            cuts={orderedCuts}
            onCreateCut={onCreateCut}
            onDeleteCut={onDeleteCut}
            onDragEnd={onDragEnd}
            onSelectCut={onSelectCut}
            selectedCutId={selectedCut?.id ?? null}
          />
        ) : (
          <BranchCanvas
            choices={choices}
            cuts={orderedCuts}
            onCreateChoiceConnection={onCreateChoiceConnection}
            onConnectChoice={onConnectChoice}
            onMoveCut={onMoveCut}
            onSelectChoice={onSelectChoice}
            onSelectCut={onSelectCut}
            selected={selected}
          />
        )}
        {viewMode === 'list' ? (
          <PreviewPlayer
            choices={previewChoices}
            cut={previewCut}
            onSelectChoice={onPreviewSelectChoice}
            onSelectCut={onPreviewSelectCut}
            selectedChoiceId={previewSelectedChoiceId}
          />
        ) : null}
        <InspectorPanel
          cuts={orderedCuts}
          choices={choices}
          onCreateChoice={onCreateChoice}
          onCommitCut={onCommitCut}
          onDeleteChoice={onDeleteChoice}
          onDeleteCut={onDeleteCut}
          onSelectChoice={onSelectChoice}
          onUpdateChoice={onUpdateChoice}
          onUpdateCut={onUpdateCut}
          onUploadAsset={onUploadAsset}
          pendingAutosaveCount={pendingAutosaveCount}
          selectedChoice={selectedChoice}
          selectedCut={selectedCut}
        />
      </section>
    </main>
  );
}

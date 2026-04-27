import type {
  Choice,
  Cut,
  DeleteCutRequest,
  EditorSelection,
  PatchChoiceRequest,
  PatchCutRequest
} from '@promptoon/shared';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent
} from 'react';

import { CutListPanel, type CutListDragPayload } from '../cut-list-panel/CutListPanel';
import { InspectorPanel } from '../inspector-panel/InspectorPanel';
import { BranchCanvas } from '../branch-canvas/BranchCanvas';
import type { GraphLayoutMode } from '../branch-canvas/graph-layout';
import { PreviewPlayer } from '../preview-phone-frame/PreviewPlayer';
import { EditorToolbar } from './EditorToolbar';

const DEFAULT_GRAPH_INSPECTOR_PERCENT = 30;
const MIN_GRAPH_INSPECTOR_PERCENT = 24;
const MAX_GRAPH_INSPECTOR_PERCENT = 45;
const GRAPH_SPLIT_STEP_PERCENT = 2;

function clampGraphInspectorPercent(value: number): number {
  return Math.min(MAX_GRAPH_INSPECTOR_PERCENT, Math.max(MIN_GRAPH_INSPECTOR_PERCENT, value));
}

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
  graphLayoutMode,
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
  onApplyGraphLayout,
  onCreateLinkedCut,
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
  onOpenScriptEditor,
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
  graphLayoutMode: GraphLayoutMode;
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
  onCreateCut: (anchorCutId?: string) => void;
  onUpdateCut: (cutId: string, patch: PatchCutRequest) => void;
  onCommitCut: (cutId: string, patch: PatchCutRequest) => Promise<void>;
  onUploadAsset: (file: File) => Promise<string>;
  onApplyGraphLayout: (mode: GraphLayoutMode) => void;
  onCreateLinkedCut: (cutId: string, position: { x: number; y: number }) => void;
  onMoveCut: (cutId: string, position: { x: number; y: number }) => void;
  onDeleteCut: (cutId: string, payload?: DeleteCutRequest) => Promise<void> | void;
  onCreateChoice: (cutId: string) => void;
  onCreateChoiceConnection: (cutId: string, targetCutId: string) => void;
  onUpdateChoice: (choiceId: string, patch: PatchChoiceRequest) => void;
  onConnectChoice: (choiceId: string, targetCutId: string) => void;
  onDeleteChoice: (choiceId: string) => void;
  onDragEnd: (payload: CutListDragPayload) => void;
  onSaveOrder: () => void;
  onValidate: () => void;
  onPublish: () => void;
  onOpenScriptEditor: () => void;
  onToggleViewMode: () => void;
}) {
  const graphSplitFrameRef = useRef<HTMLDivElement | null>(null);
  const isDraggingGraphSplitRef = useRef(false);
  const [graphInspectorPercent, setGraphInspectorPercent] = useState(DEFAULT_GRAPH_INSPECTOR_PERCENT);

  const updateGraphInspectorPercentFromClientX = useCallback((clientX: number) => {
    const frame = graphSplitFrameRef.current;
    if (!frame) {
      return;
    }

    const frameRect = frame.getBoundingClientRect();
    if (frameRect.width <= 0) {
      return;
    }

    const nextInspectorPercent = ((frameRect.right - clientX) / frameRect.width) * 100;
    setGraphInspectorPercent(Math.round(clampGraphInspectorPercent(nextInspectorPercent)));
  }, []);

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      if (!isDraggingGraphSplitRef.current) {
        return;
      }

      event.preventDefault();
      updateGraphInspectorPercentFromClientX(event.clientX);
    }

    function handlePointerUp() {
      if (!isDraggingGraphSplitRef.current) {
        return;
      }

      isDraggingGraphSplitRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      isDraggingGraphSplitRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [updateGraphInspectorPercentFromClientX]);

  function handleGraphSplitPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    isDraggingGraphSplitRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    updateGraphInspectorPercentFromClientX(event.clientX);
  }

  function handleGraphSplitKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') {
      return;
    }

    event.preventDefault();

    if (event.key === 'Home') {
      setGraphInspectorPercent(DEFAULT_GRAPH_INSPECTOR_PERCENT);
      return;
    }

    if (event.key === 'End') {
      setGraphInspectorPercent(MAX_GRAPH_INSPECTOR_PERCENT);
      return;
    }

    setGraphInspectorPercent((current) =>
      clampGraphInspectorPercent(current + (event.key === 'ArrowLeft' ? GRAPH_SPLIT_STEP_PERCENT : -GRAPH_SPLIT_STEP_PERCENT))
    );
  }

  const graphSplitGridStyle = {
    gridTemplateColumns: `minmax(0, calc(${100 - graphInspectorPercent}% - 6px)) 12px minmax(300px, calc(${graphInspectorPercent}% - 6px))`
  };

  return (
    <main
      className={[
        'flex w-full flex-col px-3 sm:px-4 lg:px-5',
        viewMode === 'graph'
          ? 'h-[calc(100dvh-65px)] max-h-[calc(100dvh-65px)] min-h-0 gap-2 overflow-hidden py-2'
          : 'min-h-[calc(100dvh-64px)] gap-4 py-4'
      ].join(' ')}
    >
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
        onOpenScriptEditor={onOpenScriptEditor}
        onPublish={onPublish}
        onSaveOrder={onSaveOrder}
        onTabChange={onTabChange}
        onToggleViewMode={onToggleViewMode}
        onValidate={onValidate}
        publishedViewerPath={publishedViewerPath}
        toolbarNotice={toolbarNotice}
        viewMode={viewMode}
      />

      {viewMode === 'graph' ? (
        <section
          className="grid h-full min-h-0 flex-1 grid-rows-[minmax(0,1fr)] overflow-hidden"
          data-testid="graph-split-frame"
          ref={graphSplitFrameRef}
          style={graphSplitGridStyle}
        >
          <div className="h-full min-h-0 min-w-0 overflow-hidden" data-testid="graph-pane">
            <BranchCanvas
              choices={choices}
              cuts={orderedCuts}
              layoutMode={graphLayoutMode}
              onApplyLayout={onApplyGraphLayout}
              onCreateChoiceConnection={onCreateChoiceConnection}
              onCreateLinkedCut={onCreateLinkedCut}
              onConnectChoice={onConnectChoice}
              onDeleteChoice={onDeleteChoice}
              onMoveCut={onMoveCut}
              onSelectChoice={onSelectChoice}
              onSelectCut={onSelectCut}
              selected={selected}
            />
          </div>
          <div
            aria-label="Resize graph and inspector panels"
            aria-orientation="vertical"
            aria-valuemax={MAX_GRAPH_INSPECTOR_PERCENT}
            aria-valuemin={MIN_GRAPH_INSPECTOR_PERCENT}
            aria-valuenow={graphInspectorPercent}
            className="group flex cursor-col-resize items-stretch justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-editor-accentSoft"
            data-testid="graph-splitter"
            onKeyDown={handleGraphSplitKeyDown}
            onPointerDown={handleGraphSplitPointerDown}
            role="separator"
            tabIndex={0}
          >
            <span className="my-2 w-px rounded-full bg-editor-border transition group-hover:bg-editor-accentSoft group-focus-visible:bg-editor-accentSoft" />
          </div>
          <div className="h-full min-h-0 min-w-0 overflow-hidden" data-testid="graph-inspector-pane">
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
              viewMode={viewMode}
            />
          </div>
        </section>
      ) : (
        <section className="grid min-h-[640px] flex-1 gap-4 xl:grid-cols-[300px_minmax(220px,0.45fr)_minmax(560px,1fr)]">
          <CutListPanel
            choices={choices}
            cuts={orderedCuts}
            onCreateCut={onCreateCut}
            onDeleteCut={onDeleteCut}
            onDragEnd={onDragEnd}
            onSelectCut={onSelectCut}
            selectedCutId={selectedCut?.id ?? null}
          />
          <PreviewPlayer
            choices={previewChoices}
            cut={previewCut}
            onSelectChoice={onPreviewSelectChoice}
            onSelectCut={onPreviewSelectCut}
            selectedChoiceId={previewSelectedChoiceId}
          />
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
            viewMode={viewMode}
          />
        </section>
      )}
    </main>
  );
}

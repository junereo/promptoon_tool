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
import { getChoicesForCut } from '../../entities/promptoon/selectors';
import { InspectorPanel } from '../inspector-panel/InspectorPanel';
import { BranchCanvas } from '../branch-canvas/BranchCanvas';
import type { GraphLayoutMode } from '../branch-canvas/graph-layout';
import { LivePreviewModal } from '../preview-phone-frame/LivePreviewModal';
import { PreviewPlayer } from '../preview-phone-frame/PreviewPlayer';
import { EditorToolbar } from './EditorToolbar';

const DEFAULT_GRAPH_INSPECTOR_PERCENT = 30;
const MIN_GRAPH_INSPECTOR_PERCENT = 24;
const MAX_GRAPH_INSPECTOR_PERCENT = 45;
const GRAPH_SPLIT_STEP_PERCENT = 2;

function clampGraphInspectorPercent(value: number): number {
  return Math.min(MAX_GRAPH_INSPECTOR_PERCENT, Math.max(MIN_GRAPH_INSPECTOR_PERCENT, value));
}

function getNextPreviewCut(
  cuts: Cut[],
  currentCut: Cut | null,
  currentChoices: Choice[],
  selectedChoiceId: string | null
): Cut | null {
  if (!currentCut) {
    return null;
  }

  const cutById = new Map(cuts.map((cut) => [cut.id, cut]));
  const selectedLinkedChoice = selectedChoiceId
    ? currentChoices.find((choice) => choice.id === selectedChoiceId && choice.nextCutId && cutById.has(choice.nextCutId))
    : null;
  const nextChoice = selectedLinkedChoice ?? currentChoices.find((choice) => choice.nextCutId && cutById.has(choice.nextCutId));

  return nextChoice?.nextCutId ? cutById.get(nextChoice.nextCutId) ?? null : null;
}

function getPreviousPreview(
  cuts: Cut[],
  choices: Choice[],
  currentCut: Cut | null
): { cut: Cut; selectedChoiceId: string | null } | null {
  if (!currentCut) {
    return null;
  }

  const cutById = new Map(cuts.map((cut) => [cut.id, cut]));
  const cutOrder = new Map(cuts.map((cut, index) => [cut.id, index]));
  const incomingChoice = choices
    .filter((choice) => choice.nextCutId === currentCut.id && cutById.has(choice.cutId))
    .sort((left, right) => {
      const leftCutOrder = cutOrder.get(left.cutId) ?? Number.MAX_SAFE_INTEGER;
      const rightCutOrder = cutOrder.get(right.cutId) ?? Number.MAX_SAFE_INTEGER;
      return leftCutOrder - rightCutOrder || left.orderIndex - right.orderIndex || left.createdAt.localeCompare(right.createdAt);
    })[0];

  if (!incomingChoice) {
    return null;
  }

  const previousCut = cutById.get(incomingChoice.cutId);
  return previousCut ? { cut: previousCut, selectedChoiceId: incomingChoice.id } : null;
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
  const [isLivePreviewModalOpen, setIsLivePreviewModalOpen] = useState(false);

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

  useEffect(() => {
    if (viewMode !== 'list') {
      setIsLivePreviewModalOpen(false);
    }
  }, [viewMode]);

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
  const previousPreview = getPreviousPreview(orderedCuts, choices, previewCut);
  const previousPreviewCut = previousPreview?.cut ?? null;
  const previousPreviewChoices = previousPreviewCut ? getChoicesForCut(choices, previousPreviewCut.id) : [];
  const previousPreviewSelectedChoiceId =
    previousPreview?.selectedChoiceId && previousPreviewChoices.some((choice) => choice.id === previousPreview.selectedChoiceId)
      ? previousPreview.selectedChoiceId
      : null;
  const nextPreviewCut = getNextPreviewCut(orderedCuts, previewCut, previewChoices, previewSelectedChoiceId);
  const nextPreviewChoices = nextPreviewCut ? getChoicesForCut(choices, nextPreviewCut.id) : [];
  const currentPreviewSelectedChoiceId = previewChoices.some((choice) => choice.id === previewSelectedChoiceId)
    ? previewSelectedChoiceId
    : null;
  const nextPreviewSelectedChoiceId = nextPreviewChoices.some((choice) => choice.id === previewSelectedChoiceId)
    ? previewSelectedChoiceId
    : null;

  function handlePreviewNavigateCut(cutId: string) {
    onPreviewSelectCut(cutId);
    onSelectCut(cutId);
  }

  return (
    <main
      className={[
        'flex w-full flex-col px-3 sm:px-4 lg:px-5',
        viewMode === 'graph'
          ? 'h-[calc(100dvh-65px)] max-h-[calc(100dvh-65px)] min-h-0 gap-2 overflow-hidden py-2'
          : 'h-[calc(100dvh-65px)] max-h-[calc(100dvh-65px)] min-h-0 gap-2 overflow-hidden py-2'
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
              graphPreview={
                <PreviewPlayer
                  choices={previewChoices}
                  cut={previewCut}
                  framed={false}
                  nextCutId={nextPreviewCut?.id ?? null}
                  onNavigateCut={handlePreviewNavigateCut}
                  onSelectChoice={onPreviewSelectChoice}
                  onSelectCut={handlePreviewNavigateCut}
                  previousCutId={previousPreviewCut?.id ?? null}
                  selectedChoiceId={currentPreviewSelectedChoiceId}
                />
              }
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
        <section className="grid min-h-0 flex-1 gap-3 overflow-y-auto overscroll-contain xl:h-full xl:grid-cols-[340px_minmax(0,1fr)_max-content] xl:grid-rows-[minmax(0,1fr)] xl:overflow-hidden">
          <CutListPanel
            choices={choices}
            cuts={orderedCuts}
            onCreateCut={onCreateCut}
            onDeleteCut={onDeleteCut}
            onDragEnd={onDragEnd}
            onSelectCut={onSelectCut}
            selectedCutId={selectedCut?.id ?? null}
          />
          <div
            className="grid h-full min-h-0 min-w-0 max-w-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-0 overflow-hidden rounded-[18px] border border-editor-border bg-editor-panel/80"
            data-testid="preview-pair"
          >
            <div className="h-full min-h-0 min-w-0 overflow-hidden">
              <PreviewPlayer
                choices={previousPreviewChoices}
                cut={previousPreviewCut}
                framed={false}
                onSelectChoice={onPreviewSelectChoice}
                onSelectCut={onPreviewSelectCut}
                selectedChoiceId={previousPreviewSelectedChoiceId}
                title="Live Preview - privious cut"
              />
            </div>
            <div className="h-full min-h-0 min-w-0 overflow-hidden border-x border-editor-border">
              <PreviewPlayer
                choices={previewChoices}
                cut={previewCut}
                framed={false}
                nextCutId={nextPreviewCut?.id ?? null}
                onNavigateCut={handlePreviewNavigateCut}
                onSelectChoice={onPreviewSelectChoice}
                onSelectCut={onPreviewSelectCut}
                onTitleClick={() => setIsLivePreviewModalOpen(true)}
                previousCutId={previousPreviewCut?.id ?? null}
                selectedChoiceId={currentPreviewSelectedChoiceId}
              />
            </div>
            <div className="h-full min-h-0 min-w-0 overflow-hidden">
              <PreviewPlayer
                choices={nextPreviewChoices}
                cut={nextPreviewCut}
                framed={false}
                onSelectChoice={onPreviewSelectChoice}
                onSelectCut={onPreviewSelectCut}
                selectedChoiceId={nextPreviewSelectedChoiceId}
                title="Live Preview - next cut"
              />
            </div>
          </div>
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
      <LivePreviewModal
        currentChoices={previewChoices}
        currentCut={previewCut}
        isOpen={viewMode === 'list' && isLivePreviewModalOpen}
        nextChoices={nextPreviewChoices}
        nextCut={nextPreviewCut}
        onClose={() => setIsLivePreviewModalOpen(false)}
        previousChoices={previousPreviewChoices}
        previousCut={previousPreviewCut}
      />
    </main>
  );
}

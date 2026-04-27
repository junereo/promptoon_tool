import type {
  Cut,
  CreateChoiceRequest,
  CreateCutRequest,
  DeleteCutRequest,
  PatchChoiceRequest,
  PatchCutRequest,
  Publish,
  ValidateEpisodeResponse
} from '@promptoon/shared';
import { startTransition, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import {
  buildCutHierarchy,
  getChoicesForCut,
  getPreviewCut,
  getSelectedChoice,
  getSelectedCut,
  sortCutsByLocalOrder
} from '../entities/promptoon/selectors';
import { useEpisodeAnalytics } from '../features/analytics/hooks/use-episode-analytics';
import { useChoiceAutosave } from '../features/editor/hooks/use-choice-autosave';
import { useCutAutosave } from '../features/editor/hooks/use-cut-autosave';
import {
  useCreateChoice,
  useCreateCut,
  useDeleteChoice,
  useDeleteCut,
  useEpisodeDraft,
  useLatestPublishedEpisode,
  usePublishEpisode,
  useReorderCuts,
  useSaveCutLayout,
  useUnpublishEpisode,
  useUpdatePublishedEpisode,
  useUploadAsset,
  useUpdateChoice,
  useUpdateCut,
  useValidateEpisode
} from '../features/editor/hooks/use-episode-query';
import { useEditorStore } from '../features/editor/store/use-editor-store';
import { AnalyticsDashboard } from '../widgets/analytics-dashboard/AnalyticsDashboard';
import { EpisodeEditorShell } from '../widgets/episode-editor-shell/episode-editor-shell';
import { ScriptEditorModal } from '../widgets/episode-editor-shell/ScriptEditorModal';
import type { ScriptCutPatch } from '../shared/lib/script-sync';
import { PublishSuccessToast } from '../widgets/publish-flow/PublishSuccessToast';
import { ToolbarNoticeToast } from '../widgets/publish-flow/ToolbarNoticeToast';
import { ValidationModal } from '../widgets/publish-flow/ValidationModal';
import type { CutListDragPayload } from '../widgets/cut-list-panel/CutListPanel';
import {
  computeHorizontalLayout,
  computeVerticalLayout,
  getBranchEndCut,
  getGlobalCreatePosition,
  getLinkedCreatePosition,
  type GraphLayoutMode
} from '../widgets/branch-canvas/graph-layout';

function moveId(ids: string[], activeId: string, overId: string): string[] {
  const activeIndex = ids.indexOf(activeId);
  const overIndex = ids.indexOf(overId);

  if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) {
    return ids;
  }

  const nextIds = [...ids];
  const [active] = nextIds.splice(activeIndex, 1);
  nextIds.splice(overIndex, 0, active);
  return nextIds;
}

function insertAfter(ids: string[], anchorId: string | null, insertedId: string): string[] {
  const nextIds = ids.filter((id) => id !== insertedId);
  const anchorIndex = anchorId ? nextIds.indexOf(anchorId) : -1;
  nextIds.splice(anchorIndex === -1 ? nextIds.length : anchorIndex + 1, 0, insertedId);
  return nextIds;
}

function getServerCutOrder(cuts: Cut[]): string[] {
  return [...cuts]
    .sort((left, right) => left.orderIndex - right.orderIndex || left.createdAt.localeCompare(right.createdAt))
    .map((cut) => cut.id);
}

function hasOrderChanged(localCutOrder: string[], serverCuts: Cut[]): boolean {
  if (localCutOrder.length === 0) {
    return false;
  }

  const serverOrder = getServerCutOrder(serverCuts);
  return localCutOrder.length !== serverOrder.length || localCutOrder.some((cutId, index) => cutId !== serverOrder[index]);
}

export function PromptoonEpisodeEditorPage() {
  const { projectId, episodeId } = useParams();

  if (!projectId || !episodeId) {
    return (
      <main className="w-full px-4 py-16 sm:px-6">
        <div className="rounded-3xl border border-editor-border bg-editor-panel/80 p-8 text-zinc-300">
          Missing route params. Expected
          {' '}
          <code>/promptoon/projects/:projectId/episodes/:episodeId</code>.
        </div>
      </main>
    );
  }

  return <EpisodeEditorPageContent episodeId={episodeId} projectId={projectId} />;
}

function EpisodeEditorPageContent({ projectId, episodeId }: { projectId: string; episodeId: string }) {
  const navigate = useNavigate();
  const draftQuery = useEpisodeDraft(episodeId);
  const latestPublishedEpisodeQuery = useLatestPublishedEpisode(episodeId);
  const analyticsQuery = useEpisodeAnalytics(episodeId);
  const createCut = useCreateCut(episodeId);
  const deleteCut = useDeleteCut(episodeId);
  const createChoice = useCreateChoice(episodeId);
  const deleteChoice = useDeleteChoice(episodeId);
  const reorderCuts = useReorderCuts(episodeId);
  const saveCutLayout = useSaveCutLayout(episodeId);
  const uploadAsset = useUploadAsset();
  const updateCut = useUpdateCut(episodeId);
  const updateChoice = useUpdateChoice(episodeId);
  const validateEpisode = useValidateEpisode();
  const publishEpisode = usePublishEpisode();
  const updatePublishedEpisode = useUpdatePublishedEpisode();
  const unpublishEpisode = useUnpublishEpisode();
  const { queueCutPatch } = useCutAutosave(episodeId);
  const { queueChoicePatch } = useChoiceAutosave(episodeId);

  const selected = useEditorStore((state) => state.selected);
  const viewMode = useEditorStore((state) => state.viewMode);
  const isDirty = useEditorStore((state) => state.isDirty);
  const localCutOrder = useEditorStore((state) => state.localCutOrder);
  const pendingAutosaveIds = useEditorStore((state) => state.pendingAutosaveIds);
  const hydrateFromDraft = useEditorStore((state) => state.hydrateFromDraft);
  const resetForEpisode = useEditorStore((state) => state.resetForEpisode);
  const setSelected = useEditorStore((state) => state.setSelected);
  const setViewMode = useEditorStore((state) => state.setViewMode);
  const reorderLocalCuts = useEditorStore((state) => state.reorderLocalCuts);
  const clearDirty = useEditorStore((state) => state.clearDirty);
  const markDirty = useEditorStore((state) => state.markDirty);

  const [validationResult, setValidationResult] = useState<ValidateEpisodeResponse | null>(null);
  const [lastPublished, setLastPublished] = useState<Publish | null>(null);
  const [publishToast, setPublishToast] = useState<Publish | null>(null);
  const [toolbarNotice, setToolbarNotice] = useState<string | null>(null);
  const [isValidationOpen, setIsValidationOpen] = useState(false);
  const [highlightSaveOrder, setHighlightSaveOrder] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'analytics'>('editor');
  const [isScriptEditorOpen, setIsScriptEditorOpen] = useState(false);
  const [previewCutId, setPreviewCutId] = useState<string | null>(null);
  const [previewSelectedChoiceId, setPreviewSelectedChoiceId] = useState<string | null>(null);
  const [graphLayoutMode, setGraphLayoutMode] = useState<GraphLayoutMode>('custom');
  const [graphPositionDraft, setGraphPositionDraft] = useState<Record<string, { x: number; y: number }>>({});

  function handleTabChange(tab: 'editor' | 'analytics') {
    if (tab === activeTab) {
      return;
    }

    startTransition(() => {
      setActiveTab(tab);
    });
  }

  useEffect(() => {
    resetForEpisode();
    setValidationResult(null);
    setLastPublished(null);
    setPublishToast(null);
    setToolbarNotice(null);
    setIsValidationOpen(false);
    setHighlightSaveOrder(false);
    setActiveTab('editor');
    setIsScriptEditorOpen(false);
    setPreviewCutId(null);
    setPreviewSelectedChoiceId(null);
    setGraphLayoutMode('custom');
    setGraphPositionDraft({});
  }, [episodeId, resetForEpisode]);

  useEffect(() => {
    if (!toolbarNotice) {
      return;
    }

    const timer = window.setTimeout(() => {
      setToolbarNotice(null);
    }, 2200);

    return () => window.clearTimeout(timer);
  }, [toolbarNotice]);

  useEffect(() => {
    if (!highlightSaveOrder) {
      return;
    }

    const timer = window.setTimeout(() => {
      setHighlightSaveOrder(false);
    }, 550);

    return () => window.clearTimeout(timer);
  }, [highlightSaveOrder]);

  useEffect(() => {
    if (!publishToast) {
      return;
    }

    const timer = window.setTimeout(() => {
      setPublishToast(null);
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [publishToast]);

  useEffect(() => {
    if (!draftQuery.data) {
      return;
    }

    hydrateFromDraft(draftQuery.data);
    setGraphPositionDraft((currentDraft) => {
      const cutIds = new Set(draftQuery.data.cuts.map((cut) => cut.id));
      const nextDraft = Object.fromEntries(Object.entries(currentDraft).filter(([cutId]) => cutIds.has(cutId)));
      return Object.keys(nextDraft).length === Object.keys(currentDraft).length ? currentDraft : nextDraft;
    });

    const selectedCut = getSelectedCut(draftQuery.data.cuts, draftQuery.data.choices, selected);
    const selectedChoice = getSelectedChoice(draftQuery.data.choices, selected);
    const selectionStillValid = selected.type === 'cut' ? Boolean(selectedCut) : selected.type === 'choice' ? Boolean(selectedChoice) : false;

    if (!selectionStillValid) {
      const nextSelectionCut = draftQuery.data.cuts.find((cut) => cut.isStart) ?? draftQuery.data.cuts[0];
      if (nextSelectionCut) {
        setSelected({ type: 'cut', id: nextSelectionCut.id });
      }
    }
  }, [draftQuery.data, hydrateFromDraft, selected, setSelected]);

  const orderedCuts = draftQuery.data ? sortCutsByLocalOrder(draftQuery.data.cuts, localCutOrder) : [];
  const graphCuts = orderedCuts.map((cut) => {
    const draftPosition = graphPositionDraft[cut.id];
    return draftPosition
      ? {
          ...cut,
          positionX: draftPosition.x,
          positionY: draftPosition.y
        }
      : cut;
  });
  const cutHierarchy = draftQuery.data ? buildCutHierarchy(orderedCuts, draftQuery.data.choices) : null;
  const selectedCut = draftQuery.data ? getSelectedCut(draftQuery.data.cuts, draftQuery.data.choices, selected) : null;
  const selectedChoice = draftQuery.data ? getSelectedChoice(draftQuery.data.choices, selected) : null;
  const selectionPreviewCut = draftQuery.data ? getPreviewCut(orderedCuts, draftQuery.data.choices, selected) : null;
  const previewCut =
    draftQuery.data && previewCutId
      ? orderedCuts.find((cut) => cut.id === previewCutId) ?? selectionPreviewCut
      : selectionPreviewCut;
  const previewChoices = draftQuery.data && previewCut ? getChoicesForCut(draftQuery.data.choices, previewCut.id) : [];
  const pendingAutosaveCount = pendingAutosaveIds.cuts.length + pendingAutosaveIds.choices.length;
  const latestPublishedEpisode = latestPublishedEpisodeQuery.data;

  useEffect(() => {
    setPreviewCutId(selectionPreviewCut?.id ?? null);
    setPreviewSelectedChoiceId(null);
  }, [selectionPreviewCut?.id]);

  useEffect(() => {
    if (!previewCut) {
      setPreviewSelectedChoiceId(null);
      return;
    }

    if (previewSelectedChoiceId && !previewChoices.some((choice) => choice.id === previewSelectedChoiceId)) {
      setPreviewSelectedChoiceId(null);
    }
  }, [previewChoices, previewCut, previewSelectedChoiceId]);

  async function handleCreateCut(anchorCutId?: string) {
    const branchEndCut = draftQuery.data && anchorCutId ? getBranchEndCut(graphCuts, draftQuery.data.choices, anchorCutId) : null;
    const createPosition = draftQuery.data && anchorCutId
      ? getLinkedCreatePosition(graphCuts, draftQuery.data.choices, anchorCutId)
      : getGlobalCreatePosition(graphCuts);
    const payload: CreateCutRequest = {
      kind: 'scene',
      title: `Cut ${orderedCuts.length + 1}`,
      body: '',
      startEffect: 'none',
      endEffect: 'none',
      edgeFade: 'both',
      edgeFadeIntensity: 'minimal',
      positionX: createPosition.x,
      positionY: createPosition.y
    };

    const cut = await createCut.mutateAsync(payload);

    if (draftQuery.data) {
      const displayOrder = insertAfter(
        cutHierarchy?.flatNodes.map((node) => node.cut.id) ?? orderedCuts.map((orderedCut) => orderedCut.id),
        branchEndCut?.id ?? null,
        cut.id
      );
      const response = await reorderCuts.mutateAsync({
        cuts: displayOrder.map((cutId, index) => ({
          cutId,
          orderIndex: index
        }))
      });
      hydrateFromDraft({ cuts: response.cuts });
      if (Object.keys(graphPositionDraft).length === 0) {
        clearDirty();
      } else {
        markDirty(true);
      }
    }

    setSelected({ type: 'cut', id: cut.id });
  }

  async function handleDeleteCut(cutId: string, payload?: DeleteCutRequest) {
    const deletedIndex = orderedCuts.findIndex((cut) => cut.id === cutId);
    const nextCut =
      orderedCuts[deletedIndex + 1] ??
      orderedCuts[deletedIndex - 1] ??
      orderedCuts.find((cut) => cut.id !== cutId) ??
      null;

    await deleteCut.mutateAsync({ cutId, payload });

    if (selectedCut?.id === cutId) {
      setSelected(nextCut ? { type: 'cut', id: nextCut.id } : { type: 'none' });
    }
  }

  async function handleCreateChoice(cutId: string) {
    const existingChoices = draftQuery.data ? getChoicesForCut(draftQuery.data.choices, cutId) : [];
    const payload: CreateChoiceRequest = {
      label: `Choice ${existingChoices.length + 1}`
    };

    const choice = await createChoice.mutateAsync({ cutId, payload });
    setSelected({ type: 'choice', id: choice.id });
  }

  async function handleDeleteChoice(choiceId: string) {
    await deleteChoice.mutateAsync(choiceId);
    setSelected({ type: 'cut', id: selectedCut?.id ?? 'none' });
  }

  function handleUpdateCut(cutId: string, patch: PatchCutRequest) {
    queueCutPatch(cutId, patch);
  }

  function handleUpdateChoice(choiceId: string, patch: PatchChoiceRequest) {
    queueChoicePatch(choiceId, patch);
  }

  function handleApplyScriptPatches(patches: ScriptCutPatch[]) {
    patches.forEach(({ cutId, patch }) => {
      handleUpdateCut(cutId, patch);
    });

    setToolbarNotice(patches.length > 0 ? `${patches.length}개 컷의 스크립트를 적용했습니다` : '적용할 스크립트 변경사항이 없습니다');
  }

  async function handleUploadAsset(file: File) {
    const response = await uploadAsset.mutateAsync({ projectId, file });
    return response.assetUrl;
  }

  async function handleCommitCut(cutId: string, patch: PatchCutRequest) {
    await updateCut.mutateAsync({
      cutId,
      payload: patch
    });
  }

  function handleMoveCut(cutId: string, position: { x: number; y: number }) {
    setGraphLayoutMode('custom');
    setGraphPositionDraft((currentDraft) => ({
      ...currentDraft,
      [cutId]: position
    }));
    markDirty(true);
  }

  function handleApplyGraphLayout(mode: GraphLayoutMode) {
    setGraphLayoutMode(mode);

    if (!draftQuery.data || mode === 'custom') {
      return;
    }

    const nextPositions =
      mode === 'vertical'
        ? computeVerticalLayout(graphCuts, draftQuery.data.choices)
        : computeHorizontalLayout(graphCuts, draftQuery.data.choices);

    setGraphPositionDraft((currentDraft) => ({
      ...currentDraft,
      ...nextPositions
    }));
    markDirty(true);
  }

  function handleConnectChoice(choiceId: string, targetCutId: string) {
    updateChoice.mutate({
      choiceId,
      payload: {
        nextCutId: targetCutId
      }
    });
  }

  async function handleCreateChoiceConnection(cutId: string, targetCutId: string) {
    const existingChoices = draftQuery.data ? getChoicesForCut(draftQuery.data.choices, cutId) : [];
    const choice = await createChoice.mutateAsync({
      cutId,
      payload: {
        label: `Choice ${existingChoices.length + 1}`,
        nextCutId: targetCutId
      }
    });

    setSelected({ type: 'choice', id: choice.id });
  }

  async function handleCreateLinkedCut(cutId: string, position: { x: number; y: number }) {
    if (!draftQuery.data) {
      return;
    }

    const branchEndCut = getBranchEndCut(graphCuts, draftQuery.data.choices, cutId) ?? graphCuts.find((cut) => cut.id === cutId) ?? null;
    if (!branchEndCut || branchEndCut.isEnding) {
      setToolbarNotice('연결할 수 있는 마지막 컷을 선택해 주세요');
      return;
    }

    const payload: CreateCutRequest = {
      kind: 'scene',
      title: `Cut ${orderedCuts.length + 1}`,
      body: '',
      startEffect: 'none',
      endEffect: 'none',
      edgeFade: 'both',
      edgeFadeIntensity: 'minimal',
      positionX: position.x,
      positionY: position.y
    };
    const cut = await createCut.mutateAsync(payload);

    const displayOrder = insertAfter(
      cutHierarchy?.flatNodes.map((node) => node.cut.id) ?? orderedCuts.map((orderedCut) => orderedCut.id),
      branchEndCut.id,
      cut.id
    );
    const response = await reorderCuts.mutateAsync({
      cuts: displayOrder.map((displayCutId, index) => ({
        cutId: displayCutId,
        orderIndex: index
      }))
    });
    hydrateFromDraft({ cuts: response.cuts });

    const existingChoices = getChoicesForCut(draftQuery.data.choices, branchEndCut.id);
    await createChoice.mutateAsync({
      cutId: branchEndCut.id,
      payload: {
        label: `Choice ${existingChoices.length + 1}`,
        nextCutId: cut.id
      }
    });

    if (Object.keys(graphPositionDraft).length === 0) {
      clearDirty();
    } else {
      markDirty(true);
    }
    setSelected({ type: 'cut', id: cut.id });
  }

  function handleDragEnd(payload: CutListDragPayload) {
    reorderLocalCuts(payload.activeId, payload.overId);

    if (!payload.parentCutId || payload.siblingChoiceIds.length === 0) {
      return;
    }

    const reorderedSiblingCutIds = moveId(payload.siblingCutIds, payload.activeId, payload.overId);
    for (const cutId of reorderedSiblingCutIds) {
      const previousIndex = payload.siblingCutIds.indexOf(cutId);
      const choiceId = payload.siblingChoiceIds[previousIndex];
      if (choiceId) {
        updateChoice.mutate({
          choiceId,
          payload: {
            orderIndex: reorderedSiblingCutIds.indexOf(cutId)
          }
        });
      }
    }
  }

  function triggerDirtyGuard() {
    setToolbarNotice('먼저 변경사항을 저장해 주세요');
    setHighlightSaveOrder(true);
  }

  async function handleSaveOrder() {
    if (!draftQuery.data) {
      return;
    }

    const layoutCuts = orderedCuts
      .map((cut) => {
        const position = graphPositionDraft[cut.id];
        if (!position || (cut.positionX === position.x && cut.positionY === position.y)) {
          return null;
        }

        return {
          cutId: cut.id,
          positionX: position.x,
          positionY: position.y
        };
      })
      .filter((cut): cut is { cutId: string; positionX: number; positionY: number } => Boolean(cut));
    const shouldSaveOrder = hasOrderChanged(localCutOrder, draftQuery.data.cuts);
    const shouldSaveLayout = layoutCuts.length > 0;

    if (!shouldSaveOrder && !shouldSaveLayout) {
      clearDirty();
      return;
    }

    const previousOrder = [...localCutOrder];
    const previousGraphPositionDraft = graphPositionDraft;
    const hierarchyOrder = draftQuery.data ? buildCutHierarchy(orderedCuts, draftQuery.data.choices).flatNodes.map((node) => node.cut.id) : [];
    const payload = {
      cuts: hierarchyOrder.map((cutId, index) => ({
        cutId,
        orderIndex: index
      }))
    };
    let orderSaved = false;

    try {
      if (shouldSaveOrder) {
        const response = await reorderCuts.mutateAsync(payload);
        orderSaved = true;
        hydrateFromDraft({ cuts: response.cuts });
      }
      if (shouldSaveLayout) {
        await saveCutLayout.mutateAsync({ cuts: layoutCuts });
        setGraphPositionDraft({});
      }
      clearDirty();
    } catch {
      if (shouldSaveOrder && !orderSaved) {
        hydrateFromDraft({
          cuts: previousOrder
            .map((cutId) => draftQuery.data.cuts.find((cut) => cut.id === cutId))
            .filter((cut): cut is NonNullable<typeof cut> => Boolean(cut))
        });
      }
      setGraphPositionDraft(previousGraphPositionDraft);
      markDirty(true);
    }
  }

  async function handleValidate() {
    if (isDirty) {
      triggerDirtyGuard();
      return;
    }

    if (pendingAutosaveCount > 0) {
      setToolbarNotice('자동 저장이 끝날 때까지 잠시만 기다려 주세요');
      return;
    }

    const result = await validateEpisode.mutateAsync(episodeId);
    setValidationResult(result);
    setIsValidationOpen(true);
  }

  async function handlePublishRequest() {
    if (isDirty) {
      triggerDirtyGuard();
      return;
    }

    if (pendingAutosaveCount > 0) {
      setToolbarNotice('자동 저장이 끝날 때까지 잠시만 기다려 주세요');
      return;
    }

    const result = await validateEpisode.mutateAsync(episodeId);
    setValidationResult(result);
    setIsValidationOpen(true);
  }

  async function handlePublishConfirm() {
    const result =
      draftQuery.data?.episode.status === 'published'
        ? await updatePublishedEpisode.mutateAsync({ projectId, episodeId })
        : await publishEpisode.mutateAsync({ projectId, episodeId });
    setIsValidationOpen(false);
    setLastPublished(result);
    setPublishToast(result);
    setToolbarNotice(draftQuery.data?.episode.status === 'published' ? '발행본이 업데이트되었습니다' : null);
  }

  if (draftQuery.isLoading) {
    return (
      <main className="w-full px-4 py-16 sm:px-6">
        <div className="rounded-3xl border border-editor-border bg-editor-panel/80 p-8 text-zinc-300">
          Loading episode draft...
        </div>
      </main>
    );
  }

  if (draftQuery.isError || !draftQuery.data) {
    return (
      <main className="w-full px-4 py-16 sm:px-6">
        <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-8 text-red-100">
          Failed to load episode draft.
        </div>
      </main>
    );
  }

  if (activeTab === 'analytics') {
    return (
      <>
        <main className="flex w-full flex-col gap-6 px-4 py-8 sm:px-6">
          <section className="rounded-[32px] border border-editor-border bg-editor-panel/80 p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-start gap-4">
                <button
                  className="rounded-full border border-editor-border px-4 py-2 text-sm text-zinc-200 transition hover:border-zinc-500"
                  onClick={() => navigate('/promptoon/projects')}
                  type="button"
                >
                  Back to Dashboard
                </button>
                <div>
                  <p className="font-display text-3xl font-semibold tracking-tight text-zinc-50">{draftQuery.data.episode.title}</p>
                  <p className="mt-2 text-sm text-zinc-400">발행된 에피소드의 조회수, 완주율, 선택 비율을 확인합니다.</p>
                </div>
              </div>

              <div className="inline-flex rounded-full border border-editor-border bg-black/20 p-1">
                <button
                  className="rounded-full px-4 py-2 text-sm text-zinc-300 transition hover:text-white"
                  onClick={() => handleTabChange('editor')}
                  type="button"
                >
                  편집
                </button>
                <button
                  className="rounded-full bg-zinc-100 px-4 py-2 text-sm text-zinc-950 transition"
                  onClick={() => handleTabChange('analytics')}
                  type="button"
                >
                  분석
                </button>
              </div>
            </div>
          </section>

          <AnalyticsDashboard
            analytics={analyticsQuery.data ?? null}
            cuts={draftQuery.data.cuts}
            error={analyticsQuery.error instanceof Error ? analyticsQuery.error.message : undefined}
            isError={analyticsQuery.isError}
            isLoading={analyticsQuery.isLoading}
          />
        </main>
      </>
    );
  }

  return (
    <>
      <EpisodeEditorShell
        activeTab={activeTab}
        choices={draftQuery.data.choices}
        episodeStatus={draftQuery.data.episode.status}
        episodeTitle={draftQuery.data.episode.title}
        graphLayoutMode={graphLayoutMode}
        highlightSaveOrder={highlightSaveOrder}
        isDirty={isDirty}
        lastPublishedVersion={lastPublished?.versionNo ?? latestPublishedEpisode?.versionNo ?? null}
        isPublishing={publishEpisode.isPending || updatePublishedEpisode.isPending || unpublishEpisode.isPending}
        isValidating={validateEpisode.isPending}
        onBack={() => navigate('/promptoon/projects')}
        onTabChange={handleTabChange}
        onApplyGraphLayout={handleApplyGraphLayout}
        onCreateChoiceConnection={handleCreateChoiceConnection}
        onConnectChoice={handleConnectChoice}
        onCommitCut={handleCommitCut}
        onCreateChoice={handleCreateChoice}
        onCreateCut={handleCreateCut}
        onCreateLinkedCut={handleCreateLinkedCut}
        onDeleteChoice={handleDeleteChoice}
        onDeleteCut={handleDeleteCut}
        onDragEnd={handleDragEnd}
        onMoveCut={handleMoveCut}
        onOpenScriptEditor={() => setIsScriptEditorOpen(true)}
        onPublish={handlePublishRequest}
        onPreviewSelectChoice={(choiceId) => setPreviewSelectedChoiceId(choiceId)}
        onPreviewSelectCut={(cutId) => {
          setPreviewCutId(cutId);
          setPreviewSelectedChoiceId(null);
        }}
        onSaveOrder={handleSaveOrder}
        onSelectChoice={(choiceId) => setSelected({ type: 'choice', id: choiceId })}
        onSelectCut={(cutId) => setSelected({ type: 'cut', id: cutId })}
        selected={selected}
        onToggleViewMode={() => setViewMode(viewMode === 'list' ? 'graph' : 'list')}
        onUploadAsset={handleUploadAsset}
        onUpdateChoice={handleUpdateChoice}
        onUpdateCut={handleUpdateCut}
        onValidate={handleValidate}
        orderedCuts={viewMode === 'graph' ? graphCuts : orderedCuts}
        pendingAutosaveCount={pendingAutosaveCount}
        previewChoices={previewChoices}
        previewCut={previewCut}
        previewSelectedChoiceId={previewSelectedChoiceId}
        publishedViewerPath={lastPublished ? `/v/${lastPublished.id}` : latestPublishedEpisode ? `/v/${latestPublishedEpisode.id}` : null}
        selectedChoice={selectedChoice}
        selectedCut={selectedCut}
        toolbarNotice={toolbarNotice}
        viewMode={viewMode}
      />
      <ScriptEditorModal
        cuts={orderedCuts}
        isOpen={isScriptEditorOpen}
        onApply={handleApplyScriptPatches}
        onClose={() => setIsScriptEditorOpen(false)}
      />
      <ValidationModal
        isOpen={isValidationOpen}
        isPublishing={publishEpisode.isPending || updatePublishedEpisode.isPending}
        onClose={() => setIsValidationOpen(false)}
        onPublish={handlePublishConfirm}
        result={validationResult}
      />
      <PublishSuccessToast onClose={() => setPublishToast(null)} publish={publishToast} />
      <ToolbarNoticeToast message={toolbarNotice} />
    </>
  );
}

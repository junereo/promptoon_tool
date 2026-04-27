import type {
  Choice,
  Cut,
  EditorSelection
} from '@promptoon/shared';
import { DEFAULT_CUT_EFFECT_DURATION_MS } from '@promptoon/shared';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getChoiceSourceHandleId,
  getCreateSourceHandleId,
  getCutTargetHandleId,
  isValidGraphConnection,
  mapChoicesToFlowEdges,
  mapCutsToFlowNodes
} from '../src/widgets/branch-canvas/graph-mapping';
import {
  computeHorizontalLayout,
  computeVerticalLayout,
  getBranchEndCut,
  getGlobalCreatePosition,
  GRAPH_NODE_HORIZONTAL_GAP,
  GRAPH_NODE_VERTICAL_GAP
} from '../src/widgets/branch-canvas/graph-layout';
import { BranchCanvas } from '../src/widgets/branch-canvas/BranchCanvas';
import { EpisodeEditorShell } from '../src/widgets/episode-editor-shell/episode-editor-shell';

afterEach(() => {
  cleanup();
});

function buildCut(id: string, overrides?: Partial<Cut>): Cut {
  return {
    id,
    episodeId: 'episode-1',
    kind: 'scene',
    title: `Cut ${id}`,
    body: 'Body',
    contentBlocks: [],
    dialogAnchorX: 'left',
    dialogAnchorY: 'bottom',
    dialogOffsetX: 0,
    dialogOffsetY: 0,
    dialogTextAlign: 'left',
    startEffect: 'none',
    endEffect: 'none',
    startEffectDurationMs: DEFAULT_CUT_EFFECT_DURATION_MS,
    endEffectDurationMs: DEFAULT_CUT_EFFECT_DURATION_MS,
    assetUrl: null,
    positionX: 0,
    positionY: 100,
    orderIndex: 0,
    isStart: false,
    isEnding: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

function buildChoice(id: string, cutId: string, overrides?: Partial<Choice>): Choice {
  return {
    id,
    cutId,
    label: `Choice ${id}`,
    orderIndex: 0,
    nextCutId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

describe('branch graph mapping', () => {
  it('computes graph creation and layout positions', () => {
    const startCut = buildCut('cut-1', { isStart: true, positionX: 0, positionY: 0 });
    const middleCut = buildCut('cut-2', { positionX: 1000, positionY: 2000, orderIndex: 1 });
    const endingCut = buildCut('cut-3', { positionX: 400, positionY: 300, orderIndex: 2 });
    const choices = [
      buildChoice('choice-1', startCut.id, { nextCutId: middleCut.id }),
      buildChoice('choice-2', middleCut.id, { nextCutId: endingCut.id })
    ];

    expect(getGlobalCreatePosition([])).toEqual({ x: 0, y: 0 });
    expect(getGlobalCreatePosition([startCut, middleCut, endingCut])).toEqual({ x: 1010, y: 2010 });
    expect(getBranchEndCut([startCut, middleCut, endingCut], choices, startCut.id)?.id).toBe(endingCut.id);

    const verticalLayout = computeVerticalLayout([startCut, middleCut, endingCut], choices);
    expect(verticalLayout[startCut.id]).toMatchObject({ y: 0 });
    expect(verticalLayout[middleCut.id]).toMatchObject({ y: GRAPH_NODE_VERTICAL_GAP });
    expect(verticalLayout[endingCut.id]).toMatchObject({ y: GRAPH_NODE_VERTICAL_GAP * 2 });

    const horizontalLayout = computeHorizontalLayout([startCut, middleCut, endingCut], choices);
    expect(horizontalLayout[startCut.id]).toMatchObject({ x: 0 });
    expect(horizontalLayout[middleCut.id]).toMatchObject({ x: GRAPH_NODE_HORIZONTAL_GAP });
    expect(horizontalLayout[endingCut.id]).toMatchObject({ x: GRAPH_NODE_HORIZONTAL_GAP * 2 });
  });

  it('maps cuts to graph nodes with selected zIndex and choice data', () => {
    const cuts = [buildCut('cut-1', { isStart: true }), buildCut('cut-2', { kind: 'ending', positionX: 240 })];
    const choices = [buildChoice('choice-1', 'cut-1', { nextCutId: 'cut-2' })];
    const selection: EditorSelection = { type: 'choice', id: 'choice-1' };

    const nodes = mapCutsToFlowNodes(cuts, choices, selection);

    expect(nodes).toHaveLength(2);
    expect(nodes[0]?.id).toBe('cut-1');
    expect(nodes[0]?.zIndex).toBe(1000);
    expect(nodes[0]?.data.choicesForCut).toHaveLength(1);
    expect(nodes[1]?.position).toEqual({ x: 240, y: 100 });
  });

  it('maps only connected choices to graph edges and highlights selected choice', () => {
    const choices = [
      buildChoice('choice-1', 'cut-1', { nextCutId: 'cut-2' }),
      buildChoice('choice-2', 'cut-1')
    ];

    const edges = mapChoicesToFlowEdges(choices, { type: 'choice', id: 'choice-1' });

    expect(edges).toHaveLength(1);
    expect(edges[0]?.id).toBe('edge-choice-1');
    expect(edges[0]?.sourceHandle).toBe(getChoiceSourceHandleId('choice-1'));
    expect(edges[0]?.targetHandle).toBe(getCutTargetHandleId('cut-2'));
    expect(edges[0]?.style).toMatchObject({ stroke: '#7A3040' });
  });

  it('accepts only source-to-target graph connections', () => {
    expect(
      isValidGraphConnection({
        source: 'cut-1',
        sourceHandle: getChoiceSourceHandleId('choice-1'),
        target: 'cut-2',
        targetHandle: getCutTargetHandleId('cut-2')
      })
    ).toBe(true);

    expect(
      isValidGraphConnection({
        source: 'cut-1',
        sourceHandle: getCreateSourceHandleId('cut-1'),
        target: 'cut-2',
        targetHandle: getCutTargetHandleId('cut-2')
      })
    ).toBe(true);

    expect(
      isValidGraphConnection({
        source: 'cut-1',
        sourceHandle: getChoiceSourceHandleId('choice-1'),
        target: 'cut-2',
        targetHandle: getChoiceSourceHandleId('choice-2')
      })
    ).toBe(false);

    expect(
      isValidGraphConnection({
        source: 'cut-1',
        sourceHandle: getCutTargetHandleId('cut-1'),
        target: 'cut-2',
        targetHandle: getCutTargetHandleId('cut-2')
      })
    ).toBe(false);
  });
});

describe('BranchCanvas', () => {
  it('renders branch graph nodes and routes node selection', () => {
    const onSelectCut = vi.fn();
    const choiceCut = buildCut('cut-1', { kind: 'choice', isStart: true, title: 'Branch Cut' });
    const endingCut = buildCut('cut-2', { kind: 'ending', isEnding: true, title: 'Ending' });
    const choices = [
      buildChoice('choice-1', choiceCut.id, { label: 'Left', nextCutId: endingCut.id }),
      buildChoice('choice-2', choiceCut.id, { label: 'Right' })
    ];

    render(
      <div style={{ height: 700, width: 1200 }}>
        <BranchCanvas
          choices={choices}
          cuts={[choiceCut, endingCut]}
          layoutMode="custom"
          onApplyLayout={vi.fn()}
          onCreateChoiceConnection={vi.fn()}
          onCreateLinkedCut={vi.fn()}
          onConnectChoice={vi.fn()}
          onMoveCut={vi.fn()}
          onSelectChoice={vi.fn()}
          onSelectCut={onSelectCut}
          selected={{ type: 'choice', id: 'choice-2' }}
        />
      </div>
    );

    fireEvent.click(screen.getByTestId('graph-node-cut-1'));

    expect(screen.getByText('Branch Graph')).toBeTruthy();
    expect(screen.getByRole('button', { name: /zoom in/i })).toBeTruthy();
    expect(screen.getByTestId('source-handle-new-cut-1')).toBeTruthy();
    expect(screen.getByTestId('source-handle-choice-1')).toBeTruthy();
    expect(screen.getByTestId('source-handle-choice-2')).toBeTruthy();
    expect(screen.queryByTestId('source-handle-cut-2')).toBeNull();
    expect(screen.queryByTestId('graph-add-placeholder-cut-2')).toBeNull();
    expect(onSelectCut).toHaveBeenCalledWith('cut-1');
  });

  it('shows one placeholder under the selected branch end and routes add clicks', () => {
    const onCreateLinkedCut = vi.fn();
    const startCut = buildCut('cut-1', { isStart: true, positionX: 0, positionY: 0 });
    const middleCut = buildCut('cut-2', { positionX: 300, positionY: 400, orderIndex: 1 });
    const choices = [buildChoice('choice-1', startCut.id, { nextCutId: middleCut.id })];

    render(
      <div style={{ height: 700, width: 1200 }}>
        <BranchCanvas
          choices={choices}
          cuts={[startCut, middleCut]}
          layoutMode="custom"
          onApplyLayout={vi.fn()}
          onCreateChoiceConnection={vi.fn()}
          onCreateLinkedCut={onCreateLinkedCut}
          onConnectChoice={vi.fn()}
          onMoveCut={vi.fn()}
          onSelectChoice={vi.fn()}
          onSelectCut={vi.fn()}
          selected={{ type: 'cut', id: startCut.id }}
        />
      </div>
    );

    expect(screen.queryByTestId('graph-add-placeholder-cut-1')).toBeNull();
    fireEvent.click(screen.getByTestId('graph-add-placeholder-button-cut-2'));

    expect(onCreateLinkedCut).toHaveBeenCalledWith('cut-2', {
      x: middleCut.positionX,
      y: middleCut.positionY + GRAPH_NODE_VERTICAL_GAP
    });
  });

  it('routes layout mode button clicks', () => {
    const onApplyLayout = vi.fn();
    const cut = buildCut('cut-1', { isStart: true });

    render(
      <div style={{ height: 700, width: 1200 }}>
        <BranchCanvas
          choices={[]}
          cuts={[cut]}
          layoutMode="custom"
          onApplyLayout={onApplyLayout}
          onCreateChoiceConnection={vi.fn()}
          onCreateLinkedCut={vi.fn()}
          onConnectChoice={vi.fn()}
          onMoveCut={vi.fn()}
          onSelectChoice={vi.fn()}
          onSelectCut={vi.fn()}
          selected={{ type: 'cut', id: cut.id }}
        />
      </div>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Vertical' }));
    fireEvent.click(screen.getByRole('button', { name: 'Horizontal' }));
    fireEvent.click(screen.getByRole('button', { name: 'Custom' }));

    expect(onApplyLayout).toHaveBeenNthCalledWith(1, 'vertical');
    expect(onApplyLayout).toHaveBeenNthCalledWith(2, 'horizontal');
    expect(onApplyLayout).toHaveBeenNthCalledWith(3, 'custom');
  });
});

describe('EpisodeEditorShell graph mode', () => {
  it('renders previous, current, and linked next cut previews in list mode', () => {
    const previousCut = buildCut('cut-0', {
      contentBlocks: [
        {
          id: 'previous-flow',
          type: 'narration',
          text: 'Previous cut preview body',
          textAlign: 'left',
          fontToken: 'sans-kr',
          placement: 'flow'
        }
      ]
    });
    const cut = buildCut('cut-1', { isStart: true, kind: 'choice', title: 'Branch Cut' });
    const nextCut = buildCut('cut-2', {
      orderIndex: 1,
      contentBlocks: [
        {
          id: 'next-flow',
          type: 'narration',
          text: 'Next cut preview body',
          textAlign: 'left',
          fontToken: 'sans-kr',
          placement: 'flow'
        }
      ]
    });
    const previousChoice = buildChoice('choice-0', previousCut.id, { nextCutId: cut.id });
    const choice = buildChoice('choice-1', cut.id, { nextCutId: nextCut.id });
    const onPreviewSelectCut = vi.fn();
    const onSelectCut = vi.fn();

    render(
      <EpisodeEditorShell
        activeTab="editor"
        choices={[previousChoice, choice]}
        episodeStatus="draft"
        episodeTitle="Episode 1"
        graphLayoutMode="custom"
        highlightSaveOrder={false}
        isDirty={false}
        isPublishing={false}
        isValidating={false}
        lastPublishedVersion={null}
        onApplyGraphLayout={vi.fn()}
        onBack={vi.fn()}
        onCreateChoiceConnection={vi.fn()}
        onCreateLinkedCut={vi.fn()}
        onConnectChoice={vi.fn()}
        onCommitCut={vi.fn().mockResolvedValue(undefined)}
        onCreateChoice={vi.fn()}
        onCreateCut={vi.fn()}
        onDeleteChoice={vi.fn()}
        onDeleteCut={vi.fn()}
        onDragEnd={vi.fn()}
        onMoveCut={vi.fn()}
        onOpenScriptEditor={vi.fn()}
        onPreviewSelectChoice={vi.fn()}
        onPreviewSelectCut={onPreviewSelectCut}
        onPublish={vi.fn()}
        onSaveOrder={vi.fn()}
        onSelectChoice={vi.fn()}
        onSelectCut={onSelectCut}
        onTabChange={vi.fn()}
        onToggleViewMode={vi.fn()}
        onUploadAsset={vi.fn().mockResolvedValue('')}
        onUpdateChoice={vi.fn()}
        onUpdateCut={vi.fn()}
        onValidate={vi.fn()}
        orderedCuts={[previousCut, cut, nextCut]}
        pendingAutosaveCount={0}
        previewChoices={[choice]}
        previewCut={cut}
        previewSelectedChoiceId={null}
        publishedViewerPath={null}
        selected={{ type: 'cut', id: cut.id }}
        selectedChoice={null}
        selectedCut={cut}
        toolbarNotice={null}
        viewMode="list"
      />
    );

    expect(screen.getByTestId('preview-pair').className).toContain('grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]');
    expect(screen.getByTestId('preview-pair').className).toContain('border-editor-border');
    expect(screen.getByTestId('preview-pair').children[1]?.className).toContain('border-x');
    expect(screen.getByText('Live Preview - privious cut')).toBeTruthy();
    expect(screen.getByText('Live Preview')).toBeTruthy();
    expect(screen.getByText('Live Preview - next cut')).toBeTruthy();
    expect(screen.getByText('Previous cut preview body')).toBeTruthy();
    expect(screen.getByText('Next cut preview body')).toBeTruthy();
    expect(screen.queryByText('Dynamic phone-frame preview synced with the current editor selection.')).toBeNull();
    expect(screen.queryByText('연결된 이전 컷이 없습니다.')).toBeNull();
    expect(screen.queryByText('다음 컷 연결 프리뷰입니다.')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Live Preview' }));
    const modal = screen.getByRole('dialog', { name: 'Live Preview' });
    expect(modal.className).toContain('rounded-[28px]');
    expect(modal.className).toContain('border');
    const deviceSelect = within(modal).getByLabelText('디바이스 선택') as HTMLSelectElement;
    expect(deviceSelect.value).toBe('iphone-15');
    expect(within(modal).getByTestId('live-preview-viewer-frame')).toBeTruthy();
    expect(within(modal).getByTestId('live-preview-viewer-scroll').className).toContain('overflow-y-auto');
    fireEvent.change(deviceSelect, { target: { value: 'galaxy-s24' } });
    expect(deviceSelect.value).toBe('galaxy-s24');
    expect(within(modal).getByText(/Galaxy S24 · 360 x 780 CSS px · DPR 3 · 1080 x 2340 physical/)).toBeTruthy();
    expect(within(modal).getByTestId('live-preview-viewer-frame').getAttribute('style')).toContain('width: 360px');
    expect(within(modal).getByTestId('live-preview-viewer-frame').getAttribute('style')).toContain('height: 780px');
    fireEvent.change(deviceSelect, { target: { value: 'desktop' } });
    expect(deviceSelect.value).toBe('desktop');
    expect(within(modal).getByTestId('live-preview-viewer-frame').getAttribute('style')).toContain('width: 1440px');
    expect(within(modal).getByTestId('live-preview-viewer-frame').getAttribute('style')).toContain('height: 900px');
    expect(within(modal).queryByText('Live Preview - privious cut')).toBeNull();
    expect(within(modal).queryByText('Live Preview - next cut')).toBeNull();
    expect(within(modal).getAllByText('Previous cut preview body').length).toBeGreaterThan(0);
    expect(within(modal).getAllByText('Next cut preview body').length).toBeGreaterThan(0);
    fireEvent.click(within(modal).getByRole('button', { name: '닫기' }));
    expect(screen.queryByTestId('live-preview-modal')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '이전 컷으로 이동' }));
    expect(onPreviewSelectCut).toHaveBeenCalledWith(previousCut.id);
    expect(onSelectCut).toHaveBeenCalledWith(previousCut.id);

    fireEvent.click(screen.getByRole('button', { name: '다음 컷으로 이동' }));
    expect(onPreviewSelectCut).toHaveBeenCalledWith(nextCut.id);
    expect(onSelectCut).toHaveBeenCalledWith(nextCut.id);
  });

  it('hides the cut list and places live preview beside inspector controls when graph mode is active', async () => {
    const cut = buildCut('cut-1', { isStart: true, kind: 'choice', title: 'Branch Cut' });
    const choice = buildChoice('choice-1', cut.id, { nextCutId: 'cut-1' });

    render(
      <EpisodeEditorShell
        choices={[choice]}
        episodeTitle="Episode 1"
        graphLayoutMode="custom"
        highlightSaveOrder={false}
        isDirty={false}
        isPublishing={false}
        isValidating={false}
        onApplyGraphLayout={vi.fn()}
        onBack={vi.fn()}
        onCreateChoiceConnection={vi.fn()}
        onCreateLinkedCut={vi.fn()}
        onConnectChoice={vi.fn()}
        onCommitCut={vi.fn().mockResolvedValue(undefined)}
        onCreateChoice={vi.fn()}
        onCreateCut={vi.fn()}
        onDeleteChoice={vi.fn()}
        onDeleteCut={vi.fn()}
        onDragEnd={vi.fn()}
        onMoveCut={vi.fn()}
        onOpenScriptEditor={vi.fn()}
        onPublish={vi.fn()}
        onSaveOrder={vi.fn()}
        onSelectChoice={vi.fn()}
        onSelectCut={vi.fn()}
        onToggleViewMode={vi.fn()}
        onUploadAsset={vi.fn().mockResolvedValue('')}
        onUpdateChoice={vi.fn()}
        onUpdateCut={vi.fn()}
        onValidate={vi.fn()}
        orderedCuts={[cut]}
        pendingAutosaveCount={0}
        previewChoices={[choice]}
        previewCut={cut}
        selected={{ type: 'cut', id: cut.id }}
        selectedChoice={null}
        selectedCut={cut}
        toolbarNotice={null}
        viewMode="graph"
      />
    );

    expect(screen.queryByText('Cut List')).toBeNull();
    expect(screen.getByText('Live Preview')).toBeTruthy();
    expect(screen.getByText('Branch Graph')).toBeTruthy();

    expect(screen.getByTestId('graph-split-frame').getAttribute('style')).toContain('70%');
    expect(screen.getByTestId('graph-split-frame').getAttribute('style')).toContain('30%');

    const graphSplitter = screen.getByTestId('graph-splitter');
    expect(graphSplitter.getAttribute('aria-valuenow')).toBe('30');
    fireEvent.keyDown(graphSplitter, { key: 'ArrowLeft' });
    expect(graphSplitter.getAttribute('aria-valuenow')).toBe('32');
    expect(screen.getByTestId('graph-split-frame').getAttribute('style')).toContain('68%');
    expect(screen.getByTestId('graph-split-frame').getAttribute('style')).toContain('32%');

    const inspectorPanel = screen.getByTestId('inspector-panel');
    expect(inspectorPanel.getAttribute('data-inspector-layout')).toBe('graph');
    expect(inspectorPanel.className).not.toContain('xl:grid-cols-2');

    await waitFor(() => {
      const choicesTitle = screen.getAllByText('선택지')[0];
      const dialoguePositionTitle = screen.getByText('대사 위치');
      expect(Boolean(choicesTitle.compareDocumentPosition(dialoguePositionTitle) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    });
  });
});

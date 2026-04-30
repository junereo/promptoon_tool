import type { Choice, Cut, EditorSelection } from '@promptoon/shared';
import {
  Background,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useNodesState,
  type Connection,
  type Edge,
  type NodeTypes,
  type NodeMouseHandler
} from '@xyflow/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AddCutPlaceholderNode } from './AddCutPlaceholderNode';
import { CutNode } from './CutNode';
import {
  getLinkedCreatePosition,
  getSelectedBranchEndCut,
  type GraphLayoutMode
} from './graph-layout';
import {
  isValidGraphConnection,
  mapChoicesToFlowEdges,
  mapCutsToFlowNodes,
  parseSourceHandle,
  type BranchFlowNode,
  type AddCutPlaceholderFlowNode
} from './graph-mapping';
import { isPromptoonEndingCut } from '../../shared/lib/promptoon-ending';

const nodeTypes = {
  cutNode: CutNode,
  addCutPlaceholderNode: AddCutPlaceholderNode
} as NodeTypes;

function buildFlowNodes(
  cuts: Cut[],
  choices: Choice[],
  selected: EditorSelection,
  multiSelectedCutIds: Set<string>,
  onCreateLinkedCut: (sourceCutId: string, position: { x: number; y: number }) => void
): BranchFlowNode[] {
  const cutNodes = mapCutsToFlowNodes(cuts, choices, selected, multiSelectedCutIds);
  const branchEndCut = getSelectedBranchEndCut(cuts, choices, selected);

  if (
    !branchEndCut ||
    isPromptoonEndingCut(branchEndCut) ||
    branchEndCut.kind === 'stateRouter' ||
    branchEndCut.kind === 'loopVariant' ||
    branchEndCut.kind === 'loopSpacer'
  ) {
    return cutNodes;
  }

  const position = getLinkedCreatePosition(cuts, choices, branchEndCut.id);
  const placeholderNode: AddCutPlaceholderFlowNode = {
    id: `add-placeholder-${branchEndCut.id}`,
    type: 'addCutPlaceholderNode',
    position,
    data: {
      sourceCutId: branchEndCut.id,
      position,
      onCreate: onCreateLinkedCut
    },
    draggable: false,
    selectable: false,
    zIndex: 500
  };

  return [...cutNodes, placeholderNode];
}

export function shouldAutoFitGraph(previousCutIds: string[] | null, currentCutIds: string[]) {
  if (currentCutIds.length === 0) {
    return false;
  }

  if (!previousCutIds) {
    return true;
  }

  return currentCutIds.length > previousCutIds.length;
}

function BranchCanvasInner({
  choices,
  onCreateChoiceConnection,
  onCreateLinkedCut,
  onDeleteCuts,
  onOpenLoopStateSetting,
  cuts,
  layoutMode,
  onConnectChoice,
  onConnectStateFallback,
  onConnectStateRoute,
  onDeleteChoice,
  onApplyLayout,
  onMoveCut,
  onSelectChoice,
  onSelectCut,
  selected
}: {
  choices: Choice[];
  onCreateChoiceConnection: (cutId: string, targetCutId: string) => void;
  onCreateLinkedCut: (cutId: string, position: { x: number; y: number }) => void;
  onDeleteCuts: (cutIds: string[]) => void | Promise<void>;
  onOpenLoopStateSetting: (anchorCutId?: string) => void;
  cuts: Cut[];
  layoutMode: GraphLayoutMode;
  onConnectChoice: (choiceId: string, targetCutId: string) => void;
  onConnectStateFallback: (cutId: string, targetCutId: string) => void;
  onConnectStateRoute: (cutId: string, stateRouteId: string, targetCutId: string) => void;
  onDeleteChoice: (choiceId: string) => void;
  onApplyLayout: (mode: GraphLayoutMode) => void;
  onMoveCut: (cutId: string, position: { x: number; y: number }) => void;
  onSelectChoice: (choiceId: string) => void;
  onSelectCut: (cutId: string) => void;
  selected: EditorSelection;
}) {
  const { fitView } = useReactFlow();
  const [multiSelectedCutIds, setMultiSelectedCutIds] = useState<Set<string>>(() => new Set());
  const [nodes, setNodes, onNodesChange] = useNodesState<BranchFlowNode>(
    buildFlowNodes(cuts, choices, selected, multiSelectedCutIds, onCreateLinkedCut)
  );
  const edges = mapChoicesToFlowEdges(choices, selected, cuts);
  const autoFitCutIds = useMemo(() => cuts.map((cut) => cut.id), [cuts]);
  const selectedCutId = selected.type === 'cut' ? selected.id : undefined;
  const multiSelectedCutCount = multiSelectedCutIds.size;
  const leftShiftPressedRef = useRef(false);
  const previousAutoFitCutIdsRef = useRef<string[] | null>(null);
  const canvasFrameRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setNodes(buildFlowNodes(cuts, choices, selected, multiSelectedCutIds, onCreateLinkedCut));
  }, [choices, cuts, multiSelectedCutIds, onCreateLinkedCut, selected, setNodes]);

  useEffect(() => {
    const cutIds = new Set(cuts.map((cut) => cut.id));
    setMultiSelectedCutIds((current) => {
      const next = new Set([...current].filter((cutId) => cutIds.has(cutId)));
      return next.size === current.size ? current : next;
    });
  }, [cuts]);

  const deleteMultiSelectedCuts = useCallback(async () => {
    if (multiSelectedCutIds.size === 0) {
      return;
    }

    const orderedCutIds = cuts.map((cut) => cut.id).filter((cutId) => multiSelectedCutIds.has(cutId));
    if (orderedCutIds.length === 0) {
      setMultiSelectedCutIds(new Set());
      return;
    }

    const confirmed = typeof window === 'undefined' ? true : window.confirm(`${orderedCutIds.length}개 컷을 삭제할까요?`);
    if (!confirmed) {
      return;
    }

    setMultiSelectedCutIds(new Set());
    await onDeleteCuts(orderedCutIds);
  }, [cuts, multiSelectedCutIds, onDeleteCuts]);

  useEffect(() => {
    function isEditableTarget(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Shift' && (event.code === 'ShiftLeft' || event.location === KeyboardEvent.DOM_KEY_LOCATION_LEFT)) {
        leftShiftPressedRef.current = true;
      }

      if (event.key !== 'Delete' || isEditableTarget(event.target)) {
        return;
      }

      if (multiSelectedCutIds.size > 0) {
        event.preventDefault();
        void deleteMultiSelectedCuts();
        return;
      }

      if (selected.type !== 'choice') {
        return;
      }

      event.preventDefault();
      onDeleteChoice(selected.id);
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.key === 'Shift' && (event.code === 'ShiftLeft' || event.location === KeyboardEvent.DOM_KEY_LOCATION_LEFT)) {
        leftShiftPressedRef.current = false;
      }
    }

    function handleBlur() {
      leftShiftPressedRef.current = false;
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [deleteMultiSelectedCuts, multiSelectedCutIds.size, onDeleteChoice, selected]);

  useEffect(() => {
    const previousCutIds = previousAutoFitCutIdsRef.current;
    previousAutoFitCutIdsRef.current = autoFitCutIds;

    if (!shouldAutoFitGraph(previousCutIds, autoFitCutIds)) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      void fitView({
        duration: 280,
        maxZoom: 1.2,
        minZoom: 0.45,
        padding: 0.08
      });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [autoFitCutIds, fitView]);

  function handleConnect(connection: Connection) {
    if (!isValidGraphConnection(connection)) {
      return;
    }

    const sourceHandle = parseSourceHandle(connection.sourceHandle);
    if (!sourceHandle) {
      return;
    }

    if (sourceHandle.kind === 'create') {
      onCreateChoiceConnection(sourceHandle.cutId, connection.target);
      return;
    }

    if (sourceHandle.kind === 'choice') {
      onConnectChoice(sourceHandle.choiceId, connection.target);
      return;
    }

    if (sourceHandle.kind === 'stateRoute') {
      onConnectStateRoute(sourceHandle.cutId, sourceHandle.stateRouteId, connection.target);
      return;
    }

    onConnectStateFallback(sourceHandle.cutId, connection.target);
  }

  const handleNodeClick: NodeMouseHandler<BranchFlowNode> = (event, node) => {
    if (node.type !== 'cutNode') {
      return;
    }

    if (leftShiftPressedRef.current || event.shiftKey) {
      setMultiSelectedCutIds((current) => {
        const next = new Set(current);
        if (next.has(node.id)) {
          next.delete(node.id);
        } else {
          next.add(node.id);
        }

        return next;
      });
      onSelectCut(node.id);
      canvasFrameRef.current?.focus();
      return;
    }

    setMultiSelectedCutIds(new Set());
    onSelectCut(node.id);
    canvasFrameRef.current?.focus();
  };

  function handleEdgeClick(_event: React.MouseEvent, edge: Edge) {
    if (!edge.id.startsWith('edge-')) {
      onSelectCut(edge.source);
      canvasFrameRef.current?.focus();
      return;
    }

    const choiceId = edge.id.replace(/^edge-/, '');
    onSelectChoice(choiceId);
    canvasFrameRef.current?.focus();
  }

  function handleNodeDragStop(_event: React.MouseEvent, node: BranchFlowNode) {
    if (node.type !== 'cutNode') {
      return;
    }

    onMoveCut(node.id, node.position);
  }

  function renderLayoutButton(mode: GraphLayoutMode, label: string) {
    return (
      <button
        className={[
          'rounded-full px-2.5 py-1 text-xs font-medium transition',
          layoutMode === mode ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-300 hover:text-white'
        ].join(' ')}
        onClick={() => onApplyLayout(mode)}
        type="button"
      >
        {label}
      </button>
    );
  }

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[20px] border border-editor-border bg-editor-panel/80 p-2">
      <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
        <div>
          <p className="font-display text-lg font-semibold text-zinc-50">Branch Graph</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {multiSelectedCutCount > 0 ? (
            <button
              className="rounded-full border border-red-400/40 bg-red-500/10 px-2.5 py-1.5 text-xs font-medium text-red-100 transition hover:border-red-300/70 hover:bg-red-500/20"
              onClick={() => {
                void deleteMultiSelectedCuts();
              }}
              type="button"
            >
              선택 삭제 ({multiSelectedCutCount})
            </button>
          ) : null}
          <button
            className="rounded-full border border-lime-500/35 bg-lime-500/10 px-2.5 py-1.5 text-xs font-medium text-lime-100 transition hover:border-lime-400/60 hover:bg-lime-500/15"
            onClick={() => onOpenLoopStateSetting(selectedCutId)}
            type="button"
          >
            LoopStateSetting
          </button>
          <div className="inline-flex rounded-full border border-editor-border bg-black/20 p-1">
            {renderLayoutButton('custom', 'Custom')}
            {renderLayoutButton('vertical', 'Vertical')}
            {renderLayoutButton('horizontal', 'Horizontal')}
          </div>
          <div className="rounded-full border border-editor-border bg-black/10 px-2.5 py-1.5 text-xs uppercase tracking-[0.18em] text-zinc-500">
            {cuts.length} nodes / {edges.length} edges
          </div>
        </div>
      </div>

      <div
        className="relative min-h-0 flex-1 overflow-hidden rounded-[20px] border border-editor-border bg-[#121217]"
        data-testid="branch-canvas"
        ref={canvasFrameRef}
        tabIndex={0}
      >
        {cuts.length === 0 ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#121217] text-center text-zinc-500">
            <div>
              <p className="font-display text-xl text-zinc-200">아직 배치된 컷이 없습니다.</p>
              <p className="mt-2 text-sm text-zinc-500">리스트 모드에서 컷을 만든 뒤 그래프 모드로 전환하세요.</p>
            </div>
          </div>
        ) : null}
        <ReactFlow<BranchFlowNode, Edge>
          className="h-full w-full"
          connectionMode={ConnectionMode.Strict}
          connectOnClick
          defaultViewport={{ x: 0, y: 0, zoom: 0.85 }}
          defaultEdgeOptions={{ animated: true }}
          edges={edges}
          isValidConnection={isValidGraphConnection}
          maxZoom={1.8}
          minZoom={0.3}
          nodeTypes={nodeTypes}
          nodes={nodes}
          onConnect={handleConnect}
          onEdgeClick={handleEdgeClick}
          onNodeClick={handleNodeClick}
          onNodeDragStop={handleNodeDragStop}
          onNodesChange={onNodesChange}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#2d2d36" gap={24} size={1} />
          <MiniMap
            className="!rounded-2xl !border !border-editor-border !bg-editor-panel/90"
            maskColor="rgba(10, 10, 12, 0.72)"
            nodeColor={(node) => (node.zIndex === 1000 ? '#7A3040' : '#3d3d47')}
            pannable
            position="bottom-left"
            zoomable
          />
          <Controls className="!rounded-2xl !border !border-editor-border !bg-editor-panel/90" showFitView showInteractive={false} showZoom />
        </ReactFlow>
      </div>
    </section>
  );
}

export function BranchCanvas(props: {
  choices: Choice[];
  onCreateChoiceConnection: (cutId: string, targetCutId: string) => void;
  onCreateLinkedCut: (cutId: string, position: { x: number; y: number }) => void;
  onDeleteCuts: (cutIds: string[]) => void | Promise<void>;
  onOpenLoopStateSetting: (anchorCutId?: string) => void;
  cuts: Cut[];
  layoutMode: GraphLayoutMode;
  onConnectChoice: (choiceId: string, targetCutId: string) => void;
  onConnectStateFallback: (cutId: string, targetCutId: string) => void;
  onConnectStateRoute: (cutId: string, stateRouteId: string, targetCutId: string) => void;
  onDeleteChoice: (choiceId: string) => void;
  onApplyLayout: (mode: GraphLayoutMode) => void;
  onMoveCut: (cutId: string, position: { x: number; y: number }) => void;
  onSelectChoice: (choiceId: string) => void;
  onSelectCut: (cutId: string) => void;
  selected: EditorSelection;
}) {
  return (
    <ReactFlowProvider>
      <BranchCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

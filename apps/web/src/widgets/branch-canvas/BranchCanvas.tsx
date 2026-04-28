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
import { useEffect, useMemo, useRef } from 'react';

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

const nodeTypes = {
  cutNode: CutNode,
  addCutPlaceholderNode: AddCutPlaceholderNode
} as NodeTypes;

function buildFlowNodes(
  cuts: Cut[],
  choices: Choice[],
  selected: EditorSelection,
  onCreateLinkedCut: (sourceCutId: string, position: { x: number; y: number }) => void
): BranchFlowNode[] {
  const cutNodes = mapCutsToFlowNodes(cuts, choices, selected);
  const branchEndCut = getSelectedBranchEndCut(cuts, choices, selected);

  if (!branchEndCut || branchEndCut.isEnding || branchEndCut.kind === 'stateRouter') {
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
  const [nodes, setNodes, onNodesChange] = useNodesState<BranchFlowNode>(buildFlowNodes(cuts, choices, selected, onCreateLinkedCut));
  const edges = mapChoicesToFlowEdges(choices, selected, cuts);
  const autoFitCutIds = useMemo(() => cuts.map((cut) => cut.id), [cuts]);
  const previousAutoFitCutIdsRef = useRef<string[] | null>(null);
  const canvasFrameRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setNodes(buildFlowNodes(cuts, choices, selected, onCreateLinkedCut));
  }, [choices, cuts, onCreateLinkedCut, selected, setNodes]);

  useEffect(() => {
    function isEditableTarget(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Delete' || selected.type !== 'choice' || isEditableTarget(event.target)) {
        return;
      }

      event.preventDefault();
      onDeleteChoice(selected.id);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onDeleteChoice, selected]);

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

  const handleNodeClick: NodeMouseHandler<BranchFlowNode> = (_event, node) => {
    if (node.type !== 'cutNode') {
      return;
    }

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

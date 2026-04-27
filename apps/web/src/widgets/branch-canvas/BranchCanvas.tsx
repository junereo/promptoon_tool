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
import { useEffect, useRef } from 'react';

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

function getNodeCenter(node: BranchFlowNode | undefined): { x: number; y: number } | null {
  if (!node) {
    return null;
  }

  const width = node.measured?.width ?? 240;
  const height = node.measured?.height ?? 180;

  return {
    x: node.position.x + width / 2,
    y: node.position.y + height / 2
  };
}

function getEdgeCenter(edge: Edge, nodes: BranchFlowNode[]): { x: number; y: number } | null {
  const sourceNode = nodes.find((node) => node.id === edge.source);
  const targetNode = nodes.find((node) => node.id === edge.target);
  const sourceCenter = getNodeCenter(sourceNode);
  const targetCenter = getNodeCenter(targetNode);

  if (sourceCenter && targetCenter) {
    return {
      x: (sourceCenter.x + targetCenter.x) / 2,
      y: (sourceCenter.y + targetCenter.y) / 2
    };
  }

  return sourceCenter ?? targetCenter;
}

function buildFlowNodes(
  cuts: Cut[],
  choices: Choice[],
  selected: EditorSelection,
  onCreateLinkedCut: (sourceCutId: string, position: { x: number; y: number }) => void
): BranchFlowNode[] {
  const cutNodes = mapCutsToFlowNodes(cuts, choices, selected);
  const branchEndCut = getSelectedBranchEndCut(cuts, choices, selected);

  if (!branchEndCut || branchEndCut.isEnding) {
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

function BranchCanvasInner({
  choices,
  onCreateChoiceConnection,
  onCreateLinkedCut,
  cuts,
  layoutMode,
  onConnectChoice,
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
  onDeleteChoice: (choiceId: string) => void;
  onApplyLayout: (mode: GraphLayoutMode) => void;
  onMoveCut: (cutId: string, position: { x: number; y: number }) => void;
  onSelectChoice: (choiceId: string) => void;
  onSelectCut: (cutId: string) => void;
  selected: EditorSelection;
}) {
  const { fitView, getZoom, setCenter } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<BranchFlowNode>(buildFlowNodes(cuts, choices, selected, onCreateLinkedCut));
  const edges = mapChoicesToFlowEdges(choices, selected);
  const lastFocusedSelectionRef = useRef<string | null>(null);
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
    if (cuts.length === 0) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      void fitView({
        duration: 280,
        maxZoom: 1.2,
        minZoom: 0.45,
        padding: 0.18
      });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [cuts, edges.length, fitView]);

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

    onConnectChoice(sourceHandle.choiceId, connection.target);
  }

  function focusPoint(point: { x: number; y: number } | null) {
    if (!point) {
      return;
    }

    if (typeof canvasFrameRef.current?.scrollIntoView === 'function') {
      canvasFrameRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });
    }

    void setCenter(point.x, point.y, {
      duration: 260,
      zoom: Math.max(getZoom(), 0.85)
    });
  }

  useEffect(() => {
    const selectionKey = selected.type === 'none' ? null : `${selected.type}:${selected.id}`;
    if (!selectionKey) {
      lastFocusedSelectionRef.current = null;
      return;
    }

    if (lastFocusedSelectionRef.current === selectionKey) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      if (selected.type === 'cut') {
        focusPoint(getNodeCenter(nodes.find((node) => node.id === selected.id)));
        lastFocusedSelectionRef.current = selectionKey;
        return;
      }

      if (selected.type === 'choice') {
        const edge = edges.find((currentEdge) => currentEdge.id === `edge-${selected.id}`);
        if (edge) {
          focusPoint(getEdgeCenter(edge, nodes));
          lastFocusedSelectionRef.current = selectionKey;
          return;
        }

        const choice = choices.find((currentChoice) => currentChoice.id === selected.id);
        if (choice) {
          focusPoint(getNodeCenter(nodes.find((node) => node.id === choice.cutId)));
          lastFocusedSelectionRef.current = selectionKey;
        }
      }
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [choices, edges, nodes, selected]);

  const handleNodeClick: NodeMouseHandler<BranchFlowNode> = (_event, node) => {
    if (node.type !== 'cutNode') {
      return;
    }

    onSelectCut(node.id);
    focusPoint(getNodeCenter(node));
  };

  function handleEdgeClick(_event: React.MouseEvent, edge: Edge) {
    const choiceId = edge.id.replace(/^edge-/, '');
    onSelectChoice(choiceId);
    canvasFrameRef.current?.focus();
    focusPoint(getEdgeCenter(edge, nodes));
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
          'rounded-full px-3 py-1.5 text-xs font-medium transition',
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
    <section className="flex h-[780px] min-h-[780px] self-start flex-col rounded-[32px] border border-editor-border bg-editor-panel/80 p-4">
      <div className="mb-4 flex items-center justify-between gap-3 px-2">
        <div>
          <p className="font-display text-xl font-semibold text-zinc-50">Branch Graph</p>
          <p className="text-sm text-zinc-400">Design the episode flow by moving cuts and reconnecting existing choices.</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="inline-flex rounded-full border border-editor-border bg-black/20 p-1">
            {renderLayoutButton('custom', 'Custom')}
            {renderLayoutButton('vertical', 'Vertical')}
            {renderLayoutButton('horizontal', 'Horizontal')}
          </div>
          <div className="rounded-full border border-editor-border bg-black/10 px-3 py-2 text-xs uppercase tracking-[0.2em] text-zinc-500">
            {cuts.length} nodes / {edges.length} edges
          </div>
        </div>
      </div>

      <div
        className="relative h-[720px] min-h-[720px] flex-1 overflow-hidden rounded-[28px] border border-editor-border bg-[#121217]"
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
          fitView
          fitViewOptions={{ maxZoom: 1.2, minZoom: 0.45, padding: 0.18 }}
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

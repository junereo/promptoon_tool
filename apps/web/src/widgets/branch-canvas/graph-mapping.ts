import type { Choice, Cut, EditorSelection } from '@promptoon/shared';
import type { Connection, Edge, Node } from '@xyflow/react';

export interface CutNodeData {
  [key: string]: unknown;
  cut: Cut;
  choicesForCut: Choice[];
  selected: boolean;
  selectedChoiceId: string | null;
}

export interface AddCutPlaceholderNodeData {
  [key: string]: unknown;
  sourceCutId: string;
  position: { x: number; y: number };
  onCreate: (sourceCutId: string, position: { x: number; y: number }) => void;
}

export type CutFlowNode = Node<CutNodeData, 'cutNode'>;
export type AddCutPlaceholderFlowNode = Node<AddCutPlaceholderNodeData, 'addCutPlaceholderNode'>;
export type BranchFlowNode = CutFlowNode | AddCutPlaceholderFlowNode;

const DEFAULT_EDGE_STROKE = '#555';
const SELECTED_EDGE_STROKE = '#7A3040';
const MULTI_INPUT_EDGE_STROKES = ['#38bdf8', '#f59e0b', '#a78bfa', '#34d399', '#fb7185', '#f472b6'];

export function getChoiceSourceHandleId(choiceId: string): string {
  return `source:${choiceId}`;
}

export function getStateRouteSourceHandleId(cutId: string, stateRouteId: string): string {
  return `source:state-route:${cutId}:${stateRouteId}`;
}

export function getStateFallbackSourceHandleId(cutId: string): string {
  return `source:state-fallback:${cutId}`;
}

export function getCreateSourceHandleId(cutId: string): string {
  return `source:new:${cutId}`;
}

export function getCutTargetHandleId(cutId: string): string {
  return `target:${cutId}`;
}

export function parseSourceHandle(
  handleId: string | null | undefined
):
  | { kind: 'choice'; choiceId: string }
  | { kind: 'create'; cutId: string }
  | { kind: 'stateRoute'; cutId: string; stateRouteId: string }
  | { kind: 'stateFallback'; cutId: string }
  | null {
  if (!handleId?.startsWith('source:')) {
    return null;
  }

  if (handleId.startsWith('source:new:')) {
    const cutId = handleId.slice('source:new:'.length);
    return cutId ? { kind: 'create', cutId } : null;
  }

  if (handleId.startsWith('source:state-route:')) {
    const [cutId, stateRouteId] = handleId.slice('source:state-route:'.length).split(':');
    return cutId && stateRouteId ? { kind: 'stateRoute', cutId, stateRouteId } : null;
  }

  if (handleId.startsWith('source:state-fallback:')) {
    const cutId = handleId.slice('source:state-fallback:'.length);
    return cutId ? { kind: 'stateFallback', cutId } : null;
  }

  const choiceId = handleId.slice('source:'.length);
  return choiceId ? { kind: 'choice', choiceId } : null;
}

export function isValidGraphConnection(connection: Connection | Edge): boolean {
  if (!connection.source || !connection.target || !connection.sourceHandle || !connection.targetHandle) {
    return false;
  }

  if (!connection.sourceHandle.startsWith('source:')) {
    return false;
  }

  if (!connection.targetHandle.startsWith('target:')) {
    return false;
  }

  return true;
}

export function getChoicesByCutId(choices: Choice[]): Map<string, Choice[]> {
  const choicesByCutId = new Map<string, Choice[]>();

  for (const choice of choices) {
    const currentChoices = choicesByCutId.get(choice.cutId) ?? [];
    currentChoices.push(choice);
    choicesByCutId.set(choice.cutId, currentChoices);
  }

  for (const [cutId, currentChoices] of choicesByCutId.entries()) {
    choicesByCutId.set(
      cutId,
      [...currentChoices].sort((left, right) => left.orderIndex - right.orderIndex || left.createdAt.localeCompare(right.createdAt))
    );
  }

  return choicesByCutId;
}

export function getSelectedChoiceId(selection: EditorSelection): string | null {
  return selection.type === 'choice' ? selection.id : null;
}

export function getSelectedCutId(cuts: Cut[], choices: Choice[], selection: EditorSelection): string | null {
  if (selection.type === 'cut') {
    return selection.id;
  }

  if (selection.type === 'choice') {
    return choices.find((choice) => choice.id === selection.id)?.cutId ?? null;
  }

  return cuts.find((cut) => cut.isStart)?.id ?? cuts[0]?.id ?? null;
}

export function mapCutsToFlowNodes(cuts: Cut[], choices: Choice[], selection: EditorSelection): CutFlowNode[] {
  const choicesByCutId = getChoicesByCutId(choices);
  const selectedCutId = getSelectedCutId(cuts, choices, selection);
  const selectedChoiceId = getSelectedChoiceId(selection);

  return cuts.map((cut) => {
    const selected = selectedCutId === cut.id;

    return {
      id: cut.id,
      type: 'cutNode',
      position: {
        x: cut.positionX,
        y: cut.positionY
      },
      data: {
        cut,
        choicesForCut: choicesByCutId.get(cut.id) ?? [],
        selected,
        selectedChoiceId
      },
      zIndex: selected ? 1000 : 0
    };
  });
}

function getIncomingEdgeCounts(choices: Choice[], cuts: Cut[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const choice of choices) {
    if (choice.nextCutId) {
      counts.set(choice.nextCutId, (counts.get(choice.nextCutId) ?? 0) + 1);
    }
  }

  for (const cut of cuts) {
    if (cut.kind !== 'stateRouter') {
      continue;
    }

    for (const stateRoute of cut.stateRoutes ?? []) {
      counts.set(stateRoute.nextCutId, (counts.get(stateRoute.nextCutId) ?? 0) + 1);
    }

    if (cut.stateFallbackCutId) {
      counts.set(cut.stateFallbackCutId, (counts.get(cut.stateFallbackCutId) ?? 0) + 1);
    }
  }

  return counts;
}

function getMultiInputStroke(targetCutId: string, indexes: Map<string, number>): string {
  const incomingEdgeIndex = indexes.get(targetCutId) ?? 0;
  indexes.set(targetCutId, incomingEdgeIndex + 1);
  return MULTI_INPUT_EDGE_STROKES[incomingEdgeIndex % MULTI_INPUT_EDGE_STROKES.length];
}

export function mapChoicesToFlowEdges(choices: Choice[], selection: EditorSelection, cuts: Cut[] = []): Edge[] {
  const selectedChoiceId = selection.type === 'choice' ? selection.id : null;
  const connectedChoices = choices.filter((choice) => Boolean(choice.nextCutId));
  const incomingEdgeIndexByTargetCutId = new Map<string, number>();
  const incomingEdgeCountByTargetCutId = getIncomingEdgeCounts(choices, cuts);

  const choiceEdges = connectedChoices.map((choice) => {
    const targetCutId = choice.nextCutId!;
    const incomingEdgeCount = incomingEdgeCountByTargetCutId.get(targetCutId) ?? 1;
    const isMultiInputEdge = incomingEdgeCount >= 2;
    const isSelected = selectedChoiceId === choice.id;
    const multiInputStroke = getMultiInputStroke(targetCutId, incomingEdgeIndexByTargetCutId);

    return {
      id: `edge-${choice.id}`,
      source: choice.cutId,
      sourceHandle: getChoiceSourceHandleId(choice.id),
      target: targetCutId,
      targetHandle: getCutTargetHandleId(targetCutId),
      animated: true,
      interactionWidth: isMultiInputEdge ? 24 : 18,
      zIndex: isSelected ? 20 : isMultiInputEdge ? 10 : 0,
      style: {
        stroke: isSelected ? SELECTED_EDGE_STROKE : isMultiInputEdge ? multiInputStroke : DEFAULT_EDGE_STROKE,
        strokeOpacity: isMultiInputEdge || isSelected ? 0.95 : 0.72,
        strokeWidth: isSelected ? 2.8 : isMultiInputEdge ? 2.4 : 1.8
      }
    };
  });

  const stateRouteEdges = cuts.flatMap((cut) => {
    if (cut.kind !== 'stateRouter') {
      return [];
    }

    const routeEdges = (cut.stateRoutes ?? [])
      .filter((stateRoute) => Boolean(stateRoute.nextCutId))
      .map((stateRoute, index) => {
        const targetCutId = stateRoute.nextCutId;
        const incomingEdgeCount = incomingEdgeCountByTargetCutId.get(targetCutId) ?? 1;
        const isMultiInputEdge = incomingEdgeCount >= 2;
        const multiInputStroke = getMultiInputStroke(targetCutId, incomingEdgeIndexByTargetCutId);

        return {
          id: `state-route-${cut.id}-${stateRoute.id}`,
          source: cut.id,
          sourceHandle: getStateRouteSourceHandleId(cut.id, stateRoute.id),
          target: targetCutId,
          targetHandle: getCutTargetHandleId(targetCutId),
          animated: true,
          interactionWidth: isMultiInputEdge ? 24 : 18,
          zIndex: isMultiInputEdge ? 10 : 0,
          style: {
            stroke: isMultiInputEdge ? multiInputStroke : MULTI_INPUT_EDGE_STROKES[index % MULTI_INPUT_EDGE_STROKES.length],
            strokeDasharray: '5 5',
            strokeOpacity: 0.9,
            strokeWidth: isMultiInputEdge ? 2.4 : 2
          }
        };
      });

    if (!cut.stateFallbackCutId) {
      return routeEdges;
    }

    const targetCutId = cut.stateFallbackCutId;
    const incomingEdgeCount = incomingEdgeCountByTargetCutId.get(targetCutId) ?? 1;
    const isMultiInputEdge = incomingEdgeCount >= 2;
    const multiInputStroke = getMultiInputStroke(targetCutId, incomingEdgeIndexByTargetCutId);

    return [
      ...routeEdges,
      {
        id: `state-fallback-${cut.id}`,
        source: cut.id,
        sourceHandle: getStateFallbackSourceHandleId(cut.id),
        target: targetCutId,
        targetHandle: getCutTargetHandleId(targetCutId),
        animated: true,
        interactionWidth: isMultiInputEdge ? 24 : 18,
        zIndex: isMultiInputEdge ? 10 : 0,
        style: {
          stroke: isMultiInputEdge ? multiInputStroke : '#94a3b8',
          strokeDasharray: '2 6',
          strokeOpacity: 0.85,
          strokeWidth: isMultiInputEdge ? 2.4 : 2
        }
      }
    ];
  });

  return [...choiceEdges, ...stateRouteEdges];
}

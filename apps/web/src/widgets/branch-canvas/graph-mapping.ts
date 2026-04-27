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

export function getChoiceSourceHandleId(choiceId: string): string {
  return `source:${choiceId}`;
}

export function getCreateSourceHandleId(cutId: string): string {
  return `source:new:${cutId}`;
}

export function getCutTargetHandleId(cutId: string): string {
  return `target:${cutId}`;
}

export function parseSourceHandle(
  handleId: string | null | undefined
): { kind: 'choice'; choiceId: string } | { kind: 'create'; cutId: string } | null {
  if (!handleId?.startsWith('source:')) {
    return null;
  }

  if (handleId.startsWith('source:new:')) {
    const cutId = handleId.slice('source:new:'.length);
    return cutId ? { kind: 'create', cutId } : null;
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

export function mapChoicesToFlowEdges(choices: Choice[], selection: EditorSelection): Edge[] {
  const selectedChoiceId = selection.type === 'choice' ? selection.id : null;

  return choices
    .filter((choice) => Boolean(choice.nextCutId))
    .map((choice) => ({
      id: `edge-${choice.id}`,
      source: choice.cutId,
      sourceHandle: getChoiceSourceHandleId(choice.id),
      target: choice.nextCutId!,
      targetHandle: getCutTargetHandleId(choice.nextCutId!),
      animated: true,
      style: {
        stroke: selectedChoiceId === choice.id ? '#7A3040' : '#555',
        strokeWidth: selectedChoiceId === choice.id ? 2.5 : 1.8
      }
    }));
}

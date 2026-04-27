import type { Choice, Cut, EditorSelection } from '@promptoon/shared';

function compareCuts(left: Cut, right: Cut): number {
  return left.orderIndex - right.orderIndex || left.createdAt.localeCompare(right.createdAt);
}

function compareChoices(left: Choice, right: Choice): number {
  return left.orderIndex - right.orderIndex || left.createdAt.localeCompare(right.createdAt);
}

export interface CutHierarchyNode {
  cut: Cut;
  rank: string;
  depth: number;
  parentCutId: string | null;
  parentChoiceId: string | null;
  siblingGroupKey: string;
  siblingCutIds: string[];
  childNodes: CutHierarchyNode[];
}

export interface CutHierarchy {
  rootNodes: CutHierarchyNode[];
  flatNodes: CutHierarchyNode[];
  nodeByCutId: Map<string, CutHierarchyNode>;
}

function getConnectedChoicesByCutId(choices: Choice[]): Map<string, Choice[]> {
  const choicesByCutId = new Map<string, Choice[]>();

  for (const choice of choices) {
    if (!choice.nextCutId) {
      continue;
    }

    const currentChoices = choicesByCutId.get(choice.cutId) ?? [];
    currentChoices.push(choice);
    choicesByCutId.set(choice.cutId, currentChoices);
  }

  for (const [cutId, currentChoices] of choicesByCutId.entries()) {
    choicesByCutId.set(cutId, [...currentChoices].sort(compareChoices));
  }

  return choicesByCutId;
}

function getIncomingCutIds(choices: Choice[]): Set<string> {
  const incomingCutIds = new Set<string>();

  for (const choice of choices) {
    if (choice.nextCutId) {
      incomingCutIds.add(choice.nextCutId);
    }
  }

  return incomingCutIds;
}

function assignSiblingCutIds(flatNodes: CutHierarchyNode[]): void {
  const groups = new Map<string, string[]>();

  for (const node of flatNodes) {
    const siblingCutIds = groups.get(node.siblingGroupKey) ?? [];
    siblingCutIds.push(node.cut.id);
    groups.set(node.siblingGroupKey, siblingCutIds);
  }

  for (const node of flatNodes) {
    node.siblingCutIds = groups.get(node.siblingGroupKey) ?? [node.cut.id];
  }
}

export function buildCutHierarchy(cuts: Cut[], choices: Choice[]): CutHierarchy {
  const sortedCuts = [...cuts];
  const cutOrder = new Map(sortedCuts.map((cut, index) => [cut.id, index]));
  const cutById = new Map(sortedCuts.map((cut) => [cut.id, cut]));
  const connectedChoicesByCutId = getConnectedChoicesByCutId(choices);
  const incomingCutIds = getIncomingCutIds(choices);
  const visitedCutIds = new Set<string>();
  const flatNodes: CutHierarchyNode[] = [];
  const nodeByCutId = new Map<string, CutHierarchyNode>();

  function visitCut(
    cut: Cut,
    path: number[],
    parentCutId: string | null,
    parentChoiceId: string | null,
    ancestorCutIds: Set<string>
  ): CutHierarchyNode | null {
    if (visitedCutIds.has(cut.id) || ancestorCutIds.has(cut.id)) {
      return null;
    }

    visitedCutIds.add(cut.id);

    const node: CutHierarchyNode = {
      cut,
      rank: path.join('.'),
      depth: path.length - 1,
      parentCutId,
      parentChoiceId,
      siblingGroupKey: parentCutId ? `children:${parentCutId}` : 'root',
      siblingCutIds: [],
      childNodes: []
    };

    flatNodes.push(node);
    nodeByCutId.set(cut.id, node);

    const nextAncestorCutIds = new Set(ancestorCutIds);
    nextAncestorCutIds.add(cut.id);

    let childRank = 1;
    for (const choice of connectedChoicesByCutId.get(cut.id) ?? []) {
      const childCut = choice.nextCutId ? cutById.get(choice.nextCutId) : undefined;
      if (!childCut) {
        continue;
      }

      const childNode = visitCut(childCut, [...path, childRank], cut.id, choice.id, nextAncestorCutIds);
      if (childNode) {
        node.childNodes.push(childNode);
        childRank += 1;
      }
    }

    return node;
  }

  const startCuts = sortedCuts.filter((cut) => cut.isStart);
  const rootCandidates = [
    ...startCuts,
    ...sortedCuts.filter((cut) => !cut.isStart && !incomingCutIds.has(cut.id)),
    ...sortedCuts.filter((cut) => !startCuts.some((startCut) => startCut.id === cut.id) && incomingCutIds.has(cut.id))
  ];
  const rootNodes: CutHierarchyNode[] = [];
  let rootRank = 1;

  for (const cut of rootCandidates) {
    const rootNode = visitCut(cut, [rootRank], null, null, new Set());
    if (rootNode) {
      rootNodes.push(rootNode);
      rootRank += 1;
    }
  }

  assignSiblingCutIds(flatNodes);
  const orderedFlatNodes = [...flatNodes].sort(
    (left, right) => (cutOrder.get(left.cut.id) ?? 0) - (cutOrder.get(right.cut.id) ?? 0)
  );

  return {
    rootNodes,
    flatNodes: orderedFlatNodes,
    nodeByCutId
  };
}

export function sortCutsByLocalOrder(cuts: Cut[], localCutOrder: string[]): Cut[] {
  if (localCutOrder.length === 0) {
    return [...cuts].sort(compareCuts);
  }

  const rank = new Map(localCutOrder.map((cutId, index) => [cutId, index]));
  return [...cuts].sort((left, right) => {
    const leftRank = rank.get(left.id);
    const rightRank = rank.get(right.id);

    if (leftRank === undefined && rightRank === undefined) {
      return compareCuts(left, right);
    }

    if (leftRank === undefined) {
      return 1;
    }

    if (rightRank === undefined) {
      return -1;
    }

    return leftRank - rightRank;
  });
}

export function getSelectedChoice(choices: Choice[], selection: EditorSelection): Choice | null {
  if (selection.type !== 'choice') {
    return null;
  }

  return choices.find((choice) => choice.id === selection.id) ?? null;
}

export function getSelectedCut(cuts: Cut[], choices: Choice[], selection: EditorSelection): Cut | null {
  if (selection.type === 'cut') {
    return cuts.find((cut) => cut.id === selection.id) ?? null;
  }

  if (selection.type === 'choice') {
    const selectedChoice = getSelectedChoice(choices, selection);
    if (!selectedChoice) {
      return null;
    }

    return cuts.find((cut) => cut.id === selectedChoice.cutId) ?? null;
  }

  return null;
}

export function getPreviewCut(cuts: Cut[], choices: Choice[], selection: EditorSelection): Cut | null {
  const selectedCut = getSelectedCut(cuts, choices, selection);
  if (selectedCut) {
    return selectedCut;
  }

  return cuts.find((cut) => cut.isStart) ?? [...cuts].sort(compareCuts)[0] ?? null;
}

export function getChoicesForCut(choices: Choice[], cutId: string): Choice[] {
  return choices
    .filter((choice) => choice.cutId === cutId)
    .sort(compareChoices);
}

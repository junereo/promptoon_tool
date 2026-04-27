import type { Choice, Cut, EditorSelection } from '@promptoon/shared';

import { buildCutHierarchy, type CutHierarchyNode } from '../../entities/promptoon/selectors';
import { getSelectedCutId } from './graph-mapping';

export type GraphLayoutMode = 'custom' | 'vertical' | 'horizontal';

export interface GraphPosition {
  x: number;
  y: number;
}

export const GLOBAL_CUT_POSITION_OFFSET = 10;
export const GRAPH_NODE_HORIZONTAL_GAP = 320;
export const GRAPH_NODE_VERTICAL_GAP = 260;

function findDeepestLastDescendant(node: CutHierarchyNode): CutHierarchyNode {
  if (node.childNodes.length === 0) {
    return node;
  }

  return findDeepestLastDescendant(node.childNodes[node.childNodes.length - 1]);
}

function nudgeIfOccupied(position: GraphPosition, cuts: Cut[]): GraphPosition {
  const occupied = new Set(cuts.map((cut) => `${cut.positionX}:${cut.positionY}`));
  const nextPosition = { ...position };

  while (occupied.has(`${nextPosition.x}:${nextPosition.y}`)) {
    nextPosition.x += GLOBAL_CUT_POSITION_OFFSET;
    nextPosition.y += GLOBAL_CUT_POSITION_OFFSET;
  }

  return nextPosition;
}

export function getGlobalCreatePosition(cuts: Cut[]): GraphPosition {
  if (cuts.length === 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: Math.max(...cuts.map((cut) => cut.positionX)) + GLOBAL_CUT_POSITION_OFFSET,
    y: Math.max(...cuts.map((cut) => cut.positionY)) + GLOBAL_CUT_POSITION_OFFSET
  };
}

export function getBranchEndCut(cuts: Cut[], choices: Choice[], anchorCutId: string | null): Cut | null {
  if (!anchorCutId) {
    return null;
  }

  const hierarchy = buildCutHierarchy(cuts, choices);
  const anchorNode = hierarchy.nodeByCutId.get(anchorCutId);
  if (!anchorNode) {
    return cuts.find((cut) => cut.id === anchorCutId) ?? null;
  }

  return findDeepestLastDescendant(anchorNode).cut;
}

export function getSelectedBranchEndCut(cuts: Cut[], choices: Choice[], selection: EditorSelection): Cut | null {
  const selectedCutId = getSelectedCutId(cuts, choices, selection);
  return getBranchEndCut(cuts, choices, selectedCutId);
}

export function getLinkedCreatePosition(cuts: Cut[], choices: Choice[], anchorCutId: string | null): GraphPosition {
  const branchEndCut = getBranchEndCut(cuts, choices, anchorCutId);
  if (!branchEndCut) {
    return getGlobalCreatePosition(cuts);
  }

  return nudgeIfOccupied(
    {
      x: branchEndCut.positionX,
      y: branchEndCut.positionY + GRAPH_NODE_VERTICAL_GAP
    },
    cuts
  );
}

export function computeVerticalLayout(cuts: Cut[], choices: Choice[]): Record<string, GraphPosition> {
  const hierarchy = buildCutHierarchy(cuts, choices);
  const positions: Record<string, GraphPosition> = {};
  let leafIndex = 0;

  function layoutNode(node: CutHierarchyNode): number {
    if (node.childNodes.length === 0) {
      const x = leafIndex * GRAPH_NODE_HORIZONTAL_GAP;
      leafIndex += 1;
      positions[node.cut.id] = {
        x,
        y: node.depth * GRAPH_NODE_VERTICAL_GAP
      };
      return x;
    }

    const childXValues = node.childNodes.map(layoutNode);
    const x = (childXValues[0] + childXValues[childXValues.length - 1]) / 2;
    positions[node.cut.id] = {
      x,
      y: node.depth * GRAPH_NODE_VERTICAL_GAP
    };
    return x;
  }

  for (const rootNode of hierarchy.rootNodes) {
    layoutNode(rootNode);
  }

  return positions;
}

export function computeHorizontalLayout(cuts: Cut[], choices: Choice[]): Record<string, GraphPosition> {
  const hierarchy = buildCutHierarchy(cuts, choices);
  const positions: Record<string, GraphPosition> = {};
  let leafIndex = 0;

  function layoutNode(node: CutHierarchyNode): number {
    if (node.childNodes.length === 0) {
      const y = leafIndex * GRAPH_NODE_VERTICAL_GAP;
      leafIndex += 1;
      positions[node.cut.id] = {
        x: node.depth * GRAPH_NODE_HORIZONTAL_GAP,
        y
      };
      return y;
    }

    const childYValues = node.childNodes.map(layoutNode);
    const y = (childYValues[0] + childYValues[childYValues.length - 1]) / 2;
    positions[node.cut.id] = {
      x: node.depth * GRAPH_NODE_HORIZONTAL_GAP,
      y
    };
    return y;
  }

  for (const rootNode of hierarchy.rootNodes) {
    layoutNode(rootNode);
  }

  return positions;
}

import type { Choice, Cut, EditorSelection } from '@promptoon/shared';

import { buildCutHierarchy, type CutHierarchyNode } from '../../entities/promptoon/selectors';
import {
  getCutGroupFrames,
  getLoopGraphGroupId,
  getLoopGraphGroups,
  GRAPH_CUT_NODE_HEIGHT,
  GRAPH_CUT_NODE_WIDTH,
  GRAPH_GROUP_HEADER_HEIGHT,
  GRAPH_GROUP_PADDING_BOTTOM,
  GRAPH_GROUP_PADDING_X
} from './graph-groups';
import { getSelectedCutId } from './graph-mapping';

export type GraphLayoutMode = 'custom' | 'vertical' | 'horizontal';

export interface GraphPosition {
  x: number;
  y: number;
}

export const GLOBAL_CUT_POSITION_OFFSET = 10;
export const GRAPH_NODE_HORIZONTAL_GAP = 320;
export const GRAPH_NODE_VERTICAL_GAP = 260;
const GRAPH_GROUP_LAYOUT_EXTRA_GAP = 120;

interface GraphRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface GroupExternalLink {
  groupId: string;
  groupCutIds: string[];
  sourceCutId: string;
  targetCutId: string;
}

interface LayoutUnit {
  id: string;
  kind: 'cut' | 'group';
  cutIds: string[];
  cuts: Cut[];
  width: number;
  height: number;
  cutOffsetX: number;
  cutOffsetY: number;
  orderIndex: number;
  createdAt: string;
}

interface LayoutUnitNode {
  unit: LayoutUnit;
  depth: number;
  childNodes: LayoutUnitNode[];
}

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

function computeLegacyVerticalLayout(cuts: Cut[], choices: Choice[]): Record<string, GraphPosition> {
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

function computeLegacyHorizontalLayout(cuts: Cut[], choices: Choice[]): Record<string, GraphPosition> {
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

function compareCuts(left: Cut, right: Cut): number {
  return left.orderIndex - right.orderIndex || left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id);
}

function compareUnits(left: LayoutUnit, right: LayoutUnit): number {
  if (left.kind !== right.kind) {
    return left.kind === 'cut' ? -1 : 1;
  }

  return left.orderIndex - right.orderIndex || left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id);
}

function getConnectedChoiceTargets(cut: Cut, choices: Choice[]): string[] {
  return choices
    .filter((choice) => choice.cutId === cut.id && choice.nextCutId)
    .sort((left, right) => left.orderIndex - right.orderIndex || left.createdAt.localeCompare(right.createdAt))
    .map((choice) => choice.nextCutId)
    .filter((nextCutId): nextCutId is string => Boolean(nextCutId));
}

function getConnectedStateRouterTargets(cut: Cut): string[] {
  if (cut.kind !== 'stateRouter') {
    return [];
  }

  return [
    ...(cut.stateRoutes ?? []).map((stateRoute) => stateRoute.nextCutId),
    ...(cut.stateFallbackCutId ? [cut.stateFallbackCutId] : [])
  ];
}

function getConnectedLoopTargets(cut: Cut): string[] {
  if (cut.loopMetadata?.role !== 'stageBase') {
    return [];
  }

  return [cut.loopMetadata.selectedVariantCutId ?? null, ...(cut.loopMetadata.variantCutIds ?? [])].filter(
    (targetCutId, index, targetCutIds): targetCutId is string =>
      Boolean(targetCutId) && targetCutId !== cut.id && targetCutIds.indexOf(targetCutId) === index
  );
}

function getConnectedTargets(cut: Cut, choices: Choice[]): string[] {
  const targetIds = [
    ...getConnectedLoopTargets(cut),
    ...getConnectedChoiceTargets(cut, choices),
    ...getConnectedStateRouterTargets(cut)
  ];

  return targetIds.filter((targetId, index) => targetId !== cut.id && targetIds.indexOf(targetId) === index);
}

function getUnitIdForCut(cut: Cut): string {
  const groupId = getLoopGraphGroupId(cut);
  return groupId ? `group:${groupId}` : `cut:${cut.id}`;
}

function getUnitIdForCutId(cutId: string, cutById: Map<string, Cut>): string | null {
  const cut = cutById.get(cutId);
  return cut ? getUnitIdForCut(cut) : null;
}

function getCutBounds(cuts: Cut[]): { width: number; height: number } {
  if (cuts.length === 0) {
    return {
      width: GRAPH_CUT_NODE_WIDTH,
      height: GRAPH_CUT_NODE_HEIGHT
    };
  }

  const minX = Math.min(...cuts.map((cut) => cut.positionX));
  const minY = Math.min(...cuts.map((cut) => cut.positionY));
  const maxX = Math.max(...cuts.map((cut) => cut.positionX + GRAPH_CUT_NODE_WIDTH));
  const maxY = Math.max(...cuts.map((cut) => cut.positionY + GRAPH_CUT_NODE_HEIGHT));

  return {
    width: Math.max(GRAPH_CUT_NODE_WIDTH, maxX - minX),
    height: Math.max(GRAPH_CUT_NODE_HEIGHT, maxY - minY)
  };
}

function buildLayoutUnits(cuts: Cut[], choices: Choice[]) {
  const cutById = new Map(cuts.map((cut) => [cut.id, cut]));
  const groupedCutIds = new Set<string>();
  const units: LayoutUnit[] = [];

  for (const group of getLoopGraphGroups(cuts)) {
    group.cutIds.forEach((cutId) => groupedCutIds.add(cutId));
    const bounds = getCutBounds(group.cuts);
    const firstCut = group.cuts[0];
    if (!firstCut) {
      continue;
    }
    units.push({
      id: `group:${group.groupId}`,
      kind: 'group',
      cutIds: group.cutIds,
      cuts: group.cuts,
      width: Math.max(320, bounds.width + GRAPH_GROUP_PADDING_X * 2),
      height: Math.max(260, bounds.height + GRAPH_GROUP_HEADER_HEIGHT + GRAPH_GROUP_PADDING_BOTTOM),
      cutOffsetX: GRAPH_GROUP_PADDING_X,
      cutOffsetY: GRAPH_GROUP_HEADER_HEIGHT,
      orderIndex: firstCut.orderIndex,
      createdAt: firstCut.createdAt
    });
  }

  for (const cut of [...cuts].sort(compareCuts)) {
    if (groupedCutIds.has(cut.id)) {
      continue;
    }

    units.push({
      id: `cut:${cut.id}`,
      kind: 'cut',
      cutIds: [cut.id],
      cuts: [cut],
      width: GRAPH_CUT_NODE_WIDTH,
      height: GRAPH_CUT_NODE_HEIGHT,
      cutOffsetX: 0,
      cutOffsetY: 0,
      orderIndex: cut.orderIndex,
      createdAt: cut.createdAt
    });
  }

  const sortedUnits = units.sort(compareUnits);
  const unitById = new Map(sortedUnits.map((unit) => [unit.id, unit]));
  const outgoingUnitIdsByUnitId = new Map<string, string[]>();
  const incomingUnitIds = new Set<string>();

  for (const cut of cuts) {
    const sourceUnitId = getUnitIdForCut(cut);
    const outgoingUnitIds = outgoingUnitIdsByUnitId.get(sourceUnitId) ?? [];

    for (const targetCutId of getConnectedTargets(cut, choices)) {
      const targetUnitId = getUnitIdForCutId(targetCutId, cutById);
      if (!targetUnitId || targetUnitId === sourceUnitId || outgoingUnitIds.includes(targetUnitId)) {
        continue;
      }

      outgoingUnitIds.push(targetUnitId);
      incomingUnitIds.add(targetUnitId);
    }

    outgoingUnitIdsByUnitId.set(sourceUnitId, outgoingUnitIds);
  }

  for (const [unitId, outgoingUnitIds] of outgoingUnitIdsByUnitId.entries()) {
    outgoingUnitIdsByUnitId.set(
      unitId,
      [...outgoingUnitIds].sort((leftUnitId, rightUnitId) => {
        const leftUnit = unitById.get(leftUnitId);
        const rightUnit = unitById.get(rightUnitId);

        if (!leftUnit || !rightUnit) {
          return leftUnit ? -1 : rightUnit ? 1 : leftUnitId.localeCompare(rightUnitId);
        }

        return compareUnits(leftUnit, rightUnit);
      })
    );
  }

  return {
    units: sortedUnits,
    unitById,
    outgoingUnitIdsByUnitId,
    incomingUnitIds
  };
}

function buildLayoutUnitTree(cuts: Cut[], choices: Choice[]): LayoutUnitNode[] {
  const { units, unitById, outgoingUnitIdsByUnitId, incomingUnitIds } = buildLayoutUnits(cuts, choices);
  const visitedUnitIds = new Set<string>();
  const startUnitIds = units
    .filter((unit) => unit.cuts.some((cut) => cut.isStart))
    .map((unit) => unit.id)
    .filter((unitId, index, unitIds) => unitIds.indexOf(unitId) === index);
  const primaryRootUnits = units
    .filter((unit) => startUnitIds.includes(unit.id) || !incomingUnitIds.has(unit.id))
    .sort(compareUnits);
  const primaryRootUnitIds = new Set(primaryRootUnits.map((unit) => unit.id));
  const rootUnits = [
    ...primaryRootUnits,
    ...units.filter((unit) => !primaryRootUnitIds.has(unit.id)).sort(compareUnits)
  ];

  function visitUnit(unit: LayoutUnit, depth: number, ancestorUnitIds: Set<string>): LayoutUnitNode | null {
    if (visitedUnitIds.has(unit.id) || ancestorUnitIds.has(unit.id)) {
      return null;
    }

    visitedUnitIds.add(unit.id);
    const nextAncestorUnitIds = new Set(ancestorUnitIds);
    nextAncestorUnitIds.add(unit.id);
    const childNodes = (outgoingUnitIdsByUnitId.get(unit.id) ?? [])
      .map((unitId) => unitById.get(unitId))
      .filter((childUnit): childUnit is LayoutUnit => Boolean(childUnit))
      .map((childUnit) => visitUnit(childUnit, depth + 1, nextAncestorUnitIds))
      .filter((node): node is LayoutUnitNode => Boolean(node));

    return {
      unit,
      depth,
      childNodes
    };
  }

  return rootUnits.map((unit) => visitUnit(unit, 0, new Set())).filter((node): node is LayoutUnitNode => Boolean(node));
}

function applyUnitPosition(positions: Record<string, GraphPosition>, unit: LayoutUnit, position: GraphPosition): void {
  const minX = Math.min(...unit.cuts.map((cut) => cut.positionX));
  const minY = Math.min(...unit.cuts.map((cut) => cut.positionY));

  for (const cut of unit.cuts) {
    positions[cut.id] = {
      x: position.x + unit.cutOffsetX + cut.positionX - minX,
      y: position.y + unit.cutOffsetY + cut.positionY - minY
    };
  }
}

function applyUnitAnchorPosition(positions: Record<string, GraphPosition>, unit: LayoutUnit, anchorPosition: GraphPosition): void {
  applyUnitPosition(positions, unit, {
    x: anchorPosition.x - unit.cutOffsetX,
    y: anchorPosition.y - unit.cutOffsetY
  });
}

function doRectsOverlap(left: GraphRect, right: GraphRect): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

function getCutRect(cut: Cut, position: GraphPosition): GraphRect {
  return {
    id: cut.id,
    x: position.x,
    y: position.y,
    width: GRAPH_CUT_NODE_WIDTH,
    height: GRAPH_CUT_NODE_HEIGHT
  };
}

function shiftGroupPositions(
  positions: Record<string, GraphPosition>,
  cutIds: string[],
  delta: GraphPosition
): Record<string, GraphPosition> {
  if (delta.x === 0 && delta.y === 0) {
    return positions;
  }

  const nextPositions = { ...positions };
  for (const cutId of cutIds) {
    const position = nextPositions[cutId];
    if (!position) {
      continue;
    }

    nextPositions[cutId] = {
      x: position.x + delta.x,
      y: position.y + delta.y
    };
  }

  return nextPositions;
}

function shiftCutPositions(
  positions: Record<string, GraphPosition>,
  cutIds: Set<string>,
  delta: GraphPosition
): Record<string, GraphPosition> {
  if (delta.x === 0 && delta.y === 0) {
    return positions;
  }

  const nextPositions = { ...positions };
  for (const cutId of cutIds) {
    const position = nextPositions[cutId];
    if (!position) {
      continue;
    }

    nextPositions[cutId] = {
      x: position.x + delta.x,
      y: position.y + delta.y
    };
  }

  return nextPositions;
}

function getGroupExternalLinks(cuts: Cut[], choices: Choice[]): GroupExternalLink[] {
  const cutById = new Map(cuts.map((cut) => [cut.id, cut]));
  const links: GroupExternalLink[] = [];
  const seenLinkKeys = new Set<string>();

  for (const group of getLoopGraphGroups(cuts)) {
    const groupCutIds = new Set(group.cutIds);

    for (const sourceCut of group.cuts) {
      for (const targetCutId of getConnectedTargets(sourceCut, choices)) {
        const targetCut = cutById.get(targetCutId);
        if (!targetCut || groupCutIds.has(targetCut.id) || getLoopGraphGroupId(targetCut)) {
          continue;
        }

        const linkKey = `${group.groupId}:${sourceCut.id}:${targetCut.id}`;
        if (seenLinkKeys.has(linkKey)) {
          continue;
        }

        seenLinkKeys.add(linkKey);
        links.push({
          groupId: group.groupId,
          groupCutIds: group.cutIds,
          sourceCutId: sourceCut.id,
          targetCutId: targetCut.id
        });
      }
    }
  }

  return links;
}

function collectReachableCutIds(
  cuts: Cut[],
  choices: Choice[],
  rootCutId: string,
  blockedCutIds: Set<string>
): Set<string> {
  const cutById = new Map(cuts.map((cut) => [cut.id, cut]));
  const reachableCutIds = new Set<string>();

  function visit(cutId: string): void {
    if (reachableCutIds.has(cutId) || blockedCutIds.has(cutId)) {
      return;
    }

    const cut = cutById.get(cutId);
    if (!cut) {
      return;
    }

    reachableCutIds.add(cut.id);
    for (const targetCutId of getConnectedTargets(cut, choices)) {
      visit(targetCutId);
    }
  }

  visit(rootCutId);
  return reachableCutIds;
}

function getPositionedCuts(cuts: Cut[], positions: Record<string, GraphPosition>): Cut[] {
  return cuts.map((cut) => {
    const position = positions[cut.id];
    return position
      ? {
          ...cut,
          positionX: position.x,
          positionY: position.y
        }
      : cut;
  });
}

function resolveGroupFrameCollisions(
  cuts: Cut[],
  positions: Record<string, GraphPosition>,
  axis: 'x' | 'y',
  ignoredBlockedCutIds: Set<string> = new Set()
): Record<string, GraphPosition> {
  let nextPositions = { ...positions };
  const groupedCutIds = new Set(getLoopGraphGroups(cuts).flatMap((group) => group.cutIds));
  const cutById = new Map(cuts.map((cut) => [cut.id, cut]));
  const blockedRects: GraphRect[] = cuts
    .filter((cut) => !groupedCutIds.has(cut.id) && !ignoredBlockedCutIds.has(cut.id))
    .map((cut) => {
      const position = nextPositions[cut.id];
      return position ? getCutRect(cut, position) : null;
    })
    .filter((rect): rect is GraphRect => Boolean(rect));

  for (const group of getLoopGraphGroups(cuts)) {
    const groupFrame = getCutGroupFrames(getPositionedCuts(cuts, nextPositions)).find((frame) => frame.groupId === group.groupId);
    if (!groupFrame) {
      continue;
    }

    const groupRect: GraphRect = {
      id: group.groupId,
      x: groupFrame.position.x,
      y: groupFrame.position.y,
      width: groupFrame.width,
      height: groupFrame.height
    };
    let resolvedRect = { ...groupRect };

    for (const blockedRect of blockedRects) {
      if (!doRectsOverlap(resolvedRect, blockedRect)) {
        continue;
      }

      if (axis === 'x') {
        resolvedRect = {
          ...resolvedRect,
          x: blockedRect.x + blockedRect.width + GRAPH_GROUP_LAYOUT_EXTRA_GAP
        };
      } else {
        resolvedRect = {
          ...resolvedRect,
          y: blockedRect.y + blockedRect.height + GRAPH_GROUP_LAYOUT_EXTRA_GAP
        };
      }
    }

    const delta = {
      x: resolvedRect.x - groupRect.x,
      y: resolvedRect.y - groupRect.y
    };
    nextPositions = shiftGroupPositions(nextPositions, group.cutIds, delta);

    const shiftedGroupCuts = group.cutIds
      .map((cutId) => {
        const cut = cutById.get(cutId);
        const position = nextPositions[cutId];
        return cut && position
          ? {
              ...cut,
              positionX: position.x,
              positionY: position.y
            }
          : null;
      })
      .filter((cut): cut is Cut => Boolean(cut));
    const [shiftedFrame] = getCutGroupFrames(shiftedGroupCuts);
    if (shiftedFrame) {
      blockedRects.push({
        id: shiftedFrame.groupId,
        x: shiftedFrame.position.x,
        y: shiftedFrame.position.y,
        width: shiftedFrame.width,
        height: shiftedFrame.height
      });
    }
  }

  return nextPositions;
}

function anchorGroupExternalTargets(
  cuts: Cut[],
  choices: Choice[],
  positions: Record<string, GraphPosition>,
  orientation: 'vertical' | 'horizontal'
): Record<string, GraphPosition> {
  let nextPositions = { ...positions };

  for (const link of getGroupExternalLinks(cuts, choices)) {
    const sourcePosition = nextPositions[link.sourceCutId];
    const targetPosition = nextPositions[link.targetCutId];
    const groupFrame = getCutGroupFrames(getPositionedCuts(cuts, nextPositions)).find((frame) => frame.groupId === link.groupId);

    if (!sourcePosition || !targetPosition || !groupFrame) {
      continue;
    }

    const targetAnchor =
      orientation === 'vertical'
        ? {
            x: sourcePosition.x,
            y: groupFrame.position.y + groupFrame.height + GRAPH_NODE_VERTICAL_GAP
          }
        : {
            x: groupFrame.position.x + groupFrame.width + GRAPH_NODE_HORIZONTAL_GAP,
            y: sourcePosition.y
          };
    const delta = {
      x: targetAnchor.x - targetPosition.x,
      y: targetAnchor.y - targetPosition.y
    };
    const subtreeCutIds = collectReachableCutIds(cuts, choices, link.targetCutId, new Set(link.groupCutIds));

    nextPositions = shiftCutPositions(nextPositions, subtreeCutIds, delta);
  }

  return nextPositions;
}

function computeGroupedVerticalLayout(cuts: Cut[], choices: Choice[]): Record<string, GraphPosition> {
  const unitTree = buildLayoutUnitTree(cuts, choices);
  const positions: Record<string, GraphPosition> = {};
  let cursorX = 0;

  function layoutNode(node: LayoutUnitNode): number {
    if (node.childNodes.length === 0) {
      const x = cursorX;
      cursorX += GRAPH_NODE_HORIZONTAL_GAP;
      applyUnitAnchorPosition(positions, node.unit, {
        x,
        y: node.depth * GRAPH_NODE_VERTICAL_GAP
      });
      return x;
    }

    const childXValues = node.childNodes.map(layoutNode);
    const x = (childXValues[0] + childXValues[childXValues.length - 1]) / 2;
    applyUnitAnchorPosition(positions, node.unit, {
      x,
      y: node.depth * GRAPH_NODE_VERTICAL_GAP
    });
    return x;
  }

  unitTree.forEach(layoutNode);
  const externalTargetCutIds = new Set(getGroupExternalLinks(cuts, choices).map((link) => link.targetCutId));
  const positionsWithoutFrameOverlap = resolveGroupFrameCollisions(cuts, positions, 'x', externalTargetCutIds);
  return anchorGroupExternalTargets(cuts, choices, positionsWithoutFrameOverlap, 'vertical');
}

function computeGroupedHorizontalLayout(cuts: Cut[], choices: Choice[]): Record<string, GraphPosition> {
  const unitTree = buildLayoutUnitTree(cuts, choices);
  const positions: Record<string, GraphPosition> = {};
  let cursorY = 0;

  function layoutNode(node: LayoutUnitNode): number {
    if (node.childNodes.length === 0) {
      const y = cursorY;
      cursorY += GRAPH_NODE_VERTICAL_GAP;
      applyUnitAnchorPosition(positions, node.unit, {
        x: node.depth * GRAPH_NODE_HORIZONTAL_GAP,
        y
      });
      return y;
    }

    const childYValues = node.childNodes.map(layoutNode);
    const y = (childYValues[0] + childYValues[childYValues.length - 1]) / 2;
    applyUnitAnchorPosition(positions, node.unit, {
      x: node.depth * GRAPH_NODE_HORIZONTAL_GAP,
      y
    });
    return y;
  }

  unitTree.forEach(layoutNode);
  const externalTargetCutIds = new Set(getGroupExternalLinks(cuts, choices).map((link) => link.targetCutId));
  const positionsWithoutFrameOverlap = resolveGroupFrameCollisions(cuts, positions, 'y', externalTargetCutIds);
  return anchorGroupExternalTargets(cuts, choices, positionsWithoutFrameOverlap, 'horizontal');
}

function hasLoopGraphGroups(cuts: Cut[]): boolean {
  return getLoopGraphGroups(cuts).length > 0;
}

export function computeVerticalLayout(cuts: Cut[], choices: Choice[]): Record<string, GraphPosition> {
  return hasLoopGraphGroups(cuts) ? computeGroupedVerticalLayout(cuts, choices) : computeLegacyVerticalLayout(cuts, choices);
}

export function computeHorizontalLayout(cuts: Cut[], choices: Choice[]): Record<string, GraphPosition> {
  return hasLoopGraphGroups(cuts) ? computeGroupedHorizontalLayout(cuts, choices) : computeLegacyHorizontalLayout(cuts, choices);
}

export function computeLocalGroupLayout(
  cuts: Cut[],
  choices: Choice[],
  groupId: string,
  mode: Exclude<GraphLayoutMode, 'custom'>
): Record<string, GraphPosition> {
  const group = getLoopGraphGroups(cuts).find((candidate) => candidate.groupId === groupId);
  if (!group) {
    return {};
  }

  const groupCutIds = new Set(group.cutIds);
  const groupChoices = choices.filter((choice) => groupCutIds.has(choice.cutId) && choice.nextCutId && groupCutIds.has(choice.nextCutId));
  const localPositions =
    mode === 'vertical' ? computeLegacyVerticalLayout(group.cuts, groupChoices) : computeLegacyHorizontalLayout(group.cuts, groupChoices);
  const localPositionValues = Object.values(localPositions);

  if (localPositionValues.length === 0) {
    return {};
  }

  const originX = Math.min(...group.cuts.map((cut) => cut.positionX));
  const originY = Math.min(...group.cuts.map((cut) => cut.positionY));
  const localMinX = Math.min(...localPositionValues.map((position) => position.x));
  const localMinY = Math.min(...localPositionValues.map((position) => position.y));

  return Object.fromEntries(
    group.cuts
      .map((cut) => {
        const position = localPositions[cut.id];
        return position
          ? [
              cut.id,
              {
                x: originX + position.x - localMinX,
                y: originY + position.y - localMinY
              }
            ]
          : null;
      })
      .filter((entry): entry is [string, GraphPosition] => Boolean(entry))
  );
}

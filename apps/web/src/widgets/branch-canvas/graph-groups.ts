import type { Cut } from '@promptoon/shared';

export const GRAPH_CUT_NODE_WIDTH = 240;
export const GRAPH_CUT_NODE_HEIGHT = 190;
export const GRAPH_GROUP_PADDING_X = 44;
export const GRAPH_GROUP_HEADER_HEIGHT = 58;
export const GRAPH_GROUP_PADDING_BOTTOM = 44;

export interface CutGraphGroup {
  groupId: string;
  label: string;
  cutIds: string[];
  cuts: Cut[];
}

export interface CutGraphGroupFrame {
  groupId: string;
  label: string;
  cutIds: string[];
  position: {
    x: number;
    y: number;
  };
  width: number;
  height: number;
}

function compareCuts(left: Cut, right: Cut): number {
  return left.orderIndex - right.orderIndex || left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id);
}

function getFirstGroupCut(group: CutGraphGroup): Cut {
  const [firstCut] = group.cuts;
  if (!firstCut) {
    throw new Error(`Graph group ${group.groupId} has no cuts`);
  }

  return firstCut;
}

export function getLoopGraphGroupId(cut: Cut): string | null {
  const groupId = cut.loopMetadata?.kind === 'exitLoop' ? cut.loopMetadata.groupId.trim() : '';
  return groupId.length > 0 ? groupId : null;
}

export function getCutGroupFrameNodeId(groupId: string): string {
  return `cut-group:${groupId}`;
}

export function getLoopGraphGroups(cuts: Cut[]): CutGraphGroup[] {
  const groupCutsById = new Map<string, Cut[]>();

  for (const cut of cuts) {
    const groupId = getLoopGraphGroupId(cut);
    if (!groupId) {
      continue;
    }

    const groupCuts = groupCutsById.get(groupId) ?? [];
    groupCuts.push(cut);
    groupCutsById.set(groupId, groupCuts);
  }

  return [...groupCutsById.entries()]
    .map(([groupId, groupCuts]) => {
      const sortedCuts = [...groupCuts].sort(compareCuts);
      const firstCut = sortedCuts[0];
      if (!firstCut) {
        return null;
      }

      const label = sortedCuts.find((cut) => cut.loopMetadata?.groupLabel)?.loopMetadata?.groupLabel ?? groupId;

      return {
        groupId,
        label,
        cutIds: sortedCuts.map((cut) => cut.id),
        cuts: sortedCuts
      };
    })
    .filter((group): group is CutGraphGroup => Boolean(group))
    .sort((left, right) => compareCuts(getFirstGroupCut(left), getFirstGroupCut(right)));
}

export function getCutGroupFrames(cuts: Cut[]): CutGraphGroupFrame[] {
  return getLoopGraphGroups(cuts).map((group) => {
    const minX = Math.min(...group.cuts.map((cut) => cut.positionX));
    const minY = Math.min(...group.cuts.map((cut) => cut.positionY));
    const maxX = Math.max(...group.cuts.map((cut) => cut.positionX + GRAPH_CUT_NODE_WIDTH));
    const maxY = Math.max(...group.cuts.map((cut) => cut.positionY + GRAPH_CUT_NODE_HEIGHT));

    return {
      groupId: group.groupId,
      label: group.label,
      cutIds: group.cutIds,
      position: {
        x: minX - GRAPH_GROUP_PADDING_X,
        y: minY - GRAPH_GROUP_HEADER_HEIGHT
      },
      width: Math.max(320, maxX - minX + GRAPH_GROUP_PADDING_X * 2),
      height: Math.max(260, maxY - minY + GRAPH_GROUP_HEADER_HEIGHT + GRAPH_GROUP_PADDING_BOTTOM)
    };
  });
}

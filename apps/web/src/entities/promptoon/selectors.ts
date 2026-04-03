import type { Choice, Cut, EditorSelection } from '@promptoon/shared';

function compareCuts(left: Cut, right: Cut): number {
  return left.orderIndex - right.orderIndex || left.createdAt.localeCompare(right.createdAt);
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
    .sort((left: Choice, right: Choice) => left.orderIndex - right.orderIndex || left.createdAt.localeCompare(right.createdAt));
}

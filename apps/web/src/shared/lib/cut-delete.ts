import type { Choice, Cut } from '@promptoon/shared';

function uniqueCutsById(cuts: Cut[]): Cut[] {
  const seen = new Set<string>();
  return cuts.filter((cut) => {
    if (seen.has(cut.id)) {
      return false;
    }

    seen.add(cut.id);
    return true;
  });
}

export function getIncomingChoiceCount(cutId: string, choices: Choice[]): number {
  return choices.filter((choice) => choice.nextCutId === cutId).length;
}

export function getDeleteCutReconnectCandidates(cutId: string, cuts: Cut[], choices: Choice[]): Cut[] {
  return uniqueCutsById(
    choices
      .filter((choice) => choice.cutId === cutId && choice.nextCutId)
      .map((choice) => cuts.find((cut) => cut.id === choice.nextCutId))
      .filter((cut): cut is Cut => Boolean(cut))
      .filter((cut) => cut.id !== cutId)
  );
}

export function getDefaultDeleteCutReconnectToCutId(cutId: string, cuts: Cut[], choices: Choice[]): string | null {
  const candidates = getDeleteCutReconnectCandidates(cutId, cuts, choices);
  return candidates.length === 1 ? candidates[0].id : null;
}

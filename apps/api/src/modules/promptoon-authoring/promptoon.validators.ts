import type { Choice, Cut, EpisodeDraftResponse, ValidateEpisodeResponse, ValidationIssue } from '@promptoon/shared';

function buildOutgoingEdges(cuts: Cut[], choices: Choice[]): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();

  for (const cut of cuts) {
    adjacency.set(cut.id, []);
  }

  for (const choice of choices) {
    if (!choice.nextCutId) {
      continue;
    }

    adjacency.get(choice.cutId)?.push(choice.nextCutId);
  }

  return adjacency;
}

function buildReverseEdges(cuts: Cut[], choices: Choice[]): Map<string, string[]> {
  const reverse = new Map<string, string[]>();

  for (const cut of cuts) {
    reverse.set(cut.id, []);
  }

  for (const choice of choices) {
    if (!choice.nextCutId) {
      continue;
    }

    reverse.get(choice.nextCutId)?.push(choice.cutId);
  }

  return reverse;
}

function visitGraph(startIds: string[], adjacency: Map<string, string[]>): Set<string> {
  const visited = new Set<string>();
  const stack = [...startIds];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || visited.has(current)) {
      continue;
    }

    visited.add(current);
    for (const next of adjacency.get(current) ?? []) {
      if (!visited.has(next)) {
        stack.push(next);
      }
    }
  }

  return visited;
}

export function validateEpisodeGraph(draft: EpisodeDraftResponse): ValidateEpisodeResponse {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const cutsById = new Map(draft.cuts.map((cut) => [cut.id, cut]));
  const startCuts = draft.cuts.filter((cut) => cut.isStart);
  const endingCuts = draft.cuts.filter((cut) => cut.isEnding || cut.kind === 'ending');

  if (startCuts.length === 0) {
    errors.push({
      code: 'missing_start_cut',
      message: 'Episode must have exactly one start cut.'
    });
  }

  if (startCuts.length > 1) {
    errors.push({
      code: 'multiple_start_cuts',
      message: 'Episode has multiple start cuts.',
      cutIds: startCuts.map((cut) => cut.id)
    });
  }

  if (endingCuts.length === 0) {
    errors.push({
      code: 'missing_ending_cut',
      message: 'Episode must have at least one ending cut.'
    });
  }

  const invalidChoices = draft.choices.filter((choice) => choice.nextCutId && !cutsById.has(choice.nextCutId));
  if (invalidChoices.length > 0) {
    errors.push({
      code: 'invalid_choice_target',
      message: 'Some choices reference a cut outside the episode or a missing cut.',
      choiceIds: invalidChoices.map((choice) => choice.id)
    });
  }

  if (startCuts.length !== 1) {
    return {
      isValid: false,
      errors,
      warnings
    };
  }

  const adjacency = buildOutgoingEdges(draft.cuts, draft.choices);
  const reachableFromStart = visitGraph([startCuts[0].id], adjacency);
  const unreachableCuts = draft.cuts.filter((cut) => !reachableFromStart.has(cut.id));

  if (unreachableCuts.length > 0) {
    errors.push({
      code: 'unreachable_cut',
      message: 'Some cuts cannot be reached from the start cut.',
      cutIds: unreachableCuts.map((cut) => cut.id)
    });
  }

  if (endingCuts.length > 0) {
    const reverseAdjacency = buildReverseEdges(draft.cuts, draft.choices);
    const endingReachable = visitGraph(
      endingCuts.map((cut) => cut.id),
      reverseAdjacency
    );

    const deadPathCuts = draft.cuts.filter((cut) => reachableFromStart.has(cut.id) && !endingReachable.has(cut.id));
    if (deadPathCuts.length > 0) {
      errors.push({
        code: 'dead_path',
        message: 'Some reachable cuts cannot lead to any ending cut.',
        cutIds: deadPathCuts.map((cut) => cut.id)
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}


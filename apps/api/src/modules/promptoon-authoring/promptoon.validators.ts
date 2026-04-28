import { getCutStateRouteConditions, type Choice, type Cut, type EpisodeDraftResponse, type ValidateEpisodeResponse, type ValidationIssue } from '@promptoon/shared';

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

  for (const cut of cuts) {
    if (cut.kind !== 'stateRouter') {
      continue;
    }

    for (const stateRoute of cut.stateRoutes ?? []) {
      adjacency.get(cut.id)?.push(stateRoute.nextCutId);
    }

    if (cut.stateFallbackCutId) {
      adjacency.get(cut.id)?.push(cut.stateFallbackCutId);
    }
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

  for (const cut of cuts) {
    if (cut.kind !== 'stateRouter') {
      continue;
    }

    for (const stateRoute of cut.stateRoutes ?? []) {
      reverse.get(stateRoute.nextCutId)?.push(cut.id);
    }

    if (cut.stateFallbackCutId) {
      reverse.get(cut.stateFallbackCutId)?.push(cut.id);
    }
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

function getReachableStateVariantTargetCutIds(cuts: Cut[], reachableFromStart: Set<string>): Set<string> {
  const stateVariantTargetCutIds = new Set<string>();

  for (const cut of cuts) {
    if (!reachableFromStart.has(cut.id)) {
      continue;
    }

    for (const stateVariant of cut.stateVariants ?? []) {
      stateVariantTargetCutIds.add(stateVariant.variantCutId);
    }
  }

  return stateVariantTargetCutIds;
}

export function validateEpisodeGraph(draft: EpisodeDraftResponse): ValidateEpisodeResponse {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const cutsById = new Map(draft.cuts.map((cut) => [cut.id, cut]));
  const startCuts = draft.cuts.filter((cut) => cut.isStart);
  const endingCuts = draft.cuts.filter((cut) => cut.isEnding || cut.kind === 'ending');

  if (!draft.episode.coverImageUrl) {
    warnings.push({
      code: 'missing_episode_cover',
      message: 'Episode cover image is recommended for the published shorts feed.'
    });
  }

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

  const invalidStateVariantCuts = draft.cuts.filter((cut) =>
    (cut.stateVariants ?? []).some((stateVariant) => stateVariant.variantCutId === cut.id || !cutsById.has(stateVariant.variantCutId))
  );
  if (invalidStateVariantCuts.length > 0) {
    errors.push({
      code: 'invalid_state_variant_target',
      message: 'Some state variants reference a missing cut or the source cut itself.',
      cutIds: invalidStateVariantCuts.map((cut) => cut.id)
    });
  }

  const stateRouterCuts = draft.cuts.filter((cut) => cut.kind === 'stateRouter');
  const invalidStateRouterCuts = stateRouterCuts.filter((cut) => {
    const invalidRouteTarget = (cut.stateRoutes ?? []).some(
      (stateRoute) => stateRoute.nextCutId === cut.id || !cutsById.has(stateRoute.nextCutId)
    );
    const invalidFallbackTarget = Boolean(
      cut.stateFallbackCutId && (cut.stateFallbackCutId === cut.id || !cutsById.has(cut.stateFallbackCutId))
    );

    return invalidRouteTarget || invalidFallbackTarget;
  });

  if (invalidStateRouterCuts.length > 0) {
    errors.push({
      code: 'invalid_state_router_target',
      message: 'Some state routers reference a missing cut or the source cut itself.',
      cutIds: invalidStateRouterCuts.map((cut) => cut.id)
    });
  }

  const stateRoutersWithInvalidConditions = stateRouterCuts.filter((cut) =>
    (cut.stateRoutes ?? []).some((stateRoute) => getCutStateRouteConditions(stateRoute).length === 0)
  );
  if (stateRoutersWithInvalidConditions.length > 0) {
    errors.push({
      code: 'invalid_state_router_condition',
      message: 'Some state router routes do not have a valid condition.',
      cutIds: stateRoutersWithInvalidConditions.map((cut) => cut.id)
    });
  }

  const stateRoutersWithoutRoutes = stateRouterCuts.filter((cut) => (cut.stateRoutes ?? []).length === 0);
  if (stateRoutersWithoutRoutes.length > 0) {
    errors.push({
      code: 'missing_state_router_route',
      message: 'State router cuts must have at least one conditional route.',
      cutIds: stateRoutersWithoutRoutes.map((cut) => cut.id)
    });
  }

  const stateRoutersWithoutFallback = stateRouterCuts.filter((cut) => !cut.stateFallbackCutId);
  if (stateRoutersWithoutFallback.length > 0) {
    errors.push({
      code: 'missing_state_router_fallback',
      message: 'State router cuts must have a fallback cut.',
      cutIds: stateRoutersWithoutFallback.map((cut) => cut.id)
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
  const reachableStateVariantTargetCutIds = getReachableStateVariantTargetCutIds(draft.cuts, reachableFromStart);
  const unreachableCuts = draft.cuts.filter((cut) => !reachableFromStart.has(cut.id) && !reachableStateVariantTargetCutIds.has(cut.id));

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

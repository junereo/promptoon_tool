import { getCutStateRouteConditions, type Choice, type Cut, type EpisodeDraftResponse, type ValidateEpisodeResponse, type ValidationIssue } from '@promptoon/shared';

function isEndingLikeCut(cut: Pick<Cut, 'isEnding' | 'kind'>): boolean {
  return cut.isEnding || cut.kind === 'ending' || cut.kind === 'resultCard';
}

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

function getReachableLoopVariantTargetCutIds(cuts: Cut[], reachableFromStart: Set<string>): Set<string> {
  const loopVariantTargetCutIds = new Set<string>();

  for (const cut of cuts) {
    if (!reachableFromStart.has(cut.id)) {
      continue;
    }

    const selectedVariantCutIds =
      cut.loopMetadata?.role === 'stageBase'
        ? [cut.loopMetadata.selectedVariantCutId ?? null, ...(cut.loopMetadata.variantCutIds ?? [])]
        : [];
    for (const selectedVariantCutId of selectedVariantCutIds) {
      if (selectedVariantCutId) {
        loopVariantTargetCutIds.add(selectedVariantCutId);
      }
    }
  }

  return loopVariantTargetCutIds;
}

function getLoopStatePrefix(groupId: string): string {
  return `exitLoop.${groupId}.`;
}

function getLoopRouteStateKey(groupId: string): string {
  return `${getLoopStatePrefix(groupId)}route`;
}

function isForwardChoice(choice: Choice): boolean {
  const label = choice.label.trim().toLowerCase();
  return label.includes('forward') || label.includes('전진') || label.includes('나아');
}

function isBackChoice(choice: Choice): boolean {
  const label = choice.label.trim().toLowerCase();
  return label.includes('back') || label.includes('돌아');
}

function hasLoopDecisionWrite(choice: Choice, groupId: string, value: 'forward' | 'back'): boolean {
  const decisionStateKey = `${getLoopStatePrefix(groupId)}decision`;
  return (choice.stateWrites ?? []).some(
    (stateWrite) =>
      stateWrite.key === decisionStateKey &&
      stateWrite.value === value &&
      (stateWrite.operation ?? 'set') === 'exitLoopDecision'
  );
}

function validateLoopCuts(
  draft: EpisodeDraftResponse,
  cutsById: Map<string, Cut>,
  choicesByCutId: Map<string, Choice[]>
): ValidationIssue[] {
  const errors: ValidationIssue[] = [];
  const loopCuts = draft.cuts.filter((cut) => cut.loopMetadata?.kind === 'exitLoop');

  const invalidMetadataCuts = loopCuts.filter((cut) => {
    const metadata = cut.loopMetadata;
    if (!metadata) {
      return false;
    }

    if (metadata.role === 'stageBase') {
      return cut.kind !== 'loopStage' || !metadata.stageIndex || !metadata.stageCount;
    }

    if (metadata.role === 'stageVariant') {
      return cut.kind !== 'loopVariant' || !metadata.stageIndex || !metadata.stageCount || !metadata.baseCutId || !metadata.truth || !metadata.expectedChoice;
    }

    if (metadata.role === 'spacer') {
      return cut.kind !== 'loopSpacer' || !metadata.stageIndex || !metadata.stageCount;
    }

    return cut.kind !== 'stateRouter';
  });
  if (invalidMetadataCuts.length > 0) {
    errors.push({
      code: 'invalid_loop_metadata',
      message: 'Some Exit Loop cuts have metadata that does not match their cut kind or role.',
      cutIds: invalidMetadataCuts.map((cut) => cut.id)
    });
  }

  const invalidVariantTargets = loopCuts.filter((cut) => {
    const metadata = cut.loopMetadata;
    if (!metadata) {
      return false;
    }

    if (metadata.role === 'stageBase') {
      const targetIds = [...new Set([metadata.selectedVariantCutId ?? null, ...(metadata.variantCutIds ?? [])].filter(Boolean))];
      return targetIds.some((targetId) => {
        const targetCut = targetId ? cutsById.get(targetId) : null;
        return !targetCut || targetCut.kind !== 'loopVariant' || targetCut.loopMetadata?.baseCutId !== cut.id;
      });
    }

    if (metadata.role === 'stageVariant') {
      const baseCut = metadata.baseCutId ? cutsById.get(metadata.baseCutId) : null;
      return !baseCut || baseCut.kind !== 'loopStage';
    }

    return false;
  });
  if (invalidVariantTargets.length > 0) {
    errors.push({
      code: 'invalid_loop_variant_target',
      message: 'Some Exit Loop stage/variant references are missing or inconsistent.',
      cutIds: invalidVariantTargets.map((cut) => cut.id)
    });
  }

  const groupedStageCuts = new Map<string, Cut[]>();
  for (const cut of loopCuts) {
    const metadata = cut.loopMetadata;
    if (!metadata) {
      continue;
    }

    if (metadata.role === 'stageBase') {
      const groupStages = groupedStageCuts.get(metadata.groupId) ?? [];
      groupStages.push(cut);
      groupedStageCuts.set(metadata.groupId, groupStages);
    }
  }

  const entryResetFailures: Cut[] = [];
  const stageChoiceFailures: Cut[] = [];
  const stateMappingFailures: Cut[] = [];
  const resultRouterFailures: Cut[] = [];
  const variantCoverageFailures: Cut[] = [];

  for (const [groupId, stageCuts] of groupedStageCuts.entries()) {
    const sortedStages = [...stageCuts].sort((left, right) => (left.loopMetadata?.stageIndex ?? 0) - (right.loopMetadata?.stageIndex ?? 0));
    const stageCount = sortedStages[0]?.loopMetadata?.stageCount ?? sortedStages.length;
    const resultRouter = loopCuts.find((cut) => cut.loopMetadata?.groupId === groupId && cut.loopMetadata?.role === 'resultRouter');
    const routeStateKey = getLoopRouteStateKey(groupId);
    const groupVariantCuts = loopCuts.filter((cut) => cut.loopMetadata?.groupId === groupId && cut.loopMetadata.role === 'stageVariant');

    if (groupVariantCuts.length === 0) {
      variantCoverageFailures.push(...sortedStages);
    }

    if (
      !resultRouter ||
      resultRouter.kind !== 'stateRouter' ||
      !resultRouter.stateFallbackCutId ||
      !(resultRouter.stateRoutes ?? []).some((stateRoute) =>
        getCutStateRouteConditions(stateRoute).some(
          (condition) => condition.stateKey === routeStateKey && condition.equals === 'exit'
        )
      )
    ) {
      if (resultRouter) {
        resultRouterFailures.push(resultRouter);
      } else {
        resultRouterFailures.push(...sortedStages);
      }
    }

    for (const stageCut of sortedStages) {
      const metadata = stageCut.loopMetadata;
      if (!metadata || !metadata.stageIndex) {
        continue;
      }

      const stageIndex = metadata.stageIndex;
      const stageChoices = choicesByCutId.get(stageCut.id) ?? [];
      const forwardChoice = stageChoices.find(isForwardChoice) ?? null;
      const backChoice = stageChoices.find(isBackChoice) ?? null;
      const targetCutId = stageIndex < stageCount
        ? draft.cuts.find(
            (cut) =>
              cut.loopMetadata?.groupId === groupId &&
              cut.loopMetadata?.role === 'spacer' &&
              cut.loopMetadata?.stageIndex === stageIndex
          )?.id ?? null
        : resultRouter?.id ?? null;

      if (stageIndex < stageCount) {
        const linkedChoices = stageChoices.filter((choice) => choice.nextCutId);
        if (linkedChoices.length !== 1 || !targetCutId || linkedChoices[0]?.nextCutId !== targetCutId) {
          stageChoiceFailures.push(stageCut);
        }
      } else {
        if (
          !forwardChoice ||
          !backChoice ||
          !targetCutId ||
          forwardChoice.nextCutId !== targetCutId ||
          backChoice.nextCutId !== targetCutId
        ) {
          stageChoiceFailures.push(stageCut);
        }

        if (
          forwardChoice &&
          backChoice &&
          (!hasLoopDecisionWrite(forwardChoice, groupId, 'forward') || !hasLoopDecisionWrite(backChoice, groupId, 'back'))
        ) {
          stateMappingFailures.push(stageCut);
        }
      }

      if (stageIndex === 1 && metadata.resetStateKeyPrefix !== getLoopStatePrefix(groupId)) {
        entryResetFailures.push(stageCut);
      }

      if (stageIndex < stageCount) {
        const spacerCut = draft.cuts.find(
          (cut) =>
            cut.loopMetadata?.groupId === groupId &&
            cut.loopMetadata?.role === 'spacer' &&
            cut.loopMetadata?.stageIndex === stageIndex
        );
        const nextStageCut = sortedStages.find((cut) => cut.loopMetadata?.stageIndex === stageIndex + 1);
        const spacerChoices = spacerCut ? choicesByCutId.get(spacerCut.id) ?? [] : [];
        if (!spacerCut || !nextStageCut || spacerChoices.length !== 1 || spacerChoices[0]?.nextCutId !== nextStageCut.id) {
          stageChoiceFailures.push(stageCut);
        }
      }
    }
  }

  if (entryResetFailures.length > 0) {
    errors.push({
      code: 'missing_loop_entry_reset',
      message: 'Exit Loop first stages must define their loop state key prefix.',
      cutIds: entryResetFailures.map((cut) => cut.id)
    });
  }

  if (variantCoverageFailures.length > 0) {
    errors.push({
      code: 'invalid_loop_variant_target',
      message: 'Exit Loop groups must include at least one real anomaly or fake suspicion variant.',
      cutIds: [...new Set(variantCoverageFailures.map((cut) => cut.id))]
    });
  }

  if (stageChoiceFailures.length > 0) {
    errors.push({
      code: 'invalid_loop_stage_choices',
      message: 'Some Exit Loop stages are missing auto-flow links, decision choices, or spacer links.',
      cutIds: [...new Set(stageChoiceFailures.map((cut) => cut.id))]
    });
  }

  if (stateMappingFailures.length > 0) {
    errors.push({
      code: 'invalid_loop_state_mapping',
      message: 'Exit Loop decision choices must write forward/back decision state.',
      cutIds: stateMappingFailures.map((cut) => cut.id)
    });
  }

  if (resultRouterFailures.length > 0) {
    errors.push({
      code: 'invalid_loop_result_router',
      message: 'Exit Loop groups must end in a state router that sends route=exit to continuation and fallback to retry.',
      cutIds: [...new Set(resultRouterFailures.map((cut) => cut.id))]
    });
  }

  return errors;
}

export function validateEpisodeGraph(
  draft: EpisodeDraftResponse,
  options: { projectThumbnailUrl?: string | null } = {}
): ValidateEpisodeResponse {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const cutsById = new Map(draft.cuts.map((cut) => [cut.id, cut]));
  const choicesByCutId = new Map<string, Choice[]>();
  for (const choice of draft.choices) {
    const currentChoices = choicesByCutId.get(choice.cutId) ?? [];
    currentChoices.push(choice);
    choicesByCutId.set(choice.cutId, currentChoices);
  }
  const startCuts = draft.cuts.filter((cut) => cut.isStart);
  const endingCuts = draft.cuts.filter(isEndingLikeCut);

  const feedCoverImageUrl = options.projectThumbnailUrl?.trim() || draft.episode.coverImageUrl?.trim() || null;
  if (!feedCoverImageUrl) {
    warnings.push({
      code: 'missing_episode_cover',
      message: 'Project representative image or episode cover image is recommended for the published shorts feed.'
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

  errors.push(...validateLoopCuts(draft, cutsById, choicesByCutId));

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
  const reachableLoopVariantTargetCutIds = getReachableLoopVariantTargetCutIds(draft.cuts, reachableFromStart);
  const unreachableCuts = draft.cuts.filter(
    (cut) =>
      !reachableFromStart.has(cut.id) &&
      !reachableStateVariantTargetCutIds.has(cut.id) &&
      !reachableLoopVariantTargetCutIds.has(cut.id)
  );

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

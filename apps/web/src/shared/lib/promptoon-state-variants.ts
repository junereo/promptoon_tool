import {
  doesCutStateRouteMatch,
  type ChoiceStateWrite,
  type CutStateRoute,
  type CutStateVariant,
  type PromptoonLoopMetadata,
  type PublishManifest
} from '@promptoon/shared';

export type PromptoonViewerState = Record<string, string>;

type StatefulChoice = {
  stateWrites?: ChoiceStateWrite[];
};

type StatefulCut = {
  id: string;
  kind?: string;
  stateVariants?: CutStateVariant[];
  stateRoutes?: CutStateRoute[];
  stateFallbackCutId?: string | null;
};

type LoopRenderableCut = StatefulCut & {
  loopMetadata?: PromptoonLoopMetadata | null;
  orderIndex?: number;
};

function getLoopStatePrefix(groupId: string): string {
  return `exitLoop.${groupId}.`;
}

function getLoopActiveVariantCutIdStateKey(groupId: string): string {
  return `${getLoopStatePrefix(groupId)}activeVariantCutId`;
}

function getLoopActiveTruthStateKey(groupId: string): string {
  return `${getLoopStatePrefix(groupId)}activeTruth`;
}

function getLoopActiveStageStateKey(groupId: string): string {
  return `${getLoopStatePrefix(groupId)}activeStage`;
}

function getLoopLevelStateKey(groupId: string): string {
  return `${getLoopStatePrefix(groupId)}level`;
}

function getLoopRouteStateKey(groupId: string): string {
  return `${getLoopStatePrefix(groupId)}route`;
}

function parseLoopLevel(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '0', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function getLoopVariantCutCandidates<TCut extends LoopRenderableCut>(
  groupId: string,
  cutsById: Map<string, TCut>
): TCut[] {
  return [...cutsById.values()]
    .filter((cut) => cut.kind === 'loopVariant' && cut.loopMetadata?.groupId === groupId && cut.loopMetadata.role === 'stageVariant')
    .sort((left, right) => (left.orderIndex ?? 0) - (right.orderIndex ?? 0) || left.id.localeCompare(right.id));
}

function getLoopExpectedChoice(truth: string | undefined): 'forward' | 'back' | null {
  if (truth === 'real_anomaly') {
    return 'back';
  }

  if (truth === 'fake_suspicion') {
    return 'forward';
  }

  return null;
}

function clearLoopActiveVariantState(nextState: PromptoonViewerState, groupId: string): void {
  delete nextState[getLoopActiveVariantCutIdStateKey(groupId)];
  delete nextState[getLoopActiveTruthStateKey(groupId)];
  delete nextState[getLoopActiveStageStateKey(groupId)];
}

function getLoopGroupIdFromDecisionKey(key: string): string | null {
  if (!key.startsWith('exitLoop.') || !key.endsWith('.decision')) {
    return null;
  }

  const groupId = key.slice('exitLoop.'.length, -'.decision'.length);
  return groupId.length > 0 ? groupId : null;
}

export function getPromptoonViewerStateStorageKey(publishId: string): string {
  return `promptoon:viewer-state:${publishId}`;
}

export function readPromptoonViewerState(publishId: string): PromptoonViewerState {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const rawValue = window.localStorage.getItem(getPromptoonViewerStateStorageKey(publishId));
    if (!rawValue) {
      return {};
    }

    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    );
  } catch {
    return {};
  }
}

export function writePromptoonViewerState(publishId: string, state: PromptoonViewerState): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(getPromptoonViewerStateStorageKey(publishId), JSON.stringify(state));
}

export function clearPromptoonViewerState(publishId: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(getPromptoonViewerStateStorageKey(publishId));
}

export function applyChoiceStateWrites<TChoice extends StatefulChoice>(
  state: PromptoonViewerState,
  choice: TChoice
): PromptoonViewerState {
  const stateWrites = choice.stateWrites ?? [];
  if (stateWrites.length === 0) {
    return state;
  }

  const nextState = { ...state };
  for (const stateWrite of stateWrites) {
    const key = stateWrite.key.trim();
    const value = stateWrite.value.trim();
    if (!key || !value) {
      continue;
    }

    if (stateWrite.operation === 'exitLoopDecision') {
      const groupId = getLoopGroupIdFromDecisionKey(key);
      if (!groupId) {
        continue;
      }

      const activeTruth = nextState[getLoopActiveTruthStateKey(groupId)];
      const expectedChoice = getLoopExpectedChoice(activeTruth);
      const currentLevel = parseLoopLevel(nextState[getLoopLevelStateKey(groupId)]);
      const exitLevelRequired = parseLoopLevel(nextState[`${getLoopStatePrefix(groupId)}exitLevelRequired`]) || 5;
      const isCorrect = expectedChoice === value;
      const nextLevel = isCorrect ? currentLevel + 1 : 0;

      nextState[key] = value;
      nextState[getLoopLevelStateKey(groupId)] = String(nextLevel);
      nextState[getLoopRouteStateKey(groupId)] = isCorrect && value === 'forward' && nextLevel >= exitLevelRequired ? 'exit' : 'retry';
      clearLoopActiveVariantState(nextState, groupId);
      continue;
    }

    if (key && value) {
      nextState[key] = value;
    }
  }

  return nextState;
}

export function clearPromptoonViewerStateByPrefix(
  state: PromptoonViewerState,
  stateKeyPrefix: string
): PromptoonViewerState {
  const prefix = stateKeyPrefix.trim();
  if (!prefix) {
    return state;
  }

  let changed = false;
  const nextState: PromptoonViewerState = {};
  for (const [key, value] of Object.entries(state)) {
    if (key.startsWith(prefix)) {
      changed = true;
      continue;
    }

    nextState[key] = value;
  }

  return changed ? nextState : state;
}

export function resolveStateVariantCut<TCut extends StatefulCut>(
  baseCut: TCut,
  viewerState: PromptoonViewerState,
  cutsById: Map<string, TCut>
): TCut {
  for (const stateVariant of baseCut.stateVariants ?? []) {
    if (viewerState[stateVariant.stateKey] !== stateVariant.equals) {
      continue;
    }

    const variantCut = cutsById.get(stateVariant.variantCutId);
    if (variantCut) {
      return variantCut;
    }
  }

  return baseCut;
}

export function resolveStateRouterTargetCut<TCut extends StatefulCut>(
  baseCut: TCut,
  viewerState: PromptoonViewerState,
  cutsById: Map<string, TCut>
): TCut {
  let currentCut = baseCut;
  const visitedCutIds = new Set<string>();

  while (currentCut.kind === 'stateRouter' && !visitedCutIds.has(currentCut.id)) {
    visitedCutIds.add(currentCut.id);

    const matchedRoute = (currentCut.stateRoutes ?? []).find((stateRoute) => doesCutStateRouteMatch(stateRoute, viewerState));
    const nextCutId = matchedRoute?.nextCutId ?? currentCut.stateFallbackCutId ?? null;
    const nextCut = nextCutId ? cutsById.get(nextCutId) : null;

    if (!nextCut) {
      return currentCut;
    }

    currentCut = nextCut;
  }

  return currentCut;
}

export function resolveLoopRenderableCut<TCut extends LoopRenderableCut>(
  baseCut: TCut,
  cutsById: Map<string, TCut>,
  viewerState: PromptoonViewerState = {}
): TCut {
  const groupId = baseCut.loopMetadata?.role === 'stageBase' ? baseCut.loopMetadata.groupId : null;
  const activeVariantCutId = groupId ? viewerState[getLoopActiveVariantCutIdStateKey(groupId)] : null;
  if (activeVariantCutId) {
    const activeVariantCut = cutsById.get(activeVariantCutId) ?? null;
    if (activeVariantCut?.loopMetadata?.baseCutId === baseCut.id) {
      return activeVariantCut;
    }

    return baseCut;
  }

  const selectedVariantCutId =
    baseCut.kind === 'loopStage' && baseCut.loopMetadata?.role === 'stageBase'
      ? baseCut.loopMetadata.selectedVariantCutId
      : null;
  if (!selectedVariantCutId) {
    return baseCut;
  }

  return cutsById.get(selectedVariantCutId) ?? baseCut;
}

export function initializeExitLoopStateForCut<TCut extends LoopRenderableCut>(
  state: PromptoonViewerState,
  activeCut: TCut | null,
  cutsById: Map<string, TCut>
): PromptoonViewerState {
  if (
    !activeCut ||
    activeCut.kind !== 'loopStage' ||
    activeCut.loopMetadata?.kind !== 'exitLoop' ||
    activeCut.loopMetadata.role !== 'stageBase' ||
    activeCut.loopMetadata.stageIndex !== 1
  ) {
    return state;
  }

  const groupId = activeCut.loopMetadata.groupId;
  const activeVariantCutIdKey = getLoopActiveVariantCutIdStateKey(groupId);
  if (state[activeVariantCutIdKey]) {
    return state;
  }

  const candidates = getLoopVariantCutCandidates(groupId, cutsById);
  if (candidates.length === 0) {
    return state;
  }

  const currentLevel = parseLoopLevel(state[getLoopLevelStateKey(groupId)]);
  const selectedVariant = candidates[currentLevel % candidates.length];
  if (!selectedVariant?.loopMetadata?.truth) {
    return state;
  }

  return {
    ...state,
    [`${getLoopStatePrefix(groupId)}exitLevelRequired`]: String(activeCut.loopMetadata.exitLevelRequired ?? 5),
    [getLoopActiveStageStateKey(groupId)]: String(selectedVariant.loopMetadata.stageIndex ?? ''),
    [activeVariantCutIdKey]: selectedVariant.id,
    [getLoopActiveTruthStateKey(groupId)]: selectedVariant.loopMetadata.truth,
    [getLoopLevelStateKey(groupId)]: String(currentLevel),
    [getLoopRouteStateKey(groupId)]: 'retry'
  };
}

export function resolveManifestStateVariantCut(
  baseCut: PublishManifest['cuts'][number],
  viewerState: PromptoonViewerState,
  cutsById: Map<string, PublishManifest['cuts'][number]>
): PublishManifest['cuts'][number] {
  return resolveStateVariantCut(baseCut, viewerState, cutsById);
}

export function resolveManifestStateRouterTargetCut(
  baseCut: PublishManifest['cuts'][number],
  viewerState: PromptoonViewerState,
  cutsById: Map<string, PublishManifest['cuts'][number]>
): PublishManifest['cuts'][number] {
  return resolveStateRouterTargetCut(baseCut, viewerState, cutsById);
}

export function resolveManifestLoopRenderableCut(
  baseCut: PublishManifest['cuts'][number],
  cutsById: Map<string, PublishManifest['cuts'][number]>,
  viewerState: PromptoonViewerState = {}
): PublishManifest['cuts'][number] {
  return resolveLoopRenderableCut(baseCut, cutsById, viewerState);
}

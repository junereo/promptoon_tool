import {
  doesCutStateRouteMatch,
  type ChoiceStateWrite,
  type CutStateRoute,
  type CutStateVariant,
  type PromptoonLoopMetadata,
  type PublishManifest
} from '@promptoon/shared';

export type PromptoonViewerState = Record<string, string>;

interface PromptoonViewerStateEnvelope {
  version: 1;
  payload: PromptoonViewerState;
  integrity: {
    alg: 'fnv1a64';
    value: string;
  };
}

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

function isPromptoonViewerStateEnvelope(value: unknown): value is PromptoonViewerStateEnvelope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const envelope = value as Partial<PromptoonViewerStateEnvelope>;
  return envelope.version === 1 && envelope.integrity?.alg === 'fnv1a64' && typeof envelope.integrity.value === 'string';
}

function normalizeViewerState(value: unknown): PromptoonViewerState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[0] === 'string' && typeof entry[1] === 'string')
  );
}

function canonicalizeViewerState(state: PromptoonViewerState): string {
  return JSON.stringify(Object.fromEntries(Object.entries(state).sort(([left], [right]) => left.localeCompare(right))));
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = (hash * prime) & mask;
  }

  return hash.toString(16).padStart(16, '0');
}

function getViewerStateIntegrity(publishId: string, state: PromptoonViewerState): string {
  return fnv1a64(`promptoon.viewer-state.v1:${publishId}:${canonicalizeViewerState(state)}`);
}

function createViewerStateEnvelope(publishId: string, state: PromptoonViewerState): PromptoonViewerStateEnvelope {
  return {
    version: 1,
    payload: state,
    integrity: {
      alg: 'fnv1a64',
      value: getViewerStateIntegrity(publishId, state)
    }
  };
}

function clearLegacyExitLoopStorage(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const keysToRemove: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key?.startsWith('promptoon:exit-loop:')) {
      keysToRemove.push(key);
    }
  }

  for (const key of keysToRemove) {
    window.localStorage.removeItem(key);
  }
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
    clearLegacyExitLoopStorage();
    const rawValue = window.localStorage.getItem(getPromptoonViewerStateStorageKey(publishId));
    if (!rawValue) {
      return {};
    }

    const parsed = JSON.parse(rawValue);
    if (!isPromptoonViewerStateEnvelope(parsed)) {
      window.localStorage.removeItem(getPromptoonViewerStateStorageKey(publishId));
      return {};
    }

    const state = normalizeViewerState(parsed.payload);
    const expectedIntegrity = getViewerStateIntegrity(publishId, state);
    if (parsed.integrity.value !== expectedIntegrity) {
      window.localStorage.removeItem(getPromptoonViewerStateStorageKey(publishId));
      return {};
    }

    return state;
  } catch {
    window.localStorage.removeItem(getPromptoonViewerStateStorageKey(publishId));
    return {};
  }
}

export function writePromptoonViewerState(publishId: string, state: PromptoonViewerState): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(getPromptoonViewerStateStorageKey(publishId), JSON.stringify(createViewerStateEnvelope(publishId, state)));
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

export function sanitizePromptoonViewerStateForManifest(
  state: PromptoonViewerState,
  manifest: PublishManifest
): PromptoonViewerState {
  const allowedValuesByKey = new Map<string, Set<string>>();

  function allow(key: string | undefined | null, value: string | undefined | null) {
    const normalizedKey = key?.trim();
    const normalizedValue = value?.trim();
    if (!normalizedKey || !normalizedValue) {
      return;
    }

    const values = allowedValuesByKey.get(normalizedKey) ?? new Set<string>();
    values.add(normalizedValue);
    allowedValuesByKey.set(normalizedKey, values);
  }

  for (const cut of manifest.cuts) {
    for (const variant of cut.stateVariants ?? []) {
      allow(variant.stateKey, variant.equals);
    }

    for (const route of cut.stateRoutes ?? []) {
      allow(route.stateKey, route.equals);
      for (const condition of route.conditions ?? []) {
        allow(condition.stateKey, condition.equals);
      }
    }

    for (const choice of cut.choices ?? []) {
      for (const stateWrite of choice.stateWrites ?? []) {
        allow(stateWrite.key, stateWrite.value);
      }
    }
  }

  const loopGroups = new Map<
    string,
    {
      exitLevelRequired: number;
      variantsById: Map<string, { stageIndex?: number; truth?: string }>;
    }
  >();

  for (const cut of manifest.cuts) {
    const metadata = cut.loopMetadata;
    if (metadata?.kind !== 'exitLoop') {
      continue;
    }

    const group = loopGroups.get(metadata.groupId) ?? {
      exitLevelRequired: 5,
      variantsById: new Map<string, { stageIndex?: number; truth?: string }>()
    };

    if (metadata.role === 'stageBase' && metadata.stageIndex === 1) {
      group.exitLevelRequired = metadata.exitLevelRequired ?? 5;
    }

    if (metadata.role === 'stageVariant' && metadata.truth) {
      group.variantsById.set(cut.id, {
        stageIndex: metadata.stageIndex,
        truth: metadata.truth
      });
    }

    loopGroups.set(metadata.groupId, group);
  }

  for (const [groupId, group] of loopGroups) {
    const prefix = getLoopStatePrefix(groupId);
    allow(`${prefix}exitLevelRequired`, String(group.exitLevelRequired));
    allow(getLoopRouteStateKey(groupId), 'retry');
    allow(getLoopRouteStateKey(groupId), 'exit');
    allow(`${prefix}decision`, 'forward');
    allow(`${prefix}decision`, 'back');

    for (let level = 0; level <= group.exitLevelRequired; level += 1) {
      allow(getLoopLevelStateKey(groupId), String(level));
    }

    for (const [variantCutId, variant] of group.variantsById) {
      allow(getLoopActiveVariantCutIdStateKey(groupId), variantCutId);
      allow(getLoopActiveTruthStateKey(groupId), variant.truth);
      if (variant.stageIndex) {
        allow(getLoopActiveStageStateKey(groupId), String(variant.stageIndex));
      }
    }
  }

  const nextState: PromptoonViewerState = {};
  for (const [key, value] of Object.entries(state)) {
    if (allowedValuesByKey.get(key)?.has(value)) {
      nextState[key] = value;
      continue;
    }

    const loopGroup = [...loopGroups.entries()].find(([groupId]) => key === getLoopLevelStateKey(groupId));
    if (loopGroup) {
      const parsedLevel = Number.parseInt(value, 10);
      if (Number.isFinite(parsedLevel) && parsedLevel >= 0) {
        nextState[key] = String(Math.min(parsedLevel, loopGroup[1].exitLevelRequired));
      }
    }
  }

  for (const [groupId, group] of loopGroups) {
    const activeVariantCutIdKey = getLoopActiveVariantCutIdStateKey(groupId);
    const activeVariantCutId = nextState[activeVariantCutIdKey];
    if (!activeVariantCutId) {
      continue;
    }

    const variant = group.variantsById.get(activeVariantCutId);
    const expectedTruth = variant?.truth;
    const expectedStage = variant?.stageIndex ? String(variant.stageIndex) : undefined;
    if (
      !variant ||
      nextState[getLoopActiveTruthStateKey(groupId)] !== expectedTruth ||
      (expectedStage && nextState[getLoopActiveStageStateKey(groupId)] !== expectedStage)
    ) {
      delete nextState[activeVariantCutIdKey];
      delete nextState[getLoopActiveTruthStateKey(groupId)];
      delete nextState[getLoopActiveStageStateKey(groupId)];
    }

    const level = parseLoopLevel(nextState[getLoopLevelStateKey(groupId)]);
    if (level > group.exitLevelRequired) {
      nextState[getLoopLevelStateKey(groupId)] = String(group.exitLevelRequired);
    }
  }

  return Object.keys(nextState).length === Object.keys(state).length &&
    Object.entries(nextState).every(([key, value]) => state[key] === value)
    ? state
    : nextState;
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

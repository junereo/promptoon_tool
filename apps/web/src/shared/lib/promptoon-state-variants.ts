import { doesCutStateRouteMatch, type ChoiceStateWrite, type CutStateRoute, type CutStateVariant, type PublishManifest } from '@promptoon/shared';

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
    if (key && value) {
      nextState[key] = value;
    }
  }

  return nextState;
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

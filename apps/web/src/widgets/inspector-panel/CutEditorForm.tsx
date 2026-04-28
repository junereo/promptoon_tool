import {
  MAX_CUT_STATE_ROUTE_CONDITIONS,
  getCutStateRouteConditions,
  type Cut,
  type CutContentBlock,
  type CutStateCondition,
  type CutStateRoute,
  type CutStateVariant,
  type PatchCutRequest
} from '@promptoon/shared';
import type { ChangeEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { CONTENT_SPACING_OPTIONS, deriveContentBlocksBody, normalizeCutContentBlocks } from '../../shared/lib/cut-content';
import { useDebounce } from '../../shared/lib/use-debounce';
import {
  CUT_EFFECT_OPTIONS,
  DEFAULT_CUT_EFFECT,
  DEFAULT_CUT_EFFECT_DURATION_MS,
  EDGE_FADE_COLOR_OPTIONS,
  EDGE_FADE_INTENSITY_OPTIONS,
  EDGE_FADE_OPTIONS,
  MAX_CUT_EFFECT_DURATION_MS
} from '../../shared/lib/cut-effects';
import { ApiError } from '../../shared/api/client';
import { CutContentBlocksEditor } from './CutContentBlocksEditor';

function FieldLabel({ children }: { children: string }) {
  return <label className="text-xs font-medium text-zinc-500">{children}</label>;
}

function inputClassName() {
  return 'mt-1.5 w-full rounded-xl border border-editor-border bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-editor-accentSoft';
}

function GroupTitle({ children }: { children: string }) {
  return <p className="text-xs font-semibold text-zinc-500">{children}</p>;
}

function CoordinateInput({
  ariaLabel,
  onValueChange,
  value
}: {
  ariaLabel: string;
  onValueChange: (value: number) => void;
  value: number;
}) {
  const [draftValue, setDraftValue] = useState(() => String(value));

  useEffect(() => {
    setDraftValue(String(value));
  }, [value]);

  return (
    <input
      aria-label={ariaLabel}
      className={inputClassName()}
      onBlur={() => {
        if (draftValue === '' || !Number.isFinite(Number(draftValue))) {
          setDraftValue(String(value));
        }
      }}
      onChange={(event) => {
        const nextValue = event.target.value;
        const numericValue = Number(nextValue);

        setDraftValue(nextValue);

        if (nextValue !== '' && Number.isFinite(numericValue)) {
          onValueChange(numericValue);
        }
      }}
      step={1}
      type="number"
      value={draftValue}
    />
  );
}

interface CutFormState {
  title: string;
  contentBlocks: CutContentBlock[];
  contentViewMode: 'default' | 'inverse';
  kind: Cut['kind'];
  dialogAnchorX: Cut['dialogAnchorX'];
  dialogAnchorY: Cut['dialogAnchorY'];
  dialogOffsetX: number;
  dialogOffsetY: number;
  dialogTextAlign: Cut['dialogTextAlign'];
  startEffect: Cut['startEffect'];
  endEffect: Cut['endEffect'];
  startEffectDurationMs: number;
  endEffectDurationMs: number;
  assetUrl: string;
  edgeFade: NonNullable<Cut['edgeFade']>;
  edgeFadeIntensity: NonNullable<Cut['edgeFadeIntensity']>;
  edgeFadeColor: NonNullable<Cut['edgeFadeColor']>;
  marginBottomToken: NonNullable<Cut['marginBottomToken']>;
  stateVariants: CutStateVariant[];
  stateRoutes: CutStateRoute[];
  stateFallbackCutId: string;
  isStart: boolean;
  isEnding: boolean;
}

function toFormState(cut: Cut): CutFormState {
  return {
    title: cut.title,
    contentBlocks: normalizeCutContentBlocks(cut),
    contentViewMode: cut.contentViewMode ?? 'default',
    kind: cut.kind,
    dialogAnchorX: cut.dialogAnchorX,
    dialogAnchorY: cut.dialogAnchorY,
    dialogOffsetX: cut.dialogOffsetX,
    dialogOffsetY: cut.dialogOffsetY,
    dialogTextAlign: cut.dialogTextAlign,
    startEffect: cut.startEffect ?? DEFAULT_CUT_EFFECT,
    endEffect: cut.endEffect ?? DEFAULT_CUT_EFFECT,
    startEffectDurationMs: cut.startEffectDurationMs ?? DEFAULT_CUT_EFFECT_DURATION_MS,
    endEffectDurationMs: cut.endEffectDurationMs ?? DEFAULT_CUT_EFFECT_DURATION_MS,
    assetUrl: cut.assetUrl ?? '',
    edgeFade: cut.edgeFade ?? 'none',
    edgeFadeIntensity: cut.edgeFadeIntensity ?? 'normal',
    edgeFadeColor: cut.edgeFadeColor ?? 'black',
    marginBottomToken: cut.marginBottomToken ?? 'none',
    stateVariants: cut.stateVariants ?? [],
    stateRoutes: (cut.stateRoutes ?? []).map(toFormStateRoute),
    stateFallbackCutId: cut.stateFallbackCutId ?? '',
    isStart: cut.isStart,
    isEnding: cut.isEnding
  };
}

function clampEffectDuration(value: number): number {
  return Math.min(MAX_CUT_EFFECT_DURATION_MS, Math.max(0, value));
}

function serializeContentBlocks(blocks: CutContentBlock[]): string {
  return JSON.stringify(blocks);
}

function createClientId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function serializeStateVariants(stateVariants: CutStateVariant[]): string {
  return JSON.stringify(stateVariants);
}

function serializeStateRoutes(stateRoutes: CutStateRoute[]): string {
  return JSON.stringify(stateRoutes);
}

function createEmptyStateRouteCondition(): CutStateCondition {
  return {
    stateKey: '',
    equals: ''
  };
}

function getEditableStateRouteConditions(stateRoute: CutStateRoute): CutStateCondition[] {
  const conditions =
    stateRoute.conditions && stateRoute.conditions.length > 0
      ? stateRoute.conditions
      : [
          {
            stateKey: stateRoute.stateKey ?? '',
            equals: stateRoute.equals ?? ''
          }
        ];

  const editableConditions = conditions.slice(0, MAX_CUT_STATE_ROUTE_CONDITIONS).map((condition) => ({
    stateKey: condition.stateKey,
    equals: condition.equals
  }));

  return editableConditions.length > 0 ? editableConditions : [createEmptyStateRouteCondition()];
}

function withStateRouteConditions(stateRoute: CutStateRoute, conditions: CutStateCondition[]): CutStateRoute {
  const nextConditions = (conditions.length > 0 ? conditions : [createEmptyStateRouteCondition()]).slice(0, MAX_CUT_STATE_ROUTE_CONDITIONS);
  const firstCondition = nextConditions[0] ?? createEmptyStateRouteCondition();

  return {
    ...stateRoute,
    stateKey: firstCondition.stateKey,
    equals: firstCondition.equals,
    conditions: nextConditions
  };
}

function updateStateRouteCondition(
  stateRoute: CutStateRoute,
  conditionIndex: number,
  patch: Partial<CutStateCondition>
): CutStateRoute {
  const conditions = getEditableStateRouteConditions(stateRoute).map((condition, index) =>
    index === conditionIndex ? { ...condition, ...patch } : condition
  );

  return withStateRouteConditions(stateRoute, conditions);
}

function toFormStateRoute(stateRoute: CutStateRoute): CutStateRoute {
  return withStateRouteConditions(stateRoute, getEditableStateRouteConditions(stateRoute));
}

function normalizeStateVariants(stateVariants: CutStateVariant[], sourceCutId: string): CutStateVariant[] {
  return stateVariants
    .map((stateVariant) => ({
      id: stateVariant.id,
      stateKey: stateVariant.stateKey.trim(),
      equals: stateVariant.equals.trim(),
      variantCutId: stateVariant.variantCutId,
      label: stateVariant.label?.trim() || undefined
    }))
    .filter(
      (stateVariant) =>
        stateVariant.stateKey.length > 0 &&
        stateVariant.equals.length > 0 &&
        stateVariant.variantCutId.length > 0 &&
        stateVariant.variantCutId !== sourceCutId
    );
}

function normalizeStateRoutes(stateRoutes: CutStateRoute[], sourceCutId: string): CutStateRoute[] {
  return stateRoutes
    .map((stateRoute) => {
      const conditions = getCutStateRouteConditions(stateRoute).slice(0, MAX_CUT_STATE_ROUTE_CONDITIONS);
      const firstCondition = conditions[0] ?? createEmptyStateRouteCondition();

      return {
        id: stateRoute.id,
        stateKey: firstCondition.stateKey,
        equals: firstCondition.equals,
        conditions,
        nextCutId: stateRoute.nextCutId,
        label: stateRoute.label?.trim() || undefined
      };
    })
    .filter(
      (stateRoute) =>
        (stateRoute.conditions ?? []).length > 0 &&
        stateRoute.nextCutId.length > 0 &&
        stateRoute.nextCutId !== sourceCutId
    );
}

function buildCutPatch(cut: Cut, formState: CutFormState): PatchCutRequest | null {
  const patch: PatchCutRequest = {};
  const isStateRouter = formState.kind === 'stateRouter';

  if (formState.title !== cut.title) {
    patch.title = formState.title;
  }

  const normalizedContentBlocks = normalizeCutContentBlocks(cut);
  if (!isStateRouter && serializeContentBlocks(formState.contentBlocks) !== serializeContentBlocks(normalizedContentBlocks)) {
    patch.contentBlocks = formState.contentBlocks;
    patch.body = deriveContentBlocksBody(formState.contentBlocks, cut.body);
  }

  if (formState.contentViewMode !== (cut.contentViewMode ?? 'default')) {
    patch.contentViewMode = formState.contentViewMode;
  }

  if (formState.kind !== cut.kind) {
    patch.kind = formState.kind;
  }

  if (!isStateRouter && formState.dialogAnchorX !== cut.dialogAnchorX) {
    patch.dialogAnchorX = formState.dialogAnchorX;
  }

  if (!isStateRouter && formState.dialogAnchorY !== cut.dialogAnchorY) {
    patch.dialogAnchorY = formState.dialogAnchorY;
  }

  if (!isStateRouter && formState.dialogOffsetX !== cut.dialogOffsetX) {
    patch.dialogOffsetX = formState.dialogOffsetX;
  }

  if (!isStateRouter && formState.dialogOffsetY !== cut.dialogOffsetY) {
    patch.dialogOffsetY = formState.dialogOffsetY;
  }

  if (!isStateRouter && formState.dialogTextAlign !== cut.dialogTextAlign) {
    patch.dialogTextAlign = formState.dialogTextAlign;
  }

  if (!isStateRouter && formState.startEffect !== (cut.startEffect ?? DEFAULT_CUT_EFFECT)) {
    patch.startEffect = formState.startEffect;
  }

  if (!isStateRouter && formState.endEffect !== (cut.endEffect ?? DEFAULT_CUT_EFFECT)) {
    patch.endEffect = formState.endEffect;
  }

  if (!isStateRouter && formState.startEffectDurationMs !== (cut.startEffectDurationMs ?? DEFAULT_CUT_EFFECT_DURATION_MS)) {
    patch.startEffectDurationMs = formState.startEffectDurationMs;
  }

  if (!isStateRouter && formState.endEffectDurationMs !== (cut.endEffectDurationMs ?? DEFAULT_CUT_EFFECT_DURATION_MS)) {
    patch.endEffectDurationMs = formState.endEffectDurationMs;
  }

  if (!isStateRouter && formState.edgeFade !== (cut.edgeFade ?? 'none')) {
    patch.edgeFade = formState.edgeFade;
  }

  if (!isStateRouter && formState.edgeFadeIntensity !== (cut.edgeFadeIntensity ?? 'normal')) {
    patch.edgeFadeIntensity = formState.edgeFadeIntensity;
  }

  if (!isStateRouter && formState.edgeFadeColor !== (cut.edgeFadeColor ?? 'black')) {
    patch.edgeFadeColor = formState.edgeFadeColor;
  }

  if (!isStateRouter && formState.marginBottomToken !== (cut.marginBottomToken ?? 'none')) {
    patch.marginBottomToken = formState.marginBottomToken;
  }

  const nextStateVariants = isStateRouter ? [] : normalizeStateVariants(formState.stateVariants, cut.id);
  const currentStateVariants = normalizeStateVariants(cut.stateVariants ?? [], cut.id);
  if (serializeStateVariants(nextStateVariants) !== serializeStateVariants(currentStateVariants)) {
    patch.stateVariants = nextStateVariants;
  }

  const nextStateRoutes = isStateRouter ? normalizeStateRoutes(formState.stateRoutes, cut.id) : [];
  const currentStateRoutes = normalizeStateRoutes(cut.stateRoutes ?? [], cut.id);
  if (serializeStateRoutes(nextStateRoutes) !== serializeStateRoutes(currentStateRoutes)) {
    patch.stateRoutes = nextStateRoutes;
  }

  const nextStateFallbackCutId = isStateRouter ? formState.stateFallbackCutId || null : null;
  if (nextStateFallbackCutId !== (cut.stateFallbackCutId ?? null)) {
    patch.stateFallbackCutId = nextStateFallbackCutId;
  }

  if (formState.isStart !== cut.isStart) {
    patch.isStart = formState.isStart;
  }

  if (formState.isEnding !== cut.isEnding) {
    patch.isEnding = formState.isEnding;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

export function CutEditorForm({
  availableCuts = [],
  cut,
  contentBlocksPortalEnabled = false,
  contentBlocksPortalTarget,
  dialoguePositionPortalTarget,
  pendingAutosaveCount,
  onQueuePatch,
  onCommitPatch,
  onDeleteCut,
  onKindPreviewChange,
  onUploadAsset
}: {
  availableCuts: Cut[];
  cut: Cut;
  contentBlocksPortalEnabled?: boolean;
  contentBlocksPortalTarget?: HTMLElement | null;
  dialoguePositionPortalTarget?: HTMLElement | null;
  pendingAutosaveCount: number;
  onQueuePatch: (cutId: string, patch: PatchCutRequest) => void;
  onCommitPatch: (cutId: string, patch: PatchCutRequest) => Promise<void>;
  onDeleteCut: (cutId: string) => void;
  onKindPreviewChange: (kind: Cut['kind']) => void;
  onUploadAsset: (file: File) => Promise<string>;
}) {
  const [formState, setFormState] = useState<CutFormState>(() => toFormState(cut));
  const [isUploadingAsset, setIsUploadingAsset] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [localAssetPreviewUrl, setLocalAssetPreviewUrl] = useState<string | null>(null);
  const queuePatchRef = useRef(onQueuePatch);
  const latestCutRef = useRef(cut);
  const fileInputId = `cut-asset-upload-${cut.id}`;

  useEffect(() => {
    queuePatchRef.current = onQueuePatch;
  }, [onQueuePatch]);

  useEffect(() => {
    latestCutRef.current = cut;
    const nextState = toFormState(cut);
    setFormState(nextState);
    onKindPreviewChange(nextState.kind);
  }, [
    cut.id,
    cut.title,
    cut.contentBlocks,
    cut.contentViewMode,
    cut.kind,
    cut.dialogAnchorX,
    cut.dialogAnchorY,
    cut.dialogOffsetX,
    cut.dialogOffsetY,
    cut.dialogTextAlign,
    cut.startEffect,
    cut.endEffect,
    cut.startEffectDurationMs,
    cut.endEffectDurationMs,
    cut.assetUrl,
    cut.edgeFade,
    cut.edgeFadeIntensity,
    cut.edgeFadeColor,
    cut.marginBottomToken,
    cut.stateVariants,
    cut.stateRoutes,
    cut.stateFallbackCutId,
    cut.isStart,
    cut.isEnding,
    onKindPreviewChange
  ]);

  useEffect(() => () => {
    if (localAssetPreviewUrl) {
      URL.revokeObjectURL(localAssetPreviewUrl);
    }
  }, [localAssetPreviewUrl]);

  const debouncedDraft = useDebounce(
    {
      cutId: cut.id,
      formState
    },
    500
  );
  const displayAssetUrl = localAssetPreviewUrl ?? formState.assetUrl;
  const isStateRouter = formState.kind === 'stateRouter';

  useEffect(() => {
    if (debouncedDraft.cutId !== cut.id) {
      return;
    }

    const patch = buildCutPatch(latestCutRef.current, debouncedDraft.formState);
    if (!patch) {
      return;
    }

    queuePatchRef.current(cut.id, patch);
  }, [cut.id, debouncedDraft]);

  async function handleAssetFileChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';

    if (!file) {
      return;
    }

    setUploadError(null);
    setIsUploadingAsset(true);
    const previewUrl = typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : null;

    setLocalAssetPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }

      return previewUrl;
    });

    try {
      const assetUrl = await onUploadAsset(file);
      setLocalAssetPreviewUrl((current) => {
        if (current) {
          URL.revokeObjectURL(current);
        }

        return null;
      });
      setFormState((current) => ({ ...current, assetUrl }));
      await onCommitPatch(cut.id, { assetUrl });
    } catch (error) {
      setLocalAssetPreviewUrl((current) => {
        if (current) {
          URL.revokeObjectURL(current);
        }

        return null;
      });
      setUploadError(error instanceof ApiError ? error.message : '이미지를 업로드하지 못했습니다.');
    } finally {
      setIsUploadingAsset(false);
    }
  }

  async function handleRemoveAsset() {
    setUploadError(null);
    setLocalAssetPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }

      return null;
    });
    setFormState((current) => ({ ...current, assetUrl: '' }));

    try {
      await onCommitPatch(cut.id, { assetUrl: null });
    } catch (error) {
      setUploadError(error instanceof ApiError ? error.message : '이미지를 제거하지 못했습니다.');
    }
  }

  const dialoguePositionEditor = (
    <div className="inspector-card ml-auto w-[26rem] max-w-full min-w-0 rounded-2xl border border-editor-border bg-black/10 p-3">
      <GroupTitle>대사 위치</GroupTitle>
      <div className="mt-2 space-y-2">
        <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2">
          <div className="min-w-0">
            <FieldLabel>가로 기준</FieldLabel>
            <select
              aria-label="Horizontal"
              className={inputClassName()}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  dialogAnchorX: event.target.value as Cut['dialogAnchorX']
                }))
              }
              value={formState.dialogAnchorX}
            >
              <option value="left">왼쪽</option>
              <option value="center">가운데</option>
              <option value="right">오른쪽</option>
            </select>
          </div>

          <div className="min-w-0">
            <FieldLabel>세로 기준</FieldLabel>
            <select
              aria-label="Vertical"
              className={inputClassName()}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  dialogAnchorY: event.target.value as Cut['dialogAnchorY']
                }))
              }
              value={formState.dialogAnchorY}
            >
              <option value="top">맨 위</option>
              <option value="upper">위쪽</option>
              <option value="center">가운데</option>
              <option value="lower">아래쪽</option>
              <option value="bottom">맨 아래</option>
            </select>
          </div>

          <div className="min-w-0">
            <FieldLabel>텍스트 정렬</FieldLabel>
            <select
              aria-label="Text Align"
              className={inputClassName()}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  dialogTextAlign: event.target.value as Cut['dialogTextAlign']
                }))
              }
              value={formState.dialogTextAlign}
            >
              <option value="left">왼쪽</option>
              <option value="center">가운데</option>
              <option value="right">오른쪽</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2">
          <div className="min-w-0">
            <FieldLabel>가로 이동</FieldLabel>
            <CoordinateInput
              ariaLabel="X"
              onValueChange={(value) =>
                setFormState((current) => ({
                  ...current,
                  dialogOffsetX: value
                }))
              }
              value={formState.dialogOffsetX}
            />
          </div>

          <div className="min-w-0">
            <FieldLabel>세로 이동</FieldLabel>
            <CoordinateInput
              ariaLabel="Y"
              onValueChange={(value) =>
                setFormState((current) => ({
                  ...current,
                  dialogOffsetY: value
                }))
              }
              value={formState.dialogOffsetY}
            />
          </div>
        </div>
      </div>
    </div>
  );
  const contentBlocksEditor = (
    <CutContentBlocksEditor
      blocks={formState.contentBlocks}
      onChange={(contentBlocks) => setFormState((current) => ({ ...current, contentBlocks }))}
      onUploadAsset={onUploadAsset}
      onViewModeChange={(contentViewMode) => setFormState((current) => ({ ...current, contentViewMode }))}
      viewMode={formState.contentViewMode}
    />
  );
  const assetEditor = (
    <div>
      <FieldLabel>이미지</FieldLabel>
      <div className="mt-1.5 rounded-2xl border border-editor-border bg-black/10 p-3">
        {displayAssetUrl ? (
          <div className="mb-3 flex h-36 items-center justify-center overflow-hidden rounded-2xl border border-editor-border bg-black/20">
            <img
              alt={cut.title}
              className="max-h-full max-w-full object-contain"
              src={displayAssetUrl}
            />
          </div>
        ) : (
          <div className="mb-3 flex h-28 items-center justify-center rounded-2xl border border-dashed border-editor-border bg-black/10 text-sm text-zinc-500">
            {isUploadingAsset ? '이미지를 업로드하는 중입니다...' : '업로드된 이미지가 없습니다.'}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <input
            accept="image/*"
            hidden
            id={fileInputId}
            onChange={handleAssetFileChange}
            type="file"
          />
          <label
            className="inline-flex cursor-pointer items-center rounded-full border border-editor-border bg-black/20 px-3 py-1.5 text-sm text-zinc-100 transition hover:border-editor-accentSoft"
            htmlFor={fileInputId}
          >
            {isUploadingAsset ? '업로드 중...' : '이미지 업로드'}
          </label>

          {displayAssetUrl ? (
            <button
              className="rounded-full border border-editor-border px-3 py-1.5 text-sm text-zinc-300 transition hover:border-zinc-500"
              onClick={() => {
                void handleRemoveAsset();
              }}
              type="button"
            >
              이미지 제거
            </button>
          ) : null}
        </div>

        <p className="mt-2 break-all text-xs text-zinc-500">
          {displayAssetUrl || '업로드한 이미지는 자동 저장 후 프리뷰와 뷰어에 반영됩니다.'}
        </p>
        {uploadError ? <p className="mt-2 text-xs text-red-300">{uploadError}</p> : null}
      </div>
    </div>
  );
  const stateVariantsEditor = (
    <div className="col-span-full rounded-2xl border border-editor-border bg-black/10 p-3">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <GroupTitle>상태 Variant</GroupTitle>
        <button
          className="shrink-0 rounded-lg border border-editor-border bg-black/20 px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-editor-accentSoft"
          onClick={() =>
            setFormState((current) => ({
              ...current,
              stateVariants: [
                ...current.stateVariants,
                {
                  id: createClientId('state-variant'),
                  stateKey: '',
                  equals: '',
                  variantCutId: availableCuts[0]?.id ?? ''
                }
              ]
            }))
          }
          type="button"
        >
          + Variant
        </button>
      </div>

      <div className="mt-2 space-y-2">
        {formState.stateVariants.length === 0 ? (
          <p className="rounded-xl border border-dashed border-editor-border bg-black/10 px-3 py-2 text-xs text-zinc-500">
            조건이 맞을 때 대신 보여줄 컷을 지정할 수 있습니다.
          </p>
        ) : (
          formState.stateVariants.map((stateVariant, index) => (
            <div className="rounded-xl border border-editor-border bg-black/10 p-2" key={stateVariant.id}>
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
                <div className="min-w-0">
                  <FieldLabel>상태 key</FieldLabel>
                  <input
                    className={inputClassName()}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        stateVariants: current.stateVariants.map((currentStateVariant, currentIndex) =>
                          currentIndex === index ? { ...currentStateVariant, stateKey: event.target.value } : currentStateVariant
                        )
                      }))
                    }
                    placeholder="first_route"
                    type="text"
                    value={stateVariant.stateKey}
                  />
                </div>

                <div className="min-w-0">
                  <FieldLabel>값</FieldLabel>
                  <input
                    className={inputClassName()}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        stateVariants: current.stateVariants.map((currentStateVariant, currentIndex) =>
                          currentIndex === index ? { ...currentStateVariant, equals: event.target.value } : currentStateVariant
                        )
                      }))
                    }
                    placeholder="A"
                    type="text"
                    value={stateVariant.equals}
                  />
                </div>
              </div>

                <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <div className="min-w-0">
                  <FieldLabel>대체 컷</FieldLabel>
                  <select
                    className={inputClassName()}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        stateVariants: current.stateVariants.map((currentStateVariant, currentIndex) =>
                          currentIndex === index ? { ...currentStateVariant, variantCutId: event.target.value } : currentStateVariant
                        )
                      }))
                    }
                    value={stateVariant.variantCutId}
                  >
                    <option value="">선택 안 함</option>
                    {availableCuts.map((availableCut) => (
                      <option key={availableCut.id} value={availableCut.id}>
                        {availableCut.title}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  className="mt-6 h-10 rounded-xl border border-editor-border bg-black/20 px-3 text-xs text-zinc-300 transition hover:border-red-400/60 hover:text-red-200"
                  onClick={() =>
                    setFormState((current) => ({
                      ...current,
                      stateVariants: current.stateVariants.filter((_, currentIndex) => currentIndex !== index)
                    }))
                  }
                  type="button"
                >
                  삭제
                </button>
              </div>

                <div className="mt-2">
                <FieldLabel>라벨</FieldLabel>
                <input
                  className={inputClassName()}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      stateVariants: current.stateVariants.map((currentStateVariant, currentIndex) =>
                        currentIndex === index ? { ...currentStateVariant, label: event.target.value } : currentStateVariant
                      )
                    }))
                  }
                  placeholder="A 루트 연출"
                  type="text"
                  value={stateVariant.label ?? ''}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
  const stateRoutesEditor = (
    <div className="col-span-full rounded-2xl border border-violet-500/20 bg-violet-500/5 p-3">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <GroupTitle>상태 분기</GroupTitle>
        <button
          className="shrink-0 rounded-lg border border-editor-border bg-black/20 px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-violet-400/70"
          onClick={() =>
            setFormState((current) => ({
              ...current,
              stateRoutes: [
                ...current.stateRoutes,
                {
                  id: createClientId('state-route'),
                  stateKey: '',
                  equals: '',
                  conditions: [createEmptyStateRouteCondition()],
                  nextCutId: availableCuts[0]?.id ?? ''
                }
              ]
            }))
          }
          type="button"
        >
          + Route
        </button>
      </div>

      <div className="mt-2 space-y-2">
        {formState.stateRoutes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-violet-400/25 bg-black/10 px-3 py-2 text-xs text-zinc-500">
            저장된 상태값이 맞을 때 이동할 컷을 추가하세요.
          </p>
        ) : (
          formState.stateRoutes.map((stateRoute, index) => {
            const conditions = getEditableStateRouteConditions(stateRoute);

            return (
              <div className="rounded-xl border border-editor-border bg-black/10 p-2" key={stateRoute.id}>
                <div className="space-y-2">
                  {conditions.map((condition, conditionIndex) => (
                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2" key={`${stateRoute.id}-condition-${conditionIndex}`}>
                      <div className="min-w-0">
                        <FieldLabel>{`조건 ${conditionIndex + 1} key`}</FieldLabel>
                        <input
                          className={inputClassName()}
                          onChange={(event) =>
                            setFormState((current) => ({
                              ...current,
                              stateRoutes: current.stateRoutes.map((currentStateRoute, currentIndex) =>
                                currentIndex === index
                                  ? updateStateRouteCondition(currentStateRoute, conditionIndex, { stateKey: event.target.value })
                                  : currentStateRoute
                              )
                            }))
                          }
                          placeholder={conditionIndex === 0 ? 'first_route' : 'second_route'}
                          type="text"
                          value={condition.stateKey}
                        />
                      </div>

                      <div className="min-w-0">
                        <FieldLabel>{`조건 ${conditionIndex + 1} 값`}</FieldLabel>
                        <input
                          className={inputClassName()}
                          onChange={(event) =>
                            setFormState((current) => ({
                              ...current,
                              stateRoutes: current.stateRoutes.map((currentStateRoute, currentIndex) =>
                                currentIndex === index
                                  ? updateStateRouteCondition(currentStateRoute, conditionIndex, { equals: event.target.value })
                                  : currentStateRoute
                              )
                            }))
                          }
                          placeholder={conditionIndex === 0 ? 'A' : 'B'}
                          type="text"
                          value={condition.equals}
                        />
                      </div>

                      <button
                        className="mt-6 h-10 rounded-xl border border-editor-border bg-black/20 px-2 text-xs text-zinc-400 transition hover:border-red-400/60 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={conditions.length <= 1}
                        onClick={() =>
                          setFormState((current) => ({
                            ...current,
                            stateRoutes: current.stateRoutes.map((currentStateRoute, currentIndex) =>
                              currentIndex === index
                                ? withStateRouteConditions(
                                    currentStateRoute,
                                    getEditableStateRouteConditions(currentStateRoute).filter(
                                      (_, currentConditionIndex) => currentConditionIndex !== conditionIndex
                                    )
                                  )
                                : currentStateRoute
                            )
                          }))
                        }
                        type="button"
                      >
                        조건 삭제
                      </button>
                    </div>
                  ))}
                </div>

                {conditions.length < MAX_CUT_STATE_ROUTE_CONDITIONS ? (
                  <button
                    className="mt-2 rounded-lg border border-editor-border bg-black/20 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-violet-400/70"
                    onClick={() =>
                      setFormState((current) => ({
                        ...current,
                        stateRoutes: current.stateRoutes.map((currentStateRoute, currentIndex) =>
                          currentIndex === index
                            ? withStateRouteConditions(currentStateRoute, [
                                ...getEditableStateRouteConditions(currentStateRoute),
                                createEmptyStateRouteCondition()
                              ])
                            : currentStateRoute
                        )
                      }))
                    }
                    type="button"
                  >
                    + 조건
                  </button>
                ) : null}

                <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <div className="min-w-0">
                  <FieldLabel>이동할 컷</FieldLabel>
                  <select
                    className={inputClassName()}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        stateRoutes: current.stateRoutes.map((currentStateRoute, currentIndex) =>
                          currentIndex === index ? { ...currentStateRoute, nextCutId: event.target.value } : currentStateRoute
                        )
                      }))
                    }
                    value={stateRoute.nextCutId}
                  >
                    <option value="">선택 안 함</option>
                    {availableCuts.map((availableCut) => (
                      <option key={availableCut.id} value={availableCut.id}>
                        {availableCut.title}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  className="mt-6 h-10 rounded-xl border border-editor-border bg-black/20 px-3 text-xs text-zinc-300 transition hover:border-red-400/60 hover:text-red-200"
                  onClick={() =>
                    setFormState((current) => ({
                      ...current,
                      stateRoutes: current.stateRoutes.filter((_, currentIndex) => currentIndex !== index)
                    }))
                  }
                  type="button"
                >
                  삭제
                </button>
              </div>

                <div className="mt-2">
                <FieldLabel>라벨</FieldLabel>
                <input
                  className={inputClassName()}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      stateRoutes: current.stateRoutes.map((currentStateRoute, currentIndex) =>
                        currentIndex === index ? { ...currentStateRoute, label: event.target.value } : currentStateRoute
                      )
                    }))
                  }
                  placeholder="A 루트"
                  type="text"
                  value={stateRoute.label ?? ''}
                />
              </div>
              </div>
            );
          })
        )}

        <div className="rounded-xl border border-editor-border bg-black/10 p-2">
          <FieldLabel>기본 컷</FieldLabel>
          <select
            className={inputClassName()}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                stateFallbackCutId: event.target.value
              }))
            }
            value={formState.stateFallbackCutId}
          >
            <option value="">선택 안 함</option>
            {availableCuts.map((availableCut) => (
              <option key={availableCut.id} value={availableCut.id}>
                {availableCut.title}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <section className="inspector-card ml-auto w-[26rem] max-w-full min-w-0 rounded-[18px] border border-editor-border bg-black/10 p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="font-display text-base font-semibold text-zinc-50">컷 설정</p>
            <p className="mt-0.5 text-xs text-zinc-400">
              {pendingAutosaveCount > 0 ? `${pendingAutosaveCount}개 변경 저장 중...` : '입력 후 0.5초 뒤 자동 저장됩니다.'}
            </p>
          </div>
          <button
            className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-200 transition hover:bg-red-500/20"
            onClick={() => onDeleteCut(cut.id)}
            type="button"
          >
            컷 삭제
          </button>
        </div>

        <div className="mt-3 space-y-3">
          {!isStateRouter ? assetEditor : null}

          <div>
            <FieldLabel>제목</FieldLabel>
            <input
              aria-label="Title"
              className={inputClassName()}
              onChange={(event) => setFormState((current) => ({ ...current, title: event.target.value }))}
              type="text"
              value={formState.title}
            />
          </div>

          {!isStateRouter && !contentBlocksPortalEnabled ? contentBlocksEditor : null}

          {!isStateRouter && !dialoguePositionPortalTarget ? dialoguePositionEditor : null}

          <div className="inspector-form-grid grid gap-3">
            <div className="inspector-field-grid grid gap-3">
              <div className="col-span-full">
                <GroupTitle>기본</GroupTitle>
              </div>

              <div>
                <FieldLabel>컷 종류</FieldLabel>
                <select
                  aria-label="Kind"
                  className={inputClassName()}
                  onChange={(event) => {
                    const kind = event.target.value as Cut['kind'];
                    setFormState((current) => ({
                      ...current,
                      kind,
                      isEnding: kind === 'ending' ? true : kind === 'stateRouter' ? false : current.isEnding
                    }));
                    onKindPreviewChange(kind);
                  }}
                  value={formState.kind}
                >
                  <option value="scene">장면</option>
                  <option value="choice">선택</option>
                  <option value="transition">전환</option>
                  <option value="stateRouter">상태 분기</option>
                  <option value="ending">엔딩</option>
                </select>
              </div>

              {!isStateRouter ? (
                <>
                  <div className="col-span-full mt-1">
                    <GroupTitle>전환 효과</GroupTitle>
                  </div>

                  <div>
                    <FieldLabel>시작 효과</FieldLabel>
                    <select
                      aria-label="Start Effect"
                      className={inputClassName()}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          startEffect: event.target.value as Cut['startEffect']
                        }))
                      }
                      value={formState.startEffect}
                    >
                      {CUT_EFFECT_OPTIONS.map((effect) => (
                        <option key={effect.value} value={effect.value}>
                          {effect.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <FieldLabel>시작 시간(밀리초)</FieldLabel>
                    <input
                      aria-label="Start Duration"
                      className={inputClassName()}
                      max={MAX_CUT_EFFECT_DURATION_MS}
                      min={0}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          startEffectDurationMs: clampEffectDuration(Number(event.target.value) || 0)
                        }))
                      }
                      type="number"
                      value={formState.startEffectDurationMs}
                    />
                  </div>

                  <div>
                    <FieldLabel>종료 효과</FieldLabel>
                    <select
                      aria-label="End Effect"
                      className={inputClassName()}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          endEffect: event.target.value as Cut['endEffect']
                        }))
                      }
                      value={formState.endEffect}
                    >
                      {CUT_EFFECT_OPTIONS.map((effect) => (
                        <option key={effect.value} value={effect.value}>
                          {effect.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <FieldLabel>종료 시간(밀리초)</FieldLabel>
                    <input
                      aria-label="End Duration"
                      className={inputClassName()}
                      max={MAX_CUT_EFFECT_DURATION_MS}
                      min={0}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          endEffectDurationMs: clampEffectDuration(Number(event.target.value) || 0)
                        }))
                      }
                      type="number"
                      value={formState.endEffectDurationMs}
                    />
                  </div>

                  <div className="col-span-full mt-1">
                    <GroupTitle>화면 마감</GroupTitle>
                  </div>

                  <div>
                    <FieldLabel>가장자리 페이드</FieldLabel>
                    <select
                      aria-label="Edge Fade"
                      className={inputClassName()}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          edgeFade: event.target.value as NonNullable<Cut['edgeFade']>
                        }))
                      }
                      value={formState.edgeFade}
                    >
                      {EDGE_FADE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <FieldLabel>페이드 강도</FieldLabel>
                    <select
                      aria-label="Edge Fade Intensity"
                      className={inputClassName()}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          edgeFadeIntensity: event.target.value as NonNullable<Cut['edgeFadeIntensity']>
                        }))
                      }
                      value={formState.edgeFadeIntensity}
                    >
                      {EDGE_FADE_INTENSITY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <FieldLabel>페이드 색상</FieldLabel>
                    <select
                      aria-label="Edge Fade Color"
                      className={inputClassName()}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          edgeFadeColor: event.target.value as NonNullable<Cut['edgeFadeColor']>
                        }))
                      }
                      value={formState.edgeFadeColor}
                    >
                      {EDGE_FADE_COLOR_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <FieldLabel>컷 아래 여백</FieldLabel>
                    <select
                      aria-label="Cut Bottom Spacing"
                      className={inputClassName()}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          marginBottomToken: event.target.value as NonNullable<Cut['marginBottomToken']>
                        }))
                      }
                      value={formState.marginBottomToken}
                    >
                      {CONTENT_SPACING_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-full mt-1">
                    <GroupTitle>상태</GroupTitle>
                  </div>

                  {stateVariantsEditor}
                </>
              ) : (
                stateRoutesEditor
              )}

              <label className="flex min-w-0 items-center gap-2 rounded-xl border border-editor-border bg-black/10 px-3 py-2 text-sm text-zinc-300">
                <input
                  checked={formState.isStart}
                  className="h-4 w-4 shrink-0 accent-editor-accentSoft"
                  onChange={(event) => setFormState((current) => ({ ...current, isStart: event.target.checked }))}
                  type="checkbox"
                />
                <span className="min-w-0 truncate">시작 컷으로 지정</span>
              </label>

              {!isStateRouter ? (
                <label className="flex min-w-0 items-center gap-2 rounded-xl border border-editor-border bg-black/10 px-3 py-2 text-sm text-zinc-300">
                  <input
                    checked={formState.isEnding}
                    className="h-4 w-4 shrink-0 accent-editor-accentSoft"
                    onChange={(event) => setFormState((current) => ({ ...current, isEnding: event.target.checked }))}
                    type="checkbox"
                  />
                  <span className="min-w-0 truncate">엔딩 컷으로 지정</span>
                </label>
              ) : null}
            </div>
          </div>
        </div>
      </section>
      {!isStateRouter && contentBlocksPortalEnabled && contentBlocksPortalTarget ? createPortal(contentBlocksEditor, contentBlocksPortalTarget) : null}
      {!isStateRouter && dialoguePositionPortalTarget ? createPortal(dialoguePositionEditor, dialoguePositionPortalTarget) : null}
    </>
  );
}

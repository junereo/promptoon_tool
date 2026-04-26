import type { Cut, CutContentBlock, PatchCutRequest } from '@promptoon/shared';
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
  return <label className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">{children}</label>;
}

function inputClassName() {
  return 'mt-2 w-full rounded-2xl border border-editor-border bg-black/20 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-editor-accentSoft';
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
    isStart: cut.isStart,
    isEnding: cut.isEnding
  };
}

function clampDialogOffset(value: number): number {
  return Math.min(160, Math.max(0, value));
}

function clampEffectDuration(value: number): number {
  return Math.min(MAX_CUT_EFFECT_DURATION_MS, Math.max(0, value));
}

function serializeContentBlocks(blocks: CutContentBlock[]): string {
  return JSON.stringify(blocks);
}

function buildCutPatch(cut: Cut, formState: CutFormState): PatchCutRequest | null {
  const patch: PatchCutRequest = {};

  if (formState.title !== cut.title) {
    patch.title = formState.title;
  }

  const normalizedContentBlocks = normalizeCutContentBlocks(cut);
  if (serializeContentBlocks(formState.contentBlocks) !== serializeContentBlocks(normalizedContentBlocks)) {
    patch.contentBlocks = formState.contentBlocks;
    patch.body = deriveContentBlocksBody(formState.contentBlocks, cut.body);
  }

  if (formState.contentViewMode !== (cut.contentViewMode ?? 'default')) {
    patch.contentViewMode = formState.contentViewMode;
  }

  if (formState.kind !== cut.kind) {
    patch.kind = formState.kind;
  }

  if (formState.dialogAnchorX !== cut.dialogAnchorX) {
    patch.dialogAnchorX = formState.dialogAnchorX;
  }

  if (formState.dialogAnchorY !== cut.dialogAnchorY) {
    patch.dialogAnchorY = formState.dialogAnchorY;
  }

  if (formState.dialogOffsetX !== cut.dialogOffsetX) {
    patch.dialogOffsetX = formState.dialogOffsetX;
  }

  if (formState.dialogOffsetY !== cut.dialogOffsetY) {
    patch.dialogOffsetY = formState.dialogOffsetY;
  }

  if (formState.dialogTextAlign !== cut.dialogTextAlign) {
    patch.dialogTextAlign = formState.dialogTextAlign;
  }

  if (formState.startEffect !== (cut.startEffect ?? DEFAULT_CUT_EFFECT)) {
    patch.startEffect = formState.startEffect;
  }

  if (formState.endEffect !== (cut.endEffect ?? DEFAULT_CUT_EFFECT)) {
    patch.endEffect = formState.endEffect;
  }

  if (formState.startEffectDurationMs !== (cut.startEffectDurationMs ?? DEFAULT_CUT_EFFECT_DURATION_MS)) {
    patch.startEffectDurationMs = formState.startEffectDurationMs;
  }

  if (formState.endEffectDurationMs !== (cut.endEffectDurationMs ?? DEFAULT_CUT_EFFECT_DURATION_MS)) {
    patch.endEffectDurationMs = formState.endEffectDurationMs;
  }

  if (formState.edgeFade !== (cut.edgeFade ?? 'none')) {
    patch.edgeFade = formState.edgeFade;
  }

  if (formState.edgeFadeIntensity !== (cut.edgeFadeIntensity ?? 'normal')) {
    patch.edgeFadeIntensity = formState.edgeFadeIntensity;
  }

  if (formState.edgeFadeColor !== (cut.edgeFadeColor ?? 'black')) {
    patch.edgeFadeColor = formState.edgeFadeColor;
  }

  if (formState.marginBottomToken !== (cut.marginBottomToken ?? 'none')) {
    patch.marginBottomToken = formState.marginBottomToken;
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
  cut,
  dialoguePositionPortalTarget,
  pendingAutosaveCount,
  onQueuePatch,
  onCommitPatch,
  onDeleteCut,
  onKindPreviewChange,
  onUploadAsset
}: {
  cut: Cut;
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
    <div className="rounded-2xl border border-editor-border bg-black/10 p-4">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">Dialogue Position</p>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div>
          <FieldLabel>Horizontal</FieldLabel>
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
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>

        <div>
          <FieldLabel>Vertical</FieldLabel>
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
            <option value="top">Top</option>
            <option value="upper">Upper</option>
            <option value="center">Center</option>
            <option value="lower">Lower</option>
            <option value="bottom">Bottom</option>
          </select>
        </div>

        <div>
          <FieldLabel>Text Align</FieldLabel>
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
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <FieldLabel>X</FieldLabel>
          <input
            aria-label="X"
            className={inputClassName()}
            max={160}
            min={0}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                dialogOffsetX: clampDialogOffset(Number(event.target.value) || 0)
              }))
            }
            step={1}
            type="number"
            value={formState.dialogOffsetX}
          />
        </div>

        <div>
          <FieldLabel>Y</FieldLabel>
          <input
            aria-label="Y"
            className={inputClassName()}
            max={160}
            min={0}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                dialogOffsetY: clampDialogOffset(Number(event.target.value) || 0)
              }))
            }
            step={1}
            type="number"
            value={formState.dialogOffsetY}
          />
        </div>
      </div>

      <p className="mt-3 text-xs text-zinc-500">
        위치 기준은 선택한 화면 가장자리이며, X/Y 값은 화면 밖으로 나가지 않도록 안전 범위 안에서만 적용됩니다.
      </p>
    </div>
  );

  return (
    <>
      <section className="rounded-[24px] border border-editor-border bg-black/10 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-xl font-semibold text-zinc-50">Inspector</p>
            <p className="mt-1 text-sm text-zinc-400">
              {pendingAutosaveCount > 0 ? `Saving ${pendingAutosaveCount} change(s)...` : 'Autosaves after 500ms idle.'}
            </p>
          </div>
          <button
            className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-200 transition hover:bg-red-500/20"
            onClick={() => onDeleteCut(cut.id)}
            type="button"
          >
            Delete Cut
          </button>
        </div>

        <div className="mt-5 space-y-5">
          <div>
            <FieldLabel>Title</FieldLabel>
            <input
              aria-label="Title"
              className={inputClassName()}
              onChange={(event) => setFormState((current) => ({ ...current, title: event.target.value }))}
              type="text"
              value={formState.title}
            />
          </div>

          <CutContentBlocksEditor
            blocks={formState.contentBlocks}
            onChange={(contentBlocks) => setFormState((current) => ({ ...current, contentBlocks }))}
            onUploadAsset={onUploadAsset}
            onViewModeChange={(contentViewMode) => setFormState((current) => ({ ...current, contentViewMode }))}
            viewMode={formState.contentViewMode}
          />

          {!dialoguePositionPortalTarget ? dialoguePositionEditor : null}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="space-y-4">
              <div>
                <FieldLabel>Kind</FieldLabel>
                <select
                  aria-label="Kind"
                  className={inputClassName()}
                  onChange={(event) => {
                    const kind = event.target.value as Cut['kind'];
                    setFormState((current) => ({
                      ...current,
                      kind,
                      isEnding: kind === 'ending' ? true : current.isEnding
                    }));
                    onKindPreviewChange(kind);
                  }}
                  value={formState.kind}
                >
                  <option value="scene">Scene</option>
                  <option value="choice">Choice</option>
                  <option value="transition">Transition</option>
                  <option value="ending">Ending</option>
                </select>
              </div>

              <div>
                <FieldLabel>Start Effect</FieldLabel>
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
                <FieldLabel>Start Duration (ms)</FieldLabel>
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
                <FieldLabel>End Effect</FieldLabel>
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
                <FieldLabel>End Duration (ms)</FieldLabel>
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

              <div>
                <FieldLabel>Edge Fade</FieldLabel>
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
                <FieldLabel>Edge Fade Intensity</FieldLabel>
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
                <FieldLabel>Edge Fade Color</FieldLabel>
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
                <FieldLabel>Cut Bottom Spacing</FieldLabel>
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
            </div>

            <div>
              <FieldLabel>Image Asset</FieldLabel>
              <div className="mt-2 rounded-2xl border border-editor-border bg-black/10 p-4">
                {displayAssetUrl ? (
                  <div className="mb-4 overflow-hidden rounded-2xl border border-editor-border bg-black/20">
                    <img
                      alt={cut.title}
                      className="h-40 w-full object-cover"
                      src={displayAssetUrl}
                    />
                  </div>
                ) : (
                  <div className="mb-4 flex h-32 items-center justify-center rounded-2xl border border-dashed border-editor-border bg-black/10 text-sm text-zinc-500">
                    {isUploadingAsset ? '이미지를 업로드하는 중입니다...' : '업로드된 이미지가 없습니다.'}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <input
                    accept="image/*"
                    hidden
                    id={fileInputId}
                    onChange={handleAssetFileChange}
                    type="file"
                  />
                  <label
                    className="inline-flex cursor-pointer items-center rounded-full border border-editor-border bg-black/20 px-4 py-2 text-sm text-zinc-100 transition hover:border-editor-accentSoft"
                    htmlFor={fileInputId}
                  >
                    {isUploadingAsset ? '업로드 중...' : '이미지 업로드'}
                  </label>

                  {displayAssetUrl ? (
                    <button
                      className="rounded-full border border-editor-border px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500"
                      onClick={() => {
                        void handleRemoveAsset();
                      }}
                      type="button"
                    >
                      이미지 제거
                    </button>
                  ) : null}
                </div>

                <p className="mt-3 break-all text-xs text-zinc-500">
                  {displayAssetUrl || '업로드한 이미지는 자동 저장 후 프리뷰와 뷰어에 반영됩니다.'}
                </p>
                {uploadError ? <p className="mt-2 text-xs text-red-300">{uploadError}</p> : null}
              </div>
            </div>
          </div>

          <p className="rounded-2xl border border-editor-border bg-black/10 px-4 py-3 text-xs leading-6 text-zinc-400">
            Start Effect는 이 컷이 나타날 때, End Effect는 다음 컷으로 넘어가며 이 컷이 사라질 때 적용됩니다. 각 Duration은 해당 효과의 지속 시간입니다.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex items-center gap-3 rounded-2xl border border-editor-border bg-black/10 px-4 py-3 text-sm text-zinc-300">
              <input
                checked={formState.isStart}
                className="h-4 w-4 accent-editor-accentSoft"
                onChange={(event) => setFormState((current) => ({ ...current, isStart: event.target.checked }))}
                type="checkbox"
              />
              Mark as start cut
            </label>

            <label className="flex items-center gap-3 rounded-2xl border border-editor-border bg-black/10 px-4 py-3 text-sm text-zinc-300">
              <input
                checked={formState.isEnding}
                className="h-4 w-4 accent-editor-accentSoft"
                onChange={(event) => setFormState((current) => ({ ...current, isEnding: event.target.checked }))}
                type="checkbox"
              />
              Mark as ending cut
            </label>
          </div>
        </div>
      </section>
      {dialoguePositionPortalTarget ? createPortal(dialoguePositionEditor, dialoguePositionPortalTarget) : null}
    </>
  );
}

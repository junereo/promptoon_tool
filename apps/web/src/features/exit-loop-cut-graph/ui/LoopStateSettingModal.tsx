import type { CreateLoopStateSettingRequest, CreateLoopStateSettingStageInput, Cut } from '@promptoon/shared';
import type { ChangeEvent, FormEvent } from 'react';
import { memo, useEffect, useMemo, useState } from 'react';

type StageTruth = CreateLoopStateSettingStageInput['truth'];

interface VariantDraft {
  assetUrl: string;
  title: string;
  truth: NonNullable<StageTruth>;
}

interface StageDraft {
  baseAssetUrl: string;
  spacerAssetUrl: string;
  title: string;
  variants: VariantDraft[];
}

interface LoopStateSettingModalProps {
  cuts: Cut[];
  initialAttachAfterCutId: string | null;
  isOpen: boolean;
  isCreating: boolean;
  onClose: () => void;
  onCreateLoopState: (payload: CreateLoopStateSettingRequest) => Promise<void>;
  onUploadAsset: (file: File) => Promise<string>;
}

function createStageDraft(stageIndex: number): StageDraft {
  const paddedIndex = String(stageIndex).padStart(2, '0');
  return {
    baseAssetUrl: '',
    spacerAssetUrl: '',
    title: `Stage ${paddedIndex}`,
    variants: [createVariantDraft(stageIndex, 1)]
  };
}

function createVariantDraft(stageIndex: number, variantIndex: number): VariantDraft {
  const paddedStageIndex = String(stageIndex).padStart(2, '0');
  return {
    assetUrl: '',
    title: `Stage ${paddedStageIndex} Variant ${variantIndex}`,
    truth: variantIndex % 2 === 1 ? 'real_anomaly' : 'fake_suspicion'
  };
}

function createStageDrafts(stageCount: number): StageDraft[] {
  return Array.from({ length: stageCount }, (_, index) => createStageDraft(index + 1));
}

function clampStageCount(value: number): number {
  return Math.min(12, Math.max(1, value));
}

function toNullableAssetUrl(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function UploadableAssetInput({
  disabled,
  label,
  onChange,
  onUploadAsset,
  value
}: {
  disabled: boolean;
  label: string;
  onChange: (value: string) => void;
  onUploadAsset: (file: File) => Promise<string>;
  value: string;
}) {
  const [isUploading, setIsUploading] = useState(false);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';
    if (!file) {
      return;
    }

    setIsUploading(true);
    try {
      onChange(await onUploadAsset(file));
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="grid gap-1.5 text-xs text-zinc-500">
      <span>{label}</span>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <input
          className="min-w-0 rounded-xl border border-editor-border bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-editor-accentSoft disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled || isUploading}
          onChange={(event) => onChange(event.target.value)}
          placeholder="/uploads/..."
          type="text"
          value={value}
        />
        <label className="inline-flex h-10 cursor-pointer items-center rounded-xl border border-editor-border bg-black/20 px-3 text-sm text-zinc-200 transition hover:border-zinc-500">
          {isUploading ? '업로드' : '파일'}
          <input
            accept="image/*"
            className="sr-only"
            disabled={disabled || isUploading}
            onChange={(event) => {
              void handleFileChange(event);
            }}
            type="file"
          />
        </label>
      </div>
    </div>
  );
}

export const LoopStateSettingModal = memo(function LoopStateSettingModal({
  cuts,
  initialAttachAfterCutId,
  isOpen,
  isCreating,
  onClose,
  onCreateLoopState,
  onUploadAsset
}: LoopStateSettingModalProps) {
  const [groupName, setGroupName] = useState('Exit Loop');
  const [stageCount, setStageCount] = useState(4);
  const [exitLevelRequired, setExitLevelRequired] = useState(5);
  const [attachAfterCutId, setAttachAfterCutId] = useState('');
  const [continuationCutId, setContinuationCutId] = useState('');
  const [retryCutId, setRetryCutId] = useState('');
  const [stageDrafts, setStageDrafts] = useState<StageDraft[]>(() => createStageDrafts(4));
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const selectableTargetCuts = useMemo(
    () => cuts.filter((cut) => cut.kind !== 'loopVariant' && cut.kind !== 'loopSpacer'),
    [cuts]
  );
  const loopGroupCount = useMemo(
    () => new Set(cuts.map((cut) => cut.loopMetadata?.groupId).filter((groupId): groupId is string => Boolean(groupId))).size,
    [cuts]
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const canUseInitialAnchor =
      initialAttachAfterCutId !== null &&
      cuts.some((cut) => cut.id === initialAttachAfterCutId && cut.kind !== 'loopVariant' && cut.kind !== 'loopSpacer');
    setGroupName('Exit Loop');
    setStageCount(4);
    setExitLevelRequired(5);
    setAttachAfterCutId(canUseInitialAnchor ? initialAttachAfterCutId : '');
    setContinuationCutId('');
    setRetryCutId('');
    setStageDrafts(createStageDrafts(4));
    setStatusMessage(null);
  }, [cuts, initialAttachAfterCutId, isOpen]);

  useEffect(() => {
    setStageDrafts((current) => {
      if (current.length === stageCount) {
        return current;
      }

      if (current.length > stageCount) {
        return current.slice(0, stageCount);
      }

      return [...current, ...Array.from({ length: stageCount - current.length }, (_, index) => createStageDraft(current.length + index + 1))];
    });
  }, [stageCount]);

  function updateStageDraft(stageIndex: number, patch: Partial<StageDraft>) {
    setStageDrafts((current) =>
      current.map((stageDraft, index) => (index === stageIndex ? { ...stageDraft, ...patch } : stageDraft))
    );
  }

  function updateVariantDraft(stageIndex: number, variantIndex: number, patch: Partial<VariantDraft>) {
    setStageDrafts((current) =>
      current.map((stageDraft, currentStageIndex) =>
        currentStageIndex === stageIndex
          ? {
              ...stageDraft,
              variants: stageDraft.variants.map((variantDraft, currentVariantIndex) =>
                currentVariantIndex === variantIndex ? { ...variantDraft, ...patch } : variantDraft
              )
            }
          : stageDraft
      )
    );
  }

  function addVariantDraft(stageIndex: number) {
    setStageDrafts((current) =>
      current.map((stageDraft, currentStageIndex) =>
        currentStageIndex === stageIndex
          ? {
              ...stageDraft,
              variants: [...stageDraft.variants, createVariantDraft(stageIndex + 1, stageDraft.variants.length + 1)]
            }
          : stageDraft
      )
    );
  }

  function removeVariantDraft(stageIndex: number, variantIndex: number) {
    setStageDrafts((current) =>
      current.map((stageDraft, currentStageIndex) =>
        currentStageIndex === stageIndex
          ? {
              ...stageDraft,
              variants: stageDraft.variants.filter((_variantDraft, currentVariantIndex) => currentVariantIndex !== variantIndex)
            }
          : stageDraft
      )
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatusMessage(null);

    try {
      await onCreateLoopState({
        attachAfterCutId: attachAfterCutId || null,
        continuationCutId: continuationCutId || null,
        exitLevelRequired,
        groupName,
        retryCutId: retryCutId || null,
        stages: stageDrafts.map((stageDraft, index) => ({
          baseAssetUrl: toNullableAssetUrl(stageDraft.baseAssetUrl),
          spacerAssetUrl: index === stageDrafts.length - 1 ? null : toNullableAssetUrl(stageDraft.spacerAssetUrl),
          title: stageDraft.title.trim() || undefined,
          variants: stageDraft.variants.map((variantDraft) => ({
            assetUrl: toNullableAssetUrl(variantDraft.assetUrl),
            title: variantDraft.title.trim() || undefined,
            truth: variantDraft.truth
          }))
        }))
      });
      onClose();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'LoopStateSetting 적용에 실패했습니다.');
    }
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-3 py-6 backdrop-blur-sm">
      <section
        aria-labelledby="loop-state-setting-title"
        className="flex max-h-[90dvh] w-full max-w-4xl min-h-0 flex-col overflow-hidden rounded-[18px] border border-editor-border bg-editor-panel shadow-2xl shadow-black/50"
        role="dialog"
      >
        <div className="shrink-0 border-b border-editor-border px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display text-lg font-semibold text-zinc-50" id="loop-state-setting-title">
                LoopStateSetting
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                판정 route cut
                {' '}
                ·
                {' '}
                재시도 / 아래 컷
                {' '}
                ·
                {' '}
                {loopGroupCount}
                {' '}
                loop group{loopGroupCount === 1 ? '' : 's'}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                className="rounded-full border border-editor-border px-3 py-1.5 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isCreating}
                onClick={onClose}
                type="button"
              >
                닫기
              </button>
              <button
                className="rounded-full bg-editor-accent px-3 py-1.5 text-sm font-medium text-white transition hover:bg-editor-accentSoft disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isCreating}
                form="loop-state-setting-form"
                type="submit"
              >
                {isCreating ? '생성 중' : '생성'}
              </button>
            </div>
          </div>
          {statusMessage ? <p className="mt-2 text-xs text-red-200">{statusMessage}</p> : null}
        </div>

        <form
          className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4"
          id="loop-state-setting-form"
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-xs text-zinc-500">
              그룹 이름
              <input
                className="rounded-xl border border-editor-border bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-editor-accentSoft"
                disabled={isCreating}
                onChange={(event) => setGroupName(event.target.value)}
                type="text"
                value={groupName}
              />
            </label>
            <label className="grid gap-1.5 text-xs text-zinc-500">
              스테이지 수
              <input
                className="rounded-xl border border-editor-border bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-editor-accentSoft"
                disabled={isCreating}
                max={12}
                min={1}
                onChange={(event) => setStageCount(clampStageCount(Number(event.target.value) || 1))}
                type="number"
                value={stageCount}
              />
            </label>
            <label className="grid gap-1.5 text-xs text-zinc-500">
              탈출 카운트
              <input
                className="rounded-xl border border-editor-border bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-editor-accentSoft"
                disabled={isCreating}
                max={99}
                min={1}
                onChange={(event) => setExitLevelRequired(Math.min(99, Math.max(1, Number(event.target.value) || 1)))}
                type="number"
                value={exitLevelRequired}
              />
            </label>
            <label className="grid gap-1.5 text-xs text-zinc-500">
              진입 컷
              <select
                className="rounded-xl border border-editor-border bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-editor-accentSoft"
                disabled={isCreating}
                onChange={(event) => setAttachAfterCutId(event.target.value)}
                value={attachAfterCutId}
              >
                <option value="">직접 연결 안 함</option>
                {selectableTargetCuts.map((cut) => (
                  <option key={cut.id} value={cut.id}>
                    {cut.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-xs text-zinc-500">
              아래 컷
              <select
                className="rounded-xl border border-editor-border bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-editor-accentSoft"
                disabled={isCreating}
                onChange={(event) => setContinuationCutId(event.target.value)}
                value={continuationCutId}
              >
                <option value="">새 일반 컷 생성</option>
                {selectableTargetCuts.map((cut) => (
                  <option key={cut.id} value={cut.id}>
                    {cut.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-xs text-zinc-500">
              재시도 컷
              <select
                className="rounded-xl border border-editor-border bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-editor-accentSoft"
                disabled={isCreating}
                onChange={(event) => setRetryCutId(event.target.value)}
                value={retryCutId}
              >
                <option value="">첫 루프 스테이지로 돌아감</option>
                {selectableTargetCuts.map((cut) => (
                  <option key={cut.id} value={cut.id}>
                    {cut.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="space-y-3">
            {stageDrafts.map((stageDraft, index) => (
              <div className="rounded-xl border border-editor-border/70 bg-black/10 p-3" key={index}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-xs text-zinc-500">
                    Stage {index + 1}
                    <input
                      className="rounded-xl border border-editor-border bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-editor-accentSoft"
                      disabled={isCreating}
                      onChange={(event) => updateStageDraft(index, { title: event.target.value })}
                      type="text"
                      value={stageDraft.title}
                    />
                  </label>
                  <label className="grid gap-1.5 text-xs text-zinc-500">
                    Base
                    <span className="rounded-xl border border-editor-border bg-black/20 px-3 py-2 text-sm text-zinc-300">
                      정상 컷
                    </span>
                  </label>
                  <UploadableAssetInput
                    disabled={isCreating}
                    label="Base"
                    onChange={(value) => updateStageDraft(index, { baseAssetUrl: value })}
                    onUploadAsset={onUploadAsset}
                    value={stageDraft.baseAssetUrl}
                  />
                  {index < stageDrafts.length - 1 ? (
                    <UploadableAssetInput
                      disabled={isCreating}
                      label="Spacer"
                      onChange={(value) => updateStageDraft(index, { spacerAssetUrl: value })}
                      onUploadAsset={onUploadAsset}
                      value={stageDraft.spacerAssetUrl}
                    />
                  ) : null}
                </div>
                <div className="mt-3 space-y-2 rounded-xl border border-teal-500/20 bg-teal-500/5 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-teal-100">Variants</p>
                    <button
                      className="rounded-full border border-teal-400/35 px-2.5 py-1 text-xs font-medium text-teal-100 transition hover:bg-teal-400/10 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isCreating}
                      onClick={() => addVariantDraft(index)}
                      type="button"
                    >
                      + Variant
                    </button>
                  </div>
                  {stageDraft.variants.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-teal-500/25 px-3 py-2 text-xs text-teal-100/65">
                      이 스테이지는 항상 base 정상 컷으로 표시됩니다.
                    </p>
                  ) : (
                    stageDraft.variants.map((variantDraft, variantIndex) => (
                      <div className="grid gap-2 rounded-lg border border-editor-border/60 bg-black/10 p-2 sm:grid-cols-[minmax(0,1fr)_9rem_auto]" key={variantIndex}>
                        <label className="grid gap-1 text-xs text-zinc-500">
                          Variant title
                          <input
                            className="rounded-lg border border-editor-border bg-black/20 px-2.5 py-2 text-sm text-zinc-100 outline-none transition focus:border-editor-accentSoft"
                            disabled={isCreating}
                            onChange={(event) => updateVariantDraft(index, variantIndex, { title: event.target.value })}
                            type="text"
                            value={variantDraft.title}
                          />
                        </label>
                        <label className="grid gap-1 text-xs text-zinc-500">
                          Truth
                          <select
                            className="rounded-lg border border-editor-border bg-black/20 px-2.5 py-2 text-sm text-zinc-100 outline-none transition focus:border-editor-accentSoft"
                            disabled={isCreating}
                            onChange={(event) => updateVariantDraft(index, variantIndex, { truth: event.target.value as NonNullable<StageTruth> })}
                            value={variantDraft.truth}
                          >
                            <option value="real_anomaly">진짜 이상</option>
                            <option value="fake_suspicion">페이크</option>
                          </select>
                        </label>
                        <button
                          className="self-end rounded-lg border border-red-400/25 px-2.5 py-2 text-xs font-medium text-red-100 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={isCreating}
                          onClick={() => removeVariantDraft(index, variantIndex)}
                          type="button"
                        >
                          삭제
                        </button>
                        <div className="sm:col-span-3">
                          <UploadableAssetInput
                            disabled={isCreating}
                            label="Variant asset"
                            onChange={(value) => updateVariantDraft(index, variantIndex, { assetUrl: value })}
                            onUploadAsset={onUploadAsset}
                            value={variantDraft.assetUrl}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </form>
      </section>
    </div>
  );
});

import { useEffect, useId, useState, type ChangeEvent } from 'react';

import type { ChannelProfile } from '../model/channel.types';

interface EditChannelCoverDialogProps {
  isDeleting: boolean;
  isOpen: boolean;
  isUploading: boolean;
  onClose: () => void;
  onDelete: () => Promise<void>;
  onUpload: (file: File) => Promise<void>;
  profile: ChannelProfile;
}

export function EditChannelCoverDialog({
  isDeleting,
  isOpen,
  isUploading,
  onClose,
  onDelete,
  onUpload,
  profile
}: EditChannelCoverDialogProps) {
  const fileInputId = useId();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isBusy = isUploading || isDeleting;

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return undefined;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedFile(null);
      setErrorMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setErrorMessage(null);

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!file.type.startsWith('image/')) {
      setSelectedFile(null);
      setErrorMessage('이미지 파일만 업로드할 수 있습니다.');
      return;
    }

    setSelectedFile(file);
  }

  async function handleUpload() {
    if (!selectedFile) {
      setErrorMessage('업로드할 커버 이미지를 선택해 주세요.');
      return;
    }

    setErrorMessage(null);
    try {
      await onUpload(selectedFile);
      setSelectedFile(null);
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '커버 업로드에 실패했습니다.');
    }
  }

  async function handleDelete() {
    setErrorMessage(null);
    try {
      await onDelete();
      setSelectedFile(null);
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '커버 삭제에 실패했습니다.');
    }
  }

  const previewSource = previewUrl ?? profile.coverImage?.mobileUrl ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/70 p-4 backdrop-blur sm:items-center sm:justify-center" role="presentation">
      <section aria-modal="true" className="w-full max-w-lg rounded-[28px] border border-white/12 bg-[#111113] p-5 text-white shadow-2xl shadow-black/35" role="dialog">
        <h2 className="font-display text-2xl font-semibold">커버 변경</h2>
        <p className="mt-2 text-sm leading-6 text-white/62">
          {profile.displayName} 채널 상단에 표시할 이미지를 업로드합니다. 권장 비율은 8:3 또는 3:1입니다.
        </p>

        <label
          className="mt-5 block cursor-pointer rounded-[22px] border border-dashed border-white/16 bg-white/[0.045] p-4 transition hover:border-white/28 hover:bg-white/[0.07]"
          htmlFor={fileInputId}
        >
          <input
            accept="image/*"
            className="sr-only"
            disabled={isBusy}
            id={fileInputId}
            onChange={handleFileChange}
            type="file"
          />
          <div className="relative aspect-[8/3] overflow-hidden rounded-[18px] bg-white/8">
            {previewSource ? (
              <img alt="채널 커버 미리보기" className="h-full w-full object-cover" src={previewSource} />
            ) : (
              <div className="flex h-full items-center justify-center bg-[linear-gradient(135deg,rgba(245,184,91,0.18),rgba(255,255,255,0.06),rgba(0,0,0,0.35))] text-sm text-white/58">
                커버 이미지 선택
              </div>
            )}
          </div>
          <p className="mt-3 text-sm font-semibold text-white">{selectedFile ? selectedFile.name : '이미지 파일 선택'}</p>
          <p className="mt-1 text-xs leading-5 text-white/48">JPG, PNG, WebP 이미지를 업로드하면 WebP 커버로 저장됩니다.</p>
        </label>

        {errorMessage ? (
          <p className="mt-3 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {errorMessage}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            className="min-h-11 rounded-full border border-red-300/18 px-5 text-sm font-semibold text-red-100 transition hover:bg-red-500/10 disabled:opacity-50"
            disabled={isBusy || !profile.coverImage}
            onClick={handleDelete}
            type="button"
          >
            {isDeleting ? '삭제 중...' : '커버 삭제'}
          </button>
          <div className="flex justify-end gap-2">
            <button
              className="min-h-11 rounded-full border border-white/12 px-5 text-sm font-semibold text-white transition hover:bg-white/8 disabled:opacity-50"
              disabled={isBusy}
              onClick={onClose}
              type="button"
            >
              닫기
            </button>
            <button
              className="min-h-11 rounded-full bg-white px-5 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:opacity-50"
              disabled={isBusy || !selectedFile}
              onClick={handleUpload}
              type="button"
            >
              {isUploading ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

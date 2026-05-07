import { useEffect, useId, useState, type ChangeEvent } from 'react';

import type { ChannelProfile } from '../model/channel.types';

interface EditChannelAvatarDialogProps {
  isDeleting: boolean;
  isOpen: boolean;
  isUploading: boolean;
  onClose: () => void;
  onDelete: () => Promise<void>;
  onUpload: (file: File) => Promise<void>;
  profile: ChannelProfile;
}

export function EditChannelAvatarDialog({
  isDeleting,
  isOpen,
  isUploading,
  onClose,
  onDelete,
  onUpload,
  profile
}: EditChannelAvatarDialogProps) {
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
      setErrorMessage('업로드할 프로필 아이콘을 선택해 주세요.');
      return;
    }

    setErrorMessage(null);
    try {
      await onUpload(selectedFile);
      setSelectedFile(null);
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '프로필 아이콘 업로드에 실패했습니다.');
    }
  }

  async function handleDelete() {
    setErrorMessage(null);
    try {
      await onDelete();
      setSelectedFile(null);
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '프로필 아이콘 삭제에 실패했습니다.');
    }
  }

  const avatarFallback = profile.displayName.trim().slice(0, 1).toUpperCase() || 'P';
  const previewSource = previewUrl ?? profile.avatarImage?.mobileUrl ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/70 p-4 backdrop-blur sm:items-center sm:justify-center" role="presentation">
      <section aria-modal="true" className="w-full max-w-md rounded-[28px] border border-white/12 bg-[#111113] p-5 text-white shadow-2xl shadow-black/35" role="dialog">
        <h2 className="font-display text-2xl font-semibold">프로필 아이콘 변경</h2>
        <p className="mt-2 text-sm leading-6 text-white/62">
          채널에 표시할 프로필 아이콘을 업로드합니다. 이미지는 1:1 정사각형 WebP로 저장됩니다.
        </p>

        <label
          className="mt-5 block cursor-pointer rounded-[22px] border border-dashed border-white/16 bg-white/[0.045] p-5 text-center transition hover:border-white/28 hover:bg-white/[0.07]"
          htmlFor={fileInputId}
        >
          <input
            aria-label="프로필 아이콘 이미지 선택"
            accept="image/*"
            className="sr-only"
            disabled={isBusy}
            id={fileInputId}
            onChange={handleFileChange}
            type="file"
          />
          <div className="mx-auto flex h-32 w-32 items-center justify-center overflow-hidden rounded-[34px] border border-white/14 bg-white/10 text-4xl font-semibold text-white">
            {previewSource ? (
              <img alt="프로필 아이콘 미리보기" className="h-full w-full object-cover" src={previewSource} />
            ) : (
              avatarFallback
            )}
          </div>
          <p className="mt-4 text-sm font-semibold text-white">{selectedFile ? selectedFile.name : '이미지 파일 선택'}</p>
          <p className="mt-1 text-xs leading-5 text-white/48">JPG, PNG, WebP 이미지를 사용할 수 있습니다.</p>
        </label>

        {errorMessage ? (
          <p className="mt-3 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {errorMessage}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            className="min-h-11 rounded-full border border-red-300/18 px-5 text-sm font-semibold text-red-100 transition hover:bg-red-500/10 disabled:opacity-50"
            disabled={isBusy || !profile.avatarImage}
            onClick={handleDelete}
            type="button"
          >
            {isDeleting ? '삭제 중...' : '아이콘 삭제'}
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

import { useEffect, useId, useState, type FormEvent } from 'react';

import type { ChannelProfile } from '../model/channel.types';
import { formatChannelHandle } from '../lib/format-channel-handle';

interface EditChannelProfilePayload {
  bio: string | null;
  displayName: string;
}

interface EditChannelProfileDialogProps {
  isOpen: boolean;
  isSaving: boolean;
  onClose: () => void;
  onSave: (payload: EditChannelProfilePayload) => Promise<void>;
  profile: ChannelProfile;
}

const CHANNEL_DISPLAY_NAME_MAX_LENGTH = 80;
const CHANNEL_BIO_MAX_LENGTH = 280;

export function EditChannelProfileDialog({
  isOpen,
  isSaving,
  onClose,
  onSave,
  profile
}: EditChannelProfileDialogProps) {
  const titleId = useId();
  const displayNameInputId = useId();
  const bioInputId = useId();
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio ?? '');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fallbackAccountId = profile.handle.replace(/^@/, '') || profile.slug;
  const accountId = formatChannelHandle(profile.accountId ?? fallbackAccountId);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setDisplayName(profile.displayName);
    setBio(profile.bio ?? '');
    setErrorMessage(null);
  }, [isOpen, profile.bio, profile.displayName]);

  if (!isOpen) {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextDisplayName = displayName.trim().replace(/\s+/g, ' ');
    const nextBio = bio.trim();

    if (!nextDisplayName) {
      setErrorMessage('채널명을 입력해 주세요.');
      return;
    }
    if (nextDisplayName.length > CHANNEL_DISPLAY_NAME_MAX_LENGTH) {
      setErrorMessage(`채널명은 ${CHANNEL_DISPLAY_NAME_MAX_LENGTH}자 이내로 입력해 주세요.`);
      return;
    }
    if (nextBio.length > CHANNEL_BIO_MAX_LENGTH) {
      setErrorMessage(`소개는 ${CHANNEL_BIO_MAX_LENGTH}자 이내로 입력해 주세요.`);
      return;
    }

    setErrorMessage(null);
    try {
      await onSave({
        displayName: nextDisplayName,
        bio: nextBio || null
      });
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '채널 프로필 저장에 실패했습니다.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/70 p-4 backdrop-blur sm:items-center sm:justify-center" role="presentation">
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="w-full max-w-lg rounded-[28px] border border-white/12 bg-[#111113] p-5 text-white shadow-2xl shadow-black/35"
        role="dialog"
      >
        <h2 className="font-display text-2xl font-semibold" id={titleId}>프로필 편집</h2>
        <form className="mt-5 flex flex-col gap-4" onSubmit={handleSubmit}>
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-white/42" htmlFor={displayNameInputId}>
              채널명
            </label>
            <input
              className="mt-2 min-h-12 w-full rounded-2xl border border-white/12 bg-white/[0.06] px-4 text-base font-semibold text-white outline-none transition placeholder:text-white/28 focus:border-white/28 focus:bg-white/[0.09]"
              disabled={isSaving}
              id={displayNameInputId}
              maxLength={CHANNEL_DISPLAY_NAME_MAX_LENGTH}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="채널명을 입력하세요"
              type="text"
              value={displayName}
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-white/42" htmlFor={bioInputId}>
              소개
            </label>
            <textarea
              className="mt-2 min-h-28 w-full resize-none rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/28 focus:border-white/28 focus:bg-white/[0.09]"
              disabled={isSaving}
              id={bioInputId}
              maxLength={CHANNEL_BIO_MAX_LENGTH}
              onChange={(event) => setBio(event.target.value)}
              placeholder="채널 소개를 입력하세요"
              value={bio}
            />
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/38">계정 ID</p>
            <p className="mt-1 text-sm font-semibold text-white/78">{accountId}</p>
          </div>

          {errorMessage ? (
            <p className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {errorMessage}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <button
              className="min-h-11 rounded-full border border-white/12 px-5 text-sm font-semibold text-white transition hover:bg-white/8 disabled:opacity-50"
              disabled={isSaving}
              onClick={onClose}
              type="button"
            >
              취소
            </button>
            <button
              className="min-h-11 rounded-full bg-white px-5 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:opacity-50"
              disabled={isSaving}
              type="submit"
            >
              {isSaving ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

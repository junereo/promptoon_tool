import { useState } from 'react';
import type { Publish } from '@promptoon/shared';

export function PublishSuccessToast({
  onClose,
  publish
}: {
  onClose: () => void;
  publish: Publish | null;
}) {
  const [copied, setCopied] = useState(false);

  if (!publish) {
    return null;
  }

  const viewerPath = `/v/${publish.id}`;

  async function handleCopyLink() {
    const origin = window.location.origin;
    const viewerUrl = `${origin}${viewerPath}`;

    try {
      await navigator.clipboard.writeText(viewerUrl);
      setCopied(true);
      window.setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="fixed right-6 top-6 z-50 w-full max-w-sm rounded-[28px] border border-emerald-500/30 bg-emerald-500/15 p-5 text-emerald-50 shadow-2xl shadow-black/30 backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-xl font-semibold">성공적으로 발행되었습니다</p>
          <p className="mt-2 text-sm text-emerald-100/90">Version {publish.versionNo} is now live.</p>
          <p className="mt-1 text-xs text-emerald-100/70">{viewerPath}</p>
        </div>
        <button
          className="rounded-full border border-emerald-300/20 px-3 py-1 text-xs text-emerald-50 transition hover:border-emerald-200/40"
          onClick={onClose}
          type="button"
        >
          Close
        </button>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <a
          className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-950 transition hover:bg-white"
          href={viewerPath}
          rel="noreferrer"
          target="_blank"
        >
          뷰어 열기
        </a>
        <button
          className="rounded-full border border-emerald-300/20 px-4 py-2 text-sm text-emerald-50 transition hover:border-emerald-200/40"
          onClick={handleCopyLink}
          type="button"
        >
          {copied ? '링크 복사됨' : '링크 복사'}
        </button>
      </div>
    </div>
  );
}

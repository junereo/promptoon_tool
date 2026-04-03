import type { Cut } from '@promptoon/shared';

export function DeleteCutConfirmModal({
  cut,
  isDeleting,
  onCancel,
  onConfirm
}: {
  cut: Cut | null;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!cut) {
    return null;
  }

  return (
    <div
      aria-labelledby="delete-cut-confirm-title"
      aria-modal="true"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm"
      role="dialog"
    >
      <div className="w-full max-w-md rounded-[28px] border border-editor-border bg-editor-panel p-6 shadow-2xl shadow-black/40">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-2xl font-semibold text-zinc-50" id="delete-cut-confirm-title">
              컷 삭제
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-300">삭제 하시겠습니까.</p>
          </div>
          <button
            className="rounded-full border border-editor-border px-3 py-1.5 text-sm text-zinc-300 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isDeleting}
            onClick={onCancel}
            type="button"
          >
            취소
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3">
          <p className="text-sm text-red-100">
            <span className="font-medium">{cut.title}</span>
            {' '}
            컷이 삭제되며 되돌릴 수 없습니다.
          </p>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            className="rounded-full border border-editor-border px-4 py-2 text-sm text-zinc-200 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isDeleting}
            onClick={onCancel}
            type="button"
          >
            취소
          </button>
          <button
            className="rounded-full bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isDeleting}
            onClick={onConfirm}
            type="button"
          >
            {isDeleting ? '삭제 중...' : '삭제'}
          </button>
        </div>
      </div>
    </div>
  );
}

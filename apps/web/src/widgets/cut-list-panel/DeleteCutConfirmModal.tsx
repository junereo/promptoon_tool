import type { Cut } from '@promptoon/shared';

export function DeleteCutConfirmModal({
  cut,
  incomingChoiceCount,
  isDeleting,
  onCancel,
  onConfirm,
  onReconnectChange,
  reconnectCandidates,
  reconnectToCutId
}: {
  cut: Cut | null;
  incomingChoiceCount: number;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onReconnectChange: (cutId: string | null) => void;
  reconnectCandidates: Cut[];
  reconnectToCutId: string | null;
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

        {incomingChoiceCount > 0 ? (
          <div className="mt-4 rounded-2xl border border-editor-border bg-black/15 px-4 py-3">
            <label className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500" htmlFor="delete-cut-reconnect">
              Reconnect incoming choices
            </label>
            <select
              className="mt-2 w-full rounded-xl border border-editor-border bg-[#18181d] px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-editor-accent disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isDeleting}
              id="delete-cut-reconnect"
              onChange={(event) => onReconnectChange(event.target.value || null)}
              value={reconnectToCutId ?? ''}
            >
              <option value="">Do not reconnect</option>
              {reconnectCandidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.title}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs leading-5 text-zinc-500">
              {incomingChoiceCount}
              {' '}
              incoming choice{incomingChoiceCount === 1 ? '' : 's'} can be pointed to the selected next cut before deletion.
            </p>
          </div>
        ) : null}

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

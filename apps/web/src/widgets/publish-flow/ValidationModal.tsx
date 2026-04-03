import type { ValidateEpisodeResponse } from '@promptoon/shared';

export function ValidationModal({
  isOpen,
  isPublishing,
  onClose,
  onPublish,
  result
}: {
  isOpen: boolean;
  isPublishing: boolean;
  onClose: () => void;
  onPublish: () => void;
  result: ValidateEpisodeResponse | null;
}) {
  if (!isOpen || !result) {
    return null;
  }

  const canPublish = result.isValid;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm">
      <div className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-[32px] border border-editor-border bg-editor-panel shadow-2xl shadow-black/40">
        <div className="border-b border-editor-border px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-display text-2xl font-semibold text-zinc-50">Validation Report</p>
              <p className="mt-2 text-sm text-zinc-400">
                {canPublish ? '완벽합니다! 발행할 준비가 되었습니다.' : '발행 전에 아래 이슈를 먼저 확인해 주세요.'}
              </p>
            </div>
            <button
              className="rounded-full border border-editor-border px-3 py-1.5 text-sm text-zinc-300 transition hover:border-zinc-500"
              onClick={onClose}
              type="button"
            >
              Close
            </button>
          </div>
        </div>

        <div className="min-h-0 overflow-y-auto px-6 py-6">
          <section
            className={[
              'rounded-2xl border p-4',
              canPublish ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-red-500/30 bg-red-500/10'
            ].join(' ')}
          >
            <p className={canPublish ? 'text-emerald-100' : 'text-red-100'}>
              {canPublish ? 'No blocking validation errors were found.' : `${result.errors.length} blocking error(s) found.`}
            </p>
          </section>

          {result.errors.length > 0 ? (
            <section className="mt-5 rounded-2xl border border-red-500/20 bg-black/10 p-4">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-red-200">Errors</p>
              <ul className="mt-3 space-y-3 text-sm text-red-100">
                {result.errors.map((issue) => (
                  <li key={`${issue.code}-${issue.message}`} className="rounded-2xl border border-red-500/10 bg-red-500/5 px-4 py-3">
                    <span className="mr-2 text-red-300">!</span>
                    {issue.message}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {result.warnings.length > 0 ? (
            <section className="mt-5 rounded-2xl border border-amber-500/20 bg-black/10 p-4">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-amber-200">Warnings</p>
              <ul className="mt-3 space-y-3 text-sm text-amber-100">
                {result.warnings.map((issue) => (
                  <li
                    key={`${issue.code}-${issue.message}`}
                    className="rounded-2xl border border-amber-500/10 bg-amber-500/5 px-4 py-3"
                  >
                    <span className="mr-2 text-amber-300">!</span>
                    {issue.message}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-editor-border px-6 py-5">
          <p className="text-sm text-zinc-500">
            {canPublish ? 'Warnings do not block publishing in this MVP flow.' : 'Resolve blocking errors before publishing.'}
          </p>
          <div className="flex items-center gap-3">
            <button
              className="rounded-full border border-editor-border px-4 py-2 text-sm text-zinc-200 transition hover:border-zinc-500"
              onClick={onClose}
              type="button"
            >
              Close
            </button>
            {canPublish ? (
              <button
                className="rounded-full bg-editor-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-editor-accentSoft disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isPublishing}
                onClick={onPublish}
                type="button"
              >
                {isPublishing ? '발행 중...' : '바로 발행하기'}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

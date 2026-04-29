export function EditorToolbar({
  activeTab,
  episodeStatus,
  episodeTitle,
  highlightSaveOrder,
  isDirty,
  lastPublishedVersion,
  isPublishing,
  isValidating,
  onBack,
  onPublish,
  onSaveOrder,
  onOpenScriptEditor,
  onTabChange,
  onToggleViewMode,
  onValidate,
  publishedViewerPath,
  toolbarNotice,
  viewMode
}: {
  activeTab: 'editor' | 'analytics';
  episodeStatus: 'draft' | 'published';
  episodeTitle: string;
  highlightSaveOrder: boolean;
  isDirty: boolean;
  lastPublishedVersion: number | null;
  isPublishing: boolean;
  isValidating: boolean;
  onBack: () => void;
  onPublish: () => void;
  onSaveOrder: () => void;
  onOpenScriptEditor: () => void;
  onTabChange: (tab: 'editor' | 'analytics') => void;
  onToggleViewMode: () => void;
  onValidate: () => void;
  publishedViewerPath: string | null;
  toolbarNotice: string | null;
  viewMode: 'list' | 'graph';
}) {
  const publishSummary = isPublishing
    ? 'running'
    : lastPublishedVersion
      ? `v${lastPublishedVersion} live`
      : episodeStatus === 'published'
        ? 'published'
        : 'idle';
  const publishActionLabel = episodeStatus === 'published' ? (isPublishing ? 'Updating...' : 'Update Publish') : isPublishing ? 'Publishing...' : 'Publish';
  const saveActionLabel = viewMode === 'graph' ? 'Save Layout' : 'Save Order';

  return (
    <section className="rounded-[24px] border border-editor-border bg-editor-panel/80 p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-start gap-3">
          <button
            className="rounded-full border border-editor-border px-3 py-1.5 text-sm text-zinc-200 transition hover:border-zinc-500"
            onClick={onBack}
            type="button"
          >
            Back to Dashboard
          </button>
          <div>
            <p className="font-display text-2xl font-semibold tracking-tight text-zinc-50">{episodeTitle}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-editor-border bg-black/20 p-1">
            <button
              className={[
                'rounded-full px-3 py-1.5 text-sm transition',
                activeTab === 'editor' ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-300 hover:text-white'
              ].join(' ')}
              onClick={() => {
                if (activeTab !== 'editor') {
                  onTabChange('editor');
                }
              }}
              type="button"
            >
              편집
            </button>
            <button
              className={[
                'rounded-full px-3 py-1.5 text-sm transition',
                activeTab === 'analytics' ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-300 hover:text-white'
              ].join(' ')}
              onClick={() => {
                if (activeTab !== 'analytics') {
                  onTabChange('analytics');
                }
              }}
              type="button"
            >
              분석
            </button>
          </div>
          <div className="inline-flex rounded-full border border-editor-border bg-black/20 p-1">
            <button
              className={[
                'rounded-full px-3 py-1.5 text-sm transition',
                viewMode === 'list' ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-300 hover:text-white'
              ].join(' ')}
              onClick={() => {
                if (viewMode !== 'list') {
                  onToggleViewMode();
                }
              }}
              type="button"
            >
              List
            </button>
            <button
              className={[
                'rounded-full px-3 py-1.5 text-sm transition',
                viewMode === 'graph' ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-300 hover:text-white'
              ].join(' ')}
              onClick={() => {
                if (viewMode !== 'graph') {
                  onToggleViewMode();
                }
              }}
              type="button"
            >
              Graph
            </button>
          </div>
          <button
            className="rounded-full border border-editor-border px-3 py-1.5 text-sm text-zinc-200 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isValidating || isPublishing}
            onClick={onValidate}
            type="button"
          >
            {isValidating ? 'Validating...' : 'Validate'}
          </button>
          <button
            className="rounded-full border border-editor-border px-3 py-1.5 text-sm text-zinc-200 transition hover:border-zinc-500"
            onClick={onOpenScriptEditor}
            type="button"
          >
            Script
          </button>
          <button
            className={[
              'rounded-full px-3 py-1.5 text-sm font-medium transition',
              isDirty ? 'bg-zinc-100 text-zinc-950 hover:bg-white animate-pulse' : 'border border-editor-border text-zinc-500',
              highlightSaveOrder ? 'animate-bounce' : ''
            ].join(' ')}
            disabled={!isDirty}
            onClick={onSaveOrder}
            type="button"
          >
            {saveActionLabel}
          </button>
          <button
            className="rounded-full bg-editor-accent px-3 py-1.5 text-sm font-medium text-white transition hover:bg-editor-accentSoft disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isValidating || isPublishing}
            onClick={onPublish}
            type="button"
          >
            {publishActionLabel}
          </button>
          <span className="rounded-full border border-editor-border bg-black/10 px-3 py-1.5 text-sm text-zinc-300">
            Publish: {publishSummary}
          </span>
          {publishedViewerPath ? (
            <a
              className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-100 transition hover:border-emerald-300/50 hover:bg-emerald-500/15"
              href={publishedViewerPath}
              rel="noreferrer"
              target="_blank"
            >
              Open Viewer
            </a>
          ) : null}
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        {toolbarNotice ?? ''}
      </p>
    </section>
  );
}

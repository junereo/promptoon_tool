import type { Cut } from '@promptoon/shared';
import type { ChangeEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  buildScriptPatch,
  exportCutsToScript,
  parseScriptJson,
  type ScriptCutPatch
} from '../../shared/lib/script-sync';

function createScriptText(cuts: Cut[]): string {
  return JSON.stringify(exportCutsToScript(cuts), null, 2);
}

function createScriptFileName(): string {
  return `promptoon-script-${new Date().toISOString().slice(0, 10)}.json`;
}

function readFileText(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    return file.text();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(typeof reader.result === 'string' ? reader.result : ''));
    reader.addEventListener('error', () => reject(reader.error ?? new Error('Failed to read file.')));
    reader.readAsText(file);
  });
}

export function ScriptEditorModal({
  cuts,
  isOpen,
  onApply,
  onClose
}: {
  cuts: Cut[];
  isOpen: boolean;
  onApply: (patches: ScriptCutPatch[]) => void;
  onClose: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [scriptText, setScriptText] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setScriptText(createScriptText(cuts));
    setNotice(null);
  }, [cuts, isOpen]);

  const parseResult = useMemo(() => parseScriptJson(scriptText), [scriptText]);
  const patchResult = useMemo(
    () => (parseResult.data ? buildScriptPatch(cuts, parseResult.data) : { patches: [], warnings: [] }),
    [cuts, parseResult.data]
  );
  const warnings = [...parseResult.warnings, ...patchResult.warnings];
  const canApply = Boolean(parseResult.data);

  if (!isOpen) {
    return null;
  }

  async function handleCopy() {
    await navigator.clipboard?.writeText(scriptText);
    setNotice('Copied script JSON.');
  }

  function handleDownload() {
    const blob = new Blob([scriptText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = createScriptFileName();
    link.click();
    URL.revokeObjectURL(url);
    setNotice('Downloaded script JSON.');
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setScriptText(await readFileText(file));
    setNotice(`Loaded ${file.name}.`);
    event.target.value = '';
  }

  function handleApply() {
    if (!canApply) {
      return;
    }

    onApply(patchResult.patches);
    onClose();
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6" role="presentation">
      <section
        aria-labelledby="script-editor-title"
        aria-modal="true"
        className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-[28px] border border-editor-border bg-editor-panel shadow-2xl shadow-black/50"
        role="dialog"
      >
        <div className="flex flex-col gap-4 border-b border-editor-border px-6 py-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p id="script-editor-title" className="font-display text-2xl font-semibold text-zinc-50">
              Script JSON
            </p>
            <p className="mt-2 text-sm text-zinc-400">
              Edit text and dialogue speakers only. Styling, placement, assets, and choices stay unchanged.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-full border border-editor-border px-4 py-2 text-sm text-zinc-200 transition hover:border-zinc-500"
              onClick={() => setScriptText(createScriptText(cuts))}
              type="button"
            >
              Reset
            </button>
            <button
              className="rounded-full border border-editor-border px-4 py-2 text-sm text-zinc-200 transition hover:border-zinc-500"
              onClick={handleCopy}
              type="button"
            >
              Copy
            </button>
            <button
              className="rounded-full border border-editor-border px-4 py-2 text-sm text-zinc-200 transition hover:border-zinc-500"
              onClick={handleDownload}
              type="button"
            >
              Download JSON
            </button>
            <button
              className="rounded-full border border-editor-border px-4 py-2 text-sm text-zinc-200 transition hover:border-zinc-500"
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              Upload JSON
            </button>
            <input
              ref={fileInputRef}
              aria-label="Upload script JSON file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleUpload}
              type="file"
            />
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <textarea
            aria-label="Script JSON editor"
            className="min-h-[520px] resize-none rounded-2xl border border-editor-border bg-black/30 p-4 font-mono text-sm leading-6 text-zinc-100 outline-none transition focus:border-editor-accentSoft"
            onChange={(event) => {
              setScriptText(event.target.value);
              setNotice(null);
            }}
            spellCheck={false}
            value={scriptText}
          />
          <aside className="flex min-h-0 flex-col gap-3 overflow-auto">
            <div
              className={[
                'rounded-2xl border px-4 py-3 text-sm',
                canApply ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100' : 'border-red-400/30 bg-red-500/10 text-red-100'
              ].join(' ')}
            >
              {canApply ? `${patchResult.patches.length} changed cut patch(es) ready.` : 'Fix JSON errors before applying.'}
            </div>

            {notice ? (
              <div className="rounded-2xl border border-editor-border bg-black/10 px-4 py-3 text-sm text-zinc-300">{notice}</div>
            ) : null}

            {parseResult.errors.length > 0 ? (
              <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                <p className="font-medium">Errors</p>
                <ul className="mt-2 space-y-2">
                  {parseResult.errors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {warnings.length > 0 ? (
              <div className="rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                <p className="font-medium">Warnings</p>
                <ul className="mt-2 space-y-2">
                  {warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </aside>
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t border-editor-border px-6 py-5">
          <button
            className="rounded-full border border-editor-border px-5 py-2 text-sm text-zinc-300 transition hover:border-zinc-500"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-full bg-editor-accent px-5 py-2 text-sm font-medium text-white transition hover:bg-editor-accentSoft disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canApply}
            onClick={handleApply}
            type="button"
          >
            Apply
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
}

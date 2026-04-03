import type { MouseEventHandler } from 'react';

interface ViewerControlsProps {
  canGoBack: boolean;
  isVisible: boolean;
  onBack: MouseEventHandler<HTMLButtonElement>;
  onClose: MouseEventHandler<HTMLButtonElement>;
  onReset: MouseEventHandler<HTMLButtonElement>;
}

export function ViewerControls({ canGoBack, isVisible, onBack, onClose, onReset }: ViewerControlsProps) {
  return (
    <div
      className={[
        'pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between p-4 transition duration-300 sm:p-6',
        isVisible ? 'opacity-100' : 'opacity-0'
      ].join(' ')}
    >
      <div className="pointer-events-auto flex items-center gap-2">
        <button
          className="rounded-full border border-white/15 bg-black/40 px-4 py-2 text-sm text-white/90 backdrop-blur transition hover:bg-black/55 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!canGoBack}
          onClick={onBack}
          type="button"
        >
          이전으로
        </button>
        <button
          className="rounded-full border border-white/15 bg-black/40 px-4 py-2 text-sm text-white/90 backdrop-blur transition hover:bg-black/55"
          onClick={onReset}
          type="button"
        >
          처음으로
        </button>
      </div>

      <button
        className="pointer-events-auto rounded-full border border-white/15 bg-black/40 px-4 py-2 text-sm text-white/90 backdrop-blur transition hover:bg-black/55"
        onClick={onClose}
        type="button"
      >
        닫기
      </button>
    </div>
  );
}

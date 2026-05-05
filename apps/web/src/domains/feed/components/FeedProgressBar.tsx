export function FeedProgressBar({ value }: { value: number }) {
  const progress = Math.max(0, Math.min(100, value));

  return (
    <div className="h-1 w-full overflow-hidden bg-white/15">
      <div className="h-full bg-editor-accentSoft transition-[width] duration-150" style={{ width: `${progress}%` }} />
    </div>
  );
}

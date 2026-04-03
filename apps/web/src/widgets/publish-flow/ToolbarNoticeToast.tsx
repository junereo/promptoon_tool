export function ToolbarNoticeToast({
  message
}: {
  message: string | null;
}) {
  if (!message) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-full max-w-sm rounded-[24px] border border-amber-400/25 bg-black/85 px-5 py-4 text-sm text-amber-100 shadow-2xl shadow-black/40 backdrop-blur">
      {message}
    </div>
  );
}

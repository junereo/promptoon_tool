import { EditPencilLine01 as Pencil } from 'react-coolicons';

interface ChannelOwnerActionsProps {
  isOwner: boolean;
  onEditCover: () => void;
}

export function ChannelOwnerActions({ isOwner, onEditCover }: ChannelOwnerActionsProps) {
  if (!isOwner) {
    return null;
  }

  return (
    <button
      className="absolute bottom-4 right-4 z-30 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 bg-black/48 px-4 text-sm font-semibold text-white shadow-lg shadow-black/30 backdrop-blur-xl transition hover:bg-black/62"
      onClick={onEditCover}
      type="button"
    >
      <Pencil aria-hidden className="h-4 w-4" />
      커버 변경
    </button>
  );
}

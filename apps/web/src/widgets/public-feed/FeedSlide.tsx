import type { FeedItem } from '@promptoon/shared';

import { ViewerCutCard } from '../public-viewer/ViewerCutCard';

export function FeedSlide({
  item,
  onChoiceClick
}: {
  item: FeedItem;
  onChoiceClick: (choiceId: string) => void;
}) {
  return (
    <article className="relative h-dvh w-full snap-start snap-always overflow-hidden bg-black" data-feed-slide data-publish-id={item.publishId}>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-5 pt-6 sm:px-8 sm:pt-8">
        <div className="max-w-sm rounded-[24px] border border-white/10 bg-black/25 px-4 py-3 backdrop-blur-md">
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/55">{item.projectTitle}</p>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">{item.episodeTitle}</h1>
        </div>
      </div>

      <div className="h-full w-full">
        <ViewerCutCard
          cut={{
            ...item.startCut,
            kind: 'choice',
            isEnding: false,
            isStart: true,
            orderIndex: 0,
            positionX: 0,
            positionY: 0,
            choices: item.startChoices
          }}
          onChoiceClick={(choice) => onChoiceClick(choice.id)}
          showChoices
          showEndingActions={false}
          visibleChoices={item.startChoices}
        />
      </div>
    </article>
  );
}

import type { FeedHomeSection, FeedItem } from '@promptoon/shared';
import { useQuery } from '@tanstack/react-query';
import type { CSSProperties } from 'react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import { feedApi } from '../../../shared/api/feed.api';
import { promptoonKeys } from '../../../shared/api/query-keys';
import { ConsumerContentCard } from '../components/ConsumerContentCard';
import { ConsumerResponsiveFrame } from '../components/ConsumerResponsiveFrame';

const HOME_CHIPS = [
  { label: '인기', target: 'popular' },
  { label: '신작', target: 'new' },
  { label: '추천', target: 'recommended' },
  { label: '모아보기', target: 'all' },
  { label: '랭킹', target: 'ranking' }
];
const HOME_CARD_SLOT_STYLE: CSSProperties = {
  flexBasis: 'calc((100% - 1.5rem) / 3)'
};

interface HomeCollection {
  key: string;
  title: string;
  items: FeedItem[];
  showRank?: boolean;
}

function findSectionItems(sections: FeedHomeSection[], key: FeedHomeSection['key']) {
  return sections.find((section) => section.key === key)?.items ?? [];
}

function uniqueItems(items: FeedItem[]) {
  const seen = new Set<string>();
  const result: FeedItem[] = [];

  for (const item of items) {
    if (seen.has(item.publishId)) {
      continue;
    }

    seen.add(item.publishId);
    result.push(item);
  }

  return result;
}

function buildHomeCollections(sections: FeedHomeSection[]): HomeCollection[] {
  const popularItems = findSectionItems(sections, 'trending');
  const newItems = findSectionItems(sections, 'new');
  const recommendedItems = findSectionItems(sections, 'recommended');
  const shortsItems = findSectionItems(sections, 'shorts');
  const allItems = uniqueItems([...popularItems, ...newItems, ...recommendedItems, ...shortsItems]);

  return [
    { key: 'popular', title: '인기', items: popularItems },
    { key: 'new', title: '신작', items: newItems },
    { key: 'recommended', title: '추천', items: recommendedItems },
    { key: 'all', title: '모아보기', items: allItems },
    { key: 'ranking', title: '랭킹', items: popularItems, showRank: true }
  ];
}

function HomeSection({ section }: { section: HomeCollection }) {
  if (section.items.length === 0) {
    return null;
  }

  return (
    <section className="min-w-0 max-w-full py-4" id={section.key}>
      <div className="mb-3 flex items-end justify-between gap-4 px-5">
        <h2 className="text-xl font-bold text-white">{section.title}</h2>
        <Link className="shrink-0 text-xs font-semibold text-white/58" to="/discovery">
          더보기
        </Link>
      </div>
      <div className="flex min-w-0 max-w-full flex-wrap gap-x-3 gap-y-5 px-5 pb-1">
        {section.items.map((item, index) => {
          const shouldPrioritizePoster = section.key === 'popular' && index < 3;

          return (
            <div className="min-w-0 shrink-0 grow-0" key={`${section.key}-${item.publishId}`} style={HOME_CARD_SLOT_STYLE}>
              <ConsumerContentCard
                imageFetchPriority={shouldPrioritizePoster ? 'high' : 'auto'}
                imageLoading={shouldPrioritizePoster ? 'eager' : 'lazy'}
                item={item}
                rank={section.showRank ? index + 1 : undefined}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MobileAppOpenBanner() {
  return (
    <section className="lg:hidden">
      <div className="flex min-h-[4.25rem] items-center gap-4 bg-[#101112] px-4 py-3 shadow-[0_1px_0_rgba(255,255,255,0.08)]">
        <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-black">
          <img alt="" className="h-full w-full object-cover" src="/promptoon-icon.webp" />
        </span>
        <p className="min-w-0 flex-1 text-sm font-bold leading-5 text-white">앱에서 더 많은 에피소드를 즐겨보세요!</p>
        <button
          aria-label="앱 준비중"
          className="h-8 shrink-0 cursor-not-allowed rounded-full bg-[#19f6df] px-3.5 text-[11px] font-black text-black"
          disabled
          title="서비스 준비중"
          type="button"
        >
          앱 준비중
        </button>
      </div>
    </section>
  );
}

function HomeContent({
  collections,
  isEmpty,
  isError,
  isLoading
}: {
  collections: HomeCollection[];
  isEmpty: boolean;
  isError: boolean;
  isLoading: boolean;
}) {
  return (
    <>
      <MobileAppOpenBanner />
      <header className="sticky top-0 z-20 min-w-0 max-w-full border-b border-white/10 bg-[#09090b]/92 pt-[max(env(safe-area-inset-top),1rem)] backdrop-blur-xl">
        <div className="flex items-center gap-2 px-5 pb-4">
          <Link className="flex items-center gap-2" to="/">
            <img alt="" className="h-8 w-8 rounded-md bg-white object-cover" src="/promptoon-icon.webp" />
            <span className="font-display text-lg font-semibold tracking-normal text-white">Promptoon</span>
          </Link>
        </div>
        <nav aria-label="홈 콘텐츠 섹션" className="scrollbar-hidden flex min-w-0 max-w-full gap-2 overflow-x-auto px-5 pb-3">
          {HOME_CHIPS.map((chip) => (
            <a
              className="rounded-md bg-white/10 px-3 py-2 text-sm font-semibold text-white/82"
              href={`#${chip.target}`}
              key={chip.label}
            >
              {chip.label}
            </a>
          ))}
        </nav>
      </header>

      {isLoading ? <p className="px-5 py-10 text-sm text-white/56">홈 콘텐츠를 불러오는 중입니다.</p> : null}
      {isError ? <p className="px-5 py-10 text-sm text-white/56">홈 콘텐츠를 불러오지 못했습니다.</p> : null}
      {collections.map((section) => <HomeSection key={section.key} section={section} />)}
      {isEmpty ? <p className="px-5 py-10 text-sm text-white/56">공개된 콘텐츠가 아직 없습니다.</p> : null}
    </>
  );
}

export function ConsumerHomePage() {
  const homeQuery = useQuery({
    queryKey: promptoonKeys.feedHome(),
    queryFn: feedApi.getHome
  });
  const home = homeQuery.data;
  const collections = useMemo(() => buildHomeCollections(home?.sections ?? []), [home?.sections]);
  const isEmpty = Boolean(home && collections.every((section) => section.items.length === 0));

  return (
    <ConsumerResponsiveFrame showMobileLandingFrames>
      <HomeContent
        collections={collections}
        isEmpty={isEmpty}
        isError={homeQuery.isError}
        isLoading={homeQuery.isLoading}
      />
    </ConsumerResponsiveFrame>
  );
}

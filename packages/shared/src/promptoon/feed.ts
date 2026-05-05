export type FeedItemType = 'short_drama' | 'promptoon' | 'webtoon_episode' | 'channel_recommendation';

export interface FeedItemMetrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
}

export interface ContentInteractionState {
  publishId: string;
  liked: boolean;
  bookmarked: boolean;
  metrics: FeedItemMetrics;
}

export interface ContentInteractionStateListResponse {
  items: ContentInteractionState[];
}

export interface FeedItemEntry {
  kind: 'viewer' | 'channel' | 'external';
  href: string;
}

export interface FeedItem {
  id?: string;
  type?: FeedItemType;
  publishId: string;
  episodeId: string;
  channelId?: string | null;
  channelSlug?: string | null;
  channelName?: string | null;
  episodeTitle: string;
  projectTitle: string;
  coverImageUrl: string | null;
  publishedAt: string;
  metrics?: FeedItemMetrics;
  entry?: FeedItemEntry;
  startCut: Pick<
    import('./core').ProductPublishedCut,
    | 'id'
    | 'title'
    | 'body'
    | 'contentBlocks'
    | 'contentViewMode'
    | 'assetUrl'
    | 'dialogAnchorX'
    | 'dialogAnchorY'
    | 'dialogOffsetX'
    | 'dialogOffsetY'
    | 'dialogTextAlign'
    | 'startEffect'
    | 'endEffect'
    | 'startEffectDurationMs'
    | 'endEffectDurationMs'
    | 'edgeFade'
    | 'edgeFadeIntensity'
    | 'edgeFadeColor'
    | 'marginBottomToken'
  >;
  startChoices: import('./core').ProductPublishedCut['choices'];
}

export interface FeedResponse {
  items: FeedItem[];
  nextCursor: string | null;
}

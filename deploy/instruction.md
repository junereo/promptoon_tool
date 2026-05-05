아래는 **`프롬툰-제작-시스템.txt` 내용을 전부 제외**하고 다시 작성한 구현 계획입니다.

이번 버전에서는 다음 항목을 제거했습니다.

```text
제외 항목
- 실제 컷 생성 파이프라인
- Concept Registry
- Camera State
- Focus Resolver
- CutState
- Prompt Compiler
- Flux2 / I2I / Reference Weight
- 중요도 기반 자동 연출
- Validation / Auto Repair
- 실패 컷 로그 기반 수정 루프
- AI 생성 엔진 세부 구현
```

이 구현 계획은 오직 다음 두 기준만 사용합니다.

```text
1. 위에서 만든 UI 컨셉
   - 숏폼 피드
   - 채널 홈
   - 웹툰 뷰어

2. 프롬툰 프로덕트 개발 문서
   - Feed / Viewer / Studio / Community / Auth / Telemetry / Core 분리
   - 모노레포 유지
   - API / 타입 / 권한 / 데이터 접근 분리
   - PublishManifest와 FeedItem projection 구조
```

문서 기준으로도 현재 방향은 **레포를 당장 분리하지 않고, 도메인/API/타입을 분리하는 것**이 핵심입니다. `junereo/promptoon_tool`은 유지하되 `feed`, `viewer`, `studio/tool`, `community`, `auth`, `telemetry`, `core`로 책임을 나누는 방향이 권장되어 있습니다.

---

# 1. 최종 제품 구현 목표

## 목표

프롬툰을 다음 구조의 서비스로 구현합니다.

```text
숏폼 피드
  ↓
채널 홈
  ↓
웹툰 뷰어
  ↓
댓글 / 공유 / 구독 / 이어보기
  ↓
다시 피드로 확산
```

즉, 최종 UX는 다음 세 화면이 중심입니다.

```text
Promptoon Public App
├─ Feed Home
│  ├─ 15초 숏드라마 카드
│  ├─ 프롬툰 카드
│  ├─ 좋아요
│  ├─ 댓글
│  ├─ 공유
│  └─ 채널 클릭
│
├─ Channel Home
│  ├─ 채널 배너
│  ├─ 작가/스튜디오 프로필
│  ├─ 구독
│  ├─ 대표 시리즈
│  ├─ 웹툰 에피소드 목록
│  ├─ 관련 숏드라마
│  └─ 커뮤니티 진입
│
└─ Webtoon Viewer
   ├─ 에피소드 감상
   ├─ 이어보기
   ├─ 다음 화 보기
   ├─ 관련 숏드라마
   └─ 댓글
```

기존 문서에서도 Feed는 공개된 에피소드를 릴스/숏츠형으로 탐색하고, 공개 뷰어로 진입하며, 조회/체류/클릭 텔레메트리, 좋아요, 저장, 공유, 댓글 진입을 담당하는 소비자 제품으로 정의되어 있습니다.

---

# 2. 제품 도메인 구조

## 최종 도메인

```text
Promptoon
├─ Feed        → 사용자가 숏폼으로 콘텐츠를 발견하는 곳
├─ Channel     → 작가/스튜디오/IP 홈
├─ Viewer      → 사용자가 웹툰을 감상하는 곳
├─ Community   → 댓글/토론/댓글 메타
├─ Studio      → 내부 제작·발행 관리
├─ Auth        → 로그인/권한
├─ Telemetry   → 행동 로그/분석
└─ Core        → 발행본, manifest, route, content block 공통 처리
```

문서에서는 Promptoon을 `Feed`, `Viewer`, `Community`, `Studio`, `Engine`으로 나누는 권장 네이밍을 제안하지만, 이번 계획에서는 제작 시스템 문서에서 온 엔진 세부 구현은 제외하고, **제품 기능 관점의 Feed / Channel / Viewer / Studio / Community / Auth / Telemetry / Core**만 남깁니다.

---

# 3. 핵심 원칙

## 3-1. 모노레포 유지

```text
레포 분리 ❌
앱 완전 분리 ❌
도메인/API/타입 분리 ✅
```

현재 단계에서는 `apps/web`, `apps/api`, `packages/shared` 구조를 유지합니다.

```text
promptoon_tool
├─ apps
│  ├─ api
│  └─ web
└─ packages
   └─ shared
```

문서에서도 지금 당장 레포를 둘로 쪼갤 필요는 없고, API route, frontend feature, shared type, auth, 배포 단위를 분리하는 방향이 적절하다고 정리되어 있습니다.

---

## 3-2. Feed는 draft를 읽지 않음

가장 중요한 데이터 접근 규칙입니다.

```text
Feed는 draft 테이블을 읽지 않는다.
Feed는 published projection만 읽는다.
Viewer는 publish manifest만 읽는다.
Studio는 draft와 publish를 모두 관리한다.
```

문서에서도 이 규칙이 명시되어 있습니다. Feed는 제작툴의 내부 구조를 몰라야 하며, 오직 발행된 manifest 또는 feed projection만 읽어야 합니다.

---

## 3-3. Studio는 제작/발행 관리만 담당

이번 계획에서 Studio는 AI 생성 시스템이 아니라, 다음 기능을 담당하는 내부 운영툴입니다.

```text
Studio
- 프로젝트 관리
- 시리즈 관리
- 에피소드 관리
- 컷/선택지 편집
- 에셋 업로드
- 발행
- 비공개
- 분석
- 백업
```

문서에서도 Tool/Studio는 프로젝트 관리, 에피소드 관리, 컷/선택지 편집, 에셋 업로드, 발행, 검증, 분석, 내부 제작 로그를 담당하는 내부 제작 영역으로 정의되어 있습니다.

---

# 4. 프론트엔드 구현 계획

## 4-1. 목표 폴더 구조

```text
apps/web/src
├─ app
│  ├─ router.tsx
│  ├─ public-router.tsx
│  └─ studio-router.tsx
│
├─ domains
│  ├─ feed
│  │  ├─ pages
│  │  │  └─ FeedHomePage.tsx
│  │  ├─ components
│  │  │  ├─ FeedSnapScroller.tsx
│  │  │  ├─ FeedShortDramaCard.tsx
│  │  │  ├─ FeedPromptoonCard.tsx
│  │  │  ├─ FeedActionBar.tsx
│  │  │  ├─ FeedChannelBadge.tsx
│  │  │  └─ FeedProgressBar.tsx
│  │  ├─ hooks
│  │  └─ api
│  │
│  ├─ channel
│  │  ├─ pages
│  │  │  ├─ ChannelHomePage.tsx
│  │  │  ├─ ChannelSeriesPage.tsx
│  │  │  ├─ ChannelShortsPage.tsx
│  │  │  └─ ChannelCommunityPage.tsx
│  │  ├─ components
│  │  │  ├─ ChannelHero.tsx
│  │  │  ├─ ChannelProfileCard.tsx
│  │  │  ├─ ChannelStats.tsx
│  │  │  ├─ ChannelTabs.tsx
│  │  │  ├─ FeaturedSeriesList.tsx
│  │  │  ├─ LatestEpisodeList.tsx
│  │  │  ├─ RelatedShortsList.tsx
│  │  │  └─ CommunityPreview.tsx
│  │  ├─ hooks
│  │  └─ api
│  │
│  ├─ viewer
│  │  ├─ pages
│  │  │  └─ ViewerPage.tsx
│  │  ├─ components
│  │  │  ├─ ViewerHeader.tsx
│  │  │  ├─ EpisodeMeta.tsx
│  │  │  ├─ WebtoonPanelList.tsx
│  │  │  ├─ ContinueButton.tsx
│  │  │  ├─ NextEpisodeButton.tsx
│  │  │  ├─ RelatedShorts.tsx
│  │  │  └─ CommentPreview.tsx
│  │  ├─ hooks
│  │  └─ api
│  │
│  ├─ studio
│  │  ├─ pages
│  │  │  ├─ StudioProjectDashboardPage.tsx
│  │  │  ├─ StudioProjectDetailPage.tsx
│  │  │  ├─ StudioSeriesPage.tsx
│  │  │  ├─ StudioEpisodeEditorPage.tsx
│  │  │  ├─ StudioPublishPage.tsx
│  │  │  └─ StudioAnalyticsPage.tsx
│  │  ├─ project
│  │  ├─ series
│  │  ├─ episode
│  │  ├─ editor
│  │  ├─ publish
│  │  ├─ analytics
│  │  └─ api
│  │
│  ├─ community
│  │  ├─ components
│  │  └─ api
│  │
│  └─ auth
│     ├─ pages
│     ├─ hooks
│     └─ api
│
└─ shared
   ├─ ui
   ├─ layout
   ├─ api-client
   ├─ lib
   └─ constants
```

문서에서도 `apps/web` 하나를 유지하되 내부적으로 `public app`과 `studio app`을 나누는 구조를 권장합니다. Public app은 Feed와 Viewer를 담당하고, Studio app은 Project Dashboard, Episode Editor, Analytics, Publish를 담당합니다.

---

# 5. 라우팅 구현 계획

## 5-1. Public 라우트

```text
/                         → FeedHomePage
/feed                     → FeedHomePage
/c/:channelSlug           → ChannelHomePage
/c/:channelSlug/series    → ChannelSeriesPage
/c/:channelSlug/shorts    → ChannelShortsPage
/c/:channelSlug/community → ChannelCommunityPage
/v/:publishId             → ViewerPage
/v/:publishId/:episodeNo  → ViewerPage
/login                    → LoginPage
/register                 → RegisterPage
```

## 5-2. Studio 라우트

기존 `/promptoon/*`를 당장 없애지 않고, 우선 유지합니다.

```text
/promptoon/projects
/promptoon/projects/:projectId
/promptoon/projects/:projectId/episodes/:episodeId
/promptoon/projects/:projectId/publish
/promptoon/projects/:projectId/analytics
```

추후 제품 네이밍을 정리하면서 `/studio/*`로 alias를 추가합니다.

```text
/studio
/studio/projects
/studio/projects/:projectId
/studio/projects/:projectId/series
/studio/episodes/:episodeId/editor
/studio/projects/:projectId/publish
/studio/analytics/episodes/:episodeId
```

## 5-3. 라우터 구조

```tsx
// apps/web/src/app/router.tsx

export function AppRouter() {
  return (
    <Routes>
      <Route element={<PublicRouter />}>
        <Route path="/" element={<FeedHomePage />} />
        <Route path="/feed" element={<FeedHomePage />} />
        <Route path="/c/:channelSlug" element={<ChannelHomePage />} />
        <Route path="/c/:channelSlug/series" element={<ChannelSeriesPage />} />
        <Route path="/c/:channelSlug/shorts" element={<ChannelShortsPage />} />
        <Route
          path="/c/:channelSlug/community"
          element={<ChannelCommunityPage />}
        />
        <Route path="/v/:publishId" element={<ViewerPage />} />
        <Route path="/v/:publishId/:episodeNo" element={<ViewerPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/promptoon/*" element={<StudioRouter />} />
        <Route path="/studio/*" element={<StudioRouter />} />
      </Route>
    </Routes>
  );
}
```

기존 라우터도 이미 `/` 공개 피드, `/v/:publishId` 공개 뷰어, `/promptoon/*` 보호된 제작툴로 기능상 분리되어 있습니다. 이번 작업은 그 구조를 제품 도메인 이름으로 명확히 정리하는 것입니다.

---

# 6. API 구현 계획

## 6-1. 현재 문제

현재는 `/api/promptoon` 하나 아래에 공개 소비 API와 내부 제작 API가 함께 들어 있는 상태입니다. 문서에서도 `/episodes/feed`, `/episodes/published/:publishId`, `/share/:publishId` 같은 공개 소비 API와 `/projects`, `/episodes/:episodeId/draft`, `/cuts/:cutId`, `/projects/:projectId/publish` 같은 내부 제작 API가 섞여 있다고 지적합니다.

## 6-2. 목표 API 구조

```text
/api/auth
/api/feed
/api/channels
/api/viewer
/api/studio
/api/community
/api/telemetry
```

문서의 권장 구조는 `/api/auth`, `/api/feed`, `/api/viewer`, `/api/studio`, `/api/telemetry`, `/api/community`로 라우터를 나누는 것입니다. 여기에 위 UI의 채널 홈을 위해 `/api/channels`만 추가합니다.

---

## 6-3. API 상세

### Auth

```text
GET  /api/auth/me
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/google/start
GET  /api/auth/google/callback
```

### Feed

```text
GET  /api/feed/mixed
GET  /api/feed/episodes
GET  /api/feed/shorts
POST /api/feed/events/impression
POST /api/feed/events/open
POST /api/feed/events/watch-progress
```

### Channels

```text
GET    /api/channels/:channelSlug
GET    /api/channels/:channelSlug/home
GET    /api/channels/:channelSlug/series
GET    /api/channels/:channelSlug/episodes
GET    /api/channels/:channelSlug/shorts
GET    /api/channels/:channelSlug/community-meta
POST   /api/channels/:channelId/subscribe
DELETE /api/channels/:channelId/subscribe
```

### Viewer

```text
GET  /api/viewer/publishes/:publishId
GET  /api/viewer/publishes/:publishId/episodes/:episodeNo
GET  /api/viewer/publishes/:publishId/related-shorts
POST /api/viewer/events
POST /api/viewer/publishes/:publishId/continue
```

### Studio

```text
GET    /api/studio/projects
POST   /api/studio/projects
GET    /api/studio/projects/:projectId
PATCH  /api/studio/projects/:projectId

GET    /api/studio/projects/:projectId/series
POST   /api/studio/projects/:projectId/series
PATCH  /api/studio/series/:seriesId
DELETE /api/studio/series/:seriesId

GET    /api/studio/episodes/:episodeId/draft
POST   /api/studio/projects/:projectId/episodes
PATCH  /api/studio/episodes/:episodeId

POST   /api/studio/episodes/:episodeId/cuts
PATCH  /api/studio/cuts/:cutId
DELETE /api/studio/cuts/:cutId

POST   /api/studio/cuts/:cutId/choices
PATCH  /api/studio/choices/:choiceId
DELETE /api/studio/choices/:choiceId

POST   /api/studio/projects/:projectId/assets

POST   /api/studio/projects/:projectId/publish
POST   /api/studio/projects/:projectId/unpublish

GET    /api/studio/analytics/episodes/:episodeId
```

### Community

```text
POST /api/community/episodes/:episodeId/discussion
GET  /api/community/publishes/:publishId/comments-meta
POST /api/community/discourse/webhook
```

문서에서도 Discourse는 Feed/Viewer 쪽 소비자 경험에 붙이는 것이 맞고, Studio에서는 topic 생성, topic id 저장, 댓글 수, 최신 댓글 시간, 관리 링크 정도만 다루면 된다고 정리되어 있습니다.

### Telemetry

```text
POST /api/telemetry/events
POST /api/telemetry/batch
```

---

# 7. 백엔드 모듈 구조

```text
apps/api/src/modules
├─ auth
├─ feed
├─ channel
├─ viewer
├─ studio
│  ├─ projects
│  ├─ series
│  ├─ episodes
│  ├─ cuts
│  ├─ choices
│  ├─ assets
│  ├─ publish
│  └─ analytics
├─ community
│  └─ discourse
├─ telemetry
└─ promptoon-core
   ├─ manifest
   ├─ content-blocks
   ├─ state-routing
   └─ projection
```

문서의 백엔드 권장 구조도 `auth`, `feed`, `viewer`, `studio`, `community`, `telemetry`, `promptoon-core`로 나누고, `promptoon-core`에는 PublishManifest 정규화, ContentBlock 정규화, state route 해석, ending cut 판별, viewer용 manifest projection 같은 공통 로직을 두는 방식입니다.

이번 버전에서는 `promptoon-core`를 **AI 생성 엔진이 아니라 발행/감상 공통 처리 모듈**로만 사용합니다.

---

# 8. Shared 타입 분리 계획

## 8-1. 목표 구조

```text
packages/shared/src
├─ promptoon
│  ├─ core.ts
│  ├─ feed.ts
│  ├─ channel.ts
│  ├─ viewer.ts
│  ├─ studio.ts
│  ├─ community.ts
│  ├─ analytics.ts
│  ├─ auth.ts
│  └─ index.ts
└─ promptoon.ts
```

문서에서도 현재 `packages/shared/src/promptoon.ts`에 프로젝트, 에피소드, 컷, 선택지, 발행본, 텔레메트리, 분석, 피드 타입이 한 파일에 모여 있어, 향후 `core`, `feed`, `viewer`, `studio`, `analytics`, `auth`로 나누는 것이 좋다고 정리되어 있습니다.

## 8-2. `promptoon.ts`는 호환용 barrel 유지

```ts
export * from "./promptoon/core";
export * from "./promptoon/feed";
export * from "./promptoon/channel";
export * from "./promptoon/viewer";
export * from "./promptoon/studio";
export * from "./promptoon/community";
export * from "./promptoon/analytics";
export * from "./promptoon/auth";
```

---

# 9. 핵심 타입 설계

## 9-1. Core

```ts
export type ID = string;

export type PublishStatus =
  | "draft"
  | "reviewing"
  | "published"
  | "unpublished"
  | "archived";

export type ContentBlockType =
  | "image"
  | "dialogue"
  | "narration"
  | "choice"
  | "video"
  | "author_note";

export type PublishManifest = {
  publishId: string;
  projectId: string;
  seriesId: string;
  episodeId: string;
  channelId?: string;
  versionNo: number;
  title: string;
  description?: string;
  coverImageUrl?: string | null;
  blocks: PublishedContentBlock[];
  choices: PublishedChoice[];
  publishedAt: string;
};

export type PublishedContentBlock = {
  id: string;
  type: ContentBlockType;
  orderIndex: number;
  imageUrl?: string | null;
  videoUrl?: string | null;
  text?: string | null;
  speaker?: string | null;
};
```

## 9-2. Feed

```ts
export type FeedItemType =
  | "short_drama"
  | "promptoon"
  | "webtoon_episode"
  | "channel_recommendation";

export type FeedItem = {
  id: string;
  type: FeedItemType;
  publishId?: string;
  channelId?: string;
  channelSlug?: string;
  channelName?: string;
  title: string;
  description?: string;
  coverImageUrl?: string | null;
  videoUrl?: string | null;
  durationSec?: number;
  publishedAt: string;
  metrics: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
  };
  entry: {
    kind: "viewer" | "channel" | "external";
    href: string;
  };
};

export type FeedResponse = {
  items: FeedItem[];
  nextCursor?: string | null;
};
```

## 9-3. Channel

```ts
export type ChannelProfile = {
  id: string;
  slug: string;
  displayName: string;
  handle?: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  bio?: string | null;
  isVerified: boolean;
  subscriberCount: number;
  likeCount: number;
  seriesCount: number;
  episodeCount: number;
  shortCount: number;
};

export type ChannelHome = {
  profile: ChannelProfile;
  featuredSeries: ChannelSeries[];
  latestEpisodes: ChannelEpisode[];
  latestShorts: ChannelShort[];
  communityMeta?: ChannelCommunityMeta;
};

export type ChannelSeries = {
  id: string;
  title: string;
  slug: string;
  description?: string;
  coverImageUrl?: string | null;
  episodeCount: number;
  status: "ongoing" | "completed" | "paused";
};

export type ChannelEpisode = {
  id: string;
  publishId: string;
  title: string;
  episodeNo: number;
  thumbnailUrl?: string | null;
  publishedAt: string;
};

export type ChannelShort = {
  id: string;
  title: string;
  thumbnailUrl?: string | null;
  videoUrl?: string | null;
  durationSec: number;
  publishId?: string;
};

export type ChannelCommunityMeta = {
  commentCount: number;
  latestCommentAt?: string | null;
};
```

## 9-4. Viewer

```ts
export type ViewerEpisode = {
  publishId: string;
  episodeId: string;
  seriesId: string;
  channelId?: string;
  title: string;
  episodeNo?: number;
  blocks: ViewerBlock[];
  nextEpisode?: {
    publishId: string;
    episodeNo: number;
    title: string;
  } | null;
  relatedShorts: RelatedShort[];
  commentsMeta?: {
    commentCount: number;
  };
};

export type ViewerBlock = {
  id: string;
  type: "image" | "dialogue" | "narration" | "choice" | "video";
  imageUrl?: string | null;
  videoUrl?: string | null;
  text?: string | null;
  speaker?: string | null;
};

export type RelatedShort = {
  id: string;
  title: string;
  thumbnailUrl?: string | null;
  durationSec: number;
  href: string;
};
```

## 9-5. Studio

```ts
export type StudioProject = {
  id: string;
  title: string;
  description?: string;
  coverImageUrl?: string | null;
  status: "draft" | "active" | "archived";
  createdAt: string;
  updatedAt: string;
};

export type StudioSeries = {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  coverImageUrl?: string | null;
  status: "draft" | "ongoing" | "completed" | "paused";
};

export type StudioEpisodeDraft = {
  id: string;
  projectId: string;
  seriesId?: string;
  title: string;
  episodeNo?: number;
  synopsis?: string;
  cuts: StudioCut[];
  choices: StudioChoice[];
  status: PublishStatus;
};

export type StudioCut = {
  id: string;
  episodeId: string;
  orderIndex: number;
  title?: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  dialogue?: string | null;
  narration?: string | null;
};

export type StudioChoice = {
  id: string;
  fromCutId: string;
  toCutId: string;
  label: string;
  orderIndex: number;
};
```

---

# 10. DB 설계

이번 DB 설계에서도 제작 시스템 세부 엔진 테이블은 제외합니다.

## 10-1. Studio-owned tables

```text
projects
series
episodes
cuts
choices
assets
publishes
publish_versions
```

## 10-2. Public-owned tables

```text
channels
channel_public_profiles
channel_home_projections
feed_items
short_clips
viewer_events
episode_view_stats
feed_impressions
user_likes
user_bookmarks
user_subscriptions
```

## 10-3. Community-owned tables

```text
episode_discussions
comment_sync_logs
discourse_users
```

## 10-4. Auth-owned tables

```text
users
sessions
oauth_accounts
studio_members
project_members
```

문서에서도 DB를 처음부터 물리적으로 나눌 필요는 없지만, Studio-owned, Feed-owned, Community-owned, Auth-owned로 테이블 책임을 나누어야 한다고 정리되어 있습니다.

---

# 11. 주요 테이블 상세

## 11-1. `projects`

```text
projects
- id
- title
- description
- cover_asset_id
- status
- created_by
- created_at
- updated_at
```

## 11-2. `channels`

```text
channels
- id
- project_id
- owner_user_id
- slug
- display_name
- handle
- avatar_asset_id
- banner_asset_id
- bio
- is_verified
- visibility
- created_at
- updated_at
```

## 11-3. `series`

```text
series
- id
- project_id
- channel_id
- title
- slug
- description
- cover_asset_id
- status
- sort_order
- created_at
- updated_at
```

## 11-4. `episodes`

```text
episodes
- id
- project_id
- series_id
- title
- episode_no
- synopsis
- thumbnail_asset_id
- status
- created_at
- updated_at
```

## 11-5. `cuts`

```text
cuts
- id
- episode_id
- project_id
- order_index
- title
- image_asset_id
- video_asset_id
- dialogue
- narration
- content_blocks_json
- created_at
- updated_at
```

## 11-6. `choices`

```text
choices
- id
- episode_id
- from_cut_id
- to_cut_id
- label
- order_index
- created_at
- updated_at
```

## 11-7. `assets`

```text
assets
- id
- project_id
- uploaded_by
- asset_type
- file_url
- thumbnail_url
- mime_type
- size_bytes
- width
- height
- duration_sec
- created_at
```

## 11-8. `publishes`

```text
publishes
- id
- project_id
- series_id
- episode_id
- channel_id
- version_no
- publish_id
- manifest_json
- status
- published_at
- created_by
- created_at
```

## 11-9. `feed_items`

```text
feed_items
- id
- publish_id
- project_id
- channel_id
- series_id
- episode_id
- item_type
- title
- description
- cover_image_url
- video_url
- duration_sec
- start_cut_snapshot_json
- choice_count
- ranking_score
- published_at
- created_at
```

문서에서도 발행 시점에 `PublishManifest`에서 Feed용 projection을 따로 생성하는 것이 좋고, 이렇게 하면 Feed가 매번 manifest 전체를 파싱하지 않아도 된다고 정리되어 있습니다.

## 11-10. `channel_home_projections`

```text
channel_home_projections
- id
- channel_id
- profile_json
- featured_series_json
- latest_episodes_json
- latest_shorts_json
- community_meta_json
- updated_at
```

## 11-11. `short_clips`

```text
short_clips
- id
- project_id
- channel_id
- series_id
- episode_id
- publish_id
- title
- description
- video_asset_id
- thumbnail_asset_id
- duration_sec
- status
- published_at
- created_at
```

---

# 12. 발행 구조

이번 계획에서 가장 중요한 연결 구조입니다.

```text
Studio Draft
  ↓
Publish
  ↓
PublishManifest 생성
  ↓
ViewerManifest 저장
  ↓
FeedItem projection 생성
  ↓
ChannelHome projection 갱신
  ↓
Community discussion 연결
  ↓
Public Feed / Channel / Viewer 노출
```

문서에서도 Tool에서 발행하면 `PublishManifest`가 만들어지고, Feed/Viewer가 그 발행본을 읽는 방향은 좋지만, 발행 시점에 Feed용 projection을 별도로 생성해야 한다고 정리되어 있습니다.

---

# 13. PublishManifest 예시

```json
{
  "publishId": "pub_001",
  "projectId": "project_001",
  "seriesId": "series_001",
  "episodeId": "episode_001",
  "channelId": "channel_001",
  "versionNo": 1,
  "title": "영혼을 삼킨 기사 24화",
  "description": "깨어난 검",
  "coverImageUrl": "/assets/cover.png",
  "blocks": [
    {
      "id": "block_001",
      "type": "image",
      "orderIndex": 1,
      "imageUrl": "/assets/panel-001.png"
    },
    {
      "id": "block_002",
      "type": "dialogue",
      "orderIndex": 2,
      "speaker": "주인공",
      "text": "이제 끝이야."
    }
  ],
  "choices": [],
  "publishedAt": "2026-05-04T00:00:00.000Z"
}
```

---

# 14. FeedItem projection 예시

```json
{
  "id": "feed_001",
  "type": "short_drama",
  "publishId": "pub_001",
  "channelId": "channel_001",
  "channelSlug": "eunha-studio",
  "channelName": "은하 스튜디오",
  "title": "EP.3 | 그의 검이 깨어나다",
  "description": "15초 숏드라마",
  "coverImageUrl": "/assets/short-thumb.png",
  "videoUrl": "/assets/short-001.mp4",
  "durationSec": 15,
  "publishedAt": "2026-05-04T00:00:00.000Z",
  "metrics": {
    "views": 0,
    "likes": 0,
    "comments": 0,
    "shares": 0
  },
  "entry": {
    "kind": "channel",
    "href": "/c/eunha-studio"
  }
}
```

---

# 15. ChannelHome projection 예시

```json
{
  "profile": {
    "id": "channel_001",
    "slug": "eunha-studio",
    "displayName": "은하 스튜디오",
    "handle": "@eunha.studio",
    "avatarUrl": "/assets/avatar.png",
    "bannerUrl": "/assets/banner.png",
    "bio": "스토리로 세상을 잇는 크리에이터 그룹",
    "isVerified": true,
    "subscriberCount": 1280000,
    "likeCount": 34520000,
    "seriesCount": 25,
    "episodeCount": 256,
    "shortCount": 42
  },
  "featuredSeries": [
    {
      "id": "series_001",
      "title": "영혼을 삼킨 기사",
      "slug": "soul-knight",
      "coverImageUrl": "/assets/series-cover.png",
      "episodeCount": 256,
      "status": "ongoing"
    }
  ],
  "latestEpisodes": [],
  "latestShorts": [],
  "communityMeta": {
    "commentCount": 312,
    "latestCommentAt": "2026-05-04T00:00:00.000Z"
  }
}
```

---

# 16. Public UI 구현 상세

## 16-1. FeedHomePage

위 UI의 첫 번째 화면입니다.

```text
목적:
- 릴스/숏츠처럼 빠르게 콘텐츠 발견
- 15초 숏드라마와 프롬툰 카드 노출
- 채널 진입 유도
```

컴포넌트:

```text
FeedHomePage
├─ FeedSnapScroller
│  ├─ FeedShortDramaCard
│  ├─ FeedPromptoonCard
│  └─ FeedWebtoonEpisodeCard
├─ FeedActionBar
├─ FeedChannelBadge
├─ FeedProgressBar
└─ FeedBottomNav
```

기능:

```text
- 세로 스냅 스크롤
- 무한 스크롤
- 15초 progress 표시
- 영상 자동 재생/정지
- 좋아요
- 댓글 열기
- 공유
- 저장
- 채널 클릭
- 웹툰 뷰어 진입
- impression telemetry
- watch progress telemetry
```

데이터:

```text
feedApi.getMixedFeed()
feedApi.trackImpression()
feedApi.trackWatchProgress()
telemetryApi.trackEvent()
```

---

## 16-2. ChannelHomePage

위 UI의 두 번째 화면입니다.

```text
목적:
- 피드에서 발견한 콘텐츠를 작가/스튜디오/IP 단위로 묶음
- 웹툰 정주행과 구독으로 연결
```

컴포넌트:

```text
ChannelHomePage
├─ ChannelHero
├─ ChannelProfileCard
├─ SubscribeButton
├─ ChannelStats
├─ ChannelTabs
├─ FeaturedSeriesList
├─ LatestEpisodeList
├─ RelatedShortsList
└─ CommunityPreview
```

탭:

```text
홈
시리즈
웹툰
숏드라마
커뮤니티
```

기능:

```text
- 채널 프로필 조회
- 대표 시리즈 조회
- 최신 웹툰 에피소드 조회
- 최신 숏드라마 조회
- 구독/구독 취소
- 커뮤니티 메타 조회
- 채널 조회 telemetry
```

데이터:

```text
channelApi.getChannelHome(channelSlug)
channelApi.getChannelSeries(channelSlug)
channelApi.getChannelEpisodes(channelSlug)
channelApi.getChannelShorts(channelSlug)
channelApi.subscribe(channelId)
telemetryApi.trackEvent('channel_view')
```

---

## 16-3. ViewerPage

위 UI의 세 번째 화면입니다.

```text
목적:
- 웹툰 감상
- 다음 화 보기
- 관련 숏드라마로 순환
- 댓글/커뮤니티 연결
```

컴포넌트:

```text
ViewerPage
├─ ViewerHeader
├─ EpisodeMeta
├─ WebtoonPanelList
├─ ContinueButton
├─ NextEpisodeButton
├─ RelatedShorts
├─ CommentPreview
└─ ViewerBottomActions
```

기능:

```text
- 세로 웹툰 스크롤
- 에피소드 메타 표시
- 이어보기
- 다음 화 보기
- 관련 숏드라마 보기
- 댓글 메타 표시
- 공유
- 북마크
- reading progress telemetry
```

데이터:

```text
viewerApi.getPublishedEpisode(publishId)
viewerApi.getRelatedShorts(publishId)
communityApi.getCommentsMeta(publishId)
telemetryApi.trackEvent('viewer_open')
telemetryApi.trackEvent('viewer_scroll_progress')
```

---

# 17. Studio UI 구현 상세

## 17-1. StudioProjectDashboardPage

```text
목적:
- 내부 프로젝트 목록 관리
- 발행 가능한 작품 상태 확인
```

기능:

```text
- 프로젝트 목록
- 프로젝트 생성
- 프로젝트 수정
- 프로젝트 삭제/보관
- 최근 발행 상태
- 에피소드 수
- 조회수 요약
```

---

## 17-2. StudioProjectDetailPage

```text
목적:
- 하나의 프로젝트 안에서 시리즈/에피소드/발행 상태 관리
```

기능:

```text
- 프로젝트 기본정보
- 커버 이미지
- 연결 채널
- 시리즈 목록
- 에피소드 목록
- 발행 상태
- 분석 요약
```

---

## 17-3. StudioSeriesPage

```text
목적:
- 작품 시리즈 관리
```

기능:

```text
- 시리즈 생성
- 시리즈 수정
- 커버 등록
- 정렬 순서 변경
- 상태 변경
  - draft
  - ongoing
  - completed
  - paused
```

---

## 17-4. StudioEpisodeEditorPage

```text
목적:
- 에피소드의 컷/대사/선택지 편집
```

기능:

```text
- 컷 추가
- 컷 삭제
- 컷 순서 변경
- 컷 이미지 업로드
- 컷 비디오 업로드
- 대사 입력
- 나레이션 입력
- 선택지 연결
- 미리보기
- 발행 준비
```

이번 버전에서는 제작 시스템 문서의 AI 컷 생성 관련 UI는 제외합니다. 따라서 `생성`, `재생성`, `클로즈업`, `시선 이동`, `중요도`, `연출 의도` 같은 엔진 기반 입력은 MVP에서 제외합니다.

---

## 17-5. StudioPublishPage

```text
목적:
- Draft Episode를 Public Feed/Channel/Viewer에 노출 가능한 발행본으로 변환
```

기능:

```text
- 발행 전 미리보기
- 누락 이미지 검사
- 제목/설명 확인
- 채널 연결 확인
- 시리즈 연결 확인
- 썸네일 확인
- 발행
- 비공개
- 새 버전 발행
```

출력:

```text
- publishes row 생성
- PublishManifest 생성
- feed_items 생성
- channel_home_projections 갱신
- episode_discussions 생성 또는 연결
```

---

## 17-6. StudioAnalyticsPage

```text
목적:
- 발행 후 소비자 반응 확인
```

지표:

```text
- 피드 노출 수
- 피드 클릭률
- 채널 진입률
- 뷰어 진입률
- 완독률
- 다음 화 클릭률
- 관련 숏드라마 클릭률
- 댓글 열기율
- 좋아요 수
- 저장 수
- 공유 수
```

---

# 18. Auth / 권한 계획

## 18-1. Feed Auth

```text
비로그인 가능:
- 피드 감상
- 채널 보기
- 웹툰 보기

로그인 필요:
- 좋아요
- 저장
- 댓글
- 구독
- 신고
```

## 18-2. Studio Auth

```text
로그인 필수:
- /promptoon/*
- /studio/*
```

역할:

```text
studio_admin
producer
writer
viewer
```

권한:

```text
studio_admin
- 모든 프로젝트 접근
- 멤버 관리
- 발행/비공개
- 삭제

producer
- 프로젝트 관리
- 시리즈 관리
- 에피소드 발행
- 분석 확인

writer
- 에피소드 편집
- 컷/대사/선택지 편집
- 미리보기

viewer
- 읽기 전용
```

문서에서도 Feed 사용자는 많고 Tool 사용자는 제한적이므로, 같은 Google 로그인이라도 Feed user와 Studio member 권한 모델은 분리해야 한다고 정리되어 있습니다.

---

# 19. Community / Discourse 계획

## 19-1. 기본 방향

댓글은 Studio가 아니라 Viewer/Community 영역에 붙입니다.

```text
Promptoon Feed / Viewer
  └─ Episode comment
       └─ Discourse Topic
```

Studio에서는 댓글 본문을 직접 관리하지 않습니다.

Studio가 관리하는 것:

```text
- 에피소드 발행 시 discussion 생성
- discourse_topic_id 저장
- 댓글 수 표시
- 최신 댓글 시간 표시
- 관리 링크 제공
```

문서에서도 Discourse는 Feed/Viewer 쪽에 붙이고, Studio에서는 topic 생성 및 댓글 메타 관리 정도만 담당하는 것이 맞다고 정리되어 있습니다.

---

# 20. Telemetry 구현 계획

## 20-1. 이벤트 목록

```text
feed_impression
feed_video_start
feed_video_progress
feed_video_complete
feed_like
feed_share
feed_bookmark
feed_channel_click

channel_view
channel_subscribe
channel_tab_click
channel_series_click
channel_episode_click
channel_short_click

viewer_open
viewer_scroll_progress
viewer_next_episode
viewer_related_short_click
viewer_comment_open
viewer_complete

studio_project_open
studio_episode_open
studio_publish
studio_unpublish
```

## 20-2. 이벤트 저장 구조

```text
telemetry_events
- id
- event_name
- anonymous_id
- user_id
- session_id
- project_id
- channel_id
- series_id
- episode_id
- publish_id
- feed_item_id
- payload_json
- created_at
```

## 20-3. Public 분석

```text
Feed:
- 노출 수
- 재생 시작
- 15초 완료율
- 채널 클릭률

Channel:
- 채널 조회
- 구독 전환율
- 시리즈 클릭률
- 웹툰 클릭률

Viewer:
- 진입 수
- 스크롤 깊이
- 완독률
- 다음 화 클릭률
- 댓글 열기율
```

---

# 21. API Client 분리

현재 `promptoon.service.ts` 하나에 공개 API와 제작 API가 섞여 있는 것이 문제입니다. 문서에서도 `promptoon.service.ts` 안에 제작툴 API, 공개 피드 API, 공개 뷰어 API, 분석 API, 텔레메트리 API가 섞여 있다고 지적합니다.

## 목표 구조

```text
apps/web/src/shared/api
├─ clients.ts
├─ feed.api.ts
├─ channel.api.ts
├─ viewer.api.ts
├─ studio.api.ts
├─ community.api.ts
├─ telemetry.api.ts
└─ auth.api.ts
```

## 예시

```ts
// feed.api.ts
export const feedApi = {
  getMixedFeed(params?: { cursor?: string; limit?: number }) {
    return publicApiClient.get("/feed/mixed", { params });
  },

  trackImpression(payload: FeedImpressionPayload) {
    return publicApiClient.post("/feed/events/impression", payload);
  },
};
```

```ts
// channel.api.ts
export const channelApi = {
  getChannelHome(channelSlug: string) {
    return publicApiClient.get(`/channels/${channelSlug}/home`);
  },

  subscribe(channelId: string) {
    return authApiClient.post(`/channels/${channelId}/subscribe`);
  },

  unsubscribe(channelId: string) {
    return authApiClient.delete(`/channels/${channelId}/subscribe`);
  },
};
```

```ts
// viewer.api.ts
export const viewerApi = {
  getPublishedEpisode(publishId: string) {
    return publicApiClient.get(`/viewer/publishes/${publishId}`);
  },

  getRelatedShorts(publishId: string) {
    return publicApiClient.get(`/viewer/publishes/${publishId}/related-shorts`);
  },
};
```

```ts
// studio.api.ts
export const studioApi = {
  getProjects() {
    return studioApiClient.get("/studio/projects");
  },

  getEpisodeDraft(episodeId: string) {
    return studioApiClient.get(`/studio/episodes/${episodeId}/draft`);
  },

  publishProject(projectId: string, payload: PublishRequest) {
    return studioApiClient.post(
      `/studio/projects/${projectId}/publish`,
      payload,
    );
  },
};
```

---

# 22. MVP 범위

## 22-1. MVP에 포함

```text
Public
- 숏폼 피드
- 프롬툰 카드
- 채널 홈
- 웹툰 뷰어
- 관련 숏드라마
- 좋아요/저장/공유 UI
- 댓글 메타 UI
- 구독 UI
- 기본 telemetry

Studio
- 프로젝트 목록
- 프로젝트 상세
- 시리즈 관리
- 에피소드 편집
- 컷/선택지 편집
- 이미지/영상 업로드
- 발행
- 비공개
- 기본 analytics

Backend
- API 라우터 분리
- shared 타입 분리
- PublishManifest
- FeedItem projection
- ChannelHome projection
- Community meta
- Auth role 분리
```

## 22-2. MVP에서 제외

```text
- AI 컷 생성
- 자동 연출
- Concept Registry
- CutState
- Camera State
- Focus Resolver
- Prompt Compiler
- Flux2 adapter
- Auto Repair
- 실패 컷 로그 기반 수정
- 고급 추천 알고리즘
- 복잡한 과금
```

---

# 23. Codex 작업 순서

## Task 1. 도메인 구조 생성

Codex 지시문:

```text
apps/web/src에 domains 구조를 추가해줘.

추가할 도메인:
- feed
- channel
- viewer
- studio
- community
- auth

기존 기능은 깨지지 않게 하고, 파일 이동이 필요한 경우 import path를 모두 수정해줘.
이번 작업에서는 기능 변경 없이 구조 정리만 해줘.
```

완료 기준:

```text
- 빌드 통과
- 기존 /, /v/:publishId, /promptoon/* 라우트 유지
- import 오류 없음
```

---

## Task 2. 페이지 이름 정리

Codex 지시문:

```text
기존 페이지 컴포넌트 이름을 제품 도메인 기준으로 변경해줘.

MainFeedPage → FeedHomePage
PromptoonViewerPage → ViewerPage
PromptoonProjectListPage → StudioProjectDashboardPage
PromptoonEpisodeEditorPage → StudioEpisodeEditorPage

URL은 변경하지 말고 컴포넌트 이름과 파일명만 정리해줘.
```

완료 기준:

```text
- URL 변경 없음
- 컴포넌트 이름 정리
- build/test 통과
```

---

## Task 3. API service 분리

Codex 지시문:

```text
shared/api/promptoon.service.ts를 다음 파일로 분리해줘.

- feed.api.ts
- channel.api.ts
- viewer.api.ts
- studio.api.ts
- community.api.ts
- telemetry.api.ts
- auth.api.ts

기존 promptoonService는 deprecated wrapper로 남겨서 기존 화면이 깨지지 않게 해줘.
```

완료 기준:

```text
- feedApi.getMixedFeed
- channelApi.getChannelHome
- viewerApi.getPublishedEpisode
- studioApi.getEpisodeDraft
- studioApi.publishProject
- telemetryApi.trackEvent
- 기존 promptoonService 호환 유지
```

---

## Task 4. API 라우터 분리

Codex 지시문:

```text
apps/api에서 createPromptoonRouter를 다음 라우터로 분리해줘.

- createAuthRouter
- createFeedRouter
- createChannelRouter
- createViewerRouter
- createStudioRouter
- createCommunityRouter
- createTelemetryRouter

기존 /api/promptoon 라우터는 createLegacyPromptoonRouter로 유지해줘.
```

완료 기준:

```ts
app.use("/api/auth", createAuthRouter());
app.use("/api/feed", createFeedRouter());
app.use("/api/channels", createChannelRouter());
app.use("/api/viewer", createViewerRouter());
app.use("/api/studio", createStudioRouter());
app.use("/api/community", createCommunityRouter());
app.use("/api/telemetry", createTelemetryRouter());
app.use("/api/promptoon", createLegacyPromptoonRouter());
```

---

## Task 5. shared 타입 분리

Codex 지시문:

```text
packages/shared/src/promptoon.ts의 타입을 다음 파일로 분리해줘.

- promptoon/core.ts
- promptoon/feed.ts
- promptoon/channel.ts
- promptoon/viewer.ts
- promptoon/studio.ts
- promptoon/community.ts
- promptoon/analytics.ts
- promptoon/auth.ts

기존 promptoon.ts는 re-export barrel로 유지해서 기존 import가 깨지지 않게 해줘.
```

완료 기준:

```text
- 기존 import 호환
- 신규 domain import 가능
- circular dependency 없음
```

---

## Task 6. DB migration 추가

Codex 지시문:

```text
프롬툰 공개 피드, 채널, 뷰어, 스튜디오 발행 구조를 위한 migration을 추가해줘.

추가 테이블:
- channels
- series
- publishes
- publish_versions
- feed_items
- channel_home_projections
- short_clips
- user_likes
- user_bookmarks
- user_subscriptions
- viewer_events
- feed_impressions
- episode_view_stats
- episode_discussions
- telemetry_events

기존 projects, episodes, cuts, choices, assets와 FK 관계를 맞춰줘.
AI 생성 엔진 관련 테이블은 추가하지 마.
```

완료 기준:

```text
- migration 적용 가능
- rollback 가능
- 기존 데이터 손상 없음
- FK/index 포함
- feed_items는 publishes를 참조
- channel_home_projections는 channels를 참조
```

---

## Task 7. Feed UI 구현

Codex 지시문:

```text
위 UI 컨셉을 기준으로 FeedHomePage를 숏폼 피드 형태로 구현해줘.

컴포넌트:
- FeedSnapScroller
- FeedShortDramaCard
- FeedPromptoonCard
- FeedActionBar
- FeedChannelBadge
- FeedProgressBar

API:
- feedApi.getMixedFeed
- telemetryApi.trackEvent

기능:
- 세로 스냅 스크롤
- 15초 progress UI
- 좋아요/댓글/공유/저장 버튼
- 채널 클릭 시 /c/:channelSlug 이동
- 웹툰 클릭 시 /v/:publishId 이동
```

완료 기준:

```text
- 모바일 우선 반응형
- 스냅 스크롤 동작
- 채널 이동 동작
- 뷰어 이동 동작
- impression telemetry 저장
```

---

## Task 8. Channel UI 구현

Codex 지시문:

```text
/c/:channelSlug 라우트와 ChannelHomePage를 구현해줘.

화면 구성:
- 상단 배너
- 프로필
- 구독 버튼
- 통계
- 탭: 홈 / 시리즈 / 웹툰 / 숏드라마 / 커뮤니티
- 대표 시리즈
- 최신 에피소드
- 관련 숏드라마
- 커뮤니티 프리뷰

API:
- channelApi.getChannelHome(channelSlug)
- channelApi.subscribe(channelId)
- telemetryApi.trackEvent
```

완료 기준:

```text
- /c/:channelSlug 라우트 동작
- 로딩/에러/빈 상태 처리
- 구독 버튼 로그인 필요 처리
- 대표 시리즈 클릭 시 Viewer 또는 Series 화면 이동
```

---

## Task 9. Viewer UI 구현

Codex 지시문:

```text
ViewerPage를 위 UI의 웹툰 뷰어 형태로 개선해줘.

컴포넌트:
- ViewerHeader
- EpisodeMeta
- WebtoonPanelList
- NextEpisodeButton
- RelatedShorts
- CommentPreview
- ViewerBottomActions

API:
- viewerApi.getPublishedEpisode
- viewerApi.getRelatedShorts
- communityApi.getCommentsMeta
- telemetryApi.trackEvent
```

완료 기준:

```text
- 웹툰 패널 세로 스크롤
- 다음 화 보기
- 관련 숏드라마 노출
- 댓글 메타 노출
- reading progress telemetry 저장
```

---

## Task 10. Studio 발행 구조 구현

Codex 지시문:

```text
Studio publish flow를 구현해줘.

발행 시:
1. Draft Episode를 PublishManifest로 변환
2. publishes row 생성
3. feed_items row 생성
4. channel_home_projections 갱신
5. episode_discussions 생성 또는 연결

Feed는 draft를 읽지 않고 feed_items만 읽게 해줘.
Viewer는 publishes.manifest_json만 읽게 해줘.
Channel은 channel_home_projections를 우선 읽게 해줘.
```

완료 기준:

```text
- publish 시 PublishManifest 생성
- publish 시 FeedItem projection 생성
- publish 시 ChannelHome projection 갱신
- /api/feed/mixed는 feed_items 기반
- /api/channels/:slug/home은 projection 기반
- /api/viewer/publishes/:publishId는 manifest 기반
```

---

## Task 11. Community 연결

Codex 지시문:

```text
episode_discussions 테이블과 community API를 구현해줘.

API:
- POST /api/community/episodes/:episodeId/discussion
- GET /api/community/publishes/:publishId/comments-meta
- POST /api/community/discourse/webhook

초기 MVP에서는 Discourse 실제 embed가 없어도 comments-meta가 동작하게 mock 또는 DB 기반으로 구현해줘.
```

완료 기준:

```text
- publishId 기준 댓글 메타 조회 가능
- Studio에서는 댓글 수와 관리 링크만 표시
- Viewer에서는 댓글 프리뷰 표시
```

---

## Task 12. Telemetry 구현

Codex 지시문:

```text
telemetryApi.trackEvent와 /api/telemetry/events를 구현해줘.

이벤트:
- feed_impression
- feed_channel_click
- channel_view
- channel_subscribe
- viewer_open
- viewer_scroll_progress
- viewer_next_episode
- viewer_related_short_click
- studio_publish

비로그인 anonymous_id와 로그인 user_id를 모두 지원해줘.
```

완료 기준:

```text
- telemetry_events 저장
- anonymous_id 지원
- user_id 연결
- Studio analytics에서 기본 집계 가능
```

---

## Task 13. Auth 권한 분리

Codex 지시문:

```text
Feed user와 Studio member 권한을 분리해줘.

테이블:
- users
- studio_members
- project_members

정책:
- Public Feed/Viewer/Channel은 비로그인 접근 가능
- 좋아요/저장/댓글/구독은 로그인 필요
- /studio/*와 /promptoon/*는 studio member만 접근 가능
- project 단위 role을 검사
```

완료 기준:

```text
- 비로그인 피드 감상 가능
- 로그인 액션 보호
- Studio 접근 권한 보호
- project role 검사
```

---

# 24. 단계별 구현 로드맵

## Phase 1. 구조 정리

```text
목표:
- 기능 변경 없이 구조 정리

작업:
- domains 폴더 생성
- 페이지 이름 정리
- shared 타입 분리
- API service 분리
- legacy route 유지
```

완료 기준:

```text
- 기존 기능 유지
- 빌드 통과
- import 오류 없음
```

---

## Phase 2. Public UX 구현

```text
목표:
- 위 UI 기반 공개 서비스 구현

작업:
- FeedHomePage
- ChannelHomePage
- ViewerPage
- 모바일 반응형
- 로딩/빈 상태/에러 상태
```

완료 기준:

```text
- 피드 → 채널 이동
- 피드 → 뷰어 이동
- 채널 → 뷰어 이동
- 뷰어 → 관련 숏드라마 이동
```

---

## Phase 3. API / DB 분리

```text
목표:
- Feed/Viewer/Channel/Studio 데이터 접근 분리

작업:
- API 라우터 분리
- DB migration
- FeedItem projection
- ChannelHome projection
- PublishManifest
```

완료 기준:

```text
- Feed는 feed_items만 읽음
- Viewer는 publishes manifest만 읽음
- Channel은 projection 기반
- Studio만 draft 데이터 접근
```

---

## Phase 4. Studio 발행 관리

```text
목표:
- 내부 제작자가 발행 가능한 구조 구현

작업:
- 프로젝트 관리
- 시리즈 관리
- 에피소드 편집
- 컷/선택지 편집
- 에셋 업로드
- 발행/비공개
```

완료 기준:

```text
- Draft Episode 생성 가능
- Publish 가능
- 발행 후 Feed/Channel/Viewer에 반영
```

---

## Phase 5. Community / Auth / Telemetry

```text
목표:
- 실제 서비스 운영에 필요한 기반 추가

작업:
- 로그인
- 구독
- 좋아요
- 저장
- 댓글 메타
- telemetry
- analytics
```

완료 기준:

```text
- 비로그인 감상 가능
- 로그인 액션 가능
- Studio 권한 보호
- 기본 지표 확인 가능
```

---

# 25. 최종 구현 우선순위

```text
1. 기존 구조 파악 및 빌드 안정화
2. API service 분리
3. API router 분리
4. shared type 분리
5. Feed UI 구현
6. Channel UI 구현
7. Viewer UI 구현
8. PublishManifest / FeedItem projection 구현
9. ChannelHome projection 구현
10. Studio 발행 관리 구현
11. Community meta 구현
12. Telemetry 구현
13. Auth 권한 분리
14. Analytics 구현
```

---

# 26. 이번 버전의 최종 구조

```text
Promptoon
├─ Feed
│  ├─ 숏폼 피드
│  ├─ 15초 숏드라마
│  ├─ 프롬툰 카드
│  └─ 채널 진입
│
├─ Channel
│  ├─ 작가/스튜디오 홈
│  ├─ 대표 시리즈
│  ├─ 웹툰 목록
│  ├─ 숏드라마 목록
│  └─ 커뮤니티 프리뷰
│
├─ Viewer
│  ├─ 웹툰 감상
│  ├─ 다음 화 보기
│  ├─ 이어보기
│  └─ 관련 숏드라마
│
├─ Studio
│  ├─ 프로젝트 관리
│  ├─ 시리즈 관리
│  ├─ 에피소드 편집
│  ├─ 컷/선택지 편집
│  ├─ 에셋 업로드
│  └─ 발행
│
├─ Community
│  ├─ 댓글 메타
│  └─ Discourse 연결
│
├─ Auth
│  ├─ Feed user
│  └─ Studio member
│
├─ Telemetry
│  ├─ 피드 이벤트
│  ├─ 채널 이벤트
│  ├─ 뷰어 이벤트
│  └─ 스튜디오 이벤트
│
└─ Core
   ├─ PublishManifest
   ├─ ContentBlock
   ├─ Viewer projection
   └─ Feed projection
```

---

# 27. Codex에 전달할 최상위 지시문

아래 문장을 Codex 작업 시작 전에 붙이면 됩니다.

```text
이번 구현에서는 프롬툰-제작-시스템 문서 기반의 AI 컷 생성 엔진 구현을 제외한다.

제외할 것:
- Concept Registry
- CutState
- Camera State
- Focus Resolver
- Prompt Compiler
- Flux2/I2I adapter
- Reference Weight
- Validation/Auto Repair
- 실패 컷 로그 기반 수정 루프
- 자동 연출/중요도 기반 카메라 규칙

구현할 것:
- Feed / Channel / Viewer / Studio / Community / Auth / Telemetry / Core 도메인 분리
- 숏폼 피드 UI
- 채널 홈 UI
- 웹툰 뷰어 UI
- Studio 발행 관리
- PublishManifest
- FeedItem projection
- ChannelHome projection
- API router 분리
- shared type 분리
- 권한 분리
- telemetry
```

한 문장으로 정리하면:

> 이번 구현 계획은 **AI 제작 엔진 구현 계획이 아니라, “숏폼 피드 → 채널 → 웹툰 뷰어”로 이어지는 프롬툰 제품 서비스 구현 계획**입니다. Feed는 발행된 콘텐츠를 소비하는 영역이고, Studio는 발행 가능한 콘텐츠를 관리하는 내부 영역이며, 둘은 Core를 공유하되 API·권한·데이터 접근은 분리합니다.

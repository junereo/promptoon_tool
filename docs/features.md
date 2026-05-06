# 기능 명세서

Promptoon은 인터랙티브 에피소드 제작, 배포, 소비, 커뮤니티, 운영 관리를 하나의 workspace에서 다룹니다. 현재 Web 앱은 public product surface와 Studio authoring surface를 함께 제공하고, Admin 앱은 platform 운영 기능을 분리해 제공합니다.

## 1. Public Feed

- Route: `/`, `/feed`
- API: `/api/feed/*`
- `promptoon_feed_item` projection 기반으로 promptoon/webtoon/short/channel recommendation feed를 조회합니다.
- infinite query cursor와 `limit` 기반 pagination을 사용합니다.
- 로그인 사용자는 publish별 like/bookmark state를 조회하고 변경할 수 있습니다.
- feed impression/open/watch-progress telemetry를 수집합니다.

## 2. Channel

- Route: `/c/:channelSlug`, `/c/:channelSlug/series`, `/c/:channelSlug/shorts`, `/c/:channelSlug/community`
- API: `/api/channels/*`
- channel profile, featured series, latest episodes, latest shorts, community meta를 조회합니다.
- channel home projection이 없으면 public table에서 재구성한 뒤 upsert합니다.
- 로그인 사용자는 channel subscribe/unsubscribe를 수행합니다.

## 3. Viewer

- Route: `/v/:publishId`, `/v/:publishId/:episodeNo`
- API: `/api/viewer/*`, `/api/telemetry/viewer-events`
- published manifest snapshot을 읽어 에피소드를 재생합니다.
- cut kind와 choice edge를 기반으로 분기형 진행을 처리합니다.
- state router, state variant, exit loop cut metadata, result card content block을 지원합니다.
- `cut_view`, `cut_leave`, `choice_click`, `ending_reach`, `ending_share` telemetry를 수집합니다.
- share endpoint는 ending cut query를 받아 HTML preview를 렌더링합니다.

## 4. Community와 Discourse

- Public route: `/community/publishes/:publishId`
- Studio route: `/studio/community/publishes/:publishId`, `/promptoon/community/publishes/:publishId`
- API: `/api/community/*`
- DB-backed comment metadata/comment list/create/edit/delete/moderation을 제공합니다.
- publish별 episode discussion projection을 만들 수 있습니다.
- Discourse topic 생성, topic 조회, post 작성/수정/삭제, like/bookmark bridge endpoint가 있습니다.
- Discourse sync 상태는 Admin 콘솔과 Studio community moderation 화면에서 확인합니다.

## 5. Studio 프로젝트 관리

- Route: `/studio/projects`, `/promptoon/projects`
- API: `/api/studio/projects*`
- 프로젝트 목록, 생성, 제목/설명/썸네일 수정.
- 프로젝트 상세에서 episode 목록과 Studio 하위 화면으로 이동합니다.
- 프로젝트별 publish history, asset library, member, settings, analytics 화면이 있습니다.
- `GET /api/studio/backup/export`로 현재 사용자 authoring backup을 export합니다.

## 6. 에피소드 에디터

- Route: `/studio/projects/:projectId/episodes/:episodeId`
- API: `/api/studio/episodes/*`, `/api/studio/cuts/*`, `/api/studio/choices/*`
- React Flow 기반 branch canvas에서 cut node와 choice edge를 편집합니다.
- cut list panel, inspector panel, preview phone frame, script editor modal을 제공합니다.
- cut position 저장은 `PATCH /episodes/:episodeId/cuts/layout` 배치 API를 사용합니다.
- cut order 저장은 `PATCH /episodes/:episodeId/cuts/reorder` 배치 API를 사용합니다.
- cut/choice field 편집은 optimistic update와 autosave 훅으로 처리합니다.
- 이미지 업로드는 project asset API를 통해 원본과 WebP 변환 asset을 저장합니다.

지원되는 cut/content 기능:

- Cut kind: `scene`, `choice`, `ending`, `transition`, `stateRouter`, `resultCard`, `loopStage`, `loopVariant`, `loopSpacer`
- Content block: `heading`, `narration`, `quote`, `emphasis`, `dialogue`, `image`, `nameInput`, `resultCard`
- Style: font token, size, line height, spacing, text align, overlay/flow placement
- Visual effect: fade/slide/zoom, effect duration, edge fade direction/intensity/color
- State: choice state writes, state variants, state routes, fallback cut
- Exit loop: loop stage/variant/spacer/result router metadata와 loop state setting 생성 modal

## 7. Validate와 Publish

- Validate API: `POST /api/studio/episodes/:episodeId/validate`
- Publish API: `POST /api/studio/projects/:projectId/publish`
- Update publish API: `POST /api/studio/projects/:projectId/publish/update`
- Unpublish API: `POST /api/studio/projects/:projectId/unpublish`

검증은 시작 컷, 엔딩 컷, choice target, state router/variant, exit loop graph, 도달 불가능한 cut, dead path, episode cover 누락 등을 확인합니다.

Publish는 draft 데이터를 manifest snapshot으로 고정하고 public product projection을 갱신합니다.

- default channel/series 보강
- feed item projection upsert
- channel home projection upsert
- episode discussion projection 생성
- publish history 기록

기존 publish를 public projection에 다시 노출해야 할 때는 `POST /api/studio/projections/rebuild`를 사용합니다.

## 8. Analytics

- Studio project analytics: `GET /api/studio/analytics/projects/:projectId`
- Episode analytics: `GET /api/studio/analytics/episodes/:episodeId`
- Reset: `POST /api/studio/analytics/episodes/:episodeId/reset`

제공 항목:

- project-level episode summary
- funnel: 시작/선택/엔딩 도달
- daily/weekly/monthly views
- choice click stats
- cut engagement
- ending distribution
- replay viewers
- feed entry metrics reset

## 9. Asset Library와 Publish History

- Asset library는 업로드 asset, project thumbnail, episode cover, cut asset을 프로젝트 기준으로 추적합니다.
- asset metadata 수정, 삭제, replace를 지원하고 history action을 남깁니다.
- publish history는 version number, channel/series, 생성 시각을 보여줍니다.
- publish diff/compare/rollback API가 있어 두 publish snapshot 사이 변경 요약을 확인하고 이전 publish로 rollback할 수 있습니다.

## 10. Member와 권한

- Studio route는 로그인과 studio 권한을 요구합니다.
- Project member role은 `owner`, `producer`, `writer`, `viewer`입니다.
- member 화면에서 loginId 기준으로 `producer`, `writer`, `viewer`를 추가/수정/삭제할 수 있습니다.
- owner만 member 관리를 수행합니다.
- publish/update/unpublish와 analytics reset은 owner/producer에게 제한됩니다.

## 11. Auth

- Login/Register route: `/login`, `/register`
- API: `/api/auth/*`
- loginId/password 기반 auth를 제공합니다.
- access token과 refresh token은 response payload와 cookie로 내려갑니다.
- session bootstrap은 `/api/auth/me`로 active session을 확인합니다.
- refresh token은 `/api/auth/refresh`로 재발급합니다.
- Kakao OAuth start/callback이 구현되어 있고 Google OAuth는 scaffold 상태입니다.

## 12. Admin 콘솔

- 위치: `apps/admin`
- 개발 route: `http://127.0.0.1:5174`
- API: `/api/admin/*`
- 접근 조건: active session + `platform_admin`

기능:

- dashboard summary
- user 검색과 role filter
- platform admin role grant/revoke
- studio role grant/revoke
- project 목록 조회
- publish 목록 조회
- Discourse sync 상태 조회
- telemetry event/domain summary 조회

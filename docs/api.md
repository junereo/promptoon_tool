# Promptoon API 문서

이 문서는 `apps/api`의 현재 Express route 기준 API 요약입니다. 상세 request/response 타입은 `packages/shared/src/promptoon/*`, request validation은 `apps/api/src/modules/promptoon-authoring/promptoon.schemas.ts`를 기준으로 합니다.

## 1. 기본 규칙

- API 서버 기본 origin: `http://127.0.0.1:4000`
- Health check: `GET /api/health`
- 업로드 asset serve: `GET /uploads/*`
- JSON body: `express.json()`
- 업로드: `multipart/form-data`, `file` field, 최대 10MB
- 인증: `Authorization: Bearer <accessToken>` 또는 auth cookie

Public read API는 대체로 인증 없이 접근합니다. Studio/Admin/interaction write API는 active session이 필요합니다. JWT가 유효해도 `promptoon_session` row가 만료/삭제되면 인증되지 않습니다.

## 2. Base Paths

- `/api/auth`: 인증/session/OAuth
- `/api/admin`: platform admin 운영
- `/api/feed`: public feed와 feed interaction
- `/api/channels`: channel public surface와 subscription
- `/api/viewer`: published viewer surface
- `/api/studio`: authoring/Studio protected API
- `/api/community`: comment/discussion/Discourse bridge
- `/api/telemetry`: generic telemetry
- `/api/promptoon/auth`: legacy auth mount
- `/api/promptoon`: legacy authoring/public 호환 API

## 3. Auth API

- `POST /api/auth/register`
  - Body: `{ loginId, password }`, 각 값은 최소 8자.
  - 201, auth payload와 auth cookies 반환.
- `POST /api/auth/login`
  - Body: `{ loginId, password }`, 각 값은 최소 8자.
  - auth payload와 auth cookies 반환.
- `GET /api/auth/me`
  - 인증 필요. 현재 user/session/studio role 반환.
- `POST /api/auth/logout`
  - 인증 필요. 현재 session 삭제, auth cookies clear.
- `POST /api/auth/refresh`
  - Body: `{ refreshToken? }`
  - header `x-refresh-token` 또는 refresh cookie도 허용.
- `GET /api/auth/google/start`, `GET /api/auth/google/callback`
  - 현재 501 scaffold.
- `GET /api/auth/kakao/start`
  - Query: `state?`, `redirect=1?`
  - Kakao authorization URL 반환 또는 redirect.
- `GET /api/auth/kakao/callback`, `POST /api/auth/kakao/callback`
  - Kakao code로 로그인. `state=admin`이면 admin redirect URL 사용.

## 4. Public Product API

### Feed

- `GET /api/feed/mixed`
- `GET /api/feed/episodes`
- `GET /api/feed/shorts`
  - Query: `{ cursor?, limit? }`, `limit` 기본 10, 최대 20.
- `GET /api/feed/state?publishIds=<uuid>[,<uuid>]`
  - 인증 필요. publish별 liked/bookmarked 상태와 projected metrics 반환.
- `POST /api/feed/publishes/:publishId/like`
- `DELETE /api/feed/publishes/:publishId/like`
- `POST /api/feed/publishes/:publishId/bookmark`
- `DELETE /api/feed/publishes/:publishId/bookmark`
  - 인증 필요. 상태 변경 후 204.
- `POST /api/feed/events/impression`
- `POST /api/feed/events/open`
- `POST /api/feed/events/watch-progress`
  - feed telemetry 수집, 202.

### Channels

- `GET /api/channels/:channelSlug`
- `GET /api/channels/:channelSlug/home`
  - channel home projection 우선 조회, 필요 시 public table 기반 rebuild/upsert.
- `GET /api/channels/:channelSlug/series`
- `GET /api/channels/:channelSlug/episodes`
- `GET /api/channels/:channelSlug/shorts`
- `GET /api/channels/:channelSlug/community-meta`
- `GET /api/channels/:channelId/subscription`
- `POST /api/channels/:channelId/subscribe`
- `DELETE /api/channels/:channelId/subscribe`
  - subscription endpoint는 인증 필요.

### Viewer

- `GET /api/viewer/publishes/:publishId`
  - published manifest 조회.
- `GET /api/viewer/publishes/:publishId/episodes/:episodeNo`
  - 현재 publish manifest를 반환하며 episodeNo route를 호환합니다.
- `GET /api/viewer/publishes/:publishId/related-shorts`
- `GET /api/viewer/publishes/:publishId/share?e=<endingCutId>`
  - share용 HTML 반환.
- `GET /api/viewer/publishes/:publishId/state`
  - 인증 필요. like/bookmark/continue 등 viewer interaction state.
- `POST /api/viewer/events`
  - viewer telemetry 수집.
- `POST /api/viewer/publishes/:publishId/continue`
  - 인증 필요. continue event 수집.

## 5. Studio API

모든 `/api/studio/*` endpoint는 인증이 필요합니다.

### Maintenance와 백업

- `POST /api/studio/projections/rebuild`
  - Studio/admin 보호 projection repair.
  - 기존 publish ID와 manifest를 보존하고 default channel/series, feed item, channel home, episode discussion projection을 idempotent하게 복구합니다.
- `GET /api/studio/backup/export`
  - 현재 사용자의 authoring backup JSON 다운로드.

### Projects

- `GET /api/studio/projects`
- `POST /api/studio/projects`
  - Body: `{ title: string, description?: string }`
- `PATCH /api/studio/projects/:projectId`
  - Body: `{ title?, description?, thumbnailUrl? }`

### Assets와 Publish History

- `GET /api/studio/projects/:projectId/assets`
- `POST /api/studio/projects/:projectId/assets`
  - `multipart/form-data`, `file` field.
  - 원본 저장과 WebP 변환을 수행하고 asset URL을 반환합니다.
- `PATCH /api/studio/projects/:projectId/assets/:assetId`
  - Body: `{ metadata?: Record<string, unknown> }`
- `DELETE /api/studio/projects/:projectId/assets/:assetId`
- `POST /api/studio/projects/:projectId/assets/:assetId/replace`
  - `multipart/form-data`, `file` field.
- `GET /api/studio/projects/:projectId/publishes`
- `GET /api/studio/projects/:projectId/publishes/:publishId/diff?to=<publishId>`
- `GET /api/studio/projects/:projectId/publishes/:fromPublishId/compare/:toPublishId`
- `POST /api/studio/projects/:projectId/publishes/:publishId/rollback`

### Project Members

- `GET /api/studio/projects/:projectId/members`
- `POST /api/studio/projects/:projectId/members`
  - Body: `{ loginId: string, role: "producer" | "writer" | "viewer" }`
- `PATCH /api/studio/projects/:projectId/members/:userId`
  - Body: `{ role: "producer" | "writer" | "viewer" }`
- `DELETE /api/studio/projects/:projectId/members/:userId`

Project role 정책:

- `owner | producer | writer | viewer`: 프로젝트 목록/읽기
- `owner | producer | writer`: draft/edit/asset/validate
- `owner | producer`: publish/update/unpublish/analytics reset
- `owner`: member 관리

### Episodes, Cuts, Choices

- `POST /api/studio/projects/:projectId/episodes`
  - Body: `{ title, episodeNo, coverImageUrl?, mode?, exitLoopMetadata? }`
- `GET /api/studio/episodes/:episodeId/draft`
- `PATCH /api/studio/episodes/:episodeId`
- `GET /api/studio/episodes/:episodeId/published/latest`
- `POST /api/studio/episodes/:episodeId/cuts`
- `PATCH /api/studio/episodes/:episodeId/cuts/reorder`
  - Body: `{ cuts: [{ cutId, orderIndex }] }`
- `PATCH /api/studio/episodes/:episodeId/cuts/layout`
  - Body: `{ cuts: [{ cutId, positionX, positionY }] }`
- `POST /api/studio/episodes/:episodeId/loop-state-setting`
- `PATCH /api/studio/cuts/:cutId`
- `DELETE /api/studio/cuts/:cutId`
  - Body optional: `{ reconnectToCutId?: string | null }`
- `POST /api/studio/cuts/:cutId/choices`
- `PATCH /api/studio/choices/:choiceId`
- `DELETE /api/studio/choices/:choiceId`

Cut kind:

- `scene`, `choice`, `ending`, `transition`
- `stateRouter`, `resultCard`
- `loopStage`, `loopVariant`, `loopSpacer`

Content block type:

- `heading`, `narration`, `quote`, `emphasis`, `dialogue`, `image`, `nameInput`, `resultCard`

### Validate와 Publish

- `POST /api/studio/episodes/:episodeId/validate`
- `POST /api/studio/projects/:projectId/publish`
  - Body: `{ episodeId }`, 201.
- `POST /api/studio/projects/:projectId/publish/update`
  - Body: `{ episodeId }`.
- `POST /api/studio/projects/:projectId/unpublish`
  - Body: `{ episodeId }`, 204.

대표 validation code:

- `missing_start_cut`, `multiple_start_cuts`, `missing_ending_cut`
- `invalid_choice_target`
- `invalid_state_variant_target`, `invalid_state_router_target`, `invalid_state_router_condition`, `missing_state_router_route`, `missing_state_router_fallback`
- `invalid_loop_metadata`, `invalid_loop_variant_target`, `invalid_loop_stage_choices`, `invalid_loop_state_mapping`, `missing_loop_entry_reset`, `invalid_loop_result_router`
- `unreachable_cut`, `dead_path`, `missing_episode_cover`

### Analytics

- `GET /api/studio/analytics/projects/:projectId`
- `GET /api/studio/analytics/episodes/:episodeId`
  - Query: `{ viewsGranularity?: "daily" | "weekly" | "monthly", viewsFrom?: "YYYY-MM-DD", viewsTo?: "YYYY-MM-DD" }`
- `POST /api/studio/analytics/episodes/:episodeId/reset`
  - Body: `{ scope: "all" | "views" | "choiceStats" | "endingDistribution" | "cutEngagement" | "feedEntry" }`

## 6. Community와 Discourse API

- `POST /api/community/episodes/:episodeId/discussion`
  - 인증 필요. episode discussion projection 보장.
- `GET /api/community/publishes/:publishId/comments-meta`
- `GET /api/community/publishes/:publishId/embed`
- `GET /api/community/publishes/:publishId/comments`
- `POST /api/community/publishes/:publishId/comments`
  - 인증 필요. Body: `{ body }`
- `PATCH /api/community/comments/:commentId`
  - 인증 필요. Body: `{ body }`
- `DELETE /api/community/comments/:commentId`
  - 인증 필요.
- `POST /api/community/comments/:commentId/moderation`
  - 인증 필요. Body: `{ status: "visible" | "hidden" | "deleted", reason? }`
- `POST /api/community/publishes/:publishId/discourse-sync`
- `POST /api/community/publishes/:publishId/discourse-topic`
- `POST /api/community/publishes/:publishId/discourse/comments`
  - 인증 필요. Body: `{ raw, replyToPostNumber? }`
- `GET /api/community/discourse/categories`
- `GET /api/community/discourse/latest`
- `GET /api/community/discourse/top`
- `GET /api/community/discourse/t/:topicId`
- `PATCH /api/community/discourse/posts/:postId`
- `DELETE /api/community/discourse/posts/:postId`
- `POST /api/community/discourse/posts/:postId/like`
- `POST /api/community/discourse/posts/:postId/bookmark`
- `POST /api/community/discourse/webhook`

Discourse 환경 변수가 비어 있으면 외부 Discourse 호출은 사용 가능한 형태로 동작하지 않습니다. DB-backed comment/meta endpoint는 별도 Discourse 설정 없이 사용할 수 있습니다.

## 7. Admin API

모든 `/api/admin/*` endpoint는 인증과 `platform_admin` 권한이 필요합니다.

- `GET /api/admin/me`
- `GET /api/admin/users`
  - Query: `{ query?, role?: "all" | "platform_admin" | "studio_member" | "no_studio", limit?, offset? }`
- `PATCH /api/admin/users/:userId/platform-role`
  - Body: `{ role: "platform_admin" | null }`
- `PATCH /api/admin/users/:userId/studio-role`
  - Body: `{ role: "studio_admin" | "producer" | "writer" | "viewer" | null }`
- `GET /api/admin/projects`
- `GET /api/admin/publishes`
- `GET /api/admin/community/discourse`
- `GET /api/admin/telemetry/summary`

`PROMPTOON_PLATFORM_ADMIN_LOGIN_IDS`에 포함된 loginId는 admin 접근 시 platform admin으로 bootstrap될 수 있습니다.

## 8. Telemetry API

- `POST /api/telemetry/events`
  - generic telemetry event.
- `POST /api/telemetry/viewer-events`
  - Body: `{ publishId, anonymousId, sessionId, eventType, cutId, choiceId?, durationMs? }`
- `POST /api/telemetry/batch`
  - Body: `{ events: [...] }`

Viewer legacy event type:

- `cut_view`, `cut_leave`, `choice_click`, `ending_reach`, `ending_share`, `feed_impression`, `feed_choice_click`

## 9. Legacy `/api/promptoon`

호환용 authoring/public API입니다. 새 UI는 product domain API와 `/api/studio`를 우선 사용합니다.

Public:

- `POST /api/promptoon/telemetry/events`
- `GET /api/promptoon/episodes/feed`
- `GET /api/promptoon/episodes/published/:publishId`
- `GET /api/promptoon/share/:publishId`

Protected:

- `GET /api/promptoon/projects`
- `GET /api/promptoon/backup/export`
- `POST /api/promptoon/projects`
- `POST /api/promptoon/projects/:projectId/assets`
- `POST /api/promptoon/projects/:projectId/episodes`
- `GET /api/promptoon/episodes/:episodeId/draft`
- `PATCH /api/promptoon/episodes/:episodeId`
- `GET /api/promptoon/episodes/:episodeId/published/latest`
- `POST /api/promptoon/episodes/:episodeId/cuts`
- `PATCH /api/promptoon/episodes/:episodeId/cuts/reorder`
- `PATCH /api/promptoon/episodes/:episodeId/cuts/layout`
- `POST /api/promptoon/episodes/:episodeId/loop-state-setting`
- `PATCH /api/promptoon/cuts/:cutId`
- `DELETE /api/promptoon/cuts/:cutId`
- `POST /api/promptoon/cuts/:cutId/choices`
- `PATCH /api/promptoon/choices/:choiceId`
- `DELETE /api/promptoon/choices/:choiceId`
- `POST /api/promptoon/episodes/:episodeId/validate`
- `POST /api/promptoon/projects/:projectId/publish`
- `POST /api/promptoon/projects/:projectId/publish/update`
- `POST /api/promptoon/projects/:projectId/unpublish`
- `GET /api/promptoon/analytics/episodes/:episodeId`
- `POST /api/promptoon/analytics/episodes/:episodeId/reset`

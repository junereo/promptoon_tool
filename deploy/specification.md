# Promptoon Product Specification

이 문서는 `deploy/instruction.md`의 구현 방향을 기준으로 현재 구현된 제품 기능과 앞으로 구현할 작업을 정리한다.
이번 범위는 프롬툰 소비/발행 제품 구조를 정리하는 것이며, AI 컷 생성 엔진 구현은 포함하지 않는다.

## 1. 구현 범위

Promptoon은 현재 모노레포 구조를 유지한다.

```text
promptoon
├─ apps
│  ├─ api
│  └─ web
└─ packages
   └─ shared
```

제품 도메인은 다음 책임으로 분리한다.

```text
Feed        공개 콘텐츠 발견과 숏폼 피드
Channel     작가/스튜디오/IP 홈
Viewer      발행본 감상과 이어보기
Community   댓글/토론 메타
Studio      내부 제작, 발행, 분석 관리
Auth        로그인, 세션, 권한
Telemetry   행동 로그와 분석 이벤트
Core        발행본, manifest, projection 공통 처리
```

핵심 데이터 접근 원칙은 다음과 같다.

- Feed는 draft 데이터를 직접 읽지 않고 `FeedItem` projection을 읽는다.
- Channel은 공개 채널 홈 projection과 공개 발행 데이터를 읽는다.
- Viewer는 발행된 publish manifest를 읽는다.
- Studio는 draft와 publish를 모두 관리한다.
- legacy `/api/promptoon` 경로는 유지하되 신규 구현은 domain API를 우선 사용한다.

## 2. 현재 구현된 내용

### API 도메인 분리

현재 API는 다음 product domain router로 분리되어 있다.

```text
/api/auth
/api/feed
/api/channels
/api/viewer
/api/studio
/api/community
/api/telemetry
```

기존 호환 경로도 유지한다.

```text
/api/promptoon/auth
/api/promptoon
```

각 도메인의 현재 책임은 다음과 같다.

- Auth: register, login, me, logout, Google OAuth scaffold.
- Feed: mixed/episodes/shorts feed 조회, interaction state, like/bookmark, feed telemetry.
- Channel: channel home, series, episodes, shorts, community meta, subscribe 상태와 변경.
- Viewer: published episode 조회, episode number alias, related shorts, interaction state, continue event.
- Studio: projects, members, assets, episodes, cuts, choices, validate, publish/update/unpublish, episode/project analytics, projection rebuild.
- Community: episode discussion 생성, publish comments meta, 댓글 작성/수정/삭제, moderation, Discourse thread sync, discourse webhook 수집.
- Telemetry: generic event, viewer legacy event, batch event 수집.

이번 Product Domain Completion 단계에서 domain router는 각 도메인 `*.service.ts`를 통해 접근하도록 정리했다.
각 service는 필요한 함수만 명시 노출하며, router import 경계는 domain service로 고정한다.
public domain service는 Studio draft/edit 전용 operation을 export하지 않는다.
Studio 내부는 다음 service 경계로 책임을 나누기 시작했다.

```text
authorization.service.ts  Studio/project role 확인
project.service.ts        project, backup, asset upload/history
editor.service.ts         episode draft/editor operation
member.service.ts         project member management
publish.service.ts        publish/projection rebuild
analytics.service.ts      project/episode analytics
access.repository.ts      Studio/project/member 권한 SQL
project.repository.ts     project/assets/publish history/backup SQL
asset.repository.ts       uploaded asset metadata/history SQL
analytics.repository.ts   project/episode analytics SQL
publish.repository.ts     publish rollback/write SQL
editor.repository.ts      core editor draft/cut/choice SQL
```

### Web 화면과 라우팅

현재 public app 라우트는 다음과 같다.

```text
/                         FeedHomePage
/feed                     FeedHomePage
/c/:channelSlug           ChannelHomePage
/c/:channelSlug/series    ChannelHomePage
/c/:channelSlug/shorts    ChannelHomePage
/c/:channelSlug/community ChannelHomePage
/v/:publishId             PromptoonViewerPage
/v/:publishId/:episodeNo  PromptoonViewerPage
/login                    LoginPage
/register                 RegisterPage
```

현재 studio app 라우트는 다음과 같다.

```text
/promptoon
/promptoon/projects
/promptoon/projects/:projectId
/promptoon/projects/:projectId/members
/promptoon/projects/:projectId/episodes/:episodeId
/studio
/studio/projects
/studio/projects/:projectId
/studio/projects/:projectId/members
/studio/projects/:projectId/episodes/:episodeId
/studio/episodes/:episodeId/editor
```

구현된 화면 기능은 다음과 같다.

- 숏폼 Feed UI: snap scroll, 공개 feed 조회, viewer preload, impression telemetry, like/bookmark/comment/share 진입.
- Channel Home UI: 채널 배너, 프로필, 구독, 통계, 대표 시리즈, 최신 에피소드, 숏드라마, 커뮤니티 메타.
- Viewer UI: publish manifest 감상, 선택지 진행, back/reset, 관련 shorts, 댓글 메타, like/bookmark/share, viewer telemetry.
- Studio UI: project dashboard, project detail, member/permission management, episode 생성, cover upload, editor, validation modal, publish/update publish, unpublish, analytics tab, project analytics summary, backup export.
- Channel 하위 route UI: `/series`, `/shorts`, `/community` 경로에서 같은 `ChannelHomePage`를 재사용하되 active tab과 표시 섹션을 route에 맞게 분기한다.

### PublishManifest와 projection

발행 시 Studio는 draft episode를 publish manifest로 만들고 공개 projection을 갱신한다.

현재 공개 projection 테이블은 다음 흐름을 담당한다.

```text
promptoon_publish
  ├─ channel_id
  └─ series_id

promptoon_feed_item
  └─ FeedItem projection

promptoon_channel_home_projection
  └─ ChannelHome projection
```

현재 projection 갱신은 다음 상황에서 수행된다.

- 신규 publish 생성.
- 기존 publish update.
- unpublish.
- `POST /api/studio/projections/rebuild`.

현재 projection 관련 보조 테이블은 다음 기능을 지원한다.

- `promptoon_channel`: 프로젝트 기반 기본 채널.
- `promptoon_series`: 프로젝트 기반 기본 시리즈.
- `promptoon_short_clip`: 채널 홈의 숏폼 슬롯.
- `promptoon_episode_discussion`: 댓글/커뮤니티 메타.
- `promptoon_comment`: Promptoon 내부 댓글.
- `promptoon_discourse_thread_sync`: Discourse thread 연결/sync 상태.
- `promptoon_asset`: Studio 업로드 에셋 metadata와 현재 버전.
- `promptoon_asset_history`: Studio 에셋 생성/metadata 수정/교체/삭제 이력.
- `promptoon_user_like`: like 상태와 metrics 갱신.
- `promptoon_user_bookmark`: bookmark 상태.
- `promptoon_user_subscription`: channel subscribe 상태.
- `promptoon_telemetry_event`: product telemetry event 저장.

### Shared type 분리

`packages/shared/src/promptoon` 아래에 product domain type 파일이 추가되어 있다.

```text
core.ts
feed.ts
channel.ts
viewer.ts
studio.ts
community.ts
analytics.ts
auth.ts
legacy.ts
index.ts
```

현재 상태는 부분 분리 단계다.

- `ChannelHome`, `FeedItemMetrics`, `TelemetryEventPayload`, role 타입은 domain 파일에 있다.
- 기존 editor/viewer 호환 타입과 interactive manifest 타입은 `legacy.ts`에 남아 있다.
- `PublishManifest`는 legacy/editor 호환을 위해 재export하되, public viewer/client는 `ProductPublishManifest`와 `ProductPublish` 타입을 우선 사용한다.
- `ProductPublishManifest`는 public manifest의 project/episode/cut/choice 구조를 포함하도록 확장했다.
- `FeedItem`, `FeedResponse`, `FeedItemMetrics`의 소유 파일은 `feed.ts`로 정리했다.

### 권한과 인증

현재 인증/권한은 다음 구조로 구현되어 있다.

- JWT Bearer token 기반 인증.
- JWT의 session id가 `promptoon_session`에 살아 있어야 유효한 session으로 본다.
- Studio project 접근은 `promptoon_project_member` role 기반으로 제한한다.
- Studio route 접근은 `/api/auth/me`의 `studioRole`을 확인한 뒤 허용한다.
- project role은 `owner`, `producer`, `writer`, `viewer`로 구분한다.
- read/write/publish 권한은 role별로 다르게 적용한다.
- Studio draft 조회는 read role을 허용하고, episode/cut/choice 편집은 write role을 요구한다.
- publish/update/unpublish는 publish role을 요구한다.
- like/bookmark/subscribe 상태 변경은 인증이 필요하다.
- 공개 Feed/Channel/Viewer 읽기는 인증 없이 가능하다.

### Telemetry

현재 telemetry는 다음 이벤트 흐름을 지원한다.

- Feed impression/open/watch-progress event.
- Viewer session/choice/ending/share 계열 event.
- Channel view event.
- Studio publish event.
- Generic `/api/telemetry/events`와 batch event 저장.

저장 위치는 `promptoon_telemetry_event`이며, 기존 viewer analytics와 호환되는 viewer event 경로도 유지한다.

### Legacy 호환

다음 호환 정책은 유지한다.

- 기존 `/api/promptoon` route는 제거하지 않는다.
- 기존 `/api/promptoon/auth` route도 유지한다.
- `promptoonService`는 deprecated wrapper로 유지한다.
- `projectService`도 deprecated wrapper로 유지하되 내부에서는 `studioApi`를 호출한다.
- 기존 editor/viewer가 의존하는 legacy shared type은 즉시 제거하지 않는다.

## 3. 앞으로 구현할 내용

### Domain service 내부 구현 분리

현재 public domain router들은 domain service를 통해 authoring service가 아니라 product repository/core 모듈에 접근한다.
Feed/Channel/Viewer/Community/Telemetry service는 legacy `promptoon-authoring/promptoon.service`와 `promptoon-authoring/promptoon.repository` 직접 import를 제거했다.

```text
apps/api/src/modules/feed/feed.service.ts
apps/api/src/modules/channel/channel.service.ts
apps/api/src/modules/viewer/viewer.service.ts
apps/api/src/modules/community/community.service.ts
apps/api/src/modules/telemetry/telemetry.service.ts
```

현재 public domain service는 draft 전용 메서드를 직접 노출하지 않는다.
`apps/api/src/modules/promptoon-core`에는 다음 공통 기능을 분리했다.

```text
editor.service.ts       draft editor operation, validation, cut/choice/loop-state mutation
publication.service.ts  manifest 정규화, public publish ref, FeedItem 생성
projection.service.ts   FeedItem/ChannelHome projection 읽기와 갱신
share.service.ts        Viewer/legacy share HTML 생성
product.repository.ts   public product persistence SQL
```

`authorization.service.ts`와 `member.service.ts`는 `studio/access.repository.ts`를 통해 Studio/project/member 권한 SQL에 접근한다.
`project.service.ts`는 project list/create, backup export, asset upload를 repository/upload helper 기반으로 처리한다.
`project.service.ts`는 project settings 수정, project asset library 조회, upload metadata/history, asset replace/delete, publish history 조회도 담당한다.
project list/create/update/assets/publish history/backup SQL은 `studio/project.repository.ts`로 이동했다.
`publish.service.ts`는 publish/update/unpublish에 더해 publish diff, version compare, rollback 발행을 제공한다.
`analytics.service.ts`는 project/episode analytics와 reset을 viewer event repository 기반으로 처리한다.
`promptoon-core/editor.service.ts`는 create/update episode, draft 조회, validation, cut/choice 편집, reorder/layout, loop-state setting 구현을 담당한다.
`studio/editor.service.ts`는 read/write role 확인 후 core editor service를 호출하는 권한 adapter로 축소했다.
API integration 테스트에는 Studio editor domain route와 legacy `/api/promptoon` route를 교차 사용해 episode/cut/choice/reorder/layout/delete/validate 편집 동작이 같은 draft 상태로 수렴하는지 확인하는 호환성 케이스를 추가했다.
loop-state setting route도 Studio와 legacy route가 같은 seed 구조에서 동일한 loop cut/choice 구조를 생성하는지 비교하는 호환성 케이스를 추가했다.
`TEST_DATABASE_URL`이 있는 환경에서 API integration suite를 실행해 실제 DB 기반 route 호환성을 검증했다.
검증 중 analytics 선택 통계 응답에서 `avgHesitationMs`가 누락되는 문제를 수정했고, legacy analytics와 Studio analytics가 같은 선택 지연 시간 필드를 보존하도록 맞췄다.
추가로 Studio project settings/assets/publish history API와 Community embed API를 실제 DB integration test에 포함했다.
이번 단계에서는 `promptoon-core/product.repository.ts`가 더 이상 `promptoon-authoring/promptoon.repository.ts`를 위임 import하지 않도록 product SQL을 물리 이동했다.
Community 댓글 CRUD, moderation, Discourse sync와 Studio asset metadata/history, replace/delete, publish diff/compare/rollback도 DB integration test에 포함했다.
추가로 Studio project/member/authorization persistence를 `studio/access.repository.ts`, `studio/project.repository.ts`, `studio/asset.repository.ts`로 분리해 `authorization.service.ts`, `member.service.ts`, `project.service.ts`의 `promptoon-authoring/promptoon.repository.ts` 직접 import를 제거했다.
추가로 `studio/analytics.repository.ts`, `studio/publish.repository.ts`, `promptoon-core/editor.repository.ts`를 추가해 `analytics.service.ts`, `publish.service.ts`, `promptoon-core/editor.service.ts`의 `promptoon-authoring/promptoon.repository.ts` 직접 import를 제거했다.

### Shared type 추가 정리

- `ChannelHome`은 `channel.ts` 소유를 유지한다.
- `ProductPublishManifest`는 public/product projection용 타입으로 유지한다.
- 기존 interactive viewer/editor용 `PublishManifest`는 호환을 위해 유지한다.
- 신규 domain API/client code는 domain 파일의 type을 우선 사용한다.
- `promptoon-core/product.repository.ts`는 public product persistence SQL을 직접 소유한다.
- `studio/access.repository.ts`, `studio/project.repository.ts`, `studio/asset.repository.ts`는 Studio 권한/project/assets persistence SQL을 직접 소유한다.
- `studio/analytics.repository.ts`는 analytics 집계와 reset용 viewer event SQL을 직접 소유한다.
- `studio/publish.repository.ts`는 rollback 발행에 필요한 publish version/write SQL을 직접 소유한다.
- `promptoon-core/editor.repository.ts`는 episode draft, cut/choice mutation, reorder/layout용 editor SQL을 직접 소유한다.
- legacy `/api/promptoon` 호환을 위해 `promptoon-authoring/promptoon.repository.ts`는 당분간 유지한다. 신규 Studio/Core service는 dedicated repository를 우선 사용한다.

### Domain API 보강 후보

- `GET /api/studio/backup/export`는 추가되었고, 기존 legacy backup export와 함께 유지한다.
- `GET /api/viewer/publishes/:publishId/share?e=:endingCutId`는 추가되었고, 기존 legacy share route와 함께 유지한다.
- `GET /api/community/publishes/:publishId/comments`는 공개 댓글 목록을 제공한다.
- `POST /api/community/publishes/:publishId/comments`는 인증 사용자 댓글을 생성한다.
- `PATCH /api/community/comments/:commentId`, `DELETE /api/community/comments/:commentId`는 댓글 작성자 또는 moderator 권한으로 댓글을 수정/삭제한다.
- `POST /api/community/comments/:commentId/moderation`은 project owner/producer/writer가 댓글 상태를 `visible`, `hidden`, `deleted`로 변경한다.
- `POST /api/community/publishes/:publishId/discourse-sync`는 Discourse topic sync 상태를 저장한다.
- `PATCH /api/studio/projects/:projectId/assets/:assetId`, `DELETE /api/studio/projects/:projectId/assets/:assetId`, `POST /api/studio/projects/:projectId/assets/:assetId/replace`는 Studio asset metadata/delete/replace history를 기록한다.
- `GET /api/studio/projects/:projectId/publishes/:publishId/diff`, `GET /api/studio/projects/:projectId/publishes/:fromPublishId/compare/:toPublishId`, `POST /api/studio/projects/:projectId/publishes/:publishId/rollback`은 publish version diff/compare/rollback을 제공한다.
- 다음 단계에서는 Studio/Viewer domain API를 기준으로 문서와 외부 호출 예시를 더 정리한다.

### Studio 화면 분리 후보

현재 Studio는 dashboard/editor를 유지하면서 독립 route alias를 추가했다.

- `/studio/projects/:projectId` -> Studio project detail page.
- `/studio/projects/:projectId/series` -> Studio series page.
- `/studio/projects/:projectId/members` -> Studio member/permission management page.
- `/studio/projects/:projectId/publish` -> Studio publish page.
- `/studio/projects/:projectId/settings` -> Studio project settings page.
- `/studio/projects/:projectId/assets` -> Studio asset library page.
- `/studio/projects/:projectId/history` -> Studio publish history page.
- `/studio/projects/:projectId/analytics` -> Studio analytics summary page.
- `/promptoon/projects/:projectId/*` legacy studio alias도 같은 페이지군을 사용한다.

초기 구현에서는 기존 editor/dashboard 기능을 유지하면서 route alias와 화면 책임을 분리했다.
project setting, asset library, publish history page는 독립 페이지로 구현했다.
asset upload history의 영속 저장과 publish별 diff/rollback API는 구현했다.
다음 후보는 project-level community moderation dashboard와 asset metadata/history UI 편집 기능이다.

### Community embed와 관리 흐름

Community는 comments meta에 더해 public embed route와 Studio moderation route를 제공한다.

```text
GET /api/community/publishes/:publishId/embed
/community/publishes/:publishId
/studio/community/publishes/:publishId
```

기본 provider는 `promptoon` 내부 embed이며, Discourse sync 상태가 `synced`이면 embed contract의 provider가 `discourse`로 전환된다.
댓글은 공개 목록, 인증 작성, 작성자 수정/삭제, project role 기반 moderation을 지원한다.

### 테스트 보강

- domain router와 legacy router 응답 호환 테스트를 계속 보강한다.
- Studio domain endpoint 기반 project/dashboard 테스트를 추가한다.
- Studio member role, publish permission, project analytics domain route integration test를 유지한다.
- Viewer domain share endpoint와 legacy share endpoint의 동일 동작을 검증한다.
- Channel 하위 route별 active tab/section 표시를 검증한다.
- Studio settings/assets/history route와 API client를 검증한다.
- Community embed API/client와 Studio moderation route를 검증한다.
- domain router가 authoring service를 직접 import하지 않고 public service가 Studio-only operation을 export하지 않는 정적 boundary test를 유지한다.
- public service가 legacy authoring service를 import하지 않는 boundary test를 유지한다.
- Studio facade가 authoring service를 직접 import하지 않고 dedicated service를 통하도록 하는 boundary test를 유지한다.
- Feed/Channel public read가 projection service를 통해 동작하는 boundary test를 유지한다.
- Studio 독립 route, members route, analytics tab deep link boundary test를 유지한다.
- `TEST_DATABASE_URL`을 설정한 API integration test는 2026-05-06 기준 95개 통과 상태다.
- Web test는 2026-05-06 기준 171개 통과 상태다.
- workspace `pnpm test`는 2026-05-06 기준 API non-integration 43개, Web 171개 통과 상태다.

## 4. 제외 범위

이번 제품 구현 범위에서는 다음 항목을 구현하지 않는다.

- AI 컷 생성 엔진.
- 실제 컷 생성 파이프라인.
- Concept Registry.
- Camera State.
- Focus Resolver.
- Prompt Compiler.
- Flux/I2I adapter.
- Reference Weight.
- 중요도 기반 자동 연출.
- 자동 연출/중요도 기반 카메라 규칙.
- 실패 컷 로그 기반 수정 루프.
- Validation Auto Repair.
- Auto Repair.

주의 사항:

- `CutState`와 episode validation은 현재 기존 인터랙티브 에디터 호환 기능으로 남아 있다.
- 위 기능들은 AI 생성 엔진의 Concept Registry/Prompt Compiler/Auto Repair 계열로 확장하지 않는다.
- 신규 Feed/Channel/Viewer product projection의 핵심 계약으로 `CutState`를 확대하지 않는다.

## 5. 검증 기준

문서 기준으로 다음 조건을 만족해야 한다.

- 공개 app은 Feed -> Channel -> Viewer 흐름을 제공한다.
- Studio는 project/episode/editor/publish/member/analytics 관리 흐름을 제공한다.
- Feed는 draft table을 직접 읽지 않고 published projection을 읽는다.
- Viewer는 published manifest를 읽는다.
- Channel은 public channel home projection을 읽는다.
- Studio만 draft와 publish를 모두 관리한다.
- domain API와 legacy API는 필요한 기간 동안 함께 동작한다.
- 신규 구현은 domain API를 우선 사용한다.
- `/api/promptoon` 제거는 별도 마이그레이션 계획 없이 진행하지 않는다.

현재 문서 작성 시점의 기본 검증 명령은 다음과 같다.

```bash
pnpm test
```

API integration test를 포함하려면 `TEST_DATABASE_URL`을 설정한 뒤 API 테스트를 실행한다.

```bash
POSTGRES_ADMIN_USER=promptoon_user node scripts/setup-api-integration-db.mjs
TEST_DATABASE_URL='postgresql://promptoon_test_user:promptoon_test_password@localhost:5436/promptoon_test' pnpm --filter @promptoon/api test
```

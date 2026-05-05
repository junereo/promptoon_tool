# Promptoon MVP Workspace

Promptoon Authoring MVP를 위한 `pnpm` 모노레포입니다.

- `apps/api`: Express + PostgreSQL 기반 authoring API
- `apps/web`: Vite + React 기반 episode editor
- `packages/shared`: 공용 타입

## 요구 사항

- Node.js 20+
- `pnpm`
- Docker

## 빠른 시작

### 1. 의존성 설치

```bash
pnpm install
```

### 2. 환경 변수 준비

루트 기준:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

기본값으로도 동작하도록 되어 있지만, 로컬 환경을 명시적으로 맞추려면 위 파일들을 만들어 두는 편이 안전합니다.

중요:

- `DATABASE_URL`은 실제 개발 데이터용 DB입니다.
- `TEST_DATABASE_URL`은 API 통합 테스트 전용 DB입니다.
- 두 값을 같은 DB로 두면 테스트가 개발 데이터를 삭제합니다.

## 데이터베이스 실행

기본 PostgreSQL 포트는 `5432`입니다.

```bash
pnpm run db:up
```

호스트에서 `5432`가 이미 사용 중이면 포트를 바꿔 실행합니다.

```bash
POSTGRES_PORT=5436 docker compose up -d postgres
```

종료:

```bash
pnpm run db:down
```

로그 확인:

```bash
pnpm run db:logs
```

## 마이그레이션

기본 포트 `5435` 사용 시:

```bash
pnpm run migrate:api
```

포트를 `5435`으로 올렸다면:

```bash
DATABASE_URL='postgresql://promptoon_user:promptoon_password@localhost:5435/promptoon_db' pnpm --filter @promptoon/api migrate
```

## 개발 서버 실행

### API

```bash
pnpm run dev:api
```

기본 주소:

- `http://127.0.0.1:4000`
- Health check: `http://127.0.0.1:4000/health`

### Web

```bash
pnpm --filter @promptoon/web dev
```

기본 주소:

- `http://127.0.0.1:5173`

Vite는 `/api` 요청을 기본적으로 `http://127.0.0.1:4000`으로 프록시합니다.

## 에디터 접속 경로

웹 에디터 라우트는 아래 형태입니다.

```text
/promptoon/projects/:projectId/episodes/:episodeId
```

예시:

```text
http://127.0.0.1:5173/promptoon/projects/<projectId>/episodes/<episodeId>
```

프로젝트/에피소드 생성은 현재 API로 먼저 만들어야 합니다.

## 주요 명령어

전체 빌드:

```bash
pnpm build
```

전체 테스트:

```bash
pnpm test
```

API 테스트만:

```bash
pnpm run test:api
```

API 통합 테스트는 `TEST_DATABASE_URL`이 설정된 경우에만 실행됩니다.

로컬 Docker Postgres 테스트 DB를 준비한 뒤 실행합니다.

```bash
pnpm run test:api:integration:setup
TEST_DATABASE_URL='postgresql://promptoon_test_user:promptoon_test_password@localhost:5436/promptoon_test' pnpm run test:api:integration
```

Web 테스트만:

```bash
pnpm run test:web
```

## API 개요

Legacy base path:

```text
/api/promptoon
```

Product domain base paths:

```text
/api/auth
/api/feed
/api/channels
/api/viewer
/api/studio
/api/community
/api/telemetry
```

Legacy 주요 엔드포인트:

- `GET /projects`
- `POST /projects`
- `POST /projects/:projectId/episodes`
- `GET /episodes/:episodeId/draft`
- `POST /episodes/:episodeId/cuts`
- `PATCH /episodes/:episodeId/cuts/reorder`
- `PATCH /cuts/:cutId`
- `DELETE /cuts/:cutId`
- `POST /cuts/:cutId/choices`
- `PATCH /choices/:choiceId`
- `DELETE /choices/:choiceId`
- `POST /episodes/:episodeId/validate`
- `POST /projects/:projectId/publish`

Studio projection repair:

- `POST /api/studio/projections/rebuild`
- 인증 필요
- 기존 `promptoon_publish.id`와 manifest를 유지하면서 default channel/series를 보강하고 `promptoon_feed_item`, `promptoon_channel_home_projection`, `promptoon_episode_discussion`을 idempotent upsert로 재생성합니다.
- 이미 발행된 에피소드를 다시 publish하지 않고 public Feed/Channel/Viewer 흐름에 노출해야 할 때 사용합니다.

Public interactions:

- `GET /api/feed/state?publishIds=...`
- `POST|DELETE /api/feed/publishes/:publishId/like`
- `POST|DELETE /api/feed/publishes/:publishId/bookmark`
- `GET /api/channels/:channelId/subscription`
- `POST|DELETE /api/channels/:channelId/subscribe`
- `GET /api/viewer/publishes/:publishId/state`
- 공개 Feed/Channel/Viewer 읽기는 인증 없이 유지하고, like/bookmark/subscribe 상태 변경은 active session이 필요합니다.
- like/unlike는 `promptoon_feed_item.metrics_json.likes`와 channel home `likeCount` projection을 갱신합니다.

Auth / role:

- 인증은 JWT Bearer 토큰을 사용하며 JWT의 session id가 `promptoon_session`에 살아 있어야 합니다.
- `POST /api/auth/logout`은 현재 session만 만료합니다.
- Studio project 접근은 `promptoon_project_member` role 기반입니다.
- `GET /api/studio/projects/:projectId/members`
- `POST /api/studio/projects/:projectId/members`
- `PATCH /api/studio/projects/:projectId/members/:userId`
- `DELETE /api/studio/projects/:projectId/members/:userId`
- Google OAuth는 scaffold 상태이며 실제 provider 설정은 별도 작업입니다.

## 검증된 상태

다음 항목 기준으로 검증했습니다.

- `pnpm build` 성공
- `pnpm test` 성공
- PostgreSQL 연결 상태에서 `pnpm --filter @promptoon/api test` 성공

## 참고

- Tailwind는 다크 모드 강제(`darkMode: 'class'`) 설정입니다.
- reorder 저장은 배치 API로 처리됩니다.
- 필드 편집은 optimistic update + autosave 전략을 사용합니다.

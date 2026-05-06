# 아키텍처 명세서

Promptoon은 `pnpm` workspace 기반 모노레포입니다. 현재 구현은 초기 authoring MVP에서 확장되어 public product surface, Studio authoring, Admin 운영 콘솔, Community/Discourse 연동을 함께 포함합니다.

## 1. Workspace 구성

- `apps/web`: 사용자용 Web 앱. public feed/channel/viewer/community와 Studio authoring 화면을 함께 제공.
- `apps/admin`: platform admin 전용 운영 콘솔.
- `apps/api`: Express + PostgreSQL API 서버.
- `packages/shared`: 프론트엔드와 백엔드가 공유하는 TypeScript 타입.

공유 타입은 `@promptoon/shared` workspace 패키지로 연결됩니다. Vite 앱은 alias로 `packages/shared/src/index.ts`를 직접 참조합니다.

## 2. Frontend

### 2.1. Web App

- 위치: `apps/web`
- 주요 스택: React 19, Vite 5, TypeScript, React Router, TanStack Query, Zustand, Tailwind CSS 4, React Flow, dnd-kit, Recharts
- 개발 서버: `http://127.0.0.1:5173`
- API proxy: `/api`, `/uploads` -> `VITE_API_PROXY_TARGET` 또는 `http://127.0.0.1:4000`

디렉터리는 FSD와 product-domain 구조가 함께 쓰입니다.

- `app/`: router, query client, bootstrap.
- `domains/`: product domain 화면. `feed`, `channel`, `viewer`, `studio`, `community`.
- `features/`: 인증, 에디터, 분석, viewer telemetry 등 기능 단위 상태/훅.
- `widgets/`: editor shell, branch canvas, inspector, preview, public viewer/feed UI 등 복합 UI.
- `pages/`: legacy/공통 route page.
- `shared/`: API clients, 유틸리티, 공용 UI.
- `entities/`: selector 등 도메인 보조 모델.

주요 route:

- Public: `/`, `/feed`, `/v/:publishId`, `/v/:publishId/:episodeNo`, `/c/:channelSlug`, `/community/publishes/:publishId`
- Auth: `/login`, `/register`
- Studio: `/promptoon/*`, `/studio/*`

`/promptoon`과 `/studio`는 같은 Studio shell을 공유하며 `ProtectedRoute requireStudio`로 보호됩니다.

### 2.2. Admin App

- 위치: `apps/admin`
- 주요 스택: React 19, Vite 5, TypeScript, TanStack Query, Zustand, Tailwind CSS 4
- 개발 서버: `http://127.0.0.1:5174`
- API proxy: `/api`, `/uploads` -> `VITE_API_PROXY_TARGET` 또는 `http://127.0.0.1:4000`

route:

- `/login`: admin login
- `/`: dashboard
- `/users`: platform role/studio role 관리
- `/projects`: 프로젝트 목록
- `/publishes`: publish 목록
- `/community`: Discourse sync 상태
- `/telemetry`: telemetry summary

Admin API는 `/api/admin/*`에 mount되고 active session과 `platform_admin` 권한이 필요합니다.

## 3. Backend

- 위치: `apps/api`
- 주요 스택: Node.js 20+, Express 4, TypeScript, PostgreSQL, Zod, JWT, bcryptjs, multer, sharp
- 기본 포트: `4000`
- Health check: `GET /api/health`
- 정적 업로드: `/uploads`가 workspace `.data/uploads`와 `apps/api/.data/uploads`를 순서대로 serve합니다.

API는 `apps/api/src/app/createApp.ts`에서 mount됩니다.

- `/api/auth`: register/login/session/refresh/logout/OAuth
- `/api/admin`: platform admin 운영 API
- `/api/feed`: public feed와 like/bookmark/feed telemetry
- `/api/channels`: channel home, series, episodes, shorts, subscription
- `/api/viewer`: published viewer manifest, share page, viewer state/continue
- `/api/studio`: authoring, asset, publish, analytics, member, projection repair
- `/api/community`: DB comment, discussion, Discourse bridge
- `/api/telemetry`: generic/viewer/batch telemetry
- `/api/promptoon/auth`: auth 호환 mount
- `/api/promptoon`: legacy authoring/public 호환 API

모듈은 controller 파일을 별도로 두지 않고 `routes -> service -> repository` 흐름을 사용합니다.

- `modules/*/*.routes.ts`: Express 라우팅, 인증 middleware, Zod parse.
- `modules/*/*.service.ts`: 권한 확인, 트랜잭션, 도메인 orchestration.
- `modules/*/*.repository.ts`: PostgreSQL query.
- `modules/promptoon-core`: product domain에서 공유하는 public/projection repository와 service.
- `modules/promptoon-authoring`: legacy authoring service와 schema/validator. Studio service가 일부 구현을 재사용합니다.

## 4. Auth와 권한

인증은 JWT access token과 refresh token을 사용합니다. 토큰은 JSON response와 httpOnly cookie에 함께 내려가며, `Authorization: Bearer <token>`도 지원합니다.

- JWT에는 `sid`가 포함됩니다.
- `requireAuth`는 JWT 검증 후 `promptoon_session` row가 존재하고 만료되지 않았는지 확인합니다.
- `POST /api/auth/logout`은 현재 session만 만료합니다.
- `POST /api/auth/refresh`는 body `refreshToken`, `x-refresh-token` header, refresh cookie 순서로 token을 찾습니다.
- Google OAuth는 501 scaffold 상태입니다.
- Kakao OAuth는 `/api/auth/kakao/start`, `/api/auth/kakao/callback`로 구현되어 있습니다.

권한은 두 층입니다.

- Platform admin: `promptoon_platform_admin`, Admin 콘솔 접근에 필요.
- Studio/project role: `studio_admin`, `owner`, `producer`, `writer`, `viewer`.

Project role 정책:

- `owner | producer | writer | viewer`: 프로젝트 목록/읽기
- `owner | producer | writer`: draft/edit/asset/validate
- `owner | producer`: publish/update/unpublish/analytics reset
- `owner`: project member 관리
- `studio_admin`: Studio maintenance API 접근용이며 project membership을 자동 우회하지 않습니다.

## 5. Database

PostgreSQL은 `pg.Pool`로 연결됩니다. Vitest 실행 중이고 `TEST_DATABASE_URL`이 있으면 테스트 DB를 사용하고, 그 외에는 `DATABASE_URL`을 사용합니다.

마이그레이션은 `apps/api/src/db/migrations/*.sql`을 번호순으로 실행합니다. 현재 migration 범위는 `001_init_promptoon.sql`부터 `024_promptoon_platform_admin.sql`까지입니다.

주요 schema 축:

- authoring: project, episode, cut, choice, publish
- auth/session/role: user, session, refresh token, project member, studio member, platform admin
- public product: feed item projection, channel, series, channel home projection, short clip
- interaction: like, bookmark, subscription, viewer event, telemetry event
- community: episode discussion, DB comment, Discourse sync
- asset/publish history: project asset, asset history, publish history/diff/rollback support

## 6. Shared Package

`packages/shared/src/promptoon/*`는 domain별 타입을 나눠 export합니다.

- `legacy.ts`: Project/Episode/Cut/Choice/Publish, editor request/response, validation, legacy analytics
- `core.ts`: product publish manifest와 public cut/choice/content block 타입
- `auth.ts`: auth session/me response
- `studio.ts`: project role, member, asset, publish history/diff/rollback, projection repair 타입
- `admin.ts`: platform admin response 타입
- `feed.ts`, `channel.ts`, `viewer.ts`, `community.ts`, `analytics.ts`: public product 및 analytics 타입

API request validation의 소스는 `apps/api/src/modules/promptoon-authoring/promptoon.schemas.ts`입니다.

## 7. Network와 배포 메모

로컬 기본 포트:

- API: `4000`
- Web: `5173`
- Admin: `5174`
- PostgreSQL: `5432`

Web/Admin dev server는 `/api`와 `/uploads`를 API 서버로 proxy합니다. 운영 배포에서는 API origin, cookie domain/SameSite/Secure 설정, `CLIENT_REDIRECT_URL`, `ADMIN_CLIENT_REDIRECT_URL`, OAuth redirect URI, `APP_ORIGIN` 또는 reverse proxy host header를 함께 맞춰야 합니다.

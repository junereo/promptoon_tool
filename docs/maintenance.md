# 유지보수 및 운영 가이드

이 문서는 Promptoon workspace의 로컬 개발, DB 마이그레이션, 테스트, 운영성 작업을 정리합니다.

## 1. 사전 요구 사항

- Node.js 20+
- `pnpm` 10.x (`packageManager`는 `pnpm@10.4.1`)
- Docker와 Docker Compose
- PostgreSQL client는 필수는 아니지만 DB 확인/운영에는 유용합니다.

## 2. 초기 셋팅

### 2.1. 패키지 설치

```bash
pnpm install
```

### 2.2. 환경 변수

기본 템플릿:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

현재 저장소에는 `apps/admin/.env.example`이 없습니다. Admin 앱은 필요 시 `apps/admin/.env`에 `VITE_API_PROXY_TARGET=http://127.0.0.1:4000`처럼 Vite env를 둘 수 있고, 기본 proxy target은 코드에서 `http://127.0.0.1:4000`입니다.

중요 변수:

- `DATABASE_URL`: 개발 DB.
- `TEST_DATABASE_URL`: API 테스트 DB. 개발 DB와 절대 같게 두지 않습니다.
- `JWT_SECRET`, `JWT_REFRESH_SECRET`: access/refresh token 서명.
- `JWT_ISSUER`, `JWT_AUDIENCE`: JWT 검증 옵션.
- `JWT_ACCESS_TOKEN_EXPIRES_IN`, `JWT_REFRESH_TOKEN_EXPIRES_IN`, `JWT_REFRESH_TOKEN_TTL_DAYS`: token/session 만료 정책.
- `CLIENT_REDIRECT_URL`: Web OAuth/login redirect.
- `ADMIN_CLIENT_REDIRECT_URL`: Admin OAuth redirect.
- `PROMPTOON_PLATFORM_ADMIN_LOGIN_IDS`: admin bootstrap 대상 loginId 목록.
- `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET`, `KAKAO_REDIRECT_URI`: Kakao OAuth.
- `DISCOURSE_BASE_URL`, `DISCOURSE_API_KEY`, `DISCOURSE_API_USER`, `DISCOURSE_CATEGORY_ID`, `DISCOURSE_ORIGIN`: Discourse bridge.
- `PORT`: API 서버 포트, 기본 `4000`.
- `VITE_API_PROXY_TARGET`: Web/Admin dev proxy target.

## 3. 로컬 DB

PostgreSQL은 `docker-compose.yml`의 `postgres:15-alpine` 컨테이너를 사용합니다.

```bash
pnpm run db:up
pnpm run db:logs
pnpm run db:down
```

기본 포트는 `5432`입니다. 충돌하면 포트를 바꿔 실행합니다.

```bash
POSTGRES_PORT=5435 docker compose up -d postgres
```

포트를 바꾼 경우 `.env`, `apps/api/.env`, 테스트 실행 시 `DATABASE_URL`/`TEST_DATABASE_URL`도 같은 포트로 맞춥니다.

## 4. 마이그레이션

```bash
pnpm run migrate:api
```

커스텀 DB URL:

```bash
DATABASE_URL='postgresql://promptoon_user:promptoon_password@localhost:5435/promptoon_db' pnpm --filter @promptoon/api migrate
```

마이그레이션 파일은 `apps/api/src/db/migrations`에 있으며 현재 `001_init_promptoon.sql`부터 `024_promptoon_platform_admin.sql`까지 번호순으로 적용됩니다.

## 5. 개발 서버

API:

```bash
pnpm run dev:api
```

- 기본 주소: `http://127.0.0.1:4000`
- Health check: `http://127.0.0.1:4000/api/health`

Web:

```bash
pnpm --filter @promptoon/web dev
```

- 기본 주소: `http://127.0.0.1:5173`
- public feed: `/`
- Studio: `/studio/projects` 또는 `/promptoon/projects`

Admin:

```bash
pnpm run dev:admin
```

- 기본 주소: `http://127.0.0.1:5174`
- login: `/login`

Web/Admin Vite dev server는 `/api`와 `/uploads`를 API 서버로 proxy합니다.

## 6. 빌드와 테스트

전체:

```bash
pnpm build
pnpm test
pnpm run typecheck
```

앱별:

```bash
pnpm run test:api
pnpm run test:web
pnpm run test:admin
pnpm run build:admin
```

API 통합 테스트용 DB 준비:

```bash
pnpm run test:api:integration:setup
TEST_DATABASE_URL='postgresql://promptoon_test_user:promptoon_test_password@localhost:5436/promptoon_test' pnpm run test:api:integration
```

`test:api:integration:setup`은 `TEST_DATABASE_URL`의 database를 drop/create합니다. 개발 DB와 같은 URL을 사용하지 않습니다.

## 7. 프론트엔드 아이콘

Web/Admin의 UI 아이콘은 [coolicons](https://github.com/krystonschwarze/coolicons)를 기준으로 사용합니다.

- React 컴포넌트는 `react-coolicons`에서 import합니다.
- 새 아이콘을 추가할 때는 `lucide-react`나 직접 작성한 인라인 SVG 대신 coolicons 이름을 먼저 찾습니다.
- coolicons에 같은 이름이 없으면 의미가 가장 가까운 아이콘을 alias로 import합니다.

## 8. 운영성 작업

### 8.1. Projection repair

기존 publish 데이터가 public feed/channel/viewer surface에 보이지 않으면 Studio 인증 token으로 projection repair를 실행합니다.

```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  http://127.0.0.1:4000/api/studio/projections/rebuild
```

이 작업은 기존 `promptoon_publish.id`와 manifest를 유지하고, default channel/series, feed item, channel home projection, episode discussion projection만 idempotent하게 보강합니다.

### 8.2. Auth/session 점검

- JWT만으로는 인증되지 않습니다. JWT의 `sid`가 가리키는 `promptoon_session` row가 활성 상태여야 합니다.
- `POST /api/auth/logout`은 현재 session만 삭제합니다.
- refresh token은 `/api/auth/refresh`에서 body, `x-refresh-token`, cookie 순서로 읽습니다.
- admin 접근은 active session과 `platform_admin` 권한이 모두 필요합니다.
- `PROMPTOON_PLATFORM_ADMIN_LOGIN_IDS`를 사용하면 특정 loginId를 admin 접근 시 bootstrap할 수 있습니다.

### 8.3. Upload 경로

API는 업로드를 우선 workspace `.data/uploads`에 쓰고, 권한 문제가 있으면 `apps/api/.data/uploads`로 폴백합니다. 정적 serve는 두 경로를 모두 `/uploads`에 mount합니다.

루트 `.data` 권한 문제를 해결하려면:

```bash
sudo chown -R "$USER:$USER" .data
```

### 8.4. Discourse 연동

Discourse bridge를 사용하려면 아래 값이 필요합니다.

- `DISCOURSE_BASE_URL`
- `DISCOURSE_API_KEY`
- `DISCOURSE_API_USER`
- `DISCOURSE_CATEGORY_ID`

DB-backed comment/comment-meta endpoint는 Discourse 설정 없이 사용할 수 있습니다. 외부 Discourse topic/post API는 설정이 없으면 정상 호출할 수 없습니다.
Discourse API key는 API 서버 환경 변수로만 설정합니다. 로컬에서는 `apps/api/.env`에 두고 API 서버를 재시작합니다. `apps/web/.env` 또는 `VITE_DISCOURSE_API_KEY`처럼 웹 번들에 포함되는 값으로 설정하지 않습니다.
개발 모드에서 `DISCOURSE_API_KEY`만 있고 `DISCOURSE_BASE_URL`이 비어 있으면 API 서버는 로컬 Discourse 기본 주소 `http://127.0.0.1:3000`을 사용합니다.

## 9. 트러블슈팅

1. API health check가 실패할 때
   - `pnpm run dev:api`가 실행 중인지 확인합니다.
   - 경로는 `/health`가 아니라 `/api/health`입니다.
   - `PORT`를 바꿨다면 Vite `VITE_API_PROXY_TARGET`도 함께 변경합니다.

2. Web/Admin에서 API 요청이 404 또는 CORS처럼 보일 때
   - `apps/web/vite.config.ts`, `apps/admin/vite.config.ts`의 proxy target을 확인합니다.
   - API 서버가 `http://127.0.0.1:4000` 또는 설정한 target에서 떠 있는지 확인합니다.

3. 테스트 중 개발 데이터가 삭제됐을 때
   - `TEST_DATABASE_URL`이 `DATABASE_URL`과 같은 database를 가리키지 않는지 확인합니다.
   - 통합 테스트 setup은 테스트 DB를 drop/create합니다.

4. Studio 접근이 막힐 때
   - `/api/auth/me` 응답의 session과 `studioRole`을 확인합니다.
   - 프로젝트 편집은 project membership role도 필요합니다.

5. Admin 접근이 막힐 때
   - `/api/admin/me`를 호출해 platform admin 권한을 확인합니다.
   - bootstrap loginId는 `PROMPTOON_PLATFORM_ADMIN_LOGIN_IDS`에 설정합니다.

6. Public feed/channel에 publish가 안 보일 때
   - publish가 존재하는지 확인한 뒤 projection repair를 실행합니다.
   - like metrics/channel home projection은 interaction write 후 갱신됩니다.

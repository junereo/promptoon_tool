# 유지보수 및 운영 가이드 (Maintenance)

이 문서는 Promptoon Authoring MVP 프로젝트의 로컬 개발 환경 셋팅, 스크립트 실행 방법 및 트러블슈팅에 대해 안내합니다.

## 1. 사전 요구 사항 (Prerequisites)

- Node.js 20+ 이상 버전 권장.
- `pnpm` (버전 10.x 대 권장, 저장소는 `10.4.1` 기준으로 세팅됨).
- [Docker](https://www.docker.com/) & Docker Compose (로컬 PostgreSQL 실행용).

## 2. 초기 셋팅

### 2.1. 패키지 설치

루트 디렉토리에서 아래 명령어를 실행하여 모노레포 전체 워크스페이스 의존성을 설치합니다.

```bash
pnpm install
```

### 2.2. 환경 변수 설정 (.env)

레포지토리에 존재하는 `.env.example` 템플릿 파일들을 복사하여 실제 `.env` 파일들을 각각 생성해 줍니다.

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

**주의**: `.env` 내부의 `DATABASE_URL` (로컬 개발용)과 `TEST_DATABASE_URL` (API 통합 테스트용)은 절대로 동일한 데이터베이스 스키마를 바라보지 않도록 분리해야 합니다 (테스트가 이전 데이터를 삭제할 수 있습니다).

## 3. 실행 방법

### 3.1. 베이스 인프라 (DB) 실행

```bash
# Docker DB 실행 (백그라운드 포트 5432)
pnpm run db:up

# 로그 확인
pnpm run db:logs

# DB 종료
pnpm run db:down
```

포트 충돌(`5432` 포트 이미 사용중) 발생 시:
```bash
POSTGRES_PORT=5435 docker compose up -d postgres
```
이후 `.env` 파일들의 포트 설정을 `5435` 등으로 변경해주어야 합니다.

### 3.2. 데이터베이스 마이그레이션

DB 컨테이너가 뜬 상태에서, 애플리케이션에 필요한 테이블들을 생성합니다.

```bash
# 기본 마이그레이션 실행
pnpm run migrate:api

# 커스텀 포트/환경 사용 시
DATABASE_URL='postgresql://promptoon_user:promptoon_password@localhost:5435/promptoon_db' pnpm --filter @promptoon/api migrate
```

### 3.3. 서버 리스닝 (개발 모드)

터미널 세션을 2개 띄워서 프론트엔드와 백엔드를 각각 실행하는 것을 권장합니다 (`pnpm --parallel` 활용도 가능).

**API 서버**:
```bash
pnpm run dev:api
```
- API는 `http://127.0.0.1:4000` 에서 실행.
- 상태 확인(Health Check): `http://127.0.0.1:4000/health`

**프론트엔드 (Web)**:
```bash
pnpm --filter @promptoon/web dev
```
- 웹 에디터는 `http://127.0.0.1:5173` 기반으로 구동됨.

## 4. 빌드 및 테스트

**전체 워크스페이스 빌드**:
```bash
pnpm build
```

**테스트**:
```bash
# 전체 테스트 실행
pnpm test

# API만 실행
pnpm --filter @promptoon/api test

# Web만 실행
pnpm --filter @promptoon/web test
```
*API 통합 테스트는 `TEST_DATABASE_URL`이 명시적으로 설정되어 있어야만 동작합니다.*

## 5. 트러블슈팅

1. **프론트 API 요청이 실패할 경우 (CORS / 404 등)**:
    - Vite 구동 포트(`5173`)와 별개로, Vite 프록시 설정이 `http://127.0.0.1:4000` 을 향하고 있는지 확인하세요(`vite.config.ts`).
    - API 서버(`apps/api`)가 정상적으로 4000 포트에서 실행 중인지 체크하세요.

2. **`pnpm test` 중 데이터 삭제 오류**:
    - `API`의 `TEST_DATABASE_URL` 환경변수가 `DATABASE_URL`과 같은 주소로 물려있어 개발 데이터를 지운 것은 아닌지 확인하세요.

3. **마이그레이션 에러**:
    - DB 컨테이너가 정상 구동 중인지 `docker ps`로 확인하세요.
    - DB 계정 (`promptoon_user`, `promptoon_password`) 등 `.env`의 접속 정보가 `docker-compose.yml` 환경과 일치하는지 점검하세요.

4. **이미지 업로드 시 `EACCES` 권한 오류**:
    - 루트 `.data` 디렉터리가 `root` 소유일 경우 새 업로드 디렉터리를 만들지 못할 수 있습니다.
    - 현재 API는 우선 루트 `.data/uploads`를 사용하고, 권한이 없으면 자동으로 `apps/api/.data/uploads`로 폴백합니다.
    - 루트 경로를 계속 쓰고 싶다면 소유권을 현재 사용자로 변경하세요.
```bash
sudo chown -R "$USER:$USER" .data
```

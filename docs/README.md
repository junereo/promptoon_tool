# Promptoon 기술 문서

이 디렉터리는 Promptoon workspace의 현재 코드 구조, API, 기능, 운영 절차를 빠르게 파악하기 위한 기술 문서입니다. 현재 저장소에는 `apps/docs` 경로가 없으며, 문서의 기준 경로는 최상위 `docs/`입니다.

## 문서 목록

1. [Architecture](./architecture.md)
   - `apps/web`, `apps/admin`, `apps/api`, `apps/recommendation-api`, `packages/*`의 역할과 모노레포 구조
   - consumer public surface, Studio, Admin, legacy authoring API, Recommendation API의 경계
   - 인증/session, project role, platform admin 권한 모델

2. [API](./api.md)
   - `/api/auth`, `/api/admin`, `/api/feed`, `/api/channels`, `/api/viewer`, `/api/studio`, `/api/community`, `/api/telemetry`
   - 독립 `POST /recommendations/v1/feed` Recommendation API
   - 호환용 `/api/promptoon` endpoint
   - 인증 필요 여부와 주요 request/response 타입 위치

3. [Features](./features.md)
   - consumer home/discovery/library/my, recommendation feed, channel/viewer/community
   - Studio 프로젝트, 에피소드 에디터, publish, analytics, asset/member 관리
   - Admin 콘솔과 Discourse 연동 흐름

4. [Maintenance](./maintenance.md)
   - 로컬 DB, 환경 변수, 마이그레이션, API/Recommendation API/Web/Admin 개발 서버 실행
   - 테스트/빌드 명령
   - projection repair, recommendation fallback, auth/session, upload, Discourse 관련 운영 메모

## 소스 기준

- 앱 workspace: `pnpm-workspace.yaml`
- 실행 스크립트: `package.json`, `apps/*/package.json`
- API mount: `apps/api/src/app/createApp.ts`
- Recommendation API app: `apps/recommendation-api/src/app/createApp.ts`
- API schema: `apps/api/src/modules/promptoon-authoring/promptoon.schemas.ts`
- 공유 타입: `packages/shared/src/promptoon/*`
- 추천 계약/랭커: `packages/recommendation-contract`, `packages/recommendation-rankers`
- Web 라우터: `apps/web/src/app/router.tsx`
- Admin 라우터: `apps/admin/src/app/router.tsx`

문서를 수정할 때는 위 파일을 먼저 확인하고, 구현과 문서가 충돌하면 구현을 기준으로 갱신합니다.

# Promptoon API 문서

이 문서는 Promptoon Authoring MVP의 백엔드 API 명세입니다.

기존 호환 엔드포인트의 기본 경로는 `/api/promptoon` 입니다. Product domain API는 `/api/auth`, `/api/feed`, `/api/channels`, `/api/viewer`, `/api/studio`, `/api/community`, `/api/telemetry`로 분리되어 있습니다.

Product domain router는 각 도메인 `*.service.ts` wrapper만 import합니다. `/api/feed`, `/api/channels`, `/api/viewer`, `/api/community`, `/api/telemetry` 같은 public domain service는 Studio draft/edit 전용 operation을 export하지 않습니다. 기존 authoring service는 아직 내부 구현 공유 계층으로 남아 있지만, router 경계에서는 직접 참조하지 않습니다.

> **인증**: JWT Bearer 토큰을 사용합니다. Public Feed/Channel/Viewer 읽기는 인증 없이 접근 가능하고, Studio 및 구독/댓글/좋아요 계열 쓰기는 로그인이 필요합니다. Google OAuth는 scaffold 상태입니다.
> JWT에는 session id가 포함되며, 해당 session이 `promptoon_session`에 존재하고 만료되지 않아야 인증됩니다.

## 도메인 모델 요약

- **Project**: 최상위 개념, 여러 개의 Episode를 포함.
- **Episode**: 하나의 에피소드, 캔버스 위의 노드(Cut)와 엣지(Choice)로 구성.
- **Cut**: 캔버스 상의 장면 또는 노드. 종류 (`scene`, `choice`, `ending`, `transition`)
- **Choice**: Cut과 Cut을 연결하는 선택지 (선택형 스토리텔링용). 
- **Publish**: 특정 시점의 에피소드를 스냅샷처럼 배포한 상태.

## 주요 엔드포인트

### 1. 프로젝트 (Projects)

- `GET /projects`: 프로젝트 목록 조회
- `POST /projects`: 새 프로젝트 생성
  - **Body**: `{ title: string, description?: string }`
- `POST /projects/:projectId/assets`: 프로젝트 이미지 업로드
  - `multipart/form-data`로 `file` 필드 전송
  - 응답: `{ assetUrl: string }`
- `POST /projects/:projectId/publish`: 프로젝트(특정 에피소드) 배포
  - **Body**: `{ episodeId: string }`

### Product Domain API

- `GET /api/feed/mixed`: `promptoon_feed_item` projection 기반 public feed 조회
- `GET /api/feed/state?publishIds=...`: 로그인 필요, publish별 liked/bookmarked 상태와 projected metrics 조회
- `POST /api/feed/publishes/:publishId/like`, `DELETE /api/feed/publishes/:publishId/like`: 로그인 필요, like 상태와 feed/channel like metrics 갱신
- `POST /api/feed/publishes/:publishId/bookmark`, `DELETE /api/feed/publishes/:publishId/bookmark`: 로그인 필요, private bookmark 상태 갱신
- `GET /api/channels/:channelSlug/home`: channel home projection 우선 조회, 누락 시 public table 기반 rebuild/upsert
- `GET /api/channels/:channelId/subscription`: 로그인 필요, 현재 사용자의 channel subscription 상태 조회
- `POST /api/channels/:channelId/subscribe`: 로그인 필요, 구독 후 channel projection subscriber count 재계산
- `DELETE /api/channels/:channelId/subscribe`: 로그인 필요
- `GET /api/viewer/publishes/:publishId`: published manifest 조회
- `GET /api/viewer/publishes/:publishId/related-shorts`: `promptoon_short_clip` 기반 관련 숏드라마 조회
- `GET /api/viewer/publishes/:publishId/state`: 로그인 필요, viewer action 상태 조회
- `GET /api/community/publishes/:publishId/comments-meta`: DB-backed comment metadata 조회
- `POST /api/telemetry/events`: generic telemetry event 수집
- `POST /api/telemetry/viewer-events`: viewer legacy event와 generic telemetry event 동시 수집
- `GET /api/auth/me`, `POST /api/auth/logout`: session-backed auth 확인 및 로그아웃
- `POST /api/studio/projections/rebuild`: Studio/admin 보호 projection repair. 기존 publish ID와 manifest를 보존하고 default channel/series, feed item, channel home, episode discussion projection을 idempotent하게 복구합니다.

### Studio Project Members

- `GET /api/studio/projects/:projectId/members`: owner 전용 member 목록
- `POST /api/studio/projects/:projectId/members`: owner 전용, `{ loginId, role }`, role은 `producer | writer | viewer`
- `PATCH /api/studio/projects/:projectId/members/:userId`: owner 전용 role 변경
- `DELETE /api/studio/projects/:projectId/members/:userId`: owner 전용 member 제거

Project role 정책:

- `owner | producer | writer | viewer`: project 목록/읽기
- `owner | producer | writer`: draft/edit/asset/validate
- `owner | producer`: publish/update/unpublish/analytics reset
- `owner`: member 관리
- `studio_admin`: Studio maintenance 전용이며 project membership을 우회하지 않음

### 2. 에피소드 (Episodes)

- `POST /projects/:projectId/episodes`: 새 에피소드 생성
  - **Body**: `{ title: string, episodeNo: number }`
- `GET /episodes/:episodeId/draft`: 특정 에피소드의 편집 중인(draft) 데이터 전체 조회 (에피소드 정보, 컷 목록, 선택지 목록 등)
- `POST /episodes/:episodeId/validate`: 에피소드 배포 전 유효성 검사 실행
  - 반환값: `isValid`, `errors`, `warnings` 등 (`ValidationIssue` 형태)

### 3. 컷 (Cuts / Nodes)

- `POST /episodes/:episodeId/cuts`: 에피소드에 새 컷 생성
  - **Body**: `CreateCutRequest` (`kind`, `title`, `positionX`, `positionY` 등)
- `PATCH /episodes/:episodeId/cuts/reorder`: 에피소드 내 컷들의 정렬 순서 한 번에 업데이트 (배치 저장)
  - **Body**: `{ cuts: [{ cutId, orderIndex }] }`
- `PATCH /cuts/:cutId`: 특정 컷의 정보 부분 수정 (optimistic update 처리 권장)
  - **Body**: `PatchCutRequest`
- `DELETE /cuts/:cutId`: 특정 컷 삭제

### 4. 선택지 (Choices / Edges)

- `POST /cuts/:cutId/choices`: 특정 컷에 새 선택지 추가
  - **Body**: `CreateChoiceRequest` (`label`, `nextCutId` 등)
- `PATCH /choices/:choiceId`: 특정 선택지의 정보 수정 (연결 대상 `nextCutId`, 내용 `label` 등)
  - **Body**: `PatchChoiceRequest`
- `DELETE /choices/:choiceId`: 특정 선택지 삭제

## 응답 타입 참고

API에 대한 상세한 Request / Response 인터페이스는 `packages/shared/src/promptoon.ts`에 정의되어 있습니다.

- `ValidationIssueCode`: 'missing_start_cut' | 'unreachable_cut' | 'dead_path' 등 다양한 오류 검출 포함.
- `TelemetryEventRequest`: 사용자 뷰어 이벤트를 수집하기 위한 모델 (`cut_view`, `choice_click` 등).

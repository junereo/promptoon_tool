# Promptoon API 문서

이 문서는 Promptoon Authoring MVP의 백엔드 API 명세입니다.

모든 엔드포인트의 기본 경로는 `/api/promptoon` 입니다.

> **인증**: MVP 버전에서는 `x-user-id` 헤더를 통해 사용자를 식별합니다. (디버그/개발 용도로 사용)

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
- `POST /projects/:projectId/publish`: 프로젝트(특정 에피소드) 배포
  - **Body**: `{ episodeId: string }`

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

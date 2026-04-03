# 아키텍처 명세서 (Architecture)

이 문서는 Promptoon Authoring MVP의 시스템, 패키지 및 애플리케이션 아키텍처를 요약합니다.

## 1. 시스템 구조 개요

- **Monorepo**: `pnpm` workspace를 활용하여 여러 패키지(공유 모듈, 백엔드 서버, 프론트엔드 앱)를 하나의 레포지토리에서 관리.
- **환경 공유**: 공용 타입 스키마(예: Zod validators, TypeScript Interfaces)를 `packages/shared`로 묶어 프론트/백에서 한 곳의 코드로 공유.

## 2. 모듈 구성

### 2.1. 프론트엔드 (Frontend - Web App)

- **위치**: `apps/web`
- **기술 스택**: React 18, Vite, TypeScript, Tailwind CSS
- **아키텍처 패턴**: [Feature-Sliced Design(FSD)](https://feature-sliced.design/)를 기반으로 디렉토리를 분할.
  - `app/`: 애플리케이션 전역 설정, 라우터, 공용 레이아웃 등 최상위 구성.
  - `pages/`: 라우터 레벨에서 매핑되는 페이지 컴포넌트 (`editor-page`, `viewer-page` 등).
  - `widgets/`: 독립적이고 컨텍스트가 결합된 UI 블록 유닛 (예: Canvas Editor Board, Sidebar).
  - `features/`: 특정 사용자 가치(비즈니스 단위)를 제공하는 로직과 UI (예: `editor`, `analytics`, `viewer`).
  - `entities/`: 도메인 단위 (상태, 모델 등).
  - `shared/`: 재사용성 높은 기본 UI 컴포넌트(버튼, 모달), 유틸리티 등.
- **스타일링**: Tailwind CSS 및 다크 모드(`class` 방식)를 기본 적용.

### 2.2. 백엔드 (Backend - API Server)

- **위치**: `apps/api`
- **기술 스택**: Express.js, Node.js 20+, TypeScript
- **아키텍처 패턴**: Controller - Service - Repository 계층형 아키텍처 모듈 기반 설계.
  - `modules/[domain]/[domain].routes.ts`: 라우트 및 Express 인터페이스 처리.
  - `modules/[domain]/[domain].controller.ts`: 요청(Request) 검증 및 응답(Response) 형식 처리.
  - `modules/[domain]/[domain].service.ts`: 순수 비즈니스/도메인 로직 처리 및 트랜잭션.
  - `modules/[domain]/[domain].repository.ts`: 데이터베이스 쿼리 레이어.
- **데이터베이스 (DB)**: PostgreSQL 사용.
  - 로컬 환경은 Docker Compose(`postgres` 이미지)로 실행 (`docker-compose.yml` 참고).

### 2.3. 공용 패키지 (Shared Package)

- **위치**: `packages/shared`
- **역할**: 프론트엔드와 백엔드가 함께 사용하는 도메인 타입(`Cut`, `Episode`, `Project` 등) 및 유효성 검증 모델 집결지.

## 3. 통신 및 배포 (Network & Deploy)

- 기본적으로 로컬 환경에서 Web (Vite, `:5173`)은 `/api` 라우트로 전송된 모든 요청을 API 서버(`:4000`)로 프록시(Proxy)하여 CORS 문제를 회피합니다.
- MVP 배포 및 텔레메트리를 위해 REST API 기반으로 통신합니다. (`fetch` 및 관련된 Query Client 활용 추정)

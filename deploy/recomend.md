결론부터 말하면, **최신순 정렬은 없애는 게 아니라 “fallback ranker”로 낮춰야 합니다.**
기본 피드는 `Feed API` 내부에서 정렬하지 말고, 별도 **Recommendation Engine**이 `publishId` 목록을 반환하는 구조로 분리하는 게 맞습니다.

프롬툰의 기존 방향도 Feed / Viewer / Studio / Core를 분리하고, Feed는 발행된 projection만 읽도록 설계하는 흐름이므로 추천 엔진은 Studio나 제작 엔진에 붙이면 안 되고 **Feed 계층의 독립 서비스**로 붙이는 게 가장 안전합니다.  
또한 제작 시스템 쪽은 작품·컷·연출 상태를 다루는 내부 엔진이고, 소비자 Feed는 발행된 콘텐츠 소비 영역이므로 둘을 섞지 않는 것이 중요합니다.

---

# 1. 최종 구조

추천 엔진은 이렇게 분리하는 게 좋습니다.

```text
[Feed UI]
   ↓
[Feed API]
   ↓
[Recommendation Gateway]
   ↓
[Recommendation Engine]
   ├─ Candidate Generator
   ├─ Feature Store
   ├─ Ranker
   ├─ Diversity / Policy Layer
   ├─ Experiment Layer
   └─ Result Cache
   ↓
[추천 publishId 목록 반환]
   ↓
[Feed API가 feed_items 조회]
   ↓
[Feed UI 노출]
```

핵심은 이것입니다.

```text
Feed API는 추천을 계산하지 않는다.
Feed API는 Recommendation Engine에 요청만 한다.

Recommendation Engine은 콘텐츠 본문을 렌더링하지 않는다.
Recommendation Engine은 publishId, score, reason, trackingToken만 반환한다.
```

이렇게 해야 추천 로직이 독립적으로 교체됩니다.

---

# 2. 왜 최신순만 두면 문제가 생기는가

최신순은 초반 MVP에서는 괜찮지만, 콘텐츠가 늘어나면 바로 문제가 생깁니다.

```text
1. 좋은 콘텐츠가 하루만 지나도 묻힘
2. 사용자의 취향과 무관한 콘텐츠가 계속 노출됨
3. 조회수 높은 콘텐츠와 신작 콘텐츠의 균형을 잡기 어려움
4. 웹툰 / 영상 / 분기형 콘텐츠의 소비 패턴을 반영하지 못함
5. A/B 테스트, 실험, 개인화, 실시간 트렌딩으로 확장하기 어려움
```

그래서 최신순은 아래처럼 처리해야 합니다.

```text
LatestRanker = 장애 시 fallback
RuleRanker = 초기 기본 추천
HybridRanker = 개인화 + 트렌딩 + 최신성
MLRanker = 추후 빅데이터 기반 추천
RealtimeRanker = 실시간 반응 기반 추천
```

---

# 3. 추천 엔진의 독립성 원칙

추천 엔진은 프롬툰 내부 Feed 코드에 종속되면 안 됩니다.

## 독립성을 지키는 규칙

```text
1. Recommendation Engine은 별도 API로 호출한다.
2. Feed API는 추천 엔진의 내부 로직을 모른다.
3. 추천 엔진은 Studio draft, cut_state, concept registry를 읽지 않는다.
4. 추천 엔진은 발행된 feed_items / publish projection만 사용한다.
5. 추천 결과에는 publishId만 내려준다.
6. 모델 버전, 정책 버전, 실험 ID를 항상 로그에 남긴다.
```

기존 프롬툰 설계에서도 Feed는 draft를 읽지 않고 published projection만 읽는 방향이 맞다고 정리되어 있으므로, 추천 엔진도 같은 원칙을 따라야 합니다.

---

# 4. 추천 API 계약

추천 엔진은 이런 API를 가지면 됩니다.

```http
POST /recommendations/v1/feed
```

요청 예시:

```json
{
  "user": {
    "userId": "user_123",
    "anonymousId": "anon_abc",
    "isLoggedIn": true
  },
  "context": {
    "surface": "home_feed",
    "device": "mobile",
    "locale": "ko-KR",
    "cursor": null,
    "limit": 20
  },
  "constraints": {
    "contentTypes": ["webtoon", "video"],
    "excludePublishIds": ["pub_001", "pub_002"],
    "safeMode": true
  }
}
```

응답 예시:

```json
{
  "requestId": "rec_req_20260508_001",
  "policyId": "home_feed_rule_v1",
  "modelVersion": "rule_ranker_0.1.0",
  "experimentId": "exp_home_feed_A",
  "items": [
    {
      "publishId": "pub_101",
      "rank": 1,
      "score": 0.934,
      "source": "personalized_trending",
      "reason": "genre_affinity",
      "trackingToken": "signed_token_..."
    },
    {
      "publishId": "pub_203",
      "rank": 2,
      "score": 0.887,
      "source": "fresh_exploration",
      "reason": "new_content"
    }
  ],
  "nextCursor": "cursor_xxx"
}
```

`trackingToken`은 매우 중요합니다.
사용자가 클릭, 시청, 완독, 좋아요, 숨김을 했을 때 이 토큰을 다시 이벤트에 포함해야 “어떤 추천 정책이 어떤 결과를 만들었는지” 추적할 수 있습니다.

---

# 5. 추천 엔진 내부 구조

```text
Recommendation Engine
├─ 1. Candidate Generator
│   ├─ latest candidates
│   ├─ trending candidates
│   ├─ personalized candidates
│   ├─ similar content candidates
│   ├─ continue watching / reading
│   └─ exploration candidates
│
├─ 2. Feature Store
│   ├─ content features
│   ├─ user features
│   ├─ session features
│   └─ realtime stats
│
├─ 3. Ranker
│   ├─ LatestRanker
│   ├─ RuleRanker
│   ├─ HybridRanker
│   ├─ MLRanker
│   └─ RealtimeRanker
│
├─ 4. Policy Layer
│   ├─ age / safety filter
│   ├─ duplicate removal
│   ├─ same project limit
│   ├─ genre diversity
│   └─ creator exposure cap
│
├─ 5. Experiment Layer
│   ├─ A/B test
│   ├─ traffic split
│   └─ policy versioning
│
└─ 6. Result Cache
    ├─ user feed cache
    ├─ anonymous feed cache
    └─ fallback cache
```

---

# 6. Candidate Generator 설계

추천은 한 번에 모든 콘텐츠를 정렬하는 방식으로 가면 확장성이 떨어집니다.
먼저 후보군을 여러 소스에서 가져오고, 그 다음 Ranker가 점수를 매기는 방식이 좋습니다.

## 후보군 종류

| 후보군           | 설명                                     |
| ---------------- | ---------------------------------------- |
| Latest           | 최신 발행 콘텐츠                         |
| Trending         | 최근 5분, 1시간, 24시간 반응 좋은 콘텐츠 |
| Personalized     | 사용자 취향과 맞는 콘텐츠                |
| Similar          | 사용자가 본 콘텐츠와 유사한 작품         |
| Continue         | 보던 웹툰 / 영상 이어보기                |
| Creator Affinity | 자주 보는 작가 / 프로젝트                |
| Exploration      | 신작, 저노출 콘텐츠 탐색                 |
| Editorial        | 운영자가 고정한 추천 콘텐츠              |

초기에는 `Latest + Trending + Exploration`만 있어도 충분합니다.
이후 데이터가 쌓이면 `Personalized + Similar + MLRanker`로 확장하면 됩니다.

---

# 7. 초기 RuleRanker 점수 공식

처음부터 ML을 넣지 않아도 됩니다.
대신 추천 엔진을 외부화하고, 점수 공식을 버전 관리하면 됩니다.

```text
final_score =
  0.20 * freshness_score
+ 0.20 * quality_score
+ 0.20 * trending_score
+ 0.20 * personalization_score
+ 0.10 * exploration_score
+ 0.10 * creator_affinity_score
- penalty_score
```

## 각 점수 의미

```text
freshness_score
= 최신성. 발행 후 시간이 지날수록 감소.

quality_score
= 완독률, 시청 유지율, 좋아요율, 저장률, 신고율 기반.

trending_score
= 최근 짧은 시간 동안 반응이 급상승한 정도.

personalization_score
= 사용자의 장르, 태그, 작품, 작가 취향과의 유사도.

exploration_score
= 신작이나 데이터 부족 콘텐츠에 기회를 주는 점수.

creator_affinity_score
= 사용자가 자주 보는 작가 / 프로젝트와의 관련성.

penalty_score
= 이미 본 콘텐츠, 신고 많은 콘텐츠, 중복 프로젝트, 과도한 반복 노출 차감.
```

최신순은 이 중 `freshness_score` 하나일 뿐입니다.
즉, 최신성은 추천의 일부가 되어야지 전체 기준이 되면 안 됩니다.

---

# 8. 영상과 웹툰의 이벤트를 다르게 봐야 함

영상과 웹툰은 “좋은 반응”의 정의가 다릅니다.

## 영상 이벤트

```text
- impression
- video_start
- watch_3s
- watch_10s
- watch_30s
- watch_complete
- replay
- skip
- like
- bookmark
- share
- report
```

영상은 특히 아래 지표가 중요합니다.

```text
watch_time_ratio
retention_3s
retention_10s
completion_rate
skip_rate
replay_rate
```

## 웹툰 이벤트

```text
- impression
- open
- cut_view
- scroll_depth
- episode_complete
- next_episode_click
- choice_click
- branch_path
- like
- bookmark
- share
- comment_open
- report
```

프롬툰처럼 분기형 웹툰이면 특히 중요합니다.

```text
choice_click_rate
branch_completion_rate
cut_depth
ending_reach_rate
replay_with_different_choice
```

일반 웹툰 추천과 다르게, 프롬툰은 “선택지”와 “분기 도달률”이 강한 추천 신호가 됩니다.

---

# 9. 이벤트 수집 구조

```text
[Viewer / Feed UI]
   ↓
[Telemetry API]
   ↓
[Event Queue]
   ↓
[Stream Processor]
   ↓
[Realtime Feature Store]
   ↓
[Recommendation Engine]
```

이벤트 스키마는 처음부터 추천용으로 설계해야 합니다.

```json
{
  "eventId": "evt_001",
  "eventType": "episode_complete",
  "userId": "user_123",
  "anonymousId": "anon_abc",
  "sessionId": "sess_001",
  "publishId": "pub_101",
  "episodeId": "ep_101",
  "projectId": "proj_101",
  "contentType": "webtoon",
  "surface": "home_feed",
  "position": 3,
  "trackingToken": "signed_token_...",
  "progress": 0.92,
  "dwellMs": 42000,
  "createdAt": "2026-05-08T12:00:00+09:00"
}
```

여기서 `trackingToken`, `position`, `surface`, `policyId`는 반드시 필요합니다.
그래야 “3번째에 노출했더니 완독했다” 같은 추천 품질 분석이 가능합니다.

---

# 10. 데이터 테이블 설계

기존 프롬툰 설계에서도 Feed-owned table로 `feed_items`, `feed_rankings`, `viewer_events`, `episode_view_stats`, `feed_impressions`를 분리하는 방향이 적절하다고 되어 있습니다.
추천 엔진까지 고려하면 아래처럼 확장하면 됩니다.

```text
feed_items
- id
- publish_id
- episode_id
- project_id
- content_type
- title
- cover_image_url
- tags
- genre
- age_rating
- language
- published_at
- status

viewer_events
- id
- event_type
- user_id
- anonymous_id
- session_id
- publish_id
- episode_id
- project_id
- surface
- position
- tracking_token
- dwell_ms
- progress
- created_at

content_realtime_stats
- publish_id
- impressions_5m
- opens_5m
- completes_5m
- likes_5m
- bookmarks_5m
- reports_5m
- ctr_5m
- completion_rate_5m
- updated_at

content_daily_stats
- publish_id
- date
- impressions
- opens
- completions
- likes
- bookmarks
- shares
- reports
- avg_dwell_ms

user_profiles
- user_id
- genre_vector
- tag_vector
- creator_affinity
- preferred_content_type
- updated_at

recommendation_requests
- request_id
- user_id
- anonymous_id
- surface
- policy_id
- model_version
- experiment_id
- created_at

recommendation_results
- request_id
- publish_id
- rank
- score
- source
- reason
- tracking_token
```

---

# 11. 실시간 추천까지 고려한 확장 구조

초기에는 PostgreSQL + Redis 정도로 충분합니다.
하지만 빅데이터 / 실시간으로 확장하려면 구조를 이렇게 가져가야 합니다.

```text
[Event API]
   ↓
[Event Queue]
   ↓
[Stream Processor]
   ├─ 5분 트렌딩 계산
   ├─ 1시간 트렌딩 계산
   ├─ 사용자 세션 취향 업데이트
   └─ 콘텐츠 품질 지표 업데이트
   ↓
[Online Feature Store]
   ↓
[Recommendation Serving API]

동시에

[Event Queue]
   ↓
[Data Lake / Warehouse]
   ↓
[Offline Training Dataset]
   ↓
[Model Training]
   ↓
[Model Registry]
   ↓
[Recommendation Serving API]
```

초기와 미래 구조를 연결하면 이렇게 됩니다.

```text
MVP
PostgreSQL + RuleRanker

성장 단계
PostgreSQL + Redis + Batch Stats

실시간 단계
Event Queue + Stream Processor + Online Feature Store

빅데이터 단계
Warehouse + Offline Training + MLRanker + Vector Search

고도화 단계
Realtime Ranker + Bandit + A/B Test Platform
```

---

# 12. Ranker를 교체 가능하게 만드는 인터페이스

추천 엔진 내부는 반드시 인터페이스 기반이어야 합니다.

```ts
type RecommendationRequest = {
  userId?: string;
  anonymousId?: string;
  surface: "home_feed" | "related" | "continue" | "search";
  limit: number;
  cursor?: string | null;
  excludePublishIds?: string[];
};

type Candidate = {
  publishId: string;
  source: "latest" | "trending" | "personalized" | "similar" | "exploration";
};

type RankedItem = {
  publishId: string;
  rank: number;
  score: number;
  reason: string;
  source: string;
};

interface Ranker {
  rank(
    request: RecommendationRequest,
    candidates: Candidate[],
    features: RecommendationFeatures,
  ): Promise<RankedItem[]>;
}
```

이렇게 해두면 나중에 아래처럼 쉽게 교체할 수 있습니다.

```text
RuleRanker
↓
HybridRanker
↓
MLRanker
↓
RealtimeRanker
```

Feed API는 어떤 Ranker가 쓰였는지 몰라도 됩니다.
이게 진짜 분리입니다.

---

# 13. 추천 결과 후처리 규칙

Ranker가 점수만 매기면 피드 품질이 나빠질 수 있습니다.
그래서 반드시 후처리 레이어가 있어야 합니다.

```text
Diversity Layer
- 같은 프로젝트 연속 노출 제한
- 같은 작가 연속 노출 제한
- 같은 장르 과다 노출 제한
- 영상 / 웹툰 비율 조절

Safety Layer
- 비공개 publish 제외
- 연령 제한 필터
- 신고율 높은 콘텐츠 감점
- 차단한 작가 / 콘텐츠 제외

Freshness Layer
- 너무 오래된 콘텐츠 감점
- 신작 최소 노출 슬롯 확보

Exploration Layer
- 데이터가 부족한 신작에 일정 비율 노출 기회 제공
```

추천 결과 예시는 이렇게 섞는 게 좋습니다.

```text
1번: 개인화 추천
2번: 트렌딩
3번: 개인화 추천
4번: 신작 탐색
5번: 이어보기
6번: 개인화 추천
7번: 운영 추천
8번: 트렌딩
```

---

# 14. Cold Start 대응

추천에서 가장 중요한 문제 중 하나가 cold start입니다.

## 신규 사용자

로그인이 없거나 기록이 없을 때:

```text
- 최신 인기작
- 장르 다양성 보장
- 운영 추천
- 신작 탐색
- 첫 10개 노출에서 사용자의 반응 수집
```

초기 피드는 이렇게 구성할 수 있습니다.

```text
30% trending
30% latest
20% editorial
20% exploration
```

## 신규 콘텐츠

새로 발행된 콘텐츠는 데이터가 없기 때문에 무조건 불리합니다.
그래서 별도 탐색 슬롯이 필요합니다.

```text
- 발행 후 24시간 동안 최소 노출량 보장
- 같은 작가의 기존 성과를 약하게 반영
- 장르 / 태그 유사 사용자에게 우선 노출
- 반응이 좋으면 trending 후보로 승격
```

---

# 15. 추천 엔진 장애 대응

추천 엔진은 독립 서비스이므로 장애 대응이 필요합니다.

```text
1. Recommendation Engine 정상
   → 개인화 추천

2. Feature Store 장애
   → RuleRanker + cached stats

3. Recommendation Engine 장애
   → Feed API fallback: 최신순 + 공개 상태 필터

4. Event Pipeline 장애
   → 기존 daily stats 기반 추천

5. Cache 장애
   → 직접 ranking 계산 또는 latest fallback
```

즉, 최신순은 제거하는 게 아니라 다음 위치에 둡니다.

```text
LatestRanker = fallback
```

---

# 16. 추천 조작 방지

추천은 이벤트 기반이기 때문에 조작 가능성을 반드시 고려해야 합니다.

```text
- impression / open / complete 이벤트 중복 제거
- trackingToken 서명
- 동일 IP / 동일 anonymousId 반복 이벤트 제한
- 짧은 시간 과도한 이벤트 rate limit
- 신고율 높은 콘텐츠 자동 감점
- 봇 의심 이벤트는 추천 학습에서 제외
- anonymous 이벤트는 logged-in 이벤트보다 낮은 가중치
```

특히 공개 피드는 텔레메트리 조작으로 completion rate나 impression 수가 왜곡될 수 있으므로, 추천 학습용 이벤트와 단순 분석용 이벤트를 분리해두는 게 좋습니다.

---

# 17. 프롬툰에 맞는 추천 정책 예시

## 홈 피드 추천

```text
목표:
사용자가 처음 들어왔을 때 볼만한 작품 발견

후보:
- trending
- personalized
- latest
- exploration

주요 지표:
- open rate
- completion rate
- next episode click
- bookmark
```

## 이어보기 추천

```text
목표:
보던 작품을 다시 보게 함

후보:
- 미완료 에피소드
- 다음 에피소드
- 다른 선택지로 재감상 가능한 분기

주요 지표:
- continue click
- episode completion
- branch replay
```

## 관련 작품 추천

```text
목표:
현재 본 작품과 비슷한 작품 추천

후보:
- 같은 장르
- 유사 태그
- 유사 선택지 구조
- 유사 독자층

주요 지표:
- related click
- dwell time
- completion
```

## 신작 탐색 추천

```text
목표:
새로운 작품에 최소 노출 기회 제공

후보:
- 발행 후 24~72시간 이내 콘텐츠
- 데이터 부족 콘텐츠
- 운영 승인 콘텐츠

주요 지표:
- early open rate
- early completion rate
- report rate
```

---

# 18. 현재 프롬툰 구조에 적용할 변경안

지금 구조에서는 이렇게 적용하면 됩니다.

```text
1. Feed API는 더 이상 최신순만 조회하지 않는다.

2. Feed API는 Recommendation Engine에 추천 요청을 보낸다.

3. Recommendation Engine은 publishId 목록을 반환한다.

4. Feed API는 반환된 publishId로 feed_items를 조회한다.

5. Viewer / Feed 이벤트에는 trackingToken을 포함한다.

6. 이벤트는 viewer_events에 저장한다.

7. 추천 엔진은 viewer_events와 feed_items를 기반으로 점수를 갱신한다.
```

구조상으로는 기존 `feed_items` projection을 활용하면 좋습니다. 발행 시 `PublishManifest` 전체를 Feed로 넘기지 말고 Feed용 projection을 따로 저장하자는 기존 설계와도 맞습니다.

---

# 19. 추천 엔진 패키지 / 서비스 구조

모노레포를 유지한다면 이렇게 나누면 됩니다.

```text
apps
├─ api
├─ web
└─ recommendation-api

packages
├─ shared
├─ recommendation-contract
├─ recommendation-client
├─ recommendation-core
└─ recommendation-rankers
```

각 역할은 다음과 같습니다.

```text
recommendation-contract
- 요청 / 응답 타입
- event 타입
- policy 타입

recommendation-client
- Feed API가 호출하는 클라이언트

recommendation-core
- candidate generation
- feature loading
- post processing
- experiment handling

recommendation-rankers
- LatestRanker
- RuleRanker
- HybridRanker
- MLRanker

recommendation-api
- 외부 추천 API 서버
```

초기에는 같은 레포 안에 있어도 됩니다.
중요한 건 코드 위치보다 **API 계약으로 분리되어 있느냐**입니다.

---

# 20. 단계별 구현 로드맵

## 1단계: 최신순 탈출

```text
- feed_items projection 정리
- Recommendation API 생성
- LatestRanker 구현
- RuleRanker 구현
- Feed API가 Recommendation API를 호출하도록 변경
- 추천 요청 / 결과 로그 저장
```

이 단계에서는 ML이 없어도 됩니다.

## 2단계: 기본 품질 추천

```text
- viewer_events 정리
- open rate, completion rate, bookmark rate 계산
- trending_score 추가
- quality_score 추가
- 같은 프로젝트 반복 노출 제한
- 신작 exploration 슬롯 추가
```

## 3단계: 개인화 추천

```text
- user_profiles 생성
- 장르 / 태그 affinity 계산
- 로그인 사용자와 anonymous 사용자 분리
- session-based 추천 추가
- 이어보기 추천 추가
```

## 4단계: 빅데이터 확장

```text
- event queue 도입
- stream processing 도입
- online feature store 도입
- warehouse 적재
- offline training dataset 생성
```

## 5단계: ML / 실시간 추천

```text
- vector similarity 후보 생성
- MLRanker 도입
- model registry
- A/B test
- realtime trending
- bandit 기반 exploration
```

---

# 21. 최종 권장 구조 요약

```text
[Studio]
  발행 생성
  ↓

[Publish Manifest]
  ↓

[Feed Projection / feed_items]
  ↓

[Recommendation Engine]
  후보 생성 + 점수화 + 다양성 + 실험
  ↓

[Feed API]
  추천 publishId를 feed_items로 변환
  ↓

[Feed / Viewer UI]
  사용자 노출
  ↓

[Telemetry Events]
  시청 / 완독 / 선택 / 좋아요 / 저장 / 신고
  ↓

[Feature Store]
  실시간 지표 업데이트
  ↓

[Recommendation Engine]
  다음 추천에 반영
```

한 문장으로 정리하면:

> **프롬툰 추천 시스템은 Feed 내부 정렬 기능이 아니라, 발행된 콘텐츠 projection과 사용자 반응 이벤트를 입력받아 publishId 목록을 반환하는 독립 Recommendation Engine으로 설계해야 합니다.**

가장 먼저 만들 MVP는 이것입니다.

```text
Recommendation Engine v0
- LatestRanker
- RuleRanker
- Trending score
- Freshness score
- Quality score
- Exploration slot
- Diversity filter
- Recommendation log
- Tracking token
- Feed fallback
```

이렇게 시작하면 지금은 단순 추천으로 동작하지만, 나중에 빅데이터·실시간·ML 추천으로 확장해도 구조를 갈아엎지 않아도 됩니다.

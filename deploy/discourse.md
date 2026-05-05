검색해보니 현재 구조는 프론트 -> AIVRP_SERVER /api/discourse proxy -> Discourse API 입니다. Discourse API key는 서버에서 붙이고, 프론트는 대부분 서버 API만 호출합니다.

핵심 흐름

프로젝트 경로 /home/vrp/workspace/AIVRP

서버 부팅 시 env를 먼저 로드합니다: server.ts (line 2), Discourse env 키는 env.ts (line 45)에 정의되어 있습니다.
서버는 /api/discourse로 Discourse proxy 라우터를 붙입니다: app.ts (line 74).
Discourse axios base URL은 DISCOURSE_BASE_URL입니다: DiscourseAxios.ts (line 5).
주요 proxy 라우트는 categories/latest/top/topic/comment/upload/like/bookmark/edit/delete입니다: discourse.routes.ts (line 40), discourse.routes.ts (line 63).
댓글 작성은 JWT로 현재 유저를 찾고 user.discourseUsername을 Api-Username으로 넣어 Discourse /posts.json에 요청합니다: discourse.service.ts (line 44).
토픽 생성은 프론트가 넘긴 X-Discourse-Username으로 Discourse impersonation을 합니다: discourse.service.ts (line 80).
클립/프롬투온 발행 시 Discourse 토픽을 만들고 topic_id를 DB에 저장합니다: createDiscourseTopic.ts (line 11), PublishClipUseCase.ts (line 70).
DB에는 User.discourseUsername, VideoClip.discourseTopicId, PublishedVideo.discourseTopicId, Publish.discourseTopicId가 있습니다: schema.prisma (line 431), schema.prisma (line 878), schema.prisma (line 1253), schema.prisma (line 1329).

인증 연결

OAuth 로그인 후 서버가 Discourse 유저를 없으면 생성하고, User.discourseUsername = relic\_${user.id}로 저장합니다: oauth.service.ts (line 155), oauth.service.ts (line 185).

/api/discourse/me는 프론트가 현재 Discourse username을 가져오는 용도입니다: discourse.routes.ts (line 74), useUser.ts (line 13).

SSO 파일도 있지만 현재 컨트롤러는 mock user를 반환합니다. 그대로 실서비스에 복사하면 안 됩니다: sso.controller.ts (line 8).

프론트 연결

프론트 공용 API는 ${config.backend.url}/api를 baseURL로 잡고 credentials를 보냅니다: axios.ts (line 11).

토픽 작성 화면은 /api/discourse/topic으로 보내고, 헤더에 X-Discourse-Username을 넣습니다: CreateTopicPage.tsx (line 327).

댓글은 저장된 discourseTopicId를 기준으로 /api/discourse/t/:id 조회, /api/discourse/comment 작성합니다: useDiscourseTopic.ts (line 19), createComment.ts (line 14).

시청 페이지도 watch.video.discourseTopicId가 있으면 댓글 섹션을 렌더합니다: ClipWatchPage.tsx (line 53), ClipWatchPage.tsx (line 360).

다른 프로젝트 이식 체크리스트

서버에 DISCOURSE_BASE_URL, DISCOURSE_API_KEY, DISCOURSE_API_USER, DISCOURSE_CATEGORY_ID, DISCOURSE_SECRET, DISCOURSE_ORIGIN 환경변수 추가.

Prisma/User 모델에 discourseUsername, 콘텐츠 모델에 discourseTopicId 추가.

DiscourseAxios, discourse.routes/controller/service, discourse-user.service, createDiscourseTopic 이식.

로그인 성공 후 Discourse 유저 생성/확인 및 discourseUsername 저장 로직 이식.

프론트는 Discourse API를 직접 호출하지 말고 /api/discourse/\*만 호출.

클립 임베드까지 필요하면 onebox/oEmbed 라우트도 같이 이식: onebox.routes.ts (line 12), onebox.controller.ts (line 119).

주의할 점: 현재 프론트 설정 파일에도 Discourse API key가 하드코딩되어 있습니다: discourseConfig.ts (line 2), axiosInstance.ts (line 9). 다른 프로젝트에는 이 방식으로 복사하지 말고, key는 서버 env에만 둬야 합니다. 현재 노출된 키는 교체 대상으로 보는 게 맞습니다.

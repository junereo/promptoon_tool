import type { ComponentType } from 'react';

import {
  Bookmark,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  GalleryHorizontalEnd,
  Menu,
  MessageCircle,
  PencilLine,
  Play,
  Send,
  Users
} from 'lucide-react';

const episodes = [
  '56화. 다시 흐르기 시작한 시간',
  '55화. 봉인된 기억',
  '54화. 뒤엉킨 운명',
  '53화. 예언의 시작'
];

export function WebtoonWorkspaceMock() {
  return (
    <div className="rounded-[2rem] border border-blue-100 bg-white/90 p-5 shadow-pt-card">
      <div className="grid gap-5 lg:grid-cols-2">
        <EpisodeListPanel />
        <ViewerPanel />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FeaturePill Icon={Play} text="이전까지 본 화 이어보기" title="이어보기" />
        <FeaturePill Icon={PencilLine} text="비하인드, 제작 스토리" title="작가 노트" />
        <FeaturePill Icon={GalleryHorizontalEnd} text="연관 숏폼 콘텐츠" title="관련 숏드라마" />
        <FeaturePill Icon={Users} text="댓글, 토론, 팬아트" title="커뮤니티" />
      </div>
    </div>
  );
}

function EpisodeListPanel() {
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white">
      <div className="bg-gradient-to-r from-pt-blue to-blue-500 px-5 py-3 text-center font-black text-white">
        채널 홈 웹툰 서비스
      </div>

      <div className="p-5">
        <div className="mb-4 flex gap-5 border-b text-sm font-bold">
          <span className="border-b-2 border-pt-blue pb-2 text-pt-blue">에피소드</span>
          <span className="pb-2 text-slate-500">이어보기</span>
          <span className="pb-2 text-slate-500">작가 노트</span>
          <span className="pb-2 text-slate-500">커뮤니티</span>
        </div>

        <h3 className="text-xl font-black text-slate-900">시간을 걷는 마법사</h3>
        <p className="mt-1 text-xs text-slate-500">연재 중 · 매주 금요일 업데이트</p>

        <div className="mt-5 space-y-3">
          {episodes.map((episode, index) => (
            <div className="flex items-center gap-3" key={episode}>
              <div className="h-14 w-20 shrink-0 rounded-xl bg-gradient-to-br from-slate-800 to-blue-600" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-slate-800">{episode}</p>
                <p className="text-xs text-slate-400">24.05.{24 - index * 7}</p>
              </div>
              <Bookmark className="h-5 w-5 shrink-0 text-slate-400" />
            </div>
          ))}
        </div>

        <button className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-pt-blue py-3 text-sm font-black text-white" type="button">
          <Play className="h-4 w-4 fill-white" />
          첫 화부터 보기
        </button>
      </div>
    </section>
  );
}

function ViewerPanel() {
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
        <ChevronLeft className="h-5 w-5 shrink-0 text-slate-600" />
        <p className="min-w-0 truncate text-sm font-black text-slate-800">56화. 다시 흐르기 시작한 시간</p>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-xs font-bold text-slate-400">12 / 70</span>
          <Menu className="h-5 w-5" />
        </div>
      </div>

      <div className="relative h-[330px] bg-[radial-gradient(circle_at_20%_20%,rgba(191,219,254,0.75),transparent_32%),linear-gradient(135deg,#1e293b,#020617)] p-6">
        <div className="absolute left-5 top-7 rounded-full bg-white px-5 py-4 text-center text-sm font-black leading-snug text-slate-900 shadow-lg">
          이제,
          <br />
          우리가 움직일
          <br />
          차례야.
        </div>
      </div>

      <div className="grid grid-cols-5 items-center border-t px-5 py-3 text-xs font-bold text-slate-500">
        <button type="button">이어보기</button>
        <button type="button">화면맞춤</button>
        <button className="mx-auto flex items-center gap-2 rounded-full border px-4 py-2" type="button">
          <ChevronLeft className="h-4 w-4" />
          <ChevronRight className="h-4 w-4" />
        </button>
        <button className="grid justify-items-center" type="button">
          <MessageCircle className="h-4 w-4" />
          댓글
        </button>
        <button className="grid justify-items-center" type="button">
          <Send className="h-4 w-4" />
          공유
        </button>
      </div>
    </section>
  );
}

function FeaturePill({ Icon, title, text }: { Icon: ComponentType<{ className?: string }>; title: string; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-white px-4 py-3 shadow-sm">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-blue-50 text-pt-blue">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="font-black text-pt-blue">{title}</p>
        <p className="text-xs text-slate-500">{text}</p>
      </div>
    </div>
  );
}

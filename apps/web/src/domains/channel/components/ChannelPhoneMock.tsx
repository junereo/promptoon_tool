import { Bell, Bookmark } from 'lucide-react';

import { PhoneFrame } from '../../../shared/ui/PhoneFrame';

export function ChannelPhoneMock() {
  return (
    <PhoneFrame className="w-[320px] max-w-full">
      <div className="h-[520px] bg-white">
        <div className="relative h-44 bg-[radial-gradient(circle_at_70%_30%,rgba(196,181,253,0.9),transparent_32%),linear-gradient(135deg,#0f172a,#1d4ed8)] p-5 text-white">
          <p className="text-2xl font-black leading-tight">
            시간을 걷는
            <br />
            마법사
          </p>
          <p className="mt-2 text-xs text-white/70">운명을 바꾸는 한 마법사의 주문</p>
        </div>

        <div className="-mt-10 px-5">
          <div className="rounded-3xl bg-white p-4 shadow-xl ring-1 ring-slate-100">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 shrink-0 rounded-full bg-gradient-to-br from-slate-800 to-blue-700 ring-4 ring-white" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <h3 className="truncate font-black text-slate-900">스튜디오 시간</h3>
                  <span className="rounded-full bg-pt-blue px-1.5 text-xs font-black text-white">✓</span>
                </div>
                <p className="text-xs text-slate-500">@studiotime</p>
                <p className="mt-1 text-xs text-slate-500">구독자 12.6만명 · 영상 156개</p>
              </div>
              <button className="rounded-full bg-pt-blue px-4 py-2 text-xs font-black text-white" type="button">
                구독
              </button>
              <Bell className="h-5 w-5 shrink-0 text-slate-400" />
            </div>

            <div className="mt-5 flex gap-5 border-b text-sm font-bold">
              <span className="border-b-2 border-pt-blue pb-2 text-pt-blue">홈</span>
              <span className="pb-2 text-slate-500">시리즈</span>
              <span className="pb-2 text-slate-500">세계관</span>
              <span className="pb-2 text-slate-500">커뮤니티</span>
            </div>

            <div className="mt-5">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="font-black text-slate-900">대표 시리즈</h4>
                <span className="text-xs text-slate-400">더보기 &gt;</span>
              </div>

              <div className="flex gap-3 rounded-2xl border border-slate-100 p-3">
                <div className="h-24 w-20 shrink-0 rounded-xl bg-gradient-to-br from-slate-800 to-blue-600" />
                <div className="min-w-0 flex-1">
                  <p className="font-black text-slate-900">시간을 걷는 마법사</p>
                  <p className="mt-1 text-xs text-slate-500">시간을 넘어 얽힌 두 사람의 이야기</p>
                  <div className="mt-2 flex gap-1 text-[10px]">
                    <span className="rounded-full bg-slate-100 px-2 py-1">판타지</span>
                    <span className="rounded-full bg-slate-100 px-2 py-1">로맨스</span>
                  </div>
                  <p className="mt-3 text-xs font-bold text-slate-500">연재 중 · 56화</p>
                </div>
                <Bookmark className="h-5 w-5 shrink-0 text-slate-400" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}

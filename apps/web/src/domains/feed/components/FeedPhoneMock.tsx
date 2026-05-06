import type { ReactNode } from 'react';

import {
  Bell,
  Heart01 as Heart,
  House01 as Home,
  ChatCircle as MessageCircle,
  AddPlus as Plus,
  SearchMagnifyingGlass as Search,
  PaperPlane as Send,
  User01 as User
} from 'react-coolicons';

import { PhoneFrame } from '../../../shared/ui/PhoneFrame';

export function FeedPhoneMock() {
  return (
    <PhoneFrame className="w-[260px]">
      <div className="relative h-[520px] bg-slate-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(96,165,250,0.55),transparent_35%),linear-gradient(180deg,#111827,#030712)]" />

        <div className="relative z-10 flex items-center justify-between px-4 pt-5 text-sm font-bold">
          <div className="flex gap-4">
            <span className="border-b-2 border-white pb-1">추천</span>
            <span className="text-white/70">팔로잉</span>
            <span className="text-white/70">최신</span>
          </div>
          <Search className="h-5 w-5" />
        </div>

        <div className="relative z-10 px-4 pt-6">
          <span className="rounded-full bg-pt-blue px-3 py-1 text-xs font-black">15초 숏드라마</span>

          <div className="mt-28 max-w-[180px]">
            <h3 className="text-2xl font-black leading-tight">그날, 너와 나의 시간이 멈췄다</h3>
            <p className="mt-2 text-xs text-white/80">#로맨스 #타임슬립</p>
            <p className="mt-4 text-xs font-bold">00:07 / 00:15</p>
          </div>

          <div className="mt-5 rounded-2xl bg-white/12 p-3 backdrop-blur">
            <span className="rounded-full bg-pt-purple px-2 py-1 text-xs font-bold">프롬툰</span>
            <p className="mt-2 text-sm font-bold">프롬툰으로 만든 내 웹툰 세계관</p>
            <p className="mt-1 text-xs text-white/70">#프롬툰 #판타지</p>
          </div>
        </div>

        <div className="absolute right-3 top-44 z-20 flex flex-col items-center gap-4">
          <FeedAction icon={<Heart />} label="좋아요" />
          <FeedAction icon={<MessageCircle />} label="댓글" />
          <FeedAction icon={<Send />} label="공유" />
        </div>

        <div className="absolute bottom-0 left-0 right-0 z-20 grid grid-cols-5 border-t border-white/10 bg-black/60 px-3 py-3 text-[10px] font-bold backdrop-blur">
          <FeedTab icon={<Home />} label="홈" />
          <FeedTab icon={<Search />} label="탐색" />
          <FeedTab active icon={<Plus />} label="" />
          <FeedTab icon={<Bell />} label="알림" />
          <FeedTab icon={<User />} label="MY" />
        </div>
      </div>
    </PhoneFrame>
  );
}

function FeedAction({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <button aria-label={label} className="grid justify-items-center gap-1 text-white" type="button">
      <span className="grid h-8 w-8 place-items-center rounded-full bg-white/15">{icon}</span>
      <span className="text-[10px]">{label}</span>
    </button>
  );
}

function FeedTab({ icon, label, active }: { icon: ReactNode; label: string; active?: boolean }) {
  return (
    <button className="grid justify-items-center gap-1" type="button">
      <span
        className={
          active
            ? 'grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-pt-blue to-pt-purple'
            : 'grid h-5 w-5 place-items-center'
        }
      >
        {icon}
      </span>
      {label ? <span>{label}</span> : null}
    </button>
  );
}

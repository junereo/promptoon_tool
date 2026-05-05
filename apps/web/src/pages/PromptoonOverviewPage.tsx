import type { ReactNode } from 'react';

import { BookOpen, Gem, Link2, Play, Target, Users } from 'lucide-react';

import { ChannelPhoneMock } from '../domains/channel/components/ChannelPhoneMock';
import { FeedPhoneMock } from '../domains/feed/components/FeedPhoneMock';
import { StageCard } from '../domains/platform/components/StageCard';
import { WebtoonWorkspaceMock } from '../domains/viewer/components/WebtoonWorkspaceMock';

export function PromptoonOverviewPage() {
  return (
    <main className="min-h-screen bg-pt-bg px-6 py-8 text-pt-ink">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col gap-5 sm:flex-row sm:gap-6">
            <div className="grid h-20 w-20 shrink-0 place-items-center rounded-3xl bg-gradient-to-br from-pt-blue to-pt-purple text-white shadow-lg">
              <Play className="h-10 w-10 fill-white" />
            </div>

            <div>
              <h1 className="text-4xl font-black tracking-normal md:text-6xl">
                숏드라마 + <span className="text-pt-purple">프롬툰</span> +{' '}
                <span className="text-pt-blue">웹툰 채널</span> 플랫폼
              </h1>
              <p className="mt-3 text-xl font-bold text-slate-600">
                짧게 보고, 채널로 들어가고, 깊게 몰입하는 콘텐츠 구조
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <TopButton icon={<Play />} text="숏폼으로 발견" />
            <TopButton icon={<Users />} text="채널로 연결" />
            <TopButton icon={<BookOpen />} text="웹툰으로 몰입" />
          </div>
        </header>

        <section className="grid gap-8 lg:grid-cols-[0.9fr_1fr_1.55fr]">
          <StageCard step={1} subtitle="15초 숏드라마와 프롬툰을 즐기는 숏폼 피드" title="피드 홈">
            <FeedPhoneMock />
          </StageCard>

          <StageCard step={2} subtitle="크리에이터/작가의 채널 홈으로 진입" title="채널 진입">
            <ChannelPhoneMock />
          </StageCard>

          <StageCard step={3} subtitle="웹툰 감상과 채널 기능을 하나의 공간에서" title="웹툰 서비스 + 채널">
            <WebtoonWorkspaceMock />
          </StageCard>
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-[0.7fr_1fr_1fr_1fr_1fr]">
          <div className="flex items-center justify-center rounded-3xl bg-gradient-to-br from-pt-blue to-pt-purple p-6 text-white shadow-pt-card">
            <div className="text-center">
              <Gem className="mx-auto h-10 w-10" />
              <p className="mt-3 text-2xl font-black">핵심 가치</p>
            </div>
          </div>

          <ValueCard icon={<Target />} text="15초 피드로 빠른 유입. 숏드라마와 프롬툰으로 흥미 자극." title="짧은 진입" />
          <ValueCard icon={<BookOpen />} text="채널 진입 후 웹툰 정주행. 세계관과 에피소드 확장." title="깊은 몰입" />
          <ValueCard icon={<Link2 />} text="숏폼과 웹툰을 연결해 IP 가치와 수익 모델 확장." title="IP 확장" />
          <ValueCard icon={<Users />} text="구독, 댓글, 토론, 팬아트로 지속적인 관계 형성." title="팬 커뮤니티" />
        </section>
      </div>
    </main>
  );
}

function TopButton({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <button
      className="flex items-center gap-2 rounded-xl border border-blue-100 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm"
      type="button"
    >
      <span className="text-pt-blue">{icon}</span>
      {text}
    </button>
  );
}

function ValueCard({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <article className="flex gap-4 rounded-3xl border border-blue-100 bg-white p-6 shadow-pt-card">
      <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-50 to-purple-50 text-pt-blue">
        {icon}
      </div>
      <div>
        <h3 className="text-xl font-black text-pt-blue">{title}</h3>
        <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">{text}</p>
      </div>
    </article>
  );
}

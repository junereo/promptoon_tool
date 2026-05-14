import { useEffect } from 'react';
import { Link } from 'react-router-dom';

import { ConsumerResponsiveFrame } from '../components/ConsumerResponsiveFrame';

export function AboutPage() {
  useEffect(() => {
    window.document.title = 'About Promptoon';
  }, []);

  return (
    <ConsumerResponsiveFrame>
      <article className="min-h-dvh px-5 pb-14 pt-[max(env(safe-area-inset-top),1.5rem)]">
        <header className="-mx-5 border-b border-white/10 px-5 pb-6">
          <Link className="inline-flex items-center gap-2" to="/">
            <img alt="" className="h-8 w-8 rounded-md bg-white object-cover" src="/promptoon-icon.webp" />
            <span className="font-display text-lg font-semibold tracking-normal text-white">Promptoon</span>
          </Link>

          <p className="mt-8 text-xs font-semibold uppercase tracking-normal text-white/42">AI Prompt Platform</p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-normal text-white">Promptoon</h1>
          <p className="mt-5 text-base leading-7 text-white/74">
            Promptoon is an AI-powered platform that helps users create, manage, and optimize prompts for generative AI
            tools.
          </p>
          <p className="mt-4 text-base leading-7 text-white/64">
            Promptoon은 생성형 AI를 위한 프롬프트를 쉽게 만들고 관리할 수 있도록 도와주는 플랫폼입니다.
          </p>
        </header>

        <section className="space-y-8 py-8">
          <div>
            <h2 className="text-lg font-bold leading-7 text-white">What Promptoon Does</h2>
            <p className="mt-3 text-sm leading-7 text-white/68">
              Promptoon helps users organize AI prompt ideas, manage reusable prompt workflows, and prepare prompts for
              generative AI use cases.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold leading-7 text-white">How Users Can Use It</h2>
            <ul className="mt-4 space-y-2 text-sm leading-7 text-white/66">
              <li className="flex gap-2">
                <span aria-hidden className="mt-3 h-1 w-1 shrink-0 rounded-full bg-white/42" />
                <span>프롬프트 아이디어와 목적을 정리합니다.</span>
              </li>
              <li className="flex gap-2">
                <span aria-hidden className="mt-3 h-1 w-1 shrink-0 rounded-full bg-white/42" />
                <span>생성형 AI 도구에 사용할 프롬프트를 관리하고 개선합니다.</span>
              </li>
              <li className="flex gap-2">
                <span aria-hidden className="mt-3 h-1 w-1 shrink-0 rounded-full bg-white/42" />
                <span>콘텐츠 제작과 운영에 필요한 프롬프트 흐름을 준비합니다.</span>
              </li>
            </ul>
          </div>
        </section>
      </article>
    </ConsumerResponsiveFrame>
  );
}

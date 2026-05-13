import type { ReactNode } from 'react';
import { ExternalLink } from 'react-coolicons';

import { cn } from '../../../shared/lib/cn';
import { ConsumerBottomNav } from './ConsumerBottomNav';

const INSTAGRAM_URL = 'https://www.instagram.com/promptoon_ai/';
const STORE_BADGES = [
  {
    label: 'App Store',
    src: '/app-store-badge.svg',
    alt: 'Download on the App Store'
  },
  {
    label: 'Google Play',
    src: '/google-play-badge.svg',
    alt: 'Get it on Google Play'
  }
];

const FOOTER_LABELS = ['서비스 이용약관', '개인정보 처리방침', '자주 묻는 질문', '문의하기', '청소년 보호 정책', '공지사항'];
export const CONSUMER_FRAME_CLASS =
  'mx-auto min-h-dvh w-full max-w-[480px] overflow-x-hidden lg:relative lg:left-[50vw] lg:mx-0 lg:grid lg:h-dvh lg:min-h-0 lg:w-[960px] lg:min-w-[960px] lg:max-w-[960px] lg:-translate-x-1/2 lg:grid-cols-[480px_480px] lg:gap-0 lg:overflow-hidden';
export const CONSUMER_RIGHT_FRAME_CLASS =
  'min-h-dvh w-full min-w-0 max-w-full bg-[#09090b] text-white lg:h-dvh lg:min-h-0 lg:w-[480px] lg:min-w-[480px] lg:max-w-[480px] lg:overflow-hidden';
export const CONSUMER_RIGHT_CONTENT_CLASS =
  'scrollbar-hidden min-h-dvh w-full min-w-0 max-w-full overflow-x-hidden bg-[#09090b] pb-24 shadow-[0_0_80px_rgba(0,0,0,0.42)] lg:h-full lg:min-h-0 lg:w-[480px] lg:min-w-[480px] lg:max-w-[480px] lg:overflow-y-auto lg:overscroll-contain';
export const CONSUMER_RIGHT_NAV_CLASS = 'lg:left-[50vw] lg:right-auto lg:w-[480px]';
export const CONSUMER_FLOATING_RIGHT_CLASS = 'lg:left-[calc(50vw+240px)]';

function StoreBadgeButtons() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:max-w-md lg:grid-cols-1 xl:grid-cols-2">
      {STORE_BADGES.map((badge) => (
        <button
          aria-label={`${badge.label} 서비스 준비중`}
          className="flex min-h-16 cursor-not-allowed flex-col items-center justify-center rounded-lg border border-white/12 bg-white/[0.04] p-3 text-center opacity-70"
          disabled
          key={badge.label}
          type="button"
        >
          <img alt={badge.alt} className="h-10 w-auto max-w-full object-contain grayscale" src={badge.src} />
          <span className="mt-2 text-xs font-semibold text-white/62">서비스 준비중</span>
        </button>
      ))}
    </div>
  );
}

function LandingIntroContent() {
  return (
    <div className="flex flex-col items-center text-center">
      <img alt="Promptoon" className="h-auto w-full max-w-[20rem] rounded-lg object-contain" src="/promptoon-logo.webp" />

      <div className="mt-8 max-w-xl">
        <p className="text-base font-black leading-tight text-white">
          선택에 따라 달라지는 짧은 이야기
        </p>
        <p className="mt-4 max-w-lg text-sm leading-6 text-white/68 sm:text-base sm:leading-7">
          Promptoon은 모바일 화면에서 바로 감상하는 인터랙티브 웹툰과 숏폼 콘텐츠를 준비하고 있습니다.
        </p>
      </div>

      <div className="mt-8">
        <p className="mb-3 text-sm font-bold text-white">앱 다운로드</p>
        <StoreBadgeButtons />
      </div>
    </div>
  );
}

function LandingFooterContent() {
  return (
    <footer className="text-left text-sm text-white/48">
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-white/58">
        {FOOTER_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <a
        className="mt-5 inline-flex items-center gap-2 text-white/76 transition hover:text-white focus:outline-none focus:ring-2 focus:ring-white/40 focus:ring-offset-2 focus:ring-offset-[#060708]"
        href={INSTAGRAM_URL}
        rel="noreferrer"
        target="_blank"
      >
        <ExternalLink aria-hidden className="h-4 w-4" />
        Instagram
      </a>

      <div className="mt-5 space-y-2 leading-6">
        <p>대표이사: 김태정 | 사업자등록번호: 722-03-03734</p>
        <p>주소 : 경기도 성남시 분당구 대왕판교로645번길 12, 경기창조경제혁신센터</p>
        <p>Copyright © Promptoon. All rights reserved.</p>
      </div>
    </footer>
  );
}

export function ConsumerDesktopLandingPanel() {
  return (
    <section className="sticky top-0 hidden h-dvh w-[480px] min-w-[480px] max-w-[480px] flex-col border-r border-white/10 bg-[#060708] px-8 py-9 text-white lg:flex">
      <div className="flex min-h-0 flex-1 items-center justify-center text-center">
        <LandingIntroContent />
      </div>
      <div className="mt-10 w-full shrink-0">
        <LandingFooterContent />
      </div>
    </section>
  );
}

function MobileLandingFooterFrame() {
  return (
    <section className="border-t border-white/10 bg-[#060708] px-5 pb-28 pt-8 text-white lg:hidden">
      <LandingFooterContent />
    </section>
  );
}

export function ConsumerResponsiveFrame({
  children,
  rightContentClassName,
  rightFrameClassName,
  showMobileLandingFrames = false
}: {
  children: ReactNode;
  rightContentClassName?: string;
  rightFrameClassName?: string;
  showMobileLandingFrames?: boolean;
}) {
  return (
    <main className="min-h-dvh bg-[#050506] text-white">
      <div className={CONSUMER_FRAME_CLASS}>
        <ConsumerDesktopLandingPanel />
        <section className={cn(CONSUMER_RIGHT_FRAME_CLASS, rightFrameClassName)}>
          <div
            className={cn(
              CONSUMER_RIGHT_CONTENT_CLASS,
              rightContentClassName
            )}
          >
            {children}
          </div>
        </section>
        {showMobileLandingFrames ? <MobileLandingFooterFrame /> : null}
      </div>
      <ConsumerBottomNav className={CONSUMER_RIGHT_NAV_CLASS} />
    </main>
  );
}

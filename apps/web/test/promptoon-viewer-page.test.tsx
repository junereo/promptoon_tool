import type { Publish } from '@promptoon/shared';
import { DEFAULT_CUT_EFFECT_DURATION_MS } from '@promptoon/shared';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useViewerStore } from '../src/features/viewer/store/use-viewer-store';
import { PromptoonViewerPage } from '../src/pages/promptoon-viewer-page';

let publishedEpisode: Publish;
const sendBeaconMock = vi.fn(() => true);
const fetchMock = vi.fn();
const shareMock = vi.fn();
const clipboardWriteTextMock = vi.fn();

vi.mock('../src/features/viewer/hooks/use-published-episode', () => ({
  usePublishedEpisode: () => ({
    isLoading: false,
    isError: false,
    data: publishedEpisode
  })
}));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  window.localStorage.clear();
  sendBeaconMock.mockClear();
  fetchMock.mockClear();
  shareMock.mockReset();
  clipboardWriteTextMock.mockReset();
  Object.defineProperty(window.navigator, 'sendBeacon', {
    configurable: true,
    value: sendBeaconMock
  });
  Object.defineProperty(window.navigator, 'share', {
    configurable: true,
    value: undefined
  });
  Object.defineProperty(window.navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: clipboardWriteTextMock
    }
  });
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: fetchMock
  });

  useViewerStore.setState({
    publishId: null,
    currentCutId: null,
    historyStack: [],
    navigationDirection: 'reset',
    isChromeVisible: true
  });

  publishedEpisode = {
    id: 'publish-1',
    projectId: 'project-1',
    episodeId: 'episode-1',
    versionNo: 1,
    status: 'published',
    createdBy: 'user-1',
    createdAt: new Date().toISOString(),
    manifest: {
      project: {
        id: 'project-1',
        title: 'Project',
        description: null,
        thumbnailUrl: null,
        status: 'draft'
      },
      episode: {
        id: 'episode-1',
        title: 'Episode 1',
        episodeNo: 1,
        status: 'draft',
        startCutId: 'cut-start'
      },
      cuts: [
        {
          id: 'cut-start',
          kind: 'choice',
          title: '시작',
          body: '어디로 갈까요?',
          dialogAnchorX: 'left',
          dialogAnchorY: 'bottom',
          dialogOffsetX: 0,
          dialogOffsetY: 0,
          dialogTextAlign: 'left',
          startEffect: 'fade',
          endEffect: 'slide-left',
          startEffectDurationMs: DEFAULT_CUT_EFFECT_DURATION_MS,
          endEffectDurationMs: DEFAULT_CUT_EFFECT_DURATION_MS,
          assetUrl: null,
          positionX: 0,
          positionY: 0,
          orderIndex: 0,
          isStart: true,
          isEnding: false,
          choices: [
            {
              id: 'choice-linked',
              label: '앞으로',
              orderIndex: 0,
              nextCutId: 'cut-end'
            },
            {
              id: 'choice-unlinked',
              label: '미완성 분기',
              orderIndex: 1,
              nextCutId: null
            }
          ]
        },
        {
          id: 'cut-end',
          kind: 'ending',
          title: '엔딩',
          body: '여기가 끝입니다.',
          dialogAnchorX: 'left',
          dialogAnchorY: 'bottom',
          dialogOffsetX: 0,
          dialogOffsetY: 0,
          dialogTextAlign: 'left',
          startEffect: 'zoom-in',
          endEffect: 'none',
          startEffectDurationMs: DEFAULT_CUT_EFFECT_DURATION_MS,
          endEffectDurationMs: DEFAULT_CUT_EFFECT_DURATION_MS,
          assetUrl: null,
          positionX: 0,
          positionY: 0,
          orderIndex: 1,
          isStart: false,
          isEnding: true,
          choices: []
        }
      ]
    }
  };
});

function renderPage(initialEntry = '/v/publish-1') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route element={<PromptoonViewerPage />} path="/v/:publishId" />
        <Route element={<div>Feed</div>} path="/" />
      </Routes>
    </MemoryRouter>
  );
}

async function getTelemetryPayloads() {
  async function readBody(body: BodyInit) {
    if (!(body instanceof Blob)) {
      return String(body);
    }

    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(body);
    });
  }

  return Promise.all(
    sendBeaconMock.mock.calls.map(async ([, body]: [string, BodyInit]) => {
      const text = await readBody(body);
      return JSON.parse(text) as Record<string, unknown>;
    })
  );
}

describe('PromptoonViewerPage', () => {
  it('loads the published start cut and disables unlinked choices', async () => {
    renderPage();

    expect(await screen.findByText('어디로 갈까요?')).toBeTruthy();
    expect(screen.getByText('어디로 갈까요?')).toBeTruthy();
    expect((screen.getByRole('button', { name: /미완성 분기/ }) as HTMLButtonElement).disabled).toBe(true);

    await waitFor(() => {
      expect(sendBeaconMock).toHaveBeenCalled();
    });

    const payloads = await getTelemetryPayloads();
    expect(payloads.some((payload) => payload.eventType === 'cut_view' && payload.cutId === 'cut-start')).toBe(true);
    expect(window.localStorage.getItem('promptoon_device_id')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('moves forward to the next cut, supports back navigation, and can reset from ending', async () => {
    renderPage();

    expect(document.querySelector('[data-active-cut-end-effect="slide-left"]')).toBeTruthy();
    expect(document.querySelector('[data-cut-id="cut-start"]')?.getAttribute('data-start-effect')).toBe('fade');
    const scrollContainer = screen.getByTestId('viewer-scroll-container');
    Object.defineProperty(scrollContainer, 'scrollTop', {
      configurable: true,
      writable: true,
      value: 0
    });

    fireEvent.click(await screen.findByRole('button', { name: '앞으로' }));
    expect(await screen.findByText('여기가 끝입니다.')).toBeTruthy();
    expect(document.querySelector('[data-cut-id="cut-end"]')?.getAttribute('data-start-effect')).toBe('zoom-in');
    expect(screen.getByRole('button', { name: '다시 보기' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '이전으로' }));
    expect(await screen.findByText('어디로 갈까요?')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '앞으로' }));
    expect(await screen.findByText('여기가 끝입니다.')).toBeTruthy();
    scrollContainer.scrollTop = 640;
    fireEvent.click(screen.getByRole('button', { name: '다시 보기' }));

    await waitFor(() => {
      expect(screen.getByText('어디로 갈까요?')).toBeTruthy();
    });
    expect(scrollContainer.scrollTop).toBe(0);

    scrollContainer.scrollTop = 520;
    fireEvent.click(screen.getByRole('button', { name: '앞으로' }));
    expect(await screen.findByText('여기가 끝입니다.')).toBeTruthy();
    expect(scrollContainer.scrollTop).toBe(0);

    const payloads = await getTelemetryPayloads();
    expect(payloads.some((payload) => payload.eventType === 'choice_click' && payload.choiceId === 'choice-linked')).toBe(true);
    expect(payloads.some((payload) => payload.eventType === 'ending_reach' && payload.cutId === 'cut-end')).toBe(true);
  });

  it('shows a spoiler-safe banner for shared endings and dismisses it after the first forward navigation', async () => {
    renderPage('/v/publish-1?e=cut-end');

    expect(await screen.findByText(/친구가 "엔딩" 엔딩을 봤습니다/)).toBeTruthy();
    expect(screen.getByText('어디로 갈까요?')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '앞으로' }));

    await waitFor(() => {
      expect(screen.queryByText(/친구가 "엔딩" 엔딩을 봤습니다/)).toBeNull();
    });
  });

  it('copies the backend share URL on desktop fallback when sharing an ending result', async () => {
    clipboardWriteTextMock.mockResolvedValue(undefined);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: '앞으로' }));
    fireEvent.click(await screen.findByRole('button', { name: '결과 공유하기' }));

    await waitFor(() => {
      expect(clipboardWriteTextMock).toHaveBeenCalledWith(`${window.location.origin}/api/promptoon/share/publish-1?e=cut-end`);
    });

    expect((await screen.findByRole('status')).textContent).toContain('링크가 복사되었습니다.');
  });

  it('uses the native share sheet when navigator.share is available', async () => {
    shareMock.mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'share', {
      configurable: true,
      value: shareMock
    });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: '앞으로' }));
    fireEvent.click(await screen.findByRole('button', { name: '결과 공유하기' }));

    await waitFor(() => {
      expect(shareMock).toHaveBeenCalledWith({
        title: 'Episode 1 - 나는 "엔딩" 엔딩을 봤어!',
        text: 'Episode 1 - 나는 "엔딩" 엔딩을 봤어! 넌 어떤 엔딩이 나올까?',
        url: `${window.location.origin}/api/promptoon/share/publish-1?e=cut-end`
      });
    });
  });

  it('can start from a feed choice and uses back navigation to reveal the hidden start cut', async () => {
    renderPage('/v/publish-1?startChoice=choice-linked');

    expect(await screen.findByText('여기가 끝입니다.')).toBeTruthy();
    expect(screen.queryByText('어디로 갈까요?')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '이전으로' }));

    expect(await screen.findByText('어디로 갈까요?')).toBeTruthy();
  });

  it('falls back to the public feed when close is pressed without browser history', async () => {
    renderPage('/v/publish-1');

    fireEvent.click(await screen.findByRole('button', { name: '닫기' }));

    expect(await screen.findByText('Feed')).toBeTruthy();
  });

  it('expands linked scene cuts until a choice cut and hides scene choices in compact layout', async () => {
    publishedEpisode = {
      ...publishedEpisode,
      manifest: {
        ...publishedEpisode.manifest,
        cuts: [
          {
            id: 'cut-start',
            kind: 'scene',
            title: '시작',
            body: '시작 컷입니다.',
            dialogAnchorX: 'left',
            dialogAnchorY: 'bottom',
            dialogOffsetX: 0,
            dialogOffsetY: 0,
            dialogTextAlign: 'left',
            startEffect: 'fade',
            endEffect: 'slide-left',
            startEffectDurationMs: DEFAULT_CUT_EFFECT_DURATION_MS,
            endEffectDurationMs: DEFAULT_CUT_EFFECT_DURATION_MS,
            assetUrl: null,
            positionX: 0,
            positionY: 0,
            orderIndex: 0,
            isStart: true,
            isEnding: false,
            choices: [
              {
                id: 'choice-linked',
                label: '다음으로',
                orderIndex: 0,
                nextCutId: 'cut-middle'
              }
            ]
          },
          {
            id: 'cut-middle',
            kind: 'scene',
            title: '중간',
            body: '자동으로 이어집니다.',
            dialogAnchorX: 'left',
            dialogAnchorY: 'bottom',
            dialogOffsetX: 0,
            dialogOffsetY: 0,
            dialogTextAlign: 'left',
            startEffect: 'slide-up',
            endEffect: 'fade',
            startEffectDurationMs: DEFAULT_CUT_EFFECT_DURATION_MS,
            endEffectDurationMs: DEFAULT_CUT_EFFECT_DURATION_MS,
            assetUrl: null,
            positionX: 0,
            positionY: 0,
            orderIndex: 1,
            isStart: false,
            isEnding: false,
            choices: [
              {
                id: 'choice-middle',
                label: '갈림길로',
                orderIndex: 0,
                nextCutId: 'cut-branch'
              }
            ]
          },
          {
            id: 'cut-branch',
            kind: 'choice',
            title: '분기',
            body: '여기서 선택합니다.',
            dialogAnchorX: 'left',
            dialogAnchorY: 'bottom',
            dialogOffsetX: 0,
            dialogOffsetY: 0,
            dialogTextAlign: 'left',
            startEffect: 'fade',
            endEffect: 'slide-left',
            startEffectDurationMs: DEFAULT_CUT_EFFECT_DURATION_MS,
            endEffectDurationMs: DEFAULT_CUT_EFFECT_DURATION_MS,
            assetUrl: null,
            positionX: 0,
            positionY: 0,
            orderIndex: 2,
            isStart: false,
            isEnding: false,
            choices: [
              {
                id: 'choice-branch-left',
                label: '왼쪽으로',
                orderIndex: 0,
                nextCutId: 'cut-end'
              }
            ]
          },
          {
            id: 'cut-end',
            kind: 'ending',
            title: '엔딩',
            body: '마지막 컷입니다.',
            dialogAnchorX: 'left',
            dialogAnchorY: 'bottom',
            dialogOffsetX: 0,
            dialogOffsetY: 0,
            dialogTextAlign: 'left',
            startEffect: 'zoom-in',
            endEffect: 'none',
            startEffectDurationMs: DEFAULT_CUT_EFFECT_DURATION_MS,
            endEffectDurationMs: DEFAULT_CUT_EFFECT_DURATION_MS,
            assetUrl: null,
            positionX: 0,
            positionY: 0,
            orderIndex: 3,
            isStart: false,
            isEnding: true,
            choices: []
          }
        ]
      }
    };

    const { container } = renderPage();

    expect(await screen.findByText('시작 컷입니다.')).toBeTruthy();
    expect(await screen.findByText('자동으로 이어집니다.')).toBeTruthy();
    expect(await screen.findByText('여기서 선택합니다.')).toBeTruthy();
    expect(document.querySelector('[data-cut-id="cut-start"]')?.getAttribute('data-start-effect')).toBe('fade');
    expect(document.querySelector('[data-cut-id="cut-middle"]')?.getAttribute('data-start-effect')).toBe('slide-up');
    expect(document.querySelector('[data-cut-id="cut-branch"]')?.getAttribute('data-start-effect')).toBe('fade');
    expect(screen.queryByRole('button', { name: '다음으로' })).toBeNull();
    expect(screen.queryByRole('button', { name: '갈림길로' })).toBeNull();
    expect(screen.getByRole('button', { name: '왼쪽으로' })).toBeTruthy();
    expect(container.querySelectorAll('[data-viewer-layout="compact"]').length).toBe(3);

    fireEvent.click(screen.getByRole('button', { name: '왼쪽으로' }));

    expect(await screen.findByText('마지막 컷입니다.')).toBeTruthy();
    expect(document.querySelector('[data-cut-id="cut-end"]')?.getAttribute('data-start-effect')).toBe('zoom-in');

    await waitFor(() => {
      expect(sendBeaconMock).toHaveBeenCalled();
    });

    const payloads = await getTelemetryPayloads();
    expect(payloads.some((payload) => payload.eventType === 'cut_view' && payload.cutId === 'cut-start')).toBe(true);
    expect(payloads.some((payload) => payload.eventType === 'cut_view' && payload.cutId === 'cut-middle')).toBe(true);
    expect(payloads.some((payload) => payload.eventType === 'cut_view' && payload.cutId === 'cut-branch')).toBe(true);
    expect(payloads.some((payload) => payload.eventType === 'choice_click' && payload.choiceId === 'choice-branch-left')).toBe(true);
    expect(payloads.some((payload) => payload.eventType === 'ending_reach' && payload.cutId === 'cut-end')).toBe(true);
  });

  it('animates the immediate next cut when a choice enters an auto-expanded scene chain', async () => {
    publishedEpisode = {
      ...publishedEpisode,
      manifest: {
        ...publishedEpisode.manifest,
        cuts: [
          {
            id: 'cut-start',
            kind: 'choice',
            title: '선택',
            body: '어디로 갈까요?',
            dialogAnchorX: 'left',
            dialogAnchorY: 'bottom',
            dialogOffsetX: 0,
            dialogOffsetY: 0,
            dialogTextAlign: 'left',
            startEffect: 'fade',
            endEffect: 'slide-left',
            startEffectDurationMs: DEFAULT_CUT_EFFECT_DURATION_MS,
            endEffectDurationMs: DEFAULT_CUT_EFFECT_DURATION_MS,
            assetUrl: null,
            positionX: 0,
            positionY: 0,
            orderIndex: 0,
            isStart: true,
            isEnding: false,
            choices: [
              {
                id: 'choice-linked',
                label: '다음으로',
                orderIndex: 0,
                nextCutId: 'cut-middle'
              }
            ]
          },
          {
            id: 'cut-middle',
            kind: 'scene',
            title: '중간',
            body: '줌인으로 들어옵니다.',
            dialogAnchorX: 'left',
            dialogAnchorY: 'bottom',
            dialogOffsetX: 0,
            dialogOffsetY: 0,
            dialogTextAlign: 'left',
            startEffect: 'zoom-in',
            endEffect: 'fade',
            startEffectDurationMs: 1000,
            endEffectDurationMs: DEFAULT_CUT_EFFECT_DURATION_MS,
            assetUrl: null,
            positionX: 0,
            positionY: 0,
            orderIndex: 1,
            isStart: false,
            isEnding: false,
            choices: [
              {
                id: 'choice-middle',
                label: '갈림길로',
                orderIndex: 0,
                nextCutId: 'cut-branch'
              }
            ]
          },
          {
            id: 'cut-branch',
            kind: 'choice',
            title: '분기',
            body: '분기까지 이어집니다.',
            dialogAnchorX: 'left',
            dialogAnchorY: 'bottom',
            dialogOffsetX: 0,
            dialogOffsetY: 0,
            dialogTextAlign: 'left',
            startEffect: 'fade',
            endEffect: 'slide-left',
            startEffectDurationMs: DEFAULT_CUT_EFFECT_DURATION_MS,
            endEffectDurationMs: DEFAULT_CUT_EFFECT_DURATION_MS,
            assetUrl: null,
            positionX: 0,
            positionY: 0,
            orderIndex: 2,
            isStart: false,
            isEnding: false,
            choices: [
              {
                id: 'choice-branch-left',
                label: '왼쪽으로',
                orderIndex: 0,
                nextCutId: 'cut-end'
              }
            ]
          },
          {
            id: 'cut-end',
            kind: 'ending',
            title: '엔딩',
            body: '마지막 컷입니다.',
            dialogAnchorX: 'left',
            dialogAnchorY: 'bottom',
            dialogOffsetX: 0,
            dialogOffsetY: 0,
            dialogTextAlign: 'left',
            startEffect: 'zoom-in',
            endEffect: 'none',
            startEffectDurationMs: DEFAULT_CUT_EFFECT_DURATION_MS,
            endEffectDurationMs: DEFAULT_CUT_EFFECT_DURATION_MS,
            assetUrl: null,
            positionX: 0,
            positionY: 0,
            orderIndex: 3,
            isStart: false,
            isEnding: true,
            choices: []
          }
        ]
      }
    };

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: '다음으로' }));

    expect(await screen.findByText('줌인으로 들어옵니다.')).toBeTruthy();
    const activePath = document.querySelector('[data-active-cut-id="cut-middle"]');
    expect(activePath?.getAttribute('data-active-cut-start-effect')).toBe('zoom-in');
    expect(activePath?.getAttribute('data-active-cut-start-duration-ms')).toBe('1000');
    expect(screen.queryByText('분기까지 이어집니다.')).toBeNull();
    expect(screen.queryByRole('button', { name: '갈림길로' })).toBeNull();
    expect(screen.queryByRole('button', { name: '왼쪽으로' })).toBeNull();

    expect(await screen.findByText('분기까지 이어집니다.', {}, { timeout: 1600 })).toBeTruthy();
    expect(screen.getByRole('button', { name: '왼쪽으로' })).toBeTruthy();
  });

  it('keeps a single linked choice clickable for non-scene cuts', async () => {
    publishedEpisode = {
      ...publishedEpisode,
      manifest: {
        ...publishedEpisode.manifest,
        cuts: [
          {
            id: 'cut-start',
            kind: 'choice',
            title: '선택',
            body: '버튼으로 진행합니다.',
            dialogAnchorX: 'left',
            dialogAnchorY: 'bottom',
            dialogOffsetX: 0,
            dialogOffsetY: 0,
            dialogTextAlign: 'left',
            startEffect: 'fade',
            endEffect: 'slide-left',
            startEffectDurationMs: DEFAULT_CUT_EFFECT_DURATION_MS,
            endEffectDurationMs: DEFAULT_CUT_EFFECT_DURATION_MS,
            assetUrl: null,
            positionX: 0,
            positionY: 0,
            orderIndex: 0,
            isStart: true,
            isEnding: false,
            choices: [
              {
                id: 'choice-linked',
                label: '다음으로',
                orderIndex: 0,
                nextCutId: 'cut-end'
              }
            ]
          },
          {
            id: 'cut-end',
            kind: 'ending',
            title: '엔딩',
            body: '마지막 컷입니다.',
            dialogAnchorX: 'left',
            dialogAnchorY: 'bottom',
            dialogOffsetX: 0,
            dialogOffsetY: 0,
            dialogTextAlign: 'left',
            startEffect: 'zoom-in',
            endEffect: 'none',
            startEffectDurationMs: DEFAULT_CUT_EFFECT_DURATION_MS,
            endEffectDurationMs: DEFAULT_CUT_EFFECT_DURATION_MS,
            assetUrl: null,
            positionX: 0,
            positionY: 0,
            orderIndex: 1,
            isStart: false,
            isEnding: true,
            choices: []
          }
        ]
      }
    };

    renderPage();

    expect(await screen.findByText('버튼으로 진행합니다.')).toBeTruthy();
    expect(screen.getByRole('button', { name: '다음으로' })).toBeTruthy();
    expect(screen.queryByText('잠시 후 다음 장면으로 이동합니다.')).toBeNull();
  });

  it('falls back to none when an older manifest omits cut effect fields', async () => {
    publishedEpisode = {
      ...publishedEpisode,
      manifest: {
        ...publishedEpisode.manifest,
        cuts: publishedEpisode.manifest.cuts.map((cut) => {
          const { startEffect: _startEffect, endEffect: _endEffect, ...legacyCut } = cut;
          return legacyCut;
        }) as Publish['manifest']['cuts']
      }
    };

    renderPage();

    expect(await screen.findByText('어디로 갈까요?')).toBeTruthy();
    expect(document.querySelector('[data-cut-id="cut-start"]')?.getAttribute('data-start-effect')).toBe('none');
  });

  it('only shows viewer controls at the top or bottom of the scroll container', async () => {
    renderPage();

    expect(await screen.findByText('어디로 갈까요?')).toBeTruthy();

    const controls = screen.getByTestId('viewer-controls');
    const scrollContainer = screen.getByTestId('viewer-scroll-container');

    Object.defineProperties(scrollContainer, {
      clientHeight: {
        configurable: true,
        value: 500
      },
      scrollHeight: {
        configurable: true,
        value: 1200
      }
    });

    expect(controls.className).toContain('opacity-100');

    Object.defineProperty(scrollContainer, 'scrollTop', {
      configurable: true,
      value: 240
    });
    fireEvent.scroll(scrollContainer);

    await waitFor(() => {
      expect(controls.className).toContain('opacity-0');
    });

    fireEvent.pointerMove(screen.getByText('어디로 갈까요?'));
    expect(controls.className).toContain('opacity-0');

    Object.defineProperty(scrollContainer, 'scrollTop', {
      configurable: true,
      value: 700
    });
    fireEvent.scroll(scrollContainer);

    await waitFor(() => {
      expect(controls.className).toContain('opacity-100');
    });
  });

  it('uses a single scroll container inside the responsive 9:16 viewer frame', async () => {
    renderPage();

    expect(await screen.findByText('어디로 갈까요?')).toBeTruthy();

    const frame = screen.getByTestId('viewer-frame');
    const scrollContainer = screen.getByTestId('viewer-scroll-container');

    expect(frame.className).toContain('overflow-hidden');
    expect(frame.className).toContain('sm:h-[min(100dvh,calc(100vw*16/9))]');
    expect(frame.className).toContain('sm:w-[min(100vw,calc(100dvh*9/16))]');
    expect(frame.className).not.toContain('sm:max-w-[420px]');
    expect(scrollContainer.className).toContain('overflow-y-auto');
    expect(scrollContainer.className).toContain('h-full');
  });

  it('forwards scroll gestures from the frame gutter into the viewer scroll container', async () => {
    renderPage();

    expect(await screen.findByText('어디로 갈까요?')).toBeTruthy();

    const scrollSurface = screen.getByTestId('viewer-scroll-surface');
    const scrollContainer = screen.getByTestId('viewer-scroll-container');

    Object.defineProperty(scrollContainer, 'scrollTop', {
      configurable: true,
      writable: true,
      value: 0
    });
    Object.defineProperties(scrollContainer, {
      clientHeight: {
        configurable: true,
        value: 500
      },
      scrollHeight: {
        configurable: true,
        value: 1200
      }
    });

    fireEvent.wheel(scrollSurface, { deltaY: 180 });

    expect(scrollContainer.scrollTop).toBe(180);
  });
});

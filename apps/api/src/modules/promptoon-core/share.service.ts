import type { Publish } from '@promptoon/shared';
import { deriveCutBody } from '@promptoon/shared';
import { readFile } from 'node:fs/promises';

import { resolveFromWorkspaceRoot } from '../../lib/workspace-paths';

interface SharePageMeta {
  title: string;
  description: string;
  imageUrl: string | null;
  redirectUrl: string;
  shareUrl: string;
}

export interface SharePageOptions {
  sharePath?: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/$/, '');
}

function summarizeDescription(value: string | null | undefined, fallback: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    return fallback;
  }

  return normalized.length > 180 ? `${normalized.slice(0, 177)}...` : normalized;
}

function isEndingLikeCut(cut: { isEnding?: boolean; kind: string }): boolean {
  return Boolean(cut.isEnding) || cut.kind === 'ending' || cut.kind === 'resultCard';
}

function toAbsoluteUrl(baseOrigin: string, value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  const normalizedOrigin = trimTrailingSlash(baseOrigin);
  if (value.startsWith('/')) {
    return `${normalizedOrigin}${value}`;
  }

  return `${normalizedOrigin}/${value}`;
}

function getShareImageUrl(publish: Publish, endingCutId: string | undefined, baseOrigin: string): string | null {
  const manifest = publish.manifest;
  const endingCut =
    endingCutId
      ? manifest.cuts.find((cut) => cut.id === endingCutId && isEndingLikeCut(cut)) ?? null
      : null;
  const fallbackCutWithImage = manifest.cuts.find((cut) => Boolean(cut.assetUrl)) ?? null;

  return (
    toAbsoluteUrl(baseOrigin, endingCut?.assetUrl) ??
    toAbsoluteUrl(baseOrigin, manifest.episode.coverImageUrl) ??
    toAbsoluteUrl(baseOrigin, fallbackCutWithImage?.assetUrl) ??
    toAbsoluteUrl(baseOrigin, manifest.project.thumbnailUrl)
  );
}

function buildSharePageMeta(
  publish: Publish,
  endingCutId: string | undefined,
  baseOrigin: string,
  options: SharePageOptions = {}
): SharePageMeta {
  const manifest = publish.manifest;
  const validEndingCut =
    endingCutId
      ? manifest.cuts.find((cut) => cut.id === endingCutId && isEndingLikeCut(cut)) ?? null
      : null;
  const querySuffix = validEndingCut ? `?e=${encodeURIComponent(validEndingCut.id)}` : '';
  const redirectUrl = `${trimTrailingSlash(baseOrigin)}/v/${publish.id}${querySuffix}`;
  const sharePath = options.sharePath ?? `/api/promptoon/share/${publish.id}`;
  const normalizedSharePath = sharePath.startsWith('/') ? sharePath : `/${sharePath}`;
  const shareUrl = `${trimTrailingSlash(baseOrigin)}${normalizedSharePath}${querySuffix}`;
  const title = validEndingCut
    ? `${manifest.episode.title} - 나는 "${validEndingCut.title}" 엔딩을 봤어!`
    : `${manifest.episode.title} - 인터랙티브 웹툰`;
  const description = summarizeDescription(
    deriveCutBody(validEndingCut?.contentBlocks ?? [], validEndingCut?.body ?? manifest.project.description ?? '') ||
      manifest.project.description,
    validEndingCut
      ? `${validEndingCut.title} 엔딩을 확인해보세요. 당신은 어떤 결말에 도달할까요?`
      : `${manifest.episode.title}의 분기 엔딩을 확인해보세요.`
  );

  return {
    title,
    description,
    imageUrl: getShareImageUrl(publish, validEndingCut?.id, baseOrigin),
    redirectUrl,
    shareUrl
  };
}

async function getBaseShareTemplate(): Promise<string> {
  try {
    return await readFile(resolveFromWorkspaceRoot('apps/web/index.html'), 'utf8');
  } catch {
    return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Promptoon</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;
  }
}

function buildShareBody(meta: SharePageMeta): string {
  return `
    <main style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#050506;color:#f4f4f5;font-family:system-ui,sans-serif;">
      <div style="max-width:560px;text-align:center;">
        <p style="margin:0 0 12px;color:#a1a1aa;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;">Promptoon Share</p>
        <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2;">${escapeHtml(meta.title)}</h1>
        <p style="margin:0 0 22px;color:#d4d4d8;line-height:1.6;">${escapeHtml(meta.description)}</p>
        <p style="margin:0;color:#71717a;font-size:14px;">잠시 후 뷰어로 이동합니다.</p>
        <p style="margin:18px 0 0;"><a href="${escapeHtml(meta.redirectUrl)}" style="color:#f4f4f5;">계속하려면 여기를 클릭하세요</a></p>
      </div>
    </main>
    <script>
      window.location.replace(${JSON.stringify(meta.redirectUrl)});
    </script>
  `;
}

function injectShareTemplate(template: string, meta: SharePageMeta): string {
  const escapedTitle = escapeHtml(meta.title);
  const escapedDescription = escapeHtml(meta.description);
  const imageTags = meta.imageUrl
    ? `
    <meta property="og:image" content="${escapeHtml(meta.imageUrl)}" />
    <meta name="twitter:image" content="${escapeHtml(meta.imageUrl)}" />`
    : '';
  const headTags = `
    <meta name="description" content="${escapedDescription}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapedTitle}" />
    <meta property="og:description" content="${escapedDescription}" />
    <meta property="og:url" content="${escapeHtml(meta.shareUrl)}" />${imageTags}
    <meta name="twitter:card" content="${meta.imageUrl ? 'summary_large_image' : 'summary'}" />
    <meta name="twitter:title" content="${escapedTitle}" />
    <meta name="twitter:description" content="${escapedDescription}" />`;
  const bodyContent = buildShareBody(meta);
  const withTitle = template.includes('</title>')
    ? template.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapedTitle}</title>`)
    : template.replace('</head>', `  <title>${escapedTitle}</title>\n</head>`);
  const withHead = withTitle.includes('</head>') ? withTitle.replace('</head>', `${headTags}\n  </head>`) : withTitle;

  return withHead.match(/<body([^>]*)>[\s\S]*<\/body>/i)
    ? withHead.replace(/<body([^>]*)>[\s\S]*<\/body>/i, `<body$1>${bodyContent}</body>`)
    : `${withHead}\n<body>${bodyContent}</body>`;
}

export async function renderSharePage(
  publish: Publish,
  endingCutId: string | undefined,
  baseOrigin: string,
  options: SharePageOptions = {}
): Promise<string> {
  const template = await getBaseShareTemplate();
  const meta = buildSharePageMeta(publish, endingCutId, baseOrigin, options);

  return injectShareTemplate(template, meta);
}

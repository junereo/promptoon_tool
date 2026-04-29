import type { PromptoonResultCardContentBlock } from '@promptoon/shared';

import { RESULT_CARD_STAMP_ASSET_URL, RESULT_CARD_THEME_STYLES } from './result-card';

const RESULT_CARD_EXPORT_SIZE = 960;
const RESULT_CARD_IMAGE_HEIGHT = 336;
const RESULT_CARD_CONTENT_Y = RESULT_CARD_IMAGE_HEIGHT;
const RESULT_CARD_CONTENT_HEIGHT = RESULT_CARD_EXPORT_SIZE - RESULT_CARD_IMAGE_HEIGHT;

interface SaveResultCardAsWebpInput {
  assetUrl?: string | null;
  block: PromptoonResultCardContentBlock;
}

function escapeSvgText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function escapeSvgAttribute(value: string): string {
  return escapeSvgText(value);
}

function estimateTextWidth(value: string, fontSize: number, letterSpacing = 0): number {
  return Array.from(value).reduce((width, character) => {
    const characterWidth = /[A-Za-z0-9]/.test(character) ? fontSize * 0.62 : fontSize;
    return width + characterWidth + letterSpacing;
  }, 0);
}

function fitTextAttributes(value: string, fontSize: number, maxWidth: number, letterSpacing = 0): string {
  return estimateTextWidth(value, fontSize, letterSpacing) > maxWidth ? ` textLength="${maxWidth}" lengthAdjust="spacingAndGlyphs"` : '';
}

function getPillWidth(value: string, fontSize: number, paddingX: number, maxWidth: number, letterSpacing = 0): number {
  return Math.min(maxWidth, Math.max(100, estimateTextWidth(value, fontSize, letterSpacing) + paddingX * 2));
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read image data.'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

async function loadAssetAsDataUrl(assetUrl?: string | null): Promise<string | null> {
  if (!assetUrl) {
    return null;
  }

  if (assetUrl.startsWith('data:')) {
    return assetUrl;
  }

  try {
    const response = await fetch(assetUrl, {
      cache: 'force-cache'
    });

    if (!response.ok) {
      return null;
    }

    return await blobToDataUrl(await response.blob());
  } catch {
    return null;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load result card SVG.'));
    image.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (typeof canvas.toBlob === 'function') {
      canvas.toBlob((blob) => resolve(blob), mimeType, quality);
      return;
    }

    try {
      void fetch(canvas.toDataURL(mimeType, quality))
        .then((response) => response.blob())
        .then(resolve)
        .catch(() => resolve(null));
    } catch {
      resolve(null);
    }
  });
}

function downloadBlob(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = fileName;
  link.href = objectUrl;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export async function createResultCardSvg(block: PromptoonResultCardContentBlock, assetUrl?: string | null): Promise<string> {
  const themeStyle = RESULT_CARD_THEME_STYLES[block.theme] ?? RESULT_CARD_THEME_STYLES.blue;
  const assetDataUrl = await loadAssetAsDataUrl(assetUrl);
  const stampDataUrl = await loadAssetAsDataUrl(RESULT_CARD_STAMP_ASSET_URL);
  const badge = escapeSvgText(block.badge);
  const tagline = escapeSvgText(block.tagline);
  const badgeWidth = getPillWidth(block.badge, 20, 28, 250, 3.2);
  const taglineWidth = getPillWidth(block.tagline, 22, 26, 820);
  const lines = block.lines.slice(0, 6);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${RESULT_CARD_EXPORT_SIZE}" height="${RESULT_CARD_EXPORT_SIZE}" viewBox="0 0 ${RESULT_CARD_EXPORT_SIZE} ${RESULT_CARD_EXPORT_SIZE}">
  <defs>
    <clipPath id="cardClip">
      <rect x="2" y="2" width="956" height="956" rx="20" ry="20"/>
    </clipPath>
    <clipPath id="stampClip">
      <circle cx="810" cy="610" r="72"/>
    </clipPath>
    <linearGradient id="imageFallback" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="${themeStyle.bottomFrom}"/>
      <stop offset="50%" stop-color="#111111"/>
      <stop offset="100%" stop-color="${themeStyle.bottomTo}"/>
    </linearGradient>
    <linearGradient id="imageFade" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.8)"/>
    </linearGradient>
    <linearGradient id="bottomGradient" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="${themeStyle.bottomFrom}"/>
      <stop offset="100%" stop-color="${themeStyle.bottomTo}"/>
    </linearGradient>
  </defs>
  <rect width="960" height="960" fill="#050506"/>
  <g clip-path="url(#cardClip)">
    ${
      assetDataUrl
        ? `<image href="${escapeSvgAttribute(assetDataUrl)}" x="0" y="0" width="960" height="${RESULT_CARD_IMAGE_HEIGHT}" preserveAspectRatio="xMidYMid slice"/>`
        : `<rect x="0" y="0" width="960" height="${RESULT_CARD_IMAGE_HEIGHT}" fill="url(#imageFallback)"/>`
    }
    <rect x="0" y="0" width="960" height="${RESULT_CARD_IMAGE_HEIGHT}" fill="${themeStyle.imageTint}"/>
    <rect x="0" y="200" width="960" height="136" fill="url(#imageFade)"/>
    <rect x="32" y="32" width="${badgeWidth}" height="42" rx="21" fill="rgba(0,0,0,0.12)" stroke="${themeStyle.inflowBorder}" stroke-width="2"/>
    <text x="60" y="59" fill="${themeStyle.text}" font-family="'Noto Sans KR', 'IBM Plex Sans', Arial, sans-serif" font-size="20" font-weight="700" letter-spacing="3.2"${fitTextAttributes(block.badge, 20, badgeWidth - 56, 3.2)}>${badge}</text>

    <rect x="0" y="${RESULT_CARD_CONTENT_Y}" width="960" height="${RESULT_CARD_CONTENT_HEIGHT}" fill="url(#bottomGradient)"/>
    <text x="40" y="420" fill="${themeStyle.text}" font-family="'Noto Serif KR', 'Playfair Display', Georgia, serif" font-size="42" font-weight="700"${fitTextAttributes(block.resultName, 42, 880)}>${escapeSvgText(block.resultName)}</text>
    <rect x="40" y="448" width="${taglineWidth}" height="40" rx="20" fill="rgba(0,0,0,0.08)" stroke="${themeStyle.taglineBorder}" stroke-width="2"/>
    <text x="66" y="475" fill="${themeStyle.text}" font-family="'Noto Sans KR', 'IBM Plex Sans', Arial, sans-serif" font-size="22" font-weight="600"${fitTextAttributes(block.tagline, 22, taglineWidth - 52)}>${tagline}</text>
    ${lines
      .map(
        (line, index) =>
          `<text x="40" y="${540 + index * 34}" fill="${themeStyle.mutedText}" font-family="'Noto Sans KR', 'IBM Plex Sans', Arial, sans-serif" font-size="23" font-weight="400"${fitTextAttributes(line, 23, 620)}>${escapeSvgText(line)}</text>`
      )
      .join('\n    ')}

    <g transform="rotate(-8 810 610)" opacity="0.76">
      <circle cx="810" cy="610" r="79" fill="rgba(0,0,0,0.15)" stroke="${themeStyle.inflowBorder}" stroke-width="3"/>
      ${
        stampDataUrl
          ? `<image href="${escapeSvgAttribute(stampDataUrl)}" x="738" y="538" width="144" height="144" preserveAspectRatio="xMidYMid slice" clip-path="url(#stampClip)"/>`
          : `<circle cx="810" cy="610" r="72" fill="rgba(255,255,255,0.08)"/>`
      }
    </g>

    <rect x="40" y="806" width="880" height="104" rx="16" fill="rgba(0,0,0,0.18)" stroke="${themeStyle.inflowBorder}" stroke-width="2"/>
    <text x="64" y="846" fill="${themeStyle.mutedText}" font-family="'Noto Sans KR', 'IBM Plex Sans', Arial, sans-serif" font-size="18" font-weight="700" letter-spacing="3.6"${fitTextAttributes(block.inflowLabel, 18, 430, 3.6)}>${escapeSvgText(block.inflowLabel)}</text>
    <text x="64" y="878" fill="${themeStyle.text}" font-family="'Noto Sans KR', 'IBM Plex Sans', Arial, sans-serif" font-size="24" font-weight="700"${fitTextAttributes(block.inflowUrl, 24, 430)}>${escapeSvgText(block.inflowUrl)}</text>
    <text x="896" y="852" text-anchor="end" fill="${themeStyle.text}" font-family="'Noto Sans KR', 'IBM Plex Sans', Arial, sans-serif" font-size="21" font-weight="700"${fitTextAttributes(block.inflowBrand, 21, 260)}>${escapeSvgText(block.inflowBrand)}</text>
    <text x="896" y="882" text-anchor="end" fill="${themeStyle.mutedText}" font-family="'Noto Sans KR', 'IBM Plex Sans', Arial, sans-serif" font-size="18" font-weight="400"${fitTextAttributes(block.inflowTagline, 18, 260)}>${escapeSvgText(block.inflowTagline)}</text>
  </g>
  <rect x="1" y="1" width="958" height="958" rx="20" ry="20" fill="none" stroke="${themeStyle.border}" stroke-width="4"/>
</svg>`;
}

export async function saveResultCardAsWebp({ assetUrl, block }: SaveResultCardAsWebpInput): Promise<void> {
  const svg = await createResultCardSvg(block, assetUrl);
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));

  try {
    const image = await loadImage(svgUrl);
    const canvas = document.createElement('canvas');
    canvas.width = RESULT_CARD_EXPORT_SIZE;
    canvas.height = RESULT_CARD_EXPORT_SIZE;
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Canvas is not available.');
    }

    context.drawImage(image, 0, 0, RESULT_CARD_EXPORT_SIZE, RESULT_CARD_EXPORT_SIZE);
    const webpBlob = await canvasToBlob(canvas, 'image/webp', 0.92);
    const blob = webpBlob ?? (await canvasToBlob(canvas, 'image/png'));

    if (!blob) {
      throw new Error('Failed to encode result card image.');
    }

    downloadBlob(blob, webpBlob ? 'promptoon-result-card.webp' : 'promptoon-result-card.png');
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

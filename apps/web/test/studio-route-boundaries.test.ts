import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

async function readWebSource(relativePath: string): Promise<string> {
  return readFile(path.join(process.cwd(), 'src', relativePath), 'utf8');
}

describe('Studio route boundaries', () => {
  it('registers standalone Studio project pages behind the protected Studio shell', async () => {
    const routerSource = await readWebSource('app/router.tsx');

    expect(routerSource).toContain("path: '/studio'");
    expect(routerSource).toContain('path: \'projects/:projectId\'');
    expect(routerSource).toContain('path: \'projects/:projectId/series\'');
    expect(routerSource).toContain('path: \'projects/:projectId/settings\'');
    expect(routerSource).toContain('path: \'projects/:projectId/assets\'');
    expect(routerSource).toContain('path: \'projects/:projectId/history\'');
    expect(routerSource).toContain('path: \'projects/:projectId/members\'');
    expect(routerSource).toContain('path: \'projects/:projectId/publish\'');
    expect(routerSource).toContain('path: \'projects/:projectId/analytics\'');
    expect(routerSource).toContain('path: \'community/publishes/:publishId\'');
    expect(routerSource).toContain('<ProtectedRoute requireStudio>');
  });

  it('links project analytics summaries to the episode analytics tab', async () => {
    const analyticsSource = await readWebSource('domains/studio/pages/StudioAnalyticsPage.tsx');
    const editorSource = await readWebSource('pages/promptoon-episode-editor-page.tsx');

    expect(analyticsSource).toContain('?tab=analytics');
    expect(editorSource).toContain("searchParams.get('tab') === 'analytics'");
  });

  it('keeps Studio standalone candidate pages connected to domain APIs', async () => {
    const settingsSource = await readWebSource('domains/studio/pages/StudioProjectSettingsPage.tsx');
    const assetsSource = await readWebSource('domains/studio/pages/StudioAssetLibraryPage.tsx');
    const historySource = await readWebSource('domains/studio/pages/StudioPublishHistoryPage.tsx');
    const communitySource = await readWebSource('domains/studio/pages/StudioCommunityModerationPage.tsx');

    expect(settingsSource).toContain('usePatchProject');
    expect(assetsSource).toContain('useProjectAssets');
    expect(historySource).toContain('useProjectPublishHistory');
    expect(communitySource).toContain('getCommunityEmbed');
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';

import { publicRootApiClient, rootApiClient } from '../src/shared/api/client';
import { communityApi } from '../src/shared/api/community.api';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('communityApi', () => {
  it('uses public comments meta and embed endpoints', async () => {
    const metaResponse = { data: { publishId: 'publish-1', commentCount: 0 } };
    const embedResponse = { data: { publishId: 'publish-1', provider: 'promptoon', title: '댓글', commentCount: 0 } };
    const getSpy = vi.spyOn(publicRootApiClient, 'get')
      .mockResolvedValueOnce(metaResponse)
      .mockResolvedValueOnce(embedResponse);
    const postSpy = vi.spyOn(rootApiClient, 'post').mockResolvedValue({ data: {} });

    await communityApi.getCommentsMeta('publish-1');
    await communityApi.getCommunityEmbed('publish-1');
    await communityApi.createEpisodeDiscussion('episode-1');

    expect(getSpy).toHaveBeenNthCalledWith(1, '/community/publishes/publish-1/comments-meta');
    expect(getSpy).toHaveBeenNthCalledWith(2, '/community/publishes/publish-1/embed');
    expect(postSpy).toHaveBeenCalledWith('/community/episodes/episode-1/discussion');
  });
});

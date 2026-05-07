import { afterEach, describe, expect, it, vi } from 'vitest';

import { rootApiClient } from '../src/shared/api/client';
import { studioApi } from '../src/shared/api/studio.api';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('studioApi', () => {
  it('uses the studio project and backup endpoints', async () => {
    const listResponse = { data: [] };
    const backupResponse = { data: { schemaVersion: 1 } };
    const projectResponse = { data: { id: 'project-1' } };
    const assetsResponse = { data: { projectId: 'project-1', assets: [] } };
    const historyResponse = { data: { projectId: 'project-1', publishes: [] } };
    const episodeResponse = { data: { id: 'episode-1' } };
    const getSpy = vi.spyOn(rootApiClient, 'get')
      .mockResolvedValueOnce(listResponse)
      .mockResolvedValueOnce(backupResponse)
      .mockResolvedValueOnce(assetsResponse)
      .mockResolvedValueOnce(historyResponse);
    const postSpy = vi.spyOn(rootApiClient, 'post')
      .mockResolvedValueOnce(projectResponse)
      .mockResolvedValueOnce(episodeResponse)
      .mockResolvedValueOnce(episodeResponse)
      .mockResolvedValueOnce({ data: {} });
    const patchSpy = vi.spyOn(rootApiClient, 'patch').mockResolvedValue(episodeResponse);

    await studioApi.getProjects();
    await studioApi.exportBackup();
    await studioApi.listProjectAssets('project-1');
    await studioApi.listProjectPublishHistory('project-1');
    await studioApi.createProject({ title: 'Project 1' });
    await studioApi.patchProject('project-1', { title: 'Project 1A' });
    await studioApi.createEpisode('project-1', { title: 'Episode 1', episodeNo: 1 });
    await studioApi.patchEpisode('episode-1', { title: 'Episode 1A' });
    await studioApi.publishMovingtoonEpisode('movingtoon-episode-1');
    await studioApi.unpublishMovingtoonEpisode('movingtoon-episode-1');

    expect(getSpy).toHaveBeenNthCalledWith(1, '/studio/projects');
    expect(getSpy).toHaveBeenNthCalledWith(2, '/studio/backup/export');
    expect(getSpy).toHaveBeenNthCalledWith(3, '/studio/projects/project-1/assets');
    expect(getSpy).toHaveBeenNthCalledWith(4, '/studio/projects/project-1/publishes');
    expect(postSpy).toHaveBeenNthCalledWith(1, '/studio/projects', { title: 'Project 1' });
    expect(postSpy).toHaveBeenNthCalledWith(2, '/studio/projects/project-1/episodes', { title: 'Episode 1', episodeNo: 1 });
    expect(postSpy).toHaveBeenNthCalledWith(3, '/studio/movingtoon/episodes/movingtoon-episode-1/publish');
    expect(postSpy).toHaveBeenNthCalledWith(4, '/studio/movingtoon/episodes/movingtoon-episode-1/unpublish');
    expect(patchSpy).toHaveBeenCalledWith('/studio/projects/project-1', { title: 'Project 1A' });
    expect(patchSpy).toHaveBeenCalledWith('/studio/episodes/episode-1', { title: 'Episode 1A' });
  });

  it('uses the studio project member endpoints', async () => {
    const response = { data: { members: [] } };
    const getSpy = vi.spyOn(rootApiClient, 'get').mockResolvedValue(response);
    const postSpy = vi.spyOn(rootApiClient, 'post').mockResolvedValue(response);
    const patchSpy = vi.spyOn(rootApiClient, 'patch').mockResolvedValue(response);
    const deleteSpy = vi.spyOn(rootApiClient, 'delete').mockResolvedValue(response);

    await studioApi.listProjectMembers('project-1');
    await studioApi.addProjectMember('project-1', { loginId: 'producer001', role: 'producer' });
    await studioApi.patchProjectMember('project-1', 'user-1', { role: 'writer' });
    await studioApi.deleteProjectMember('project-1', 'user-1');

    expect(getSpy).toHaveBeenCalledWith('/studio/projects/project-1/members');
    expect(postSpy).toHaveBeenCalledWith('/studio/projects/project-1/members', { loginId: 'producer001', role: 'producer' });
    expect(patchSpy).toHaveBeenCalledWith('/studio/projects/project-1/members/user-1', { role: 'writer' });
    expect(deleteSpy).toHaveBeenCalledWith('/studio/projects/project-1/members/user-1');
  });

  it('uses studio publish and projection endpoints', async () => {
    const publishResponse = { data: { id: 'publish-1' } };
    const rebuildResponse = { data: { publishes: 1, channels: 1, series: 1, feedItems: 1, channelHomes: 1, discussions: 1 } };
    const postSpy = vi.spyOn(rootApiClient, 'post')
      .mockResolvedValueOnce(publishResponse)
      .mockResolvedValueOnce(publishResponse)
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValueOnce(rebuildResponse);

    await studioApi.publishProject('project-1', 'episode-1');
    await studioApi.updatePublishedProject('project-1', 'episode-1');
    await studioApi.unpublishProject('project-1', 'episode-1');
    await studioApi.rebuildPublicProjections();

    expect(postSpy).toHaveBeenNthCalledWith(1, '/studio/projects/project-1/publish', { episodeId: 'episode-1' });
    expect(postSpy).toHaveBeenNthCalledWith(2, '/studio/projects/project-1/publish/update', { episodeId: 'episode-1' });
    expect(postSpy).toHaveBeenNthCalledWith(3, '/studio/projects/project-1/unpublish', { episodeId: 'episode-1' });
    expect(postSpy).toHaveBeenNthCalledWith(4, '/studio/projections/rebuild');
  });
});

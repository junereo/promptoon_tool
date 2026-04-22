import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { DEFAULT_CUT_EFFECT_DURATION_MS } from '@promptoon/shared';

import { createApp } from '../src/app/createApp';
import { closePool, query } from '../src/db';
import { runMigrations } from '../src/db/migrate';

const integrationEnabled = Boolean(process.env.TEST_DATABASE_URL);
const maybeDescribe = integrationEnabled ? describe : describe.skip;
const PASSWORD = 'password123';

maybeDescribe('promptoon api integration', () => {
  const app = createApp();

  async function registerUser(loginId = `author-${randomUUID()}`) {
    const response = await request(app)
      .post('/api/promptoon/auth/register')
      .send({ loginId, password: PASSWORD });

    expect(response.status).toBe(201);

    return {
      token: response.body.token as string,
      user: response.body.user as { id: string; loginId: string }
    };
  }

  function withAuth(requestBuilder: request.Test, token: string) {
    return requestBuilder.set('Authorization', `Bearer ${token}`);
  }

  async function createPublishedEpisodeFixture() {
    const auth = await registerUser();
    const project = await withAuth(request(app).post('/api/promptoon/projects'), auth.token).send({
      title: 'Shared Project',
      description: '기본 프로젝트 설명입니다.'
    });
    const episode = await withAuth(request(app).post(`/api/promptoon/projects/${project.body.id}/episodes`), auth.token).send({
      title: 'Episode 1',
      episodeNo: 1
    });
    const startCut = await withAuth(request(app).post(`/api/promptoon/episodes/${episode.body.id}/cuts`), auth.token).send({
      title: 'Start',
      kind: 'choice',
      isStart: true,
      assetUrl: 'https://cdn.example.com/start.jpg',
      contentBlocks: [
        {
          id: 'block-start',
          type: 'narration',
          text: '시작합니다.',
          textAlign: 'left',
          fontToken: 'sans-kr'
        }
      ]
    });
    const endingCut = await withAuth(request(app).post(`/api/promptoon/episodes/${episode.body.id}/cuts`), auth.token).send({
      title: 'Secret Ending',
      body: '비밀 엔딩에 도달했습니다.',
      kind: 'ending',
      isEnding: true,
      assetUrl: 'https://cdn.example.com/ending.jpg',
      contentBlocks: [
        {
          id: 'block-end',
          type: 'emphasis',
          text: '비밀 엔딩에 도달했습니다.',
          textAlign: 'center',
          fontToken: 'serif-kr'
        }
      ]
    });
    await withAuth(request(app).post(`/api/promptoon/cuts/${startCut.body.id}/choices`), auth.token).send({
      label: 'Go',
      nextCutId: endingCut.body.id,
      afterSelectReactionText: '결말로 이동합니다.'
    });
    const publish = await withAuth(request(app).post(`/api/promptoon/projects/${project.body.id}/publish`), auth.token).send({
      episodeId: episode.body.id
    });

    return {
      auth,
      episode,
      endingCut,
      project,
      publish,
      startCut
    };
  }

  beforeAll(async () => {
    await runMigrations();
  });

  beforeEach(async () => {
    await query('DELETE FROM promptoon_viewer_event');
    await query('DELETE FROM promptoon_publish');
    await query('DELETE FROM promptoon_choice');
    await query('DELETE FROM promptoon_cut');
    await query('DELETE FROM promptoon_episode');
    await query('DELETE FROM promptoon_project');
    await query('DELETE FROM users');
  });

  afterAll(async () => {
    await closePool();
  });

  it('registers a user, hashes the password, and returns a token', async () => {
    const loginId = `creator-${randomUUID()}`;
    const response = await request(app)
      .post('/api/promptoon/auth/register')
      .send({ loginId, password: PASSWORD });

    expect(response.status).toBe(201);
    expect(response.body.user.loginId).toBe(loginId);
    expect(response.body.token).toEqual(expect.any(String));

    const result = await query<{ login_id: string; password_hash: string }>('SELECT login_id, password_hash FROM users WHERE login_id = $1', [
      loginId
    ]);

    expect(result.rows[0]?.login_id).toBe(loginId);
    expect(result.rows[0]?.password_hash).toMatch(/^\$2[aby]\$/);
    expect(result.rows[0]?.password_hash).not.toBe(PASSWORD);
  });

  it('rejects short credentials before hitting auth storage', async () => {
    const response = await request(app)
      .post('/api/promptoon/auth/register')
      .send({ loginId: 'short', password: 'tiny' });

    expect(response.status).toBe(400);
  });

  it('logs in with valid credentials and rejects invalid passwords', async () => {
    const loginId = `author-${randomUUID()}`;
    await registerUser(loginId);

    const success = await request(app)
      .post('/api/promptoon/auth/login')
      .send({ loginId, password: PASSWORD });
    const failure = await request(app)
      .post('/api/promptoon/auth/login')
      .send({ loginId, password: 'wrongpass123' });

    expect(success.status).toBe(200);
    expect(success.body.user.loginId).toBe(loginId);
    expect(success.body.token).toEqual(expect.any(String));
    expect(failure.status).toBe(401);
  });

  it('requires authentication for authoring routes', async () => {
    const response = await request(app).get('/api/promptoon/projects');

    expect(response.status).toBe(401);
  });

  it('creates a project and lists only the authenticated users projects', async () => {
    const firstUser = await registerUser();
    const secondUser = await registerUser();

    await withAuth(request(app).post('/api/promptoon/projects'), firstUser.token).send({ title: 'Project A' });
    await withAuth(request(app).post('/api/promptoon/projects'), secondUser.token).send({ title: 'Project B' });

    const response = await withAuth(request(app).get('/api/promptoon/projects'), firstUser.token);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].title).toBe('Project A');
  });

  it('creates a cut with default position and order index', async () => {
    const auth = await registerUser();
    const project = await withAuth(request(app).post('/api/promptoon/projects'), auth.token).send({ title: 'Project A' });
    const episode = await withAuth(request(app).post(`/api/promptoon/projects/${project.body.id}/episodes`), auth.token).send({
      title: 'Episode 1',
      episodeNo: 1
    });

    const cut = await withAuth(request(app).post(`/api/promptoon/episodes/${episode.body.id}/cuts`), auth.token).send({
      title: 'Cut 1',
      kind: 'scene'
    });

    expect(cut.status).toBe(201);
    expect(cut.body.positionX).toBe(0);
    expect(cut.body.positionY).toBe(100);
    expect(cut.body.orderIndex).toBe(0);
    expect(cut.body.startEffect).toBe('none');
    expect(cut.body.endEffect).toBe('none');
    expect(cut.body.startEffectDurationMs).toBe(DEFAULT_CUT_EFFECT_DURATION_MS);
    expect(cut.body.endEffectDurationMs).toBe(DEFAULT_CUT_EFFECT_DURATION_MS);
    expect(cut.body.edgeFade).toBe('none');
    expect(cut.body.edgeFadeIntensity).toBe('normal');
    expect(cut.body.marginBottomToken).toBe('none');
    expect(cut.body.contentBlocks).toEqual([]);
  });

  it('derives scene and choice kinds from the number of persisted choices', async () => {
    const auth = await registerUser();
    const project = await withAuth(request(app).post('/api/promptoon/projects'), auth.token).send({ title: 'Project A' });
    const episode = await withAuth(request(app).post(`/api/promptoon/projects/${project.body.id}/episodes`), auth.token).send({
      title: 'Episode 1',
      episodeNo: 1
    });
    const sourceCut = await withAuth(request(app).post(`/api/promptoon/episodes/${episode.body.id}/cuts`), auth.token).send({
      title: 'Source',
      kind: 'scene'
    });
    const targetA = await withAuth(request(app).post(`/api/promptoon/episodes/${episode.body.id}/cuts`), auth.token).send({
      title: 'Target A',
      kind: 'scene'
    });
    const targetB = await withAuth(request(app).post(`/api/promptoon/episodes/${episode.body.id}/cuts`), auth.token).send({
      title: 'Target B',
      kind: 'scene'
    });

    const firstChoice = await withAuth(request(app).post(`/api/promptoon/cuts/${sourceCut.body.id}/choices`), auth.token).send({
      label: 'Choice 1',
      nextCutId: targetA.body.id
    });

    const afterFirstChoice = await withAuth(request(app).get(`/api/promptoon/episodes/${episode.body.id}/draft`), auth.token);
    expect(afterFirstChoice.body.cuts.find((cut: { id: string }) => cut.id === sourceCut.body.id)?.kind).toBe('scene');

    await withAuth(request(app).post(`/api/promptoon/cuts/${sourceCut.body.id}/choices`), auth.token).send({
      label: 'Choice 2',
      nextCutId: targetB.body.id
    });

    const afterSecondChoice = await withAuth(request(app).get(`/api/promptoon/episodes/${episode.body.id}/draft`), auth.token);
    expect(afterSecondChoice.body.cuts.find((cut: { id: string }) => cut.id === sourceCut.body.id)?.kind).toBe('choice');

    const patchToScene = await withAuth(request(app).patch(`/api/promptoon/cuts/${sourceCut.body.id}`), auth.token).send({
      kind: 'scene'
    });
    expect(patchToScene.body.kind).toBe('choice');

    await withAuth(request(app).delete(`/api/promptoon/choices/${firstChoice.body.id}`), auth.token);

    const afterDelete = await withAuth(request(app).get(`/api/promptoon/episodes/${episode.body.id}/draft`), auth.token);
    expect(afterDelete.body.cuts.find((cut: { id: string }) => cut.id === sourceCut.body.id)?.kind).toBe('scene');
  });

  it('uploads an image asset and returns a served asset URL', async () => {
    const auth = await registerUser();
    const project = await withAuth(request(app).post('/api/promptoon/projects'), auth.token).send({ title: 'Upload Project' });
    const response = await withAuth(request(app).post(`/api/promptoon/projects/${project.body.id}/assets`), auth.token).attach(
      'file',
      Buffer.from('fake image bytes'),
      {
        filename: 'cover.png',
        contentType: 'image/png'
      }
    );

    expect(response.status).toBe(201);
    expect(response.body.assetUrl).toMatch(new RegExp(`^/uploads/\\d{4}/\\d{2}/\\d{2}/${project.body.id}/cover-\\d+\\.png$`));
  });

  it('rejects uploads to projects owned by another user', async () => {
    const owner = await registerUser();
    const intruder = await registerUser();
    const project = await withAuth(request(app).post('/api/promptoon/projects'), owner.token).send({ title: 'Private Upload Project' });

    const response = await withAuth(request(app).post(`/api/promptoon/projects/${project.body.id}/assets`), intruder.token).attach(
      'file',
      Buffer.from('fake image bytes'),
      {
        filename: 'cover.png',
        contentType: 'image/png'
      }
    );

    expect(response.status).toBe(403);
  });

  it('blocks writes to projects owned by another user', async () => {
    const owner = await registerUser();
    const intruder = await registerUser();
    const project = await withAuth(request(app).post('/api/promptoon/projects'), owner.token).send({ title: 'Owner Project' });
    const episode = await withAuth(request(app).post(`/api/promptoon/projects/${project.body.id}/episodes`), owner.token).send({
      title: 'Episode 1',
      episodeNo: 1
    });
    const cut = await withAuth(request(app).post(`/api/promptoon/episodes/${episode.body.id}/cuts`), owner.token).send({
      title: 'Protected Cut',
      kind: 'scene'
    });

    const response = await withAuth(request(app).patch(`/api/promptoon/cuts/${cut.body.id}`), intruder.token).send({
      title: 'Hijacked'
    });

    expect(response.status).toBe(403);
  });

  it('deletes a cut and nulls dependent choice next_cut_id', async () => {
    const auth = await registerUser();
    const project = await withAuth(request(app).post('/api/promptoon/projects'), auth.token).send({ title: 'Project A' });
    const episode = await withAuth(request(app).post(`/api/promptoon/projects/${project.body.id}/episodes`), auth.token).send({
      title: 'Episode 1',
      episodeNo: 1
    });

    const startCut = await withAuth(request(app).post(`/api/promptoon/episodes/${episode.body.id}/cuts`), auth.token).send({
      title: 'Start',
      kind: 'scene',
      isStart: true,
      startEffect: 'fade',
      endEffect: 'slide-left',
      startEffectDurationMs: 450,
      endEffectDurationMs: 900
    });
    const endingCut = await withAuth(request(app).post(`/api/promptoon/episodes/${episode.body.id}/cuts`), auth.token).send({
      title: 'End',
      kind: 'ending',
      isEnding: true,
      startEffect: 'zoom-in',
      endEffect: 'none',
      startEffectDurationMs: 300,
      endEffectDurationMs: 0
    });

    const choice = await withAuth(request(app).post(`/api/promptoon/cuts/${startCut.body.id}/choices`), auth.token).send({
      label: 'Go',
      nextCutId: endingCut.body.id
    });

    const deleteResponse = await withAuth(request(app).delete(`/api/promptoon/cuts/${endingCut.body.id}`), auth.token);
    expect(deleteResponse.status).toBe(204);

    const draft = await withAuth(request(app).get(`/api/promptoon/episodes/${episode.body.id}/draft`), auth.token);
    expect(draft.status).toBe(200);
    expect(draft.body.choices[0].id).toBe(choice.body.id);
    expect(draft.body.choices[0].nextCutId).toBeNull();
  });

  it('reorders cuts with a batch endpoint', async () => {
    const auth = await registerUser();
    const project = await withAuth(request(app).post('/api/promptoon/projects'), auth.token).send({ title: 'Project A' });
    const episode = await withAuth(request(app).post(`/api/promptoon/projects/${project.body.id}/episodes`), auth.token).send({
      title: 'Episode 1',
      episodeNo: 1
    });

    const firstCut = await withAuth(request(app).post(`/api/promptoon/episodes/${episode.body.id}/cuts`), auth.token).send({
      title: 'First',
      kind: 'scene'
    });
    const secondCut = await withAuth(request(app).post(`/api/promptoon/episodes/${episode.body.id}/cuts`), auth.token).send({
      title: 'Second',
      kind: 'scene'
    });
    const thirdCut = await withAuth(request(app).post(`/api/promptoon/episodes/${episode.body.id}/cuts`), auth.token).send({
      title: 'Third',
      kind: 'ending',
      isEnding: true
    });

    const reorder = await withAuth(request(app).patch(`/api/promptoon/episodes/${episode.body.id}/cuts/reorder`), auth.token).send({
      cuts: [
        { cutId: thirdCut.body.id, orderIndex: 0 },
        { cutId: firstCut.body.id, orderIndex: 1 },
        { cutId: secondCut.body.id, orderIndex: 2 }
      ]
    });

    expect(reorder.status).toBe(200);
    expect(reorder.body.cuts.map((cut: { id: string }) => cut.id)).toEqual([
      thirdCut.body.id,
      firstCut.body.id,
      secondCut.body.id
    ]);

    const draft = await withAuth(request(app).get(`/api/promptoon/episodes/${episode.body.id}/draft`), auth.token);
    expect(draft.status).toBe(200);
    expect(draft.body.cuts.map((cut: { id: string }) => cut.id)).toEqual([
      thirdCut.body.id,
      firstCut.body.id,
      secondCut.body.id
    ]);
  });

  it('rejects reorder payloads containing cuts from another episode', async () => {
    const auth = await registerUser();
    const project = await withAuth(request(app).post('/api/promptoon/projects'), auth.token).send({ title: 'Project A' });
    const episodeOne = await withAuth(request(app).post(`/api/promptoon/projects/${project.body.id}/episodes`), auth.token).send({
      title: 'Episode 1',
      episodeNo: 1
    });
    const episodeTwo = await withAuth(request(app).post(`/api/promptoon/projects/${project.body.id}/episodes`), auth.token).send({
      title: 'Episode 2',
      episodeNo: 2
    });

    const episodeOneCut = await withAuth(request(app).post(`/api/promptoon/episodes/${episodeOne.body.id}/cuts`), auth.token).send({
      title: 'First',
      kind: 'scene'
    });
    const foreignCut = await withAuth(request(app).post(`/api/promptoon/episodes/${episodeTwo.body.id}/cuts`), auth.token).send({
      title: 'Foreign',
      kind: 'scene'
    });

    const reorder = await withAuth(request(app).patch(`/api/promptoon/episodes/${episodeOne.body.id}/cuts/reorder`), auth.token).send({
      cuts: [
        { cutId: episodeOneCut.body.id, orderIndex: 0 },
        { cutId: foreignCut.body.id, orderIndex: 1 }
      ]
    });

    expect(reorder.status).toBe(400);
  });

  it('publishes a valid episode', async () => {
    const auth = await registerUser();
    const project = await withAuth(request(app).post('/api/promptoon/projects'), auth.token).send({ title: 'Project A' });
    const episode = await withAuth(request(app).post(`/api/promptoon/projects/${project.body.id}/episodes`), auth.token).send({
      title: 'Episode 1',
      episodeNo: 1
    });
    const startCut = await withAuth(request(app).post(`/api/promptoon/episodes/${episode.body.id}/cuts`), auth.token).send({
      title: 'Start',
      kind: 'scene',
      isStart: true,
      edgeFade: 'bottom',
      edgeFadeIntensity: 'strong',
      marginBottomToken: 'xl',
      contentBlocks: [
        {
          id: 'publish-start',
          type: 'narration',
          text: '출발',
          textAlign: 'left',
          fontToken: 'sans-kr',
          lineHeightToken: 'loose',
          marginTopToken: 'sm',
          marginBottomToken: 'base'
        }
      ]
    });
    const endingCut = await withAuth(request(app).post(`/api/promptoon/episodes/${episode.body.id}/cuts`), auth.token).send({
      title: 'End',
      kind: 'ending',
      isEnding: true,
      contentBlocks: [
        {
          id: 'publish-end',
          type: 'heading',
          text: '끝',
          textAlign: 'center',
          fontToken: 'display'
        }
      ]
    });
    await withAuth(request(app).post(`/api/promptoon/cuts/${startCut.body.id}/choices`), auth.token).send({
      label: 'Go',
      nextCutId: endingCut.body.id,
      afterSelectReactionText: '이동 중'
    });

    const publish = await withAuth(request(app).post(`/api/promptoon/projects/${project.body.id}/publish`), auth.token).send({
      episodeId: episode.body.id
    });

    expect(publish.status).toBe(201);
    expect(publish.body.versionNo).toBe(1);
    expect(publish.body.manifest.project.status).toBe('published');
    expect(publish.body.manifest.episode.status).toBe('published');
    expect(publish.body.manifest.cuts).toHaveLength(2);
    expect(publish.body.manifest.cuts.find((cut: { id: string }) => cut.id === startCut.body.id)?.contentBlocks).toHaveLength(1);
    expect(publish.body.manifest.cuts.find((cut: { id: string }) => cut.id === startCut.body.id)?.edgeFade).toBe('bottom');
    expect(publish.body.manifest.cuts.find((cut: { id: string }) => cut.id === startCut.body.id)?.edgeFadeIntensity).toBe('strong');
    expect(publish.body.manifest.cuts.find((cut: { id: string }) => cut.id === startCut.body.id)?.marginBottomToken).toBe('xl');
    expect(publish.body.manifest.cuts.find((cut: { id: string }) => cut.id === startCut.body.id)?.contentBlocks[0]).toMatchObject({
      lineHeightToken: 'loose',
      marginTopToken: 'sm',
      marginBottomToken: 'base'
    });
    expect(publish.body.manifest.cuts.find((cut: { id: string }) => cut.id === startCut.body.id)?.startEffectDurationMs).toBe(
      DEFAULT_CUT_EFFECT_DURATION_MS
    );
    expect(publish.body.manifest.cuts.find((cut: { id: string }) => cut.id === startCut.body.id)?.endEffectDurationMs).toBe(
      DEFAULT_CUT_EFFECT_DURATION_MS
    );

    const dashboard = await withAuth(request(app).get('/api/promptoon/projects'), auth.token);
    expect(dashboard.status).toBe(200);
    expect(dashboard.body[0].status).toBe('published');
    expect(dashboard.body[0].episodes[0].status).toBe('published');

    const draft = await withAuth(request(app).get(`/api/promptoon/episodes/${episode.body.id}/draft`), auth.token);
    expect(draft.status).toBe(200);
    expect(draft.body.episode.status).toBe('published');

    const latestPublished = await withAuth(request(app).get(`/api/promptoon/episodes/${episode.body.id}/published/latest`), auth.token);
    expect(latestPublished.status).toBe(200);
    expect(latestPublished.body.id).toBe(publish.body.id);
    expect(latestPublished.body.versionNo).toBe(1);
  });

  it('unpublishes an episode and reverts dashboard status to draft', async () => {
    const auth = await registerUser();
    const project = await withAuth(request(app).post('/api/promptoon/projects'), auth.token).send({ title: 'Project A' });
    const episode = await withAuth(request(app).post(`/api/promptoon/projects/${project.body.id}/episodes`), auth.token).send({
      title: 'Episode 1',
      episodeNo: 1
    });
    const startCut = await withAuth(request(app).post(`/api/promptoon/episodes/${episode.body.id}/cuts`), auth.token).send({
      title: 'Start',
      kind: 'scene',
      isStart: true
    });
    const endingCut = await withAuth(request(app).post(`/api/promptoon/episodes/${episode.body.id}/cuts`), auth.token).send({
      title: 'End',
      kind: 'ending',
      isEnding: true
    });
    await withAuth(request(app).post(`/api/promptoon/cuts/${startCut.body.id}/choices`), auth.token).send({
      label: 'Go',
      nextCutId: endingCut.body.id
    });

    const publish = await withAuth(request(app).post(`/api/promptoon/projects/${project.body.id}/publish`), auth.token).send({
      episodeId: episode.body.id
    });

    expect(publish.status).toBe(201);

    const unpublish = await withAuth(request(app).post(`/api/promptoon/projects/${project.body.id}/unpublish`), auth.token).send({
      episodeId: episode.body.id
    });

    expect(unpublish.status).toBe(204);

    const dashboard = await withAuth(request(app).get('/api/promptoon/projects'), auth.token);
    expect(dashboard.status).toBe(200);
    expect(dashboard.body[0].status).toBe('draft');
    expect(dashboard.body[0].episodes[0].status).toBe('draft');

    const draft = await withAuth(request(app).get(`/api/promptoon/episodes/${episode.body.id}/draft`), auth.token);
    expect(draft.status).toBe(200);
    expect(draft.body.episode.status).toBe('draft');

    const published = await request(app).get(`/api/promptoon/episodes/published/${publish.body.id}`);
    expect(published.status).toBe(404);
  });

  it('returns a published manifest without authentication', async () => {
    const fixture = await createPublishedEpisodeFixture();
    const response = await request(app).get(`/api/promptoon/episodes/published/${fixture.publish.body.id}`);

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(fixture.publish.body.id);
    expect(response.body.manifest.episode.startCutId).toBe(fixture.startCut.body.id);
  });

  it('returns the public feed with latest publishes only and cursor pagination', async () => {
    const auth = await registerUser();
    const project = await withAuth(request(app).post('/api/promptoon/projects'), auth.token).send({ title: 'Feed Project' });

    async function createEpisodeWithPublish(episodeNo: number, body: string, branchingChoiceCount = 2) {
      const episode = await withAuth(request(app).post(`/api/promptoon/projects/${project.body.id}/episodes`), auth.token).send({
        title: `Episode ${episodeNo}`,
        episodeNo
      });
      const startCut = await withAuth(request(app).post(`/api/promptoon/episodes/${episode.body.id}/cuts`), auth.token).send({
        title: `Start ${episodeNo}`,
        body,
        kind: 'choice',
        isStart: true,
        assetUrl: `https://cdn.example.com/${episodeNo}.jpg`
      });
      const endingCut = await withAuth(request(app).post(`/api/promptoon/episodes/${episode.body.id}/cuts`), auth.token).send({
        title: `Ending ${episodeNo}`,
        kind: 'ending',
        isEnding: true
      });
      const branchCut = await withAuth(request(app).post(`/api/promptoon/episodes/${episode.body.id}/cuts`), auth.token).send({
        title: `Branch ${episodeNo}`,
        kind: 'choice'
      });

      await withAuth(request(app).post(`/api/promptoon/cuts/${startCut.body.id}/choices`), auth.token).send({
        label: 'Intro',
        nextCutId: branchCut.body.id
      });

      for (let index = 0; index < branchingChoiceCount; index += 1) {
        await withAuth(request(app).post(`/api/promptoon/cuts/${branchCut.body.id}/choices`), auth.token).send({
          label: `Branch ${index + 1}`,
          nextCutId: endingCut.body.id
        });
      }
      const publish = await withAuth(request(app).post(`/api/promptoon/projects/${project.body.id}/publish`), auth.token).send({
        episodeId: episode.body.id
      });

      return { episode, publish, startCut };
    }

    const episodeOne = await createEpisodeWithPublish(1, '첫 번째 버전', 2);
    await createEpisodeWithPublish(2, '한 개 선택지만 있는 에피소드', 1);
    const episodeThree = await createEpisodeWithPublish(3, '세 번째 에피소드', 2);

    await withAuth(request(app).patch(`/api/promptoon/cuts/${episodeOne.startCut.body.id}`), auth.token).send({
      body: '첫 번째 에피소드 최신 버전'
    });

    const republish = await withAuth(request(app).post(`/api/promptoon/projects/${project.body.id}/publish`), auth.token).send({
      episodeId: episodeOne.episode.body.id
    });

    expect(republish.status).toBe(201);

    const firstPage = await request(app).get('/api/promptoon/episodes/feed?limit=1');

    expect(firstPage.status).toBe(200);
    expect(firstPage.body.items).toHaveLength(1);
    expect(firstPage.body.items[0].publishId).toBe(republish.body.id);
    expect(firstPage.body.items[0].startCut.body).toBe('첫 번째 에피소드 최신 버전');
    expect(firstPage.body.nextCursor).toEqual(expect.any(String));

    const secondPage = await request(app).get(`/api/promptoon/episodes/feed?limit=1&cursor=${encodeURIComponent(firstPage.body.nextCursor)}`);

    expect(secondPage.status).toBe(200);
    expect(secondPage.body.items).toHaveLength(1);
    expect(secondPage.body.items[0].publishId).toBe(episodeThree.publish.body.id);
    expect(secondPage.body.items[0].episodeId).toBe(episodeThree.episode.body.id);
    expect(secondPage.body.nextCursor).toBeNull();
  });

  it('uses the first cut with two real choices as the feed start and ignores placeholder choices', async () => {
    const auth = await registerUser();
    const project = await withAuth(request(app).post('/api/promptoon/projects'), auth.token).send({ title: 'Feed Start Project' });
    const episode = await withAuth(request(app).post(`/api/promptoon/projects/${project.body.id}/episodes`), auth.token).send({
      title: 'Episode 1',
      episodeNo: 1
    });
    const introCut = await withAuth(request(app).post(`/api/promptoon/episodes/${episode.body.id}/cuts`), auth.token).send({
      title: 'Intro',
      kind: 'choice',
      isStart: true
    });
    const branchCut = await withAuth(request(app).post(`/api/promptoon/episodes/${episode.body.id}/cuts`), auth.token).send({
      title: 'Branch',
      body: '여기서 고르세요.',
      kind: 'choice'
    });
    const endingA = await withAuth(request(app).post(`/api/promptoon/episodes/${episode.body.id}/cuts`), auth.token).send({
      title: 'Ending A',
      kind: 'ending',
      isEnding: true
    });
    const endingB = await withAuth(request(app).post(`/api/promptoon/episodes/${episode.body.id}/cuts`), auth.token).send({
      title: 'Ending B',
      kind: 'ending',
      isEnding: true
    });

    await withAuth(request(app).post(`/api/promptoon/cuts/${introCut.body.id}/choices`), auth.token).send({
      label: 'Choice 1',
      nextCutId: branchCut.body.id
    });

    await withAuth(request(app).post(`/api/promptoon/cuts/${branchCut.body.id}/choices`), auth.token).send({
      label: 'new',
      nextCutId: null
    });
    await withAuth(request(app).post(`/api/promptoon/cuts/${branchCut.body.id}/choices`), auth.token).send({
      label: '왼쪽',
      nextCutId: endingA.body.id
    });
    await withAuth(request(app).post(`/api/promptoon/cuts/${branchCut.body.id}/choices`), auth.token).send({
      label: '오른쪽',
      nextCutId: endingB.body.id
    });

    const publish = await withAuth(request(app).post(`/api/promptoon/projects/${project.body.id}/publish`), auth.token).send({
      episodeId: episode.body.id
    });

    const response = await request(app).get('/api/promptoon/episodes/feed?limit=10');

    expect(response.status).toBe(200);
    const item = response.body.items.find((currentItem: { publishId: string }) => currentItem.publishId === publish.body.id);
    expect(item).toBeTruthy();
    expect(item.startCut.id).toBe(branchCut.body.id);
    expect(item.startChoices).toHaveLength(2);
    expect(item.startChoices.map((choice: { label: string }) => choice.label)).toEqual(['왼쪽', '오른쪽']);
  });

  it('returns 404 for unknown published episodes', async () => {
    const response = await request(app).get(`/api/promptoon/episodes/published/${randomUUID()}`);

    expect(response.status).toBe(404);
  });

  it('renders share HTML with ending-specific OG tags and replace-based redirect', async () => {
    const previousOrigin = process.env.APP_ORIGIN;
    delete process.env.APP_ORIGIN;

    try {
      const fixture = await createPublishedEpisodeFixture();
      const response = await request(app)
        .get(`/api/promptoon/share/${fixture.publish.body.id}?e=${fixture.endingCut.body.id}`)
        .set('Host', 'viewer.example.test');

      expect(response.status).toBe(200);
      expect(response.type).toMatch(/html/);
      expect(response.text).toContain('Episode 1 - 나는 &quot;Secret Ending&quot; 엔딩을 봤어!');
      expect(response.text).toContain('비밀 엔딩에 도달했습니다.');
      expect(response.text).toContain('https://cdn.example.com/ending.jpg');
      expect(response.text).toContain('window.location.replace("http://viewer.example.test/v/');
      expect(response.text).toContain(`/v/${fixture.publish.body.id}?e=${fixture.endingCut.body.id}`);
    } finally {
      if (previousOrigin === undefined) {
        delete process.env.APP_ORIGIN;
      } else {
        process.env.APP_ORIGIN = previousOrigin;
      }
    }
  });

  it('falls back to episode-level share metadata when the ending query is invalid', async () => {
    const fixture = await createPublishedEpisodeFixture();
    const response = await request(app).get(`/api/promptoon/share/${fixture.publish.body.id}?e=${randomUUID()}`);

    expect(response.status).toBe(200);
    expect(response.text).toContain('Episode 1 - 인터랙티브 웹툰');
    expect(response.text).toContain('기본 프로젝트 설명입니다.');
    expect(response.text).not.toContain('Secret Ending');
    expect(response.text).toContain('https://cdn.example.com/start.jpg');
  });

  it('accepts telemetry events without authentication and persists them', async () => {
    const anonymousId = randomUUID();
    const fixture = await createPublishedEpisodeFixture();
    const choice = await query<{ id: string }>('SELECT id FROM promptoon_choice LIMIT 1');

    const response = await request(app)
      .post('/api/promptoon/telemetry/events')
      .send({
        publishId: fixture.publish.body.id,
        anonymousId,
        eventType: 'choice_click',
        cutId: fixture.startCut.body.id,
        choiceId: choice.rows[0]?.id
      });

    const countResult = await query<{ count: string }>('SELECT COUNT(*)::text AS count FROM promptoon_viewer_event');

    expect(response.status).toBe(202);
    expect(Number(countResult.rows[0].count)).toBe(1);
  });

  it('returns analytics for an episode with choice split and completion rate', async () => {
    const auth = await registerUser();
    const project = await withAuth(request(app).post('/api/promptoon/projects'), auth.token).send({ title: 'Analytics Project' });
    const episode = await withAuth(request(app).post(`/api/promptoon/projects/${project.body.id}/episodes`), auth.token).send({
      title: 'Episode 1',
      episodeNo: 1
    });
    const startCut = await withAuth(request(app).post(`/api/promptoon/episodes/${episode.body.id}/cuts`), auth.token).send({
      title: 'Start',
      kind: 'choice',
      isStart: true
    });
    const endingA = await withAuth(request(app).post(`/api/promptoon/episodes/${episode.body.id}/cuts`), auth.token).send({
      title: 'Ending A',
      kind: 'ending',
      isEnding: true
    });
    const endingB = await withAuth(request(app).post(`/api/promptoon/episodes/${episode.body.id}/cuts`), auth.token).send({
      title: 'Ending B',
      kind: 'ending',
      isEnding: true
    });
    const choiceA = await withAuth(request(app).post(`/api/promptoon/cuts/${startCut.body.id}/choices`), auth.token).send({
      label: 'A',
      nextCutId: endingA.body.id
    });
    const choiceB = await withAuth(request(app).post(`/api/promptoon/cuts/${startCut.body.id}/choices`), auth.token).send({
      label: 'B',
      nextCutId: endingB.body.id
    });
    const publish = await withAuth(request(app).post(`/api/promptoon/projects/${project.body.id}/publish`), auth.token).send({
      episodeId: episode.body.id
    });

    for (let index = 0; index < 100; index += 1) {
      const anonymousId = randomUUID();
      if (index < 80) {
        await request(app)
          .post('/api/promptoon/telemetry/events')
          .send({
            publishId: publish.body.id,
            anonymousId,
            eventType: 'feed_impression',
            cutId: startCut.body.id
          });
      }

      if (index < 30) {
        await request(app)
          .post('/api/promptoon/telemetry/events')
          .send({
            publishId: publish.body.id,
            anonymousId,
            eventType: 'feed_choice_click',
            cutId: startCut.body.id,
            choiceId: choiceA.body.id
          });
      }

      await request(app)
        .post('/api/promptoon/telemetry/events')
        .send({
          publishId: publish.body.id,
          anonymousId,
          eventType: 'cut_view',
          cutId: startCut.body.id
        });

      if (index < 60) {
        await request(app)
          .post('/api/promptoon/telemetry/events')
          .send({
            publishId: publish.body.id,
            anonymousId,
            eventType: 'choice_click',
            cutId: startCut.body.id,
            choiceId: choiceA.body.id
          });
      } else {
        await request(app)
          .post('/api/promptoon/telemetry/events')
          .send({
            publishId: publish.body.id,
            anonymousId,
            eventType: 'choice_click',
            cutId: startCut.body.id,
            choiceId: choiceB.body.id
          });
      }

      if (index < 65) {
        await request(app)
          .post('/api/promptoon/telemetry/events')
          .send({
            publishId: publish.body.id,
            anonymousId,
            eventType: 'ending_reach',
            cutId: index < 60 ? endingA.body.id : endingB.body.id
          });
      }
    }

    const response = await withAuth(request(app).get(`/api/promptoon/analytics/episodes/${episode.body.id}`), auth.token);

    expect(response.status).toBe(200);
    expect(response.body.totalViews).toBe(100);
    expect(response.body.uniqueViewers).toBe(100);
    expect(response.body.completionRate).toBe(65);
    expect(response.body.choiceStats[startCut.body.id][0].percentage).toBe(60);
    expect(response.body.choiceStats[startCut.body.id][1].percentage).toBe(40);
    expect(response.body.feedEntry.impressions).toBe(80);
    expect(response.body.feedEntry.choiceClicks).toBe(30);
    expect(response.body.feedEntry.conversionRate).toBe(37.5);
  });
});

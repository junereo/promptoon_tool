import { randomUUID } from 'node:crypto';
import { stat } from 'node:fs/promises';
import path from 'node:path';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { DEFAULT_CUT_EFFECT_DURATION_MS } from '@promptoon/shared';

import { createApp } from '../src/app/createApp';
import { closePool, query } from '../src/db';
import { runMigrations } from '../src/db/migrate';
import { env } from '../src/lib/env';
import { resolveFromApiRoot, resolveFromWorkspaceRoot } from '../src/lib/workspace-paths';

const integrationEnabled = Boolean(process.env.TEST_DATABASE_URL);
const maybeDescribe = integrationEnabled ? describe : describe.skip;
const PASSWORD = 'password123';
const TINY_PNG_IMAGE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64'
);

maybeDescribe('promptoon api integration', () => {
  const app = createApp();

  function assertSafeTestDatabaseUrl(): void {
    const testDatabaseUrl = process.env.TEST_DATABASE_URL;
    if (!testDatabaseUrl) {
      return;
    }

    const databaseName = new URL(testDatabaseUrl).pathname.replace(/^\//, '');
    if (!databaseName.includes('test')) {
      throw new Error(`Refusing to run integration tests against non-test database: ${databaseName}`);
    }
  }

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

  function getDateDaysAgo(daysAgo: number): string {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - daysAgo);
    return date.toISOString().slice(0, 10);
  }

  async function uploadFileExists(relativePath: string): Promise<boolean> {
    const candidates = [
      resolveFromWorkspaceRoot('.data/uploads', relativePath),
      resolveFromApiRoot('.data/uploads', relativePath)
    ];

    const results = await Promise.all(candidates.map(async (candidate) => {
      try {
        await stat(candidate);
        return true;
      } catch {
        return false;
      }
    }));

    return results.some(Boolean);
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
    await withAuth(request(app).patch(`/api/promptoon/episodes/${episode.body.id}`), auth.token).send({
      coverImageUrl: 'https://cdn.example.com/episode-cover.jpg'
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

  async function createFeedReadyPublishedEpisodeFixture() {
    const auth = await registerUser();
    const project = await withAuth(request(app).post('/api/promptoon/projects'), auth.token).send({
      title: 'Product Flow Project',
      description: '공개 제품 흐름 검증용 프로젝트입니다.'
    });
    const episode = await withAuth(request(app).post(`/api/promptoon/projects/${project.body.id}/episodes`), auth.token).send({
      title: 'Product Episode',
      episodeNo: 1,
      coverImageUrl: 'https://cdn.example.com/product-cover.jpg'
    });
    const startCut = await withAuth(request(app).post(`/api/promptoon/episodes/${episode.body.id}/cuts`), auth.token).send({
      title: 'Feed Branch',
      body: '두 갈래 중 하나를 고르세요.',
      kind: 'choice',
      isStart: true,
      assetUrl: 'https://cdn.example.com/product-start.jpg'
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

    await withAuth(request(app).post(`/api/promptoon/cuts/${startCut.body.id}/choices`), auth.token).send({
      label: '왼쪽',
      nextCutId: endingA.body.id
    });
    await withAuth(request(app).post(`/api/promptoon/cuts/${startCut.body.id}/choices`), auth.token).send({
      label: '오른쪽',
      nextCutId: endingB.body.id
    });

    const publish = await withAuth(request(app).post(`/api/promptoon/projects/${project.body.id}/publish`), auth.token).send({
      episodeId: episode.body.id
    });
    const publishRow = await query<{ channel_id: string; series_id: string }>(
      'SELECT channel_id::text AS channel_id, series_id::text AS series_id FROM promptoon_publish WHERE id = $1',
      [publish.body.id]
    );
    const channelRow = await query<{ slug: string }>('SELECT slug FROM promptoon_channel WHERE id = $1', [
      publishRow.rows[0].channel_id
    ]);

    return {
      auth,
      channelId: publishRow.rows[0].channel_id,
      channelSlug: channelRow.rows[0].slug,
      endingCut: endingA,
      episode,
      project,
      publish,
      seriesId: publishRow.rows[0].series_id,
      startCut
    };
  }

  beforeAll(async () => {
    assertSafeTestDatabaseUrl();
    await runMigrations();
  });

  beforeEach(async () => {
    await query('DELETE FROM promptoon_telemetry_event');
    await query('DELETE FROM promptoon_feed_impression');
    await query('DELETE FROM promptoon_user_like');
    await query('DELETE FROM promptoon_user_bookmark');
    await query('DELETE FROM promptoon_user_subscription');
    await query('DELETE FROM promptoon_channel_home_projection');
    await query('DELETE FROM promptoon_short_clip');
    await query('DELETE FROM promptoon_feed_item');
    await query('DELETE FROM promptoon_comment');
    await query('DELETE FROM promptoon_discourse_thread_sync');
    await query('DELETE FROM promptoon_project_discussion');
    await query('DELETE FROM promptoon_episode_discussion');
    await query('DELETE FROM promptoon_viewer_event');
    await query('DELETE FROM promptoon_publish');
    await query('DELETE FROM promptoon_asset_history');
    await query('DELETE FROM promptoon_asset');
    await query('DELETE FROM promptoon_series');
    await query('DELETE FROM promptoon_channel');
    await query('DELETE FROM promptoon_choice');
    await query('DELETE FROM promptoon_cut');
    await query('DELETE FROM promptoon_episode');
    await query('DELETE FROM promptoon_project');
    await query('DELETE FROM promptoon_project_member');
    await query('DELETE FROM promptoon_platform_admin');
    await query('DELETE FROM promptoon_studio_member');
    await query('DELETE FROM promptoon_session');
    await query('DELETE FROM promptoon_oauth_account');
    await query('DELETE FROM users');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    env.discourse.baseUrl = process.env.DISCOURSE_BASE_URL ?? null;
    env.discourse.apiKey = process.env.DISCOURSE_API_KEY ?? null;
    env.discourse.apiUser = process.env.DISCOURSE_API_USER ?? 'system';
    env.discourse.categoryId = process.env.DISCOURSE_CATEGORY_ID ?? null;
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
    expect(response.body.refreshToken).toEqual(expect.any(String));
    expect(response.body.session.id).toEqual(expect.any(String));

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
    expect(success.body.refreshToken).toEqual(expect.any(String));
    expect(failure.status).toBe(401);
  });

  it('supports root auth me/logout routes without automatic Studio membership and oauth scaffold responses', async () => {
    const loginId = `root-auth-${randomUUID()}`;
    const register = await request(app)
      .post('/api/auth/register')
      .send({ loginId, password: PASSWORD });
    const secondLogin = await request(app)
      .post('/api/auth/login')
      .send({ loginId, password: PASSWORD });

    expect(register.status).toBe(201);
    expect(secondLogin.status).toBe(200);

    const me = await withAuth(request(app).get('/api/auth/me'), register.body.token);
    expect(me.status).toBe(200);
    expect(me.body.user.loginId).toBe(loginId);
    expect(me.body.studioRole).toBeNull();
    expect(me.body.session.id).toEqual(expect.any(String));

    const member = await query<{ role: string }>('SELECT role FROM promptoon_studio_member WHERE user_id = $1', [
      register.body.user.id
    ]);
    const sessionsBeforeLogout = await query<{ count: string }>('SELECT COUNT(*)::text AS count FROM promptoon_session WHERE user_id = $1', [
      register.body.user.id
    ]);
    expect(member.rowCount).toBe(0);
    expect(Number(sessionsBeforeLogout.rows[0].count)).toBeGreaterThan(0);

    const logout = await withAuth(request(app).post('/api/auth/logout'), register.body.token);
    expect(logout.status).toBe(204);

    const sessionsAfterLogout = await query<{ count: string }>('SELECT COUNT(*)::text AS count FROM promptoon_session WHERE user_id = $1', [
      register.body.user.id
    ]);
    expect(Number(sessionsAfterLogout.rows[0].count)).toBe(1);

    const loggedOutMe = await withAuth(request(app).get('/api/auth/me'), register.body.token);
    const secondSessionMe = await withAuth(request(app).get('/api/auth/me'), secondLogin.body.token);
    expect(loggedOutMe.status).toBe(401);
    expect(secondSessionMe.status).toBe(200);

    const oauthStart = await request(app).get('/api/auth/google/start');
    expect(oauthStart.status).toBe(501);
    expect(oauthStart.body.error).toContain('Google OAuth is scaffolded');

    const kakaoStart = await request(app).get('/api/auth/kakao/start');
    expect(kakaoStart.status).toBe(503);
    expect(kakaoStart.body.error).toContain('Kakao OAuth is not configured');
  });

  it('protects platform admin routes and lets platform admins manage Studio roles', async () => {
    const previousBootstrapLoginIds = process.env.PROMPTOON_PLATFORM_ADMIN_LOGIN_IDS;
    const regular = await registerUser(`regular-${randomUUID()}`);
    const admin = await registerUser(`platform-${randomUUID()}`);

    try {
      const denied = await withAuth(request(app).get('/api/admin/me'), regular.token);
      expect(denied.status).toBe(403);

      process.env.PROMPTOON_PLATFORM_ADMIN_LOGIN_IDS = admin.user.loginId;

      const adminMe = await withAuth(request(app).get('/api/admin/me'), admin.token);
      expect(adminMe.status).toBe(200);
      expect(adminMe.body.platformRole).toBe('platform_admin');
      expect(adminMe.body.studioRole).toBeNull();

      const platformAdminRow = await query<{ role: string }>('SELECT role FROM promptoon_platform_admin WHERE user_id = $1', [
        admin.user.id
      ]);
      expect(platformAdminRow.rows[0]?.role).toBe('platform_admin');

      const users = await withAuth(request(app).get('/api/admin/users').query({ query: regular.user.loginId }), admin.token);
      expect(users.status).toBe(200);
      expect(users.body.users).toEqual([
        expect.objectContaining({
          userId: regular.user.id,
          studioRole: null,
          platformRole: null
        })
      ]);

      const grantStudio = await withAuth(request(app).patch(`/api/admin/users/${regular.user.id}/studio-role`), admin.token).send({
        role: 'producer'
      });
      expect(grantStudio.status).toBe(200);
      expect(grantStudio.body.studioRole).toBe('producer');

      const regularMe = await withAuth(request(app).get('/api/auth/me'), regular.token);
      expect(regularMe.status).toBe(200);
      expect(regularMe.body.studioRole).toBe('producer');

      const revokeStudio = await withAuth(request(app).patch(`/api/admin/users/${regular.user.id}/studio-role`), admin.token).send({
        role: null
      });
      expect(revokeStudio.status).toBe(200);
      expect(revokeStudio.body.studioRole).toBeNull();

      process.env.PROMPTOON_PLATFORM_ADMIN_LOGIN_IDS = '';
      const selfRevoke = await withAuth(request(app).patch(`/api/admin/users/${admin.user.id}/platform-role`), admin.token).send({
        role: null
      });
      expect(selfRevoke.status).toBe(400);
      expect(selfRevoke.body.error).toContain('At least one platform admin');
    } finally {
      if (previousBootstrapLoginIds === undefined) {
        delete process.env.PROMPTOON_PLATFORM_ADMIN_LOGIN_IDS;
      } else {
        process.env.PROMPTOON_PLATFORM_ADMIN_LOGIN_IDS = previousBootstrapLoginIds;
      }
    }
  });

  it('rotates refresh tokens and rejects reused refresh sessions', async () => {
    const loginId = `refresh-${randomUUID()}`;
    const register = await request(app)
      .post('/api/auth/register')
      .send({ loginId, password: PASSWORD });

    expect(register.status).toBe(201);
    expect(register.body.refreshToken).toEqual(expect.any(String));

    const rotated = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: register.body.refreshToken });
    expect(rotated.status).toBe(200);
    expect(rotated.body.token).toEqual(expect.any(String));
    expect(rotated.body.refreshToken).toEqual(expect.any(String));
    expect(rotated.body.session.id).not.toBe(register.body.session.id);

    const oldAccessTokenMe = await withAuth(request(app).get('/api/auth/me'), register.body.token);
    const newAccessTokenMe = await withAuth(request(app).get('/api/auth/me'), rotated.body.token);
    expect(oldAccessTokenMe.status).toBe(401);
    expect(newAccessTokenMe.status).toBe(200);

    const reused = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: register.body.refreshToken });
    expect(reused.status).toBe(401);

    const afterReuse = await withAuth(request(app).get('/api/auth/me'), rotated.body.token);
    expect(afterReuse.status).toBe(401);
  });

  it('rejects deleted and expired auth sessions', async () => {
    const auth = await registerUser(`session-${randomUUID()}`);

    await query('DELETE FROM promptoon_session WHERE user_id = $1', [auth.user.id]);
    const deletedSession = await withAuth(request(app).get('/api/auth/me'), auth.token);
    expect(deletedSession.status).toBe(401);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ loginId: auth.user.loginId, password: PASSWORD });
    expect(login.status).toBe(200);

    await query("UPDATE promptoon_session SET expires_at = NOW() - INTERVAL '1 minute' WHERE user_id = $1", [auth.user.id]);
    const expiredSession = await withAuth(request(app).get('/api/auth/me'), login.body.token);
    expect(expiredSession.status).toBe(401);
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

  it('creates and updates an episode cover image', async () => {
    const auth = await registerUser();
    const project = await withAuth(request(app).post('/api/promptoon/projects'), auth.token).send({ title: 'Project A' });
    const episode = await withAuth(request(app).post(`/api/promptoon/projects/${project.body.id}/episodes`), auth.token).send({
      title: 'Episode 1',
      episodeNo: 1
    });

    expect(episode.status).toBe(201);
    expect(episode.body.coverImageUrl).toBeNull();

    const updated = await withAuth(request(app).patch(`/api/promptoon/episodes/${episode.body.id}`), auth.token).send({
      coverImageUrl: 'https://cdn.example.com/cover.jpg'
    });
    expect(updated.status).toBe(200);
    expect(updated.body.coverImageUrl).toBe('https://cdn.example.com/cover.jpg');

    const dashboard = await withAuth(request(app).get('/api/promptoon/projects'), auth.token);
    expect(dashboard.body[0].episodes[0].coverImageUrl).toBe('https://cdn.example.com/cover.jpg');

    const draft = await withAuth(request(app).get(`/api/promptoon/episodes/${episode.body.id}/draft`), auth.token);
    expect(draft.body.episode.coverImageUrl).toBe('https://cdn.example.com/cover.jpg');
  });

  it('creates a cut with default position and order index', async () => {
    const auth = await registerUser();
    const project = await withAuth(request(app).post('/api/promptoon/projects'), auth.token).send({ title: 'Project A' });
    const episode = await withAuth(request(app).post(`/api/promptoon/projects/${project.body.id}/episodes`), auth.token).send({
      title: 'Episode 1',
      episodeNo: 1,
      coverImageUrl: 'https://cdn.example.com/publish-cover.jpg'
    });

    const cut = await withAuth(request(app).post(`/api/promptoon/episodes/${episode.body.id}/cuts`), auth.token).send({
      title: 'Cut 1',
      kind: 'scene'
    });

    expect(cut.status).toBe(201);
    expect(cut.body.positionX).toBe(0);
    expect(cut.body.positionY).toBe(100);
    expect(cut.body.orderIndex).toBe(0);
    expect(cut.body.dialogAnchorX).toBe('left');
    expect(cut.body.dialogAnchorY).toBe('bottom');
    expect(cut.body.dialogOffsetX).toBe(0);
    expect(cut.body.dialogOffsetY).toBe(0);
    expect(cut.body.startEffect).toBe('none');
    expect(cut.body.endEffect).toBe('none');
    expect(cut.body.startEffectDurationMs).toBe(DEFAULT_CUT_EFFECT_DURATION_MS);
    expect(cut.body.endEffectDurationMs).toBe(DEFAULT_CUT_EFFECT_DURATION_MS);
    expect(cut.body.edgeFade).toBe('none');
    expect(cut.body.edgeFadeIntensity).toBe('normal');
    expect(cut.body.edgeFadeColor).toBe('black');
    expect(cut.body.marginBottomToken).toBe('none');
    expect(cut.body.contentBlocks).toEqual([]);
  });

  it('preserves manually selected scene and choice kinds regardless of choice count', async () => {
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

    const patchToChoice = await withAuth(request(app).patch(`/api/promptoon/cuts/${sourceCut.body.id}`), auth.token).send({
      kind: 'choice'
    });
    expect(patchToChoice.body.kind).toBe('choice');

    const firstChoice = await withAuth(request(app).post(`/api/promptoon/cuts/${sourceCut.body.id}/choices`), auth.token).send({
      label: 'Choice 1',
      nextCutId: targetA.body.id
    });

    const afterFirstChoice = await withAuth(request(app).get(`/api/promptoon/episodes/${episode.body.id}/draft`), auth.token);
    expect(afterFirstChoice.body.cuts.find((cut: { id: string }) => cut.id === sourceCut.body.id)?.kind).toBe('choice');

    await withAuth(request(app).post(`/api/promptoon/cuts/${sourceCut.body.id}/choices`), auth.token).send({
      label: 'Choice 2',
      nextCutId: targetB.body.id
    });

    const afterSecondChoice = await withAuth(request(app).get(`/api/promptoon/episodes/${episode.body.id}/draft`), auth.token);
    expect(afterSecondChoice.body.cuts.find((cut: { id: string }) => cut.id === sourceCut.body.id)?.kind).toBe('choice');

    const patchToScene = await withAuth(request(app).patch(`/api/promptoon/cuts/${sourceCut.body.id}`), auth.token).send({
      kind: 'scene'
    });
    expect(patchToScene.body.kind).toBe('scene');

    await withAuth(request(app).delete(`/api/promptoon/choices/${firstChoice.body.id}`), auth.token);

    const afterDelete = await withAuth(request(app).get(`/api/promptoon/episodes/${episode.body.id}/draft`), auth.token);
    expect(afterDelete.body.cuts.find((cut: { id: string }) => cut.id === sourceCut.body.id)?.kind).toBe('scene');
  });

  it('uploads an image asset and returns a served asset URL', async () => {
    const auth = await registerUser();
    const project = await withAuth(request(app).post('/api/promptoon/projects'), auth.token).send({ title: 'Upload Project' });
    const response = await withAuth(request(app).post(`/api/promptoon/projects/${project.body.id}/assets`), auth.token).attach(
      'file',
      TINY_PNG_IMAGE,
      {
        filename: 'cover.png',
        contentType: 'image/png'
      }
    );

    expect(response.status).toBe(201);

    const assetUrl = response.body.assetUrl as string;
    const uploadRelativePath = assetUrl.replace(/^\/uploads\//, '');
    const originalRelativePath = path.posix.join(path.posix.dirname(uploadRelativePath), `${path.posix.basename(uploadRelativePath, '.webp')}.png`);
    const servedAsset = await request(app).get(assetUrl);

    expect(assetUrl).toMatch(/^\/uploads\/\d{4}\/\d{2}\/\d{2}\/[a-f0-9]{12}\/cover-\d+\.webp$/);
    expect(assetUrl).not.toContain(project.body.id);
    expect(servedAsset.status).toBe(200);
    expect(servedAsset.headers['content-type']).toContain('image/webp');
    expect(await uploadFileExists(uploadRelativePath)).toBe(true);
    expect(await uploadFileExists(originalRelativePath)).toBe(true);
  });

  it('rejects corrupt image uploads', async () => {
    const auth = await registerUser();
    const project = await withAuth(request(app).post('/api/promptoon/projects'), auth.token).send({ title: 'Corrupt Upload Project' });
    const response = await withAuth(request(app).post(`/api/promptoon/projects/${project.body.id}/assets`), auth.token).attach(
      'file',
      Buffer.from('fake image bytes'),
      {
        filename: 'cover.png',
        contentType: 'image/png'
      }
    );

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid image file.');
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

  it('deletes a cut and reconnects incoming choices to the requested target cut', async () => {
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
    const middleCut = await withAuth(request(app).post(`/api/promptoon/episodes/${episode.body.id}/cuts`), auth.token).send({
      title: 'Middle',
      kind: 'scene'
    });
    const endingCut = await withAuth(request(app).post(`/api/promptoon/episodes/${episode.body.id}/cuts`), auth.token).send({
      title: 'End',
      kind: 'ending',
      isEnding: true
    });
    const incomingChoice = await withAuth(request(app).post(`/api/promptoon/cuts/${startCut.body.id}/choices`), auth.token).send({
      label: 'Go',
      nextCutId: middleCut.body.id
    });

    const deleteResponse = await withAuth(request(app).delete(`/api/promptoon/cuts/${middleCut.body.id}`), auth.token).send({
      reconnectToCutId: endingCut.body.id
    });
    expect(deleteResponse.status).toBe(204);

    const draft = await withAuth(request(app).get(`/api/promptoon/episodes/${episode.body.id}/draft`), auth.token);
    expect(draft.body.cuts.some((cut: { id: string }) => cut.id === middleCut.body.id)).toBe(false);
    expect(draft.body.choices.find((choice: { id: string }) => choice.id === incomingChoice.body.id).nextCutId).toBe(endingCut.body.id);
  });

  it('rejects invalid cut delete reconnect targets', async () => {
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
    const cut = await withAuth(request(app).post(`/api/promptoon/episodes/${episodeOne.body.id}/cuts`), auth.token).send({
      title: 'Middle',
      kind: 'scene'
    });
    const foreignCut = await withAuth(request(app).post(`/api/promptoon/episodes/${episodeTwo.body.id}/cuts`), auth.token).send({
      title: 'Foreign',
      kind: 'scene'
    });

    const selfReconnect = await withAuth(request(app).delete(`/api/promptoon/cuts/${cut.body.id}`), auth.token).send({
      reconnectToCutId: cut.body.id
    });
    expect(selfReconnect.status).toBe(400);

    const foreignReconnect = await withAuth(request(app).delete(`/api/promptoon/cuts/${cut.body.id}`), auth.token).send({
      reconnectToCutId: foreignCut.body.id
    });
    expect(foreignReconnect.status).toBe(400);

    const missingReconnect = await withAuth(request(app).delete(`/api/promptoon/cuts/${cut.body.id}`), auth.token).send({
      reconnectToCutId: randomUUID()
    });
    expect(missingReconnect.status).toBe(400);
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

  it('updates cut graph layout positions with a batch endpoint', async () => {
    const auth = await registerUser();
    const project = await withAuth(request(app).post('/api/promptoon/projects'), auth.token).send({ title: 'Project A' });
    const episode = await withAuth(request(app).post(`/api/promptoon/projects/${project.body.id}/episodes`), auth.token).send({
      title: 'Episode 1',
      episodeNo: 1
    });

    const firstCut = await withAuth(request(app).post(`/api/promptoon/episodes/${episode.body.id}/cuts`), auth.token).send({
      title: 'First',
      kind: 'scene',
      positionX: 0,
      positionY: 100
    });
    const secondCut = await withAuth(request(app).post(`/api/promptoon/episodes/${episode.body.id}/cuts`), auth.token).send({
      title: 'Second',
      kind: 'scene',
      positionX: 200,
      positionY: 100
    });

    const layout = await withAuth(request(app).patch(`/api/promptoon/episodes/${episode.body.id}/cuts/layout`), auth.token).send({
      cuts: [
        { cutId: firstCut.body.id, positionX: 10, positionY: 20 },
        { cutId: secondCut.body.id, positionX: 1010, positionY: 2010 }
      ]
    });

    expect(layout.status).toBe(200);
    expect(layout.body.cuts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: firstCut.body.id, positionX: 10, positionY: 20 }),
        expect.objectContaining({ id: secondCut.body.id, positionX: 1010, positionY: 2010 })
      ])
    );

    const draft = await withAuth(request(app).get(`/api/promptoon/episodes/${episode.body.id}/draft`), auth.token);
    expect(draft.body.cuts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: firstCut.body.id, positionX: 10, positionY: 20 }),
        expect.objectContaining({ id: secondCut.body.id, positionX: 1010, positionY: 2010 })
      ])
    );
  });

  it('publishes a valid episode', async () => {
    const auth = await registerUser();
    const project = await withAuth(request(app).post('/api/promptoon/projects'), auth.token).send({ title: 'Project A' });
    const episode = await withAuth(request(app).post(`/api/promptoon/projects/${project.body.id}/episodes`), auth.token).send({
      title: 'Episode 1',
      episodeNo: 1,
      coverImageUrl: 'https://cdn.example.com/publish-cover.jpg'
    });
    const startCut = await withAuth(request(app).post(`/api/promptoon/episodes/${episode.body.id}/cuts`), auth.token).send({
      title: 'Start',
      kind: 'scene',
      isStart: true,
      edgeFade: 'bottom',
      edgeFadeIntensity: 'strong',
      edgeFadeColor: 'white',
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
    expect(publish.body.manifest.episode.coverImageUrl).toBe('https://cdn.example.com/publish-cover.jpg');
    expect(publish.body.manifest.cuts).toHaveLength(2);
    expect(publish.body.manifest.cuts.find((cut: { id: string }) => cut.id === startCut.body.id)?.contentBlocks).toHaveLength(1);
    expect(publish.body.manifest.cuts.find((cut: { id: string }) => cut.id === startCut.body.id)?.edgeFade).toBe('bottom');
    expect(publish.body.manifest.cuts.find((cut: { id: string }) => cut.id === startCut.body.id)?.edgeFadeIntensity).toBe('strong');
    expect(publish.body.manifest.cuts.find((cut: { id: string }) => cut.id === startCut.body.id)?.edgeFadeColor).toBe('white');
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
    expect(response.body.projectId).toMatch(/^prj_[A-Za-z0-9_-]{10}$/);
    expect(response.body.projectId).not.toBe(fixture.project.body.id);
    expect(response.body.manifest.project.id).toBe(response.body.projectId);
    expect(response.body.manifest.episode.startCutId).toBe(fixture.startCut.body.id);
  });

  it('keeps new domain routers compatible with legacy read routes', async () => {
    const fixture = await createFeedReadyPublishedEpisodeFixture();

    const legacyViewer = await request(app).get(`/api/promptoon/episodes/published/${fixture.publish.body.id}`);
    const domainViewer = await request(app).get(`/api/viewer/publishes/${fixture.publish.body.id}`);
    const legacyFeed = await request(app).get('/api/promptoon/episodes/feed?limit=5');
    const domainFeed = await request(app).get('/api/feed/mixed?limit=5');
    const legacyDraft = await withAuth(request(app).get(`/api/promptoon/episodes/${fixture.episode.body.id}/draft`), fixture.auth.token);
    const studioDraft = await withAuth(request(app).get(`/api/studio/episodes/${fixture.episode.body.id}/draft`), fixture.auth.token);
    const channelHome = await request(app).get(`/api/channels/${fixture.channelSlug}/home`);
    const commentsMeta = await request(app).get(`/api/community/publishes/${fixture.publish.body.id}/comments-meta`);

    expect(domainViewer.status).toBe(200);
    expect(domainViewer.body.id).toBe(legacyViewer.body.id);
    expect(domainViewer.body.manifest.episode.title).toBe(legacyViewer.body.manifest.episode.title);
    expect(domainFeed.status).toBe(200);
    expect(domainFeed.body.items.map((item: { publishId: string }) => item.publishId)).toEqual(
      legacyFeed.body.items.map((item: { publishId: string }) => item.publishId)
    );
    expect(studioDraft.status).toBe(200);
    expect(studioDraft.body.episode.id).toBe(legacyDraft.body.episode.id);
    expect(channelHome.status).toBe(200);
    expect(channelHome.body.profile.slug).toBe(fixture.channelSlug);
    expect(commentsMeta.status).toBe(200);
    expect(commentsMeta.body.commentCount).toBe(0);
  });

  it('serves Studio project management and Community embed product routes', async () => {
    const fixture = await createFeedReadyPublishedEpisodeFixture();

    const settings = await withAuth(request(app).patch(`/api/studio/projects/${fixture.project.body.id}`), fixture.auth.token).send({
      title: 'Updated Product Flow Project',
      thumbnailUrl: 'https://cdn.example.com/project-thumb.jpg'
    });
    const assets = await withAuth(request(app).get(`/api/studio/projects/${fixture.project.body.id}/assets`), fixture.auth.token);
    const history = await withAuth(request(app).get(`/api/studio/projects/${fixture.project.body.id}/publishes`), fixture.auth.token);
    const commentsMeta = await request(app).get(`/api/community/publishes/${fixture.publish.body.id}/comments-meta`);
    const communityEmbed = await request(app).get(`/api/community/publishes/${fixture.publish.body.id}/embed`);

    expect(settings.status).toBe(200);
    expect(settings.body.title).toBe('Updated Product Flow Project');
    expect(settings.body.thumbnailUrl).toBe('https://cdn.example.com/project-thumb.jpg');
    expect(assets.status).toBe(200);
    expect(assets.body.assets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ assetUrl: 'https://cdn.example.com/project-thumb.jpg', source: 'project_thumbnail' }),
        expect.objectContaining({ assetUrl: 'https://cdn.example.com/product-cover.jpg', source: 'episode_cover' }),
        expect.objectContaining({ assetUrl: 'https://cdn.example.com/product-start.jpg', source: 'cut_asset' })
      ])
    );
    expect(history.status).toBe(200);
    expect(history.body.publishes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          publishId: fixture.publish.body.id,
          episodeId: fixture.episode.body.id,
          episodeTitle: 'Product Episode',
          versionNo: 1
        })
      ])
    );
    expect(commentsMeta.status).toBe(200);
    expect(commentsMeta.body.embedUrl).toBe(`/community/publishes/${fixture.publish.body.id}`);
    expect(commentsMeta.body.managementUrl).toBe(`/studio/community/publishes/${fixture.publish.body.id}`);
    expect(communityEmbed.status).toBe(200);
    expect(communityEmbed.body.provider).toBe('promptoon');
    expect(communityEmbed.body.title).toBe('Product Episode 댓글');
  });

  it('supports Community comments, moderation, and Discourse thread sync', async () => {
    const fixture = await createFeedReadyPublishedEpisodeFixture();

    const unauthenticatedCreate = await request(app)
      .post(`/api/community/publishes/${fixture.publish.body.id}/comments`)
      .send({ body: '첫 댓글입니다.' });
    const created = await withAuth(
      request(app).post(`/api/community/publishes/${fixture.publish.body.id}/comments`),
      fixture.auth.token
    ).send({ body: '첫 댓글입니다.' });
    const listed = await request(app).get(`/api/community/publishes/${fixture.publish.body.id}/comments`);
    const metaAfterCreate = await request(app).get(`/api/community/publishes/${fixture.publish.body.id}/comments-meta`);
    const updated = await withAuth(request(app).patch(`/api/community/comments/${created.body.id}`), fixture.auth.token).send({
      body: '수정된 댓글입니다.'
    });
    const sync = await withAuth(
      request(app).post(`/api/community/publishes/${fixture.publish.body.id}/discourse-sync`),
      fixture.auth.token
    ).send({
      discourseTopicId: 'topic-123',
      status: 'synced',
      payload: { source: 'test' }
    });
    const embedAfterSync = await request(app).get(`/api/community/publishes/${fixture.publish.body.id}/embed`);
    const hidden = await withAuth(
      request(app).post(`/api/community/comments/${created.body.id}/moderation`),
      fixture.auth.token
    ).send({
      status: 'hidden',
      reason: 'spoiler'
    });
    const listedAfterModeration = await request(app).get(`/api/community/publishes/${fixture.publish.body.id}/comments`);
    const metaAfterModeration = await request(app).get(`/api/community/publishes/${fixture.publish.body.id}/comments-meta`);

    expect(unauthenticatedCreate.status).toBe(401);
    expect(created.status).toBe(201);
    expect(created.body.body).toBe('첫 댓글입니다.');
    expect(listed.status).toBe(200);
    expect(listed.body.comments).toEqual([expect.objectContaining({ id: created.body.id, body: '첫 댓글입니다.', status: 'visible' })]);
    expect(metaAfterCreate.body.commentCount).toBe(1);
    expect(updated.status).toBe(200);
    expect(updated.body.body).toBe('수정된 댓글입니다.');
    expect(sync.status).toBe(200);
    expect(sync.body).toEqual(expect.objectContaining({ publishId: fixture.publish.body.id, status: 'synced', discourseTopicId: 'topic-123' }));
    expect(embedAfterSync.body.provider).toBe('discourse');
    expect(hidden.status).toBe(200);
    expect(hidden.body.status).toBe('hidden');
    expect(listedAfterModeration.body.comments).toEqual([]);
    expect(metaAfterModeration.body.commentCount).toBe(0);
  });

  it('reports missing Discourse server env without exposing secret values', async () => {
    env.discourse.baseUrl = null;
    env.discourse.apiKey = null;

    const response = await request(app).get('/api/community/discourse/categories');

    expect(response.status).toBe(503);
    expect(response.body.error).toContain('DISCOURSE_BASE_URL');
    expect(response.body.error).toContain('DISCOURSE_API_KEY');
    expect(response.body.details).toEqual({
      missingEnv: ['DISCOURSE_BASE_URL', 'DISCOURSE_API_KEY']
    });
  });

  it('bridges feed comments to Discourse with project and episode scopes', async () => {
    env.discourse.baseUrl = 'https://discourse.example.test';
    env.discourse.apiKey = 'test-discourse-key';
    env.discourse.apiUser = 'system';
    env.discourse.categoryId = '7';

    const discourseTopics = new Map<string, { id: string; title: string; posts: Array<Record<string, unknown>> }>();
    let nextTopicId = 100;
    let nextPostId = 1000;

    function getTimestamp() {
      nextPostId += 1;
      return new Date(Date.UTC(2026, 4, 6, 0, 0, 0, nextPostId)).toISOString();
    }

    function jsonResponse(body: unknown, status = 200) {
      return new Response(JSON.stringify(body), {
        status,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    function findDiscoursePostById(postId: string) {
      for (const topic of discourseTopics.values()) {
        const post = topic.posts.find((item) => String(item.id) === postId);
        if (post) {
          return post;
        }
      }

      return null;
    }

    function setLikeAction(post: Record<string, unknown>, liked: boolean) {
      const nextCount = liked ? Number(post.like_count ?? 0) + 1 : Math.max(0, Number(post.like_count ?? 0) - 1);
      post.like_count = nextCount;
      post.actions_summary = [
        {
          id: 2,
          count: nextCount,
          acted: liked,
          can_act: !liked
        }
      ];
    }

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const requestUrl = new URL(String(url));
        const method = init?.method ?? 'GET';
        const body = init?.body ? JSON.parse(String(init.body)) : null;

        if (requestUrl.pathname === '/users.json' && method === 'POST') {
          return jsonResponse({ success: true });
        }

        if (requestUrl.pathname === '/posts.json' && method === 'POST') {
          if (body?.topic_id) {
            const topicId = String(body.topic_id);
            const topic = discourseTopics.get(topicId);
            if (!topic) {
              return jsonResponse({ errors: ['topic not found'] }, 404);
            }
            const postNumber = topic.posts.length + 1;
            const post = {
              id: nextPostId + 1,
              topic_id: topicId,
              post_number: postNumber,
              reply_to_post_number: body.reply_to_post_number ?? null,
              username: init?.headers ? 'promptoon_user' : 'unknown',
              name: 'Promptoon User',
              avatar_template: '/letter_avatar_proxy/v4/letter/p/96.png',
              cooked: `<p>${body.raw}</p>`,
              raw: body.raw,
              created_at: getTimestamp(),
              updated_at: getTimestamp(),
              like_count: 0,
              reply_count: 0,
              actions_summary: [{ id: 2, count: 0, acted: false, can_act: true }]
            };
            topic.posts.push(post);
            return jsonResponse({ id: post.id, topic_id: Number(topicId), post_number: postNumber });
          }

          const topicId = String(nextTopicId++);
          discourseTopics.set(topicId, {
            id: topicId,
            title: body.title,
            posts: [
              {
                id: nextPostId + 1,
                topic_id: topicId,
                post_number: 1,
                username: 'system',
                name: 'System',
                avatar_template: '/letter_avatar_proxy/v4/letter/s/96.png',
                cooked: `<p>${body.raw}</p>`,
                raw: body.raw,
                created_at: getTimestamp(),
                updated_at: getTimestamp(),
                like_count: 0,
                reply_count: 0,
                actions_summary: [{ id: 2, count: 0, acted: false, can_act: true }]
              }
            ]
          });
          return jsonResponse({ topic_id: Number(topicId), id: Number(topicId), post_number: 1 });
        }

        const topicMatch = requestUrl.pathname.match(/^\/t\/([^/]+)\.json$/);
        if (topicMatch && method === 'GET') {
          const topic = discourseTopics.get(topicMatch[1]);
          if (!topic) {
            return jsonResponse({ errors: ['topic not found'] }, 404);
          }
          return jsonResponse({
            id: Number(topic.id),
            title: topic.title,
            post_stream: {
              posts: topic.posts
            }
          });
        }

        if (requestUrl.pathname === '/post_actions.json' && method === 'POST') {
          const post = findDiscoursePostById(String(body.id));
          if (!post) {
            return jsonResponse({ errors: ['post not found'] }, 404);
          }
          setLikeAction(post, true);
          return jsonResponse({ success: true });
        }

        const postActionMatch = requestUrl.pathname.match(/^\/post_actions\/([^/]+)$/);
        if (postActionMatch && method === 'DELETE') {
          const post = findDiscoursePostById(postActionMatch[1]);
          if (!post) {
            return jsonResponse({ errors: ['post not found'] }, 404);
          }
          setLikeAction(post, false);
          return jsonResponse({ success: true });
        }

        return jsonResponse({ errors: ['not found'] }, 404);
      })
    );

    const fixture = await createFeedReadyPublishedEpisodeFixture();
    const episode2 = await withAuth(request(app).post(`/api/promptoon/projects/${fixture.project.body.id}/episodes`), fixture.auth.token).send({
      title: 'Product Episode 2',
      episodeNo: 2,
      coverImageUrl: 'https://cdn.example.com/product-cover-2.jpg'
    });
    const startCut2 = await withAuth(request(app).post(`/api/promptoon/episodes/${episode2.body.id}/cuts`), fixture.auth.token).send({
      title: 'Feed Branch 2',
      body: '두 번째 에피소드입니다.',
      kind: 'choice',
      isStart: true,
      assetUrl: 'https://cdn.example.com/product-start-2.jpg'
    });
    const ending2 = await withAuth(request(app).post(`/api/promptoon/episodes/${episode2.body.id}/cuts`), fixture.auth.token).send({
      title: 'Ending 2',
      kind: 'ending',
      isEnding: true
    });
    await withAuth(request(app).post(`/api/promptoon/cuts/${startCut2.body.id}/choices`), fixture.auth.token).send({
      label: '계속',
      nextCutId: ending2.body.id
    });
    const publish2 = await withAuth(request(app).post(`/api/promptoon/projects/${fixture.project.body.id}/publish`), fixture.auth.token).send({
      episodeId: episode2.body.id
    });

    const publicProjectComments = await request(app).get(`/api/community/publishes/${fixture.publish.body.id}/discourse/comments?scope=project`);
    const unauthenticatedCreate = await request(app)
      .post(`/api/community/publishes/${fixture.publish.body.id}/discourse/comments`)
      .send({ scope: 'episode', raw: '로그인 없이 댓글' });
    const projectComment = await withAuth(
      request(app).post(`/api/community/publishes/${fixture.publish.body.id}/discourse/comments`),
      fixture.auth.token
    ).send({ scope: 'project', raw: 'DM 전체 댓글' });
    const episode1Comment = await withAuth(
      request(app).post(`/api/community/publishes/${fixture.publish.body.id}/discourse/comments`),
      fixture.auth.token
    ).send({ scope: 'episode', raw: '재미있어요' });
    const episode2Comment = await withAuth(
      request(app).post(`/api/community/publishes/${publish2.body.id}/discourse/comments`),
      fixture.auth.token
    ).send({ scope: 'episode', raw: '좋아요' });
    const projectComments = await request(app).get(`/api/community/publishes/${fixture.publish.body.id}/discourse/comments?scope=project`);
    const episode1Post = projectComments.body.posts.find(
      (post: { source: string; episodeTitle?: string }) => post.source === 'episode' && post.episodeTitle === 'Product Episode'
    );
    const replyToEpisode1 = await withAuth(
      request(app).post(`/api/community/publishes/${fixture.publish.body.id}/discourse/comments`),
      fixture.auth.token
    ).send({
      scope: 'project',
      topicId: episode1Post.topicId,
      replyToPostNumber: episode1Post.postNumber,
      raw: '첫화 인가요'
    });
    const forbiddenTopic = await withAuth(
      request(app).post(`/api/community/publishes/${fixture.publish.body.id}/discourse/comments`),
      fixture.auth.token
    ).send({
      scope: 'project',
      topicId: '999999',
      raw: '다른 프로젝트 topic'
    });
    const episodeComments = await request(app).get(`/api/community/publishes/${fixture.publish.body.id}/discourse/comments?scope=episode`);
    const projectCommentsAfterReply = await request(app).get(
      `/api/community/publishes/${fixture.publish.body.id}/discourse/comments?scope=project`
    );
    const interactionAfterReply = await withAuth(
      request(app).get(`/api/community/publishes/${fixture.publish.body.id}/discourse/interaction`),
      fixture.auth.token
    );
    const likePublish = await withAuth(
      request(app).post(`/api/community/publishes/${fixture.publish.body.id}/discourse/like`),
      fixture.auth.token
    );
    const unlikePublish = await withAuth(
      request(app).delete(`/api/community/publishes/${fixture.publish.body.id}/discourse/like`),
      fixture.auth.token
    );

    expect(publicProjectComments.status).toBe(200);
    expect(publicProjectComments.body.posts).toEqual([]);
    expect(unauthenticatedCreate.status).toBe(401);
    expect(projectComment.status).toBe(201);
    expect(projectComment.body.source).toBe('project');
    expect(episode1Comment.status).toBe(201);
    expect(episode1Comment.body.source).toBe('episode');
    expect(episode2Comment.status).toBe(201);
    expect(projectComments.status).toBe(200);
    expect(projectComments.body.posts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'project', label: 'Product Flow Project 전체', cooked: '<p>DM 전체 댓글</p>' }),
        expect.objectContaining({ source: 'episode', episodeTitle: 'Product Episode', cooked: '<p>재미있어요</p>' }),
        expect.objectContaining({ source: 'episode', episodeTitle: 'Product Episode 2', cooked: '<p>좋아요</p>' })
      ])
    );
    expect(replyToEpisode1.status).toBe(201);
    expect(replyToEpisode1.body.source).toBe('episode');
    expect(forbiddenTopic.status).toBe(403);
    expect(episodeComments.body.posts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cooked: '<p>재미있어요</p>' }),
        expect.objectContaining({ cooked: '<p>첫화 인가요</p>', replyToPostNumber: episode1Post.postNumber })
      ])
    );
    expect(projectCommentsAfterReply.body.commentCount).toBe(4);
    expect(interactionAfterReply.status).toBe(200);
    expect(interactionAfterReply.body).toEqual(
      expect.objectContaining({
        publishId: fixture.publish.body.id,
        liked: false,
        metrics: expect.objectContaining({
          comments: 4,
          likes: 0
        })
      })
    );
    expect(likePublish.status).toBe(200);
    expect(likePublish.body).toEqual(
      expect.objectContaining({
        liked: true,
        metrics: expect.objectContaining({
          comments: 4,
          likes: 1
        }),
        target: expect.objectContaining({
          source: 'episode'
        })
      })
    );
    expect(unlikePublish.status).toBe(200);
    expect(unlikePublish.body).toEqual(
      expect.objectContaining({
        liked: false,
        metrics: expect.objectContaining({
          comments: 4,
          likes: 0
        })
      })
    );
  });

  it('tracks Studio uploaded asset metadata, replacement, and delete history', async () => {
    const auth = await registerUser();
    const project = await withAuth(request(app).post('/api/studio/projects'), auth.token).send({
      title: 'Asset History Project'
    });
    const upload = await withAuth(request(app).post(`/api/studio/projects/${project.body.id}/assets`), auth.token).attach(
      'file',
      TINY_PNG_IMAGE,
      'cover.png'
    );
    const uploadRelativePath = (upload.body.assetUrl as string).replace(/^\/uploads\//, '');
    const firstList = await withAuth(request(app).get(`/api/studio/projects/${project.body.id}/assets`), auth.token);
    const uploadedAsset = firstList.body.assets.find((asset: { source: string }) => asset.source === 'upload');
    const patched = await withAuth(
      request(app).patch(`/api/studio/projects/${project.body.id}/assets/${uploadedAsset.assetId}`),
      auth.token
    ).send({
      metadata: { label: '대표 이미지' }
    });
    const replaced = await withAuth(
      request(app).post(`/api/studio/projects/${project.body.id}/assets/${uploadedAsset.assetId}/replace`),
      auth.token
    ).attach('file', TINY_PNG_IMAGE, 'replacement.png');
    const deleted = await withAuth(
      request(app).delete(`/api/studio/projects/${project.body.id}/assets/${uploadedAsset.assetId}`),
      auth.token
    );
    const finalList = await withAuth(request(app).get(`/api/studio/projects/${project.body.id}/assets`), auth.token);
    const finalAsset = finalList.body.assets.find((asset: { assetId?: string }) => asset.assetId === uploadedAsset.assetId);

    expect(upload.status).toBe(201);
    expect(await uploadFileExists(uploadRelativePath)).toBe(true);
    expect(uploadedAsset).toEqual(
      expect.objectContaining({
        assetUrl: upload.body.assetUrl,
        source: 'upload',
        status: 'active',
        currentVersion: 1
      })
    );
    expect(uploadedAsset.history).toEqual([expect.objectContaining({ action: 'created' })]);
    expect(patched.status).toBe(200);
    expect(patched.body.metadata).toEqual({ label: '대표 이미지' });
    expect(replaced.status).toBe(200);
    expect(replaced.body.currentVersion).toBe(2);
    expect(replaced.body.assetUrl).not.toBe(upload.body.assetUrl);
    expect(deleted.status).toBe(204);
    expect(finalAsset.status).toBe('deleted');
    expect(finalAsset.history.map((item: { action: string }) => item.action)).toEqual(
      expect.arrayContaining(['created', 'metadata_updated', 'replaced', 'deleted'])
    );
  });

  it('compares publish versions and rolls back by creating a new published version', async () => {
    const fixture = await createFeedReadyPublishedEpisodeFixture();

    const cutPatch = await withAuth(request(app).patch(`/api/studio/cuts/${fixture.startCut.body.id}`), fixture.auth.token).send({
      title: 'Feed Branch Revised'
    });
    const secondPublish = await withAuth(
      request(app).post(`/api/studio/projects/${fixture.project.body.id}/publish`),
      fixture.auth.token
    ).send({
      episodeId: fixture.episode.body.id
    });
    const diff = await withAuth(
      request(app).get(`/api/studio/projects/${fixture.project.body.id}/publishes/${secondPublish.body.id}/diff`),
      fixture.auth.token
    );
    const compare = await withAuth(
      request(app).get(
        `/api/studio/projects/${fixture.project.body.id}/publishes/${fixture.publish.body.id}/compare/${secondPublish.body.id}`
      ),
      fixture.auth.token
    );
    const rollback = await withAuth(
      request(app).post(`/api/studio/projects/${fixture.project.body.id}/publishes/${fixture.publish.body.id}/rollback`),
      fixture.auth.token
    );
    const history = await withAuth(request(app).get(`/api/studio/projects/${fixture.project.body.id}/publishes`), fixture.auth.token);

    expect(cutPatch.status).toBe(200);
    expect(secondPublish.status).toBe(201);
    expect(secondPublish.body.versionNo).toBe(2);
    expect(diff.status).toBe(200);
    expect(diff.body.fromPublishId).toBe(secondPublish.body.id);
    expect(diff.body.toPublishId).toBe(fixture.publish.body.id);
    expect(diff.body.changedFields).toContain('cuts');
    expect(compare.status).toBe(200);
    expect(compare.body.fromPublishId).toBe(fixture.publish.body.id);
    expect(compare.body.toPublishId).toBe(secondPublish.body.id);
    expect(rollback.status).toBe(201);
    expect(rollback.body.publish.versionNo).toBe(3);
    expect(rollback.body.publish.manifest.cuts.find((cut: { id: string }) => cut.id === fixture.startCut.body.id).title).toBe('Feed Branch');
    expect(rollback.body.diff.changedFields).toContain('cuts');
    expect(history.body.publishes.map((publish: { versionNo: number }) => publish.versionNo)).toEqual(
      expect.arrayContaining([1, 2, 3])
    );
  });

  it('keeps Studio editor mutation routes compatible with legacy authoring routes', async () => {
    const auth = await registerUser();
    const project = await withAuth(request(app).post('/api/studio/projects'), auth.token).send({
      title: 'Editor Compatibility Project',
      description: 'Studio와 legacy 편집 route 호환성 검증용 프로젝트입니다.'
    });
    const episode = await withAuth(request(app).post(`/api/studio/projects/${project.body.id}/episodes`), auth.token).send({
      title: 'Compatibility Episode',
      episodeNo: 1
    });

    const legacyEpisodePatch = await withAuth(request(app).patch(`/api/promptoon/episodes/${episode.body.id}`), auth.token).send({
      coverImageUrl: 'https://cdn.example.com/editor-compat-cover.jpg'
    });
    const studioEpisodePatch = await withAuth(request(app).patch(`/api/studio/episodes/${episode.body.id}`), auth.token).send({
      title: 'Studio Revised Compatibility Episode'
    });

    const startCut = await withAuth(request(app).post(`/api/studio/episodes/${episode.body.id}/cuts`), auth.token).send({
      title: 'Start',
      kind: 'choice',
      isStart: true,
      positionX: 0,
      positionY: 100
    });
    const middleCut = await withAuth(request(app).post(`/api/promptoon/episodes/${episode.body.id}/cuts`), auth.token).send({
      title: 'Middle',
      kind: 'scene',
      positionX: 220,
      positionY: 100
    });
    const tempCut = await withAuth(request(app).post(`/api/promptoon/episodes/${episode.body.id}/cuts`), auth.token).send({
      title: 'Temporary',
      kind: 'scene',
      positionX: 440,
      positionY: 100
    });
    const endingCut = await withAuth(request(app).post(`/api/studio/episodes/${episode.body.id}/cuts`), auth.token).send({
      title: 'Ending',
      kind: 'ending',
      isEnding: true,
      positionX: 660,
      positionY: 100
    });

    const legacyChoice = await withAuth(request(app).post(`/api/promptoon/cuts/${startCut.body.id}/choices`), auth.token).send({
      label: 'Legacy choice',
      nextCutId: middleCut.body.id
    });
    const studioChoice = await withAuth(request(app).post(`/api/studio/cuts/${startCut.body.id}/choices`), auth.token).send({
      label: 'Studio choice',
      nextCutId: tempCut.body.id
    });

    const legacyCutPatch = await withAuth(request(app).patch(`/api/promptoon/cuts/${middleCut.body.id}`), auth.token).send({
      title: 'Legacy Patched Middle',
      contentBlocks: [
        {
          id: 'compat-middle-copy',
          type: 'narration',
          text: 'legacy route에서 수정된 컷입니다.',
          textAlign: 'left',
          fontToken: 'sans-kr'
        }
      ],
      edgeFade: 'bottom'
    });
    const studioCutPatch = await withAuth(request(app).patch(`/api/studio/cuts/${startCut.body.id}`), auth.token).send({
      title: 'Studio Patched Start',
      body: 'Studio domain route에서 수정된 시작 컷입니다.'
    });
    const studioChoicePatch = await withAuth(request(app).patch(`/api/studio/choices/${legacyChoice.body.id}`), auth.token).send({
      label: 'Studio patched legacy choice',
      nextCutId: endingCut.body.id,
      stateWrites: [
        {
          key: 'route',
          value: 'ending'
        }
      ]
    });
    const legacyChoicePatch = await withAuth(request(app).patch(`/api/promptoon/choices/${studioChoice.body.id}`), auth.token).send({
      label: 'Legacy patched studio choice',
      nextCutId: tempCut.body.id
    });

    const duplicateStudioReorder = await withAuth(
      request(app).patch(`/api/studio/episodes/${episode.body.id}/cuts/reorder`),
      auth.token
    ).send({
      cuts: [
        { cutId: startCut.body.id, orderIndex: 0 },
        { cutId: startCut.body.id, orderIndex: 1 }
      ]
    });
    const duplicateLegacyLayout = await withAuth(
      request(app).patch(`/api/promptoon/episodes/${episode.body.id}/cuts/layout`),
      auth.token
    ).send({
      cuts: [
        { cutId: startCut.body.id, positionX: 0, positionY: 0 },
        { cutId: startCut.body.id, positionX: 10, positionY: 10 }
      ]
    });
    const studioReorder = await withAuth(request(app).patch(`/api/studio/episodes/${episode.body.id}/cuts/reorder`), auth.token).send({
      cuts: [
        { cutId: startCut.body.id, orderIndex: 0 },
        { cutId: middleCut.body.id, orderIndex: 1 },
        { cutId: tempCut.body.id, orderIndex: 2 },
        { cutId: endingCut.body.id, orderIndex: 3 }
      ]
    });
    const legacyLayout = await withAuth(request(app).patch(`/api/promptoon/episodes/${episode.body.id}/cuts/layout`), auth.token).send({
      cuts: [
        { cutId: startCut.body.id, positionX: 11, positionY: 21 },
        { cutId: middleCut.body.id, positionX: 111, positionY: 121 },
        { cutId: tempCut.body.id, positionX: 211, positionY: 221 },
        { cutId: endingCut.body.id, positionX: 311, positionY: 321 }
      ]
    });
    const studioDeleteTemp = await withAuth(request(app).delete(`/api/studio/cuts/${tempCut.body.id}`), auth.token).send({
      reconnectToCutId: endingCut.body.id
    });

    const legacyValidation = await withAuth(request(app).post(`/api/promptoon/episodes/${episode.body.id}/validate`), auth.token);
    const studioValidation = await withAuth(request(app).post(`/api/studio/episodes/${episode.body.id}/validate`), auth.token);
    const legacyDraft = await withAuth(request(app).get(`/api/promptoon/episodes/${episode.body.id}/draft`), auth.token);
    const studioDraft = await withAuth(request(app).get(`/api/studio/episodes/${episode.body.id}/draft`), auth.token);

    expect(project.status).toBe(201);
    expect(episode.status).toBe(201);
    expect(legacyEpisodePatch.status).toBe(200);
    expect(studioEpisodePatch.status).toBe(200);
    expect(startCut.status).toBe(201);
    expect(middleCut.status).toBe(201);
    expect(tempCut.status).toBe(201);
    expect(endingCut.status).toBe(201);
    expect(legacyChoice.status).toBe(201);
    expect(studioChoice.status).toBe(201);
    expect(legacyCutPatch.status).toBe(200);
    expect(studioCutPatch.status).toBe(200);
    expect(studioChoicePatch.status).toBe(200);
    expect(legacyChoicePatch.status).toBe(200);
    expect(duplicateStudioReorder.status).toBe(400);
    expect(duplicateLegacyLayout.status).toBe(400);
    expect(studioReorder.status).toBe(200);
    expect(legacyLayout.status).toBe(200);
    expect(studioDeleteTemp.status).toBe(204);
    expect(legacyValidation.status).toBe(200);
    expect(studioValidation.status).toBe(200);
    expect(studioValidation.body).toEqual(legacyValidation.body);
    expect(studioDraft.status).toBe(200);
    expect(studioDraft.body).toEqual(legacyDraft.body);
    expect(studioDraft.body.episode).toEqual(
      expect.objectContaining({
        id: episode.body.id,
        title: 'Studio Revised Compatibility Episode',
        coverImageUrl: 'https://cdn.example.com/editor-compat-cover.jpg'
      })
    );
    expect(studioDraft.body.cuts.map((cut: { id: string }) => cut.id)).toEqual([
      startCut.body.id,
      middleCut.body.id,
      endingCut.body.id
    ]);
    expect(studioDraft.body.cuts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: startCut.body.id,
          title: 'Studio Patched Start',
          body: 'Studio domain route에서 수정된 시작 컷입니다.',
          positionX: 11,
          positionY: 21
        }),
        expect.objectContaining({
          id: middleCut.body.id,
          title: 'Legacy Patched Middle',
          edgeFade: 'bottom',
          positionX: 111,
          positionY: 121
        }),
        expect.objectContaining({
          id: endingCut.body.id,
          isEnding: true,
          positionX: 311,
          positionY: 321
        })
      ])
    );
    expect(studioDraft.body.choices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: legacyChoice.body.id,
          label: 'Studio patched legacy choice',
          nextCutId: endingCut.body.id,
          stateWrites: [
            {
              key: 'route',
              operation: 'set',
              value: 'ending'
            }
          ]
        }),
        expect.objectContaining({
          id: studioChoice.body.id,
          label: 'Legacy patched studio choice',
          nextCutId: endingCut.body.id
        })
      ])
    );
  });

  it('keeps LoopStateSetting creation compatible across Studio and legacy routes', async () => {
    const auth = await registerUser();
    const project = await withAuth(request(app).post('/api/studio/projects'), auth.token).send({
      title: 'Loop Route Compatibility Project'
    });

    async function createLoopSeed(episodeNo: number) {
      const episode = await withAuth(request(app).post(`/api/studio/projects/${project.body.id}/episodes`), auth.token).send({
        title: `Loop Route Episode ${episodeNo}`,
        episodeNo
      });
      const attachCut = await withAuth(request(app).post(`/api/studio/episodes/${episode.body.id}/cuts`), auth.token).send({
        title: 'Attach',
        kind: 'choice',
        isStart: true
      });
      const continuationCut = await withAuth(request(app).post(`/api/studio/episodes/${episode.body.id}/cuts`), auth.token).send({
        title: 'Continue',
        kind: 'scene'
      });
      const retryCut = await withAuth(request(app).post(`/api/studio/episodes/${episode.body.id}/cuts`), auth.token).send({
        title: 'Retry',
        kind: 'scene'
      });

      expect(episode.status).toBe(201);
      expect(attachCut.status).toBe(201);
      expect(continuationCut.status).toBe(201);
      expect(retryCut.status).toBe(201);

      return {
        attachCutId: attachCut.body.id as string,
        continuationCutId: continuationCut.body.id as string,
        episodeId: episode.body.id as string,
        retryCutId: retryCut.body.id as string
      };
    }

    function normalizeLoopStateResponse(
      responseBody: {
        choices: Array<{
          cutId: string;
          label: string;
          nextCutId: string | null;
          stateWrites?: Array<{ key: string; operation?: string; value: string }>;
        }>;
        continuationCutId: string;
        cuts: Array<{
          id: string;
          kind: string;
          loopMetadata?: {
            groupId: string;
            role: string;
            stageIndex?: number;
            stageCount?: number;
            truth?: string;
            expectedChoice?: string;
            variantCutIds?: string[];
            resetStateKeyPrefix?: string;
          } | null;
          stateFallbackCutId?: string | null;
          stateRoutes?: Array<{
            conditions?: Array<{ stateKey: string; equals: string }>;
            label?: string;
            nextCutId: string;
          }>;
          title: string;
        }>;
        failureCutId: string;
        firstStageCutId: string;
        groupId: string;
        resultRouterCutId: string;
        retryCutId: string;
        successCutId: string;
      },
      seed: {
        attachCutId: string;
        continuationCutId: string;
        retryCutId: string;
      }
    ) {
      const cutsById = new Map(responseBody.cuts.map((cut) => [cut.id, cut]));
      const normalizeStateKey = (key: string) => key.replace(responseBody.groupId, '<group>');
      const getCutRole = (cutId: string | null | undefined): string | null => {
        if (!cutId) {
          return null;
        }
        if (cutId === seed.attachCutId) {
          return 'attach';
        }
        if (cutId === seed.continuationCutId) {
          return 'continuation';
        }
        if (cutId === seed.retryCutId) {
          return 'retry';
        }

        const cut = cutsById.get(cutId);
        const metadata = cut?.loopMetadata;
        if (!metadata) {
          return 'unknown';
        }
        if (metadata.role === 'stageBase') {
          return `stageBase:${metadata.stageIndex}`;
        }
        if (metadata.role === 'stageVariant') {
          return `stageVariant:${metadata.stageIndex}:${metadata.truth}`;
        }
        if (metadata.role === 'spacer') {
          return `spacer:${metadata.stageIndex}`;
        }
        return metadata.role;
      };
      const loopCuts = responseBody.cuts.filter((cut) => cut.loopMetadata?.groupId === responseBody.groupId);
      const loopCutSummary = loopCuts
        .map((cut) => ({
          expectedChoice: cut.loopMetadata?.expectedChoice ?? null,
          fallbackRole: getCutRole(cut.stateFallbackCutId),
          kind: cut.kind,
          resetStateKeyPrefix: cut.loopMetadata?.resetStateKeyPrefix
            ? normalizeStateKey(cut.loopMetadata.resetStateKeyPrefix)
            : null,
          role: getCutRole(cut.id),
          routes: (cut.stateRoutes ?? []).map((route) => ({
            conditions: (route.conditions ?? []).map((condition) => ({
              equals: condition.equals,
              stateKey: normalizeStateKey(condition.stateKey)
            })),
            label: route.label ?? null,
            nextRole: getCutRole(route.nextCutId)
          })),
          stageCount: cut.loopMetadata?.stageCount ?? null,
          title: cut.title,
          variantCount: cut.loopMetadata?.variantCutIds?.length ?? 0
        }))
        .sort((left, right) => `${left.role}:${left.title}`.localeCompare(`${right.role}:${right.title}`));
      const choiceSummary = responseBody.choices
        .map((choice) => ({
          label: choice.label,
          nextRole: getCutRole(choice.nextCutId),
          sourceRole: getCutRole(choice.cutId),
          stateWrites: (choice.stateWrites ?? []).map((stateWrite) => ({
            key: normalizeStateKey(stateWrite.key),
            operation: stateWrite.operation ?? 'set',
            value: stateWrite.value
          }))
        }))
        .sort((left, right) =>
          `${left.sourceRole}:${left.label}:${left.nextRole}`.localeCompare(`${right.sourceRole}:${right.label}:${right.nextRole}`)
        );

      return {
        choiceSummary,
        firstStageRole: getCutRole(responseBody.firstStageCutId),
        groupId: responseBody.groupId.replace(/[a-f0-9]{8}$/, '<id>'),
        loopCutSummary,
        resultRouterRole: getCutRole(responseBody.resultRouterCutId),
        successRole: getCutRole(responseBody.successCutId),
        retryRole: getCutRole(responseBody.retryCutId),
        failureRole: getCutRole(responseBody.failureCutId),
        continuationRole: getCutRole(responseBody.continuationCutId)
      };
    }

    const legacySeed = await createLoopSeed(1);
    const studioSeed = await createLoopSeed(2);
    const requestBody = {
      groupName: 'Station Exit',
      exitLevelRequired: 5,
      stages: [
        {
          title: 'Entrance',
          baseAssetUrl: '/uploads/exit-loop/base-01.webp',
          spacerTitle: 'Entrance Spacer',
          spacerAssetUrl: '/uploads/exit-loop/spacer-01.webp',
          variants: [
            {
              title: 'Entrance Variant',
              assetUrl: '/uploads/exit-loop/variant-01.webp',
              truth: 'real_anomaly'
            }
          ]
        },
        {
          title: 'Gate',
          variants: [
            {
              title: 'Gate Variant',
              truth: 'fake_suspicion'
            }
          ]
        }
      ]
    };
    const legacyLoop = await withAuth(
      request(app).post(`/api/promptoon/episodes/${legacySeed.episodeId}/loop-state-setting`),
      auth.token
    ).send({
      ...requestBody,
      attachAfterCutId: legacySeed.attachCutId,
      continuationCutId: legacySeed.continuationCutId,
      retryCutId: legacySeed.retryCutId
    });
    const studioLoop = await withAuth(
      request(app).post(`/api/studio/episodes/${studioSeed.episodeId}/loop-state-setting`),
      auth.token
    ).send({
      ...requestBody,
      attachAfterCutId: studioSeed.attachCutId,
      continuationCutId: studioSeed.continuationCutId,
      retryCutId: studioSeed.retryCutId
    });
    const legacyDraftFromStudio = await withAuth(request(app).get(`/api/studio/episodes/${legacySeed.episodeId}/draft`), auth.token);
    const studioDraftFromLegacy = await withAuth(request(app).get(`/api/promptoon/episodes/${studioSeed.episodeId}/draft`), auth.token);

    expect(project.status).toBe(201);
    expect(legacyLoop.status).toBe(201);
    expect(studioLoop.status).toBe(201);
    expect(legacyDraftFromStudio.status).toBe(200);
    expect(studioDraftFromLegacy.status).toBe(200);
    expect({
      choices: legacyDraftFromStudio.body.choices,
      cuts: legacyDraftFromStudio.body.cuts,
      episode: legacyDraftFromStudio.body.episode
    }).toEqual({
      choices: legacyLoop.body.choices,
      cuts: legacyLoop.body.cuts,
      episode: legacyLoop.body.episode
    });
    expect({
      choices: studioDraftFromLegacy.body.choices,
      cuts: studioDraftFromLegacy.body.cuts,
      episode: studioDraftFromLegacy.body.episode
    }).toEqual({
      choices: studioLoop.body.choices,
      cuts: studioLoop.body.cuts,
      episode: studioLoop.body.episode
    });
    expect(normalizeLoopStateResponse(studioLoop.body, studioSeed)).toEqual(
      normalizeLoopStateResponse(legacyLoop.body, legacySeed)
    );
    expect(studioLoop.body.cuts.filter((cut: { loopMetadata?: { role?: string } | null }) => cut.loopMetadata?.role === 'stageBase')).toHaveLength(2);
    expect(studioLoop.body.cuts.filter((cut: { loopMetadata?: { role?: string } | null }) => cut.loopMetadata?.role === 'stageVariant')).toHaveLength(2);
    expect(studioLoop.body.cuts.filter((cut: { loopMetadata?: { role?: string } | null }) => cut.loopMetadata?.role === 'spacer')).toHaveLength(1);
    expect(studioLoop.body.cuts.filter((cut: { loopMetadata?: { role?: string } | null }) => cut.loopMetadata?.role === 'resultRouter')).toHaveLength(1);
  });

  it('creates public projections, community metadata, and telemetry when publishing', async () => {
    const fixture = await createFeedReadyPublishedEpisodeFixture();
    const [feedItems, channelProjections, discussions, telemetryEvents, projectMembers] = await Promise.all([
      query<{ count: string; payload_json: { channelSlug?: string; metrics?: unknown } }>(
        'SELECT COUNT(*)::text AS count, MAX(payload_json::text)::jsonb AS payload_json FROM promptoon_feed_item WHERE publish_id = $1',
        [fixture.publish.body.id]
      ),
      query<{ count: string }>('SELECT COUNT(*)::text AS count FROM promptoon_channel_home_projection WHERE channel_id = $1', [
        fixture.channelId
      ]),
      query<{ count: string; discussion_url: string | null }>(
        'SELECT COUNT(*)::text AS count, MAX(discussion_url) AS discussion_url FROM promptoon_episode_discussion WHERE publish_id = $1',
        [fixture.publish.body.id]
      ),
      query<{ count: string }>("SELECT COUNT(*)::text AS count FROM promptoon_telemetry_event WHERE event_name = 'studio_publish'"),
      query<{ role: string }>('SELECT role FROM promptoon_project_member WHERE project_id = $1 AND user_id = $2', [
        fixture.project.body.id,
        fixture.auth.user.id
      ])
    ]);

    expect(Number(feedItems.rows[0].count)).toBe(1);
    expect(feedItems.rows[0].payload_json.channelSlug).toBe(fixture.channelSlug);
    expect(feedItems.rows[0].payload_json.metrics).toEqual({ comments: 0, likes: 0, shares: 0, views: 0 });
    expect(Number(channelProjections.rows[0].count)).toBe(1);
    expect(Number(discussions.rows[0].count)).toBe(1);
    expect(discussions.rows[0].discussion_url).toBe(`/community/publishes/${fixture.publish.body.id}`);
    expect(Number(telemetryEvents.rows[0].count)).toBe(1);
    expect(projectMembers.rows[0].role).toBe('owner');
  });

  it('keeps project roles, projections, and project analytics available through Studio domain routes', async () => {
    const fixture = await createFeedReadyPublishedEpisodeFixture();
    const writer = await registerUser();
    const reviewer = await registerUser();
    const outsider = await registerUser();
    const anonymousId = randomUUID();
    const sessionId = randomUUID();

    const addMember = await withAuth(request(app).post(`/api/studio/projects/${fixture.project.body.id}/members`), fixture.auth.token).send({
      loginId: writer.user.loginId,
      role: 'writer'
    });
    expect(addMember.status).toBe(201);
    const addReviewer = await withAuth(request(app).post(`/api/studio/projects/${fixture.project.body.id}/members`), fixture.auth.token).send({
      loginId: reviewer.user.loginId,
      role: 'viewer'
    });
    expect(addReviewer.status).toBe(201);
    expect(addMember.body.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ loginId: writer.user.loginId, role: 'writer' }),
        expect.objectContaining({ loginId: fixture.auth.user.loginId, role: 'owner' })
      ])
    );

    const writerDraft = await withAuth(request(app).get(`/api/studio/episodes/${fixture.episode.body.id}/draft`), writer.token);
    expect(writerDraft.status).toBe(200);

    const writerPatch = await withAuth(request(app).patch(`/api/studio/episodes/${fixture.episode.body.id}`), writer.token).send({
      title: 'Writer Revised Episode'
    });
    expect(writerPatch.status).toBe(200);

    const reviewerDraft = await withAuth(request(app).get(`/api/studio/episodes/${fixture.episode.body.id}/draft`), reviewer.token);
    const reviewerPatch = await withAuth(request(app).patch(`/api/studio/episodes/${fixture.episode.body.id}`), reviewer.token).send({
      title: 'Reviewer Cannot Edit'
    });
    const writerValidation = await withAuth(request(app).post(`/api/studio/episodes/${fixture.episode.body.id}/validate`), writer.token);
    const reviewerValidation = await withAuth(request(app).post(`/api/studio/episodes/${fixture.episode.body.id}/validate`), reviewer.token);
    expect(reviewerDraft.status).toBe(200);
    expect(reviewerPatch.status).toBe(403);
    expect(writerValidation.status).toBe(200);
    expect(reviewerValidation.status).toBe(403);

    const writerPublish = await withAuth(request(app).post(`/api/studio/projects/${fixture.project.body.id}/publish`), writer.token).send({
      episodeId: fixture.episode.body.id
    });
    expect(writerPublish.status).toBe(403);

    await request(app)
      .post('/api/promptoon/telemetry/events')
      .send({
        publishId: fixture.publish.body.id,
        anonymousId,
        sessionId,
        eventType: 'cut_view',
        cutId: fixture.startCut.body.id
      });
    await request(app)
      .post('/api/promptoon/telemetry/events')
      .send({
        publishId: fixture.publish.body.id,
        anonymousId,
        sessionId,
        eventType: 'ending_reach',
        cutId: fixture.endingCut.body.id
      });

    const ownerAnalytics = await withAuth(request(app).get(`/api/studio/analytics/projects/${fixture.project.body.id}`), fixture.auth.token);
    const writerAnalytics = await withAuth(request(app).get(`/api/studio/analytics/projects/${fixture.project.body.id}`), writer.token);
    const reviewerAnalytics = await withAuth(request(app).get(`/api/studio/analytics/projects/${fixture.project.body.id}`), reviewer.token);
    const outsiderAnalytics = await withAuth(request(app).get(`/api/studio/analytics/projects/${fixture.project.body.id}`), outsider.token);

    expect(ownerAnalytics.status).toBe(200);
    expect(writerAnalytics.status).toBe(200);
    expect(reviewerAnalytics.status).toBe(200);
    expect(outsiderAnalytics.status).toBe(403);
    expect(ownerAnalytics.body).toEqual(
      expect.objectContaining({
        projectId: fixture.project.body.id,
        totalEpisodes: 1,
        publishedEpisodes: 1,
        totalPublishes: 1,
        totalViews: 1,
        uniqueViewers: 1,
        endingReaches: 1,
        completionRate: 100
      })
    );
    expect(ownerAnalytics.body.episodes[0]).toEqual(
      expect.objectContaining({
        episodeId: fixture.episode.body.id,
        publishCount: 1,
        totalViews: 1,
        uniqueViewers: 1,
        endingReaches: 1
      })
    );
  });

  it('rebuilds public projections for existing publishes and preserves legacy reads', async () => {
    const fixture = await createFeedReadyPublishedEpisodeFixture();

    await query(
      `INSERT INTO promptoon_studio_member (user_id, role)
       VALUES ($1, 'studio_admin')
       ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role`,
      [fixture.auth.user.id]
    );
    await query('DELETE FROM promptoon_channel_home_projection');
    await query('DELETE FROM promptoon_feed_item');
    await query('DELETE FROM promptoon_episode_discussion');
    await query('UPDATE promptoon_publish SET channel_id = NULL, series_id = NULL WHERE id = $1', [fixture.publish.body.id]);
    await query('DELETE FROM promptoon_series');
    await query('DELETE FROM promptoon_channel');

    const rebuild = await withAuth(request(app).post('/api/studio/projections/rebuild'), fixture.auth.token);
    expect(rebuild.status).toBe(200);
    expect(rebuild.body).toEqual({
      publishes: 1,
      channels: 1,
      series: 1,
      feedItems: 1,
      channelHomes: 1,
      discussions: 1
    });

    const [publishPlacement, feedItems, discussions, channels] = await Promise.all([
      query<{ channel_id: string | null; series_id: string | null }>(
        'SELECT channel_id::text AS channel_id, series_id::text AS series_id FROM promptoon_publish WHERE id = $1',
        [fixture.publish.body.id]
      ),
      query<{ count: string }>('SELECT COUNT(*)::text AS count FROM promptoon_feed_item WHERE publish_id = $1', [
        fixture.publish.body.id
      ]),
      query<{ count: string }>('SELECT COUNT(*)::text AS count FROM promptoon_episode_discussion WHERE publish_id = $1', [
        fixture.publish.body.id
      ]),
      query<{ id: string; slug: string }>('SELECT id::text AS id, slug FROM promptoon_channel WHERE owner_user_id = $1 AND is_default = TRUE', [
        fixture.auth.user.id
      ])
    ]);

    expect(publishPlacement.rows[0].channel_id).toEqual(expect.any(String));
    expect(publishPlacement.rows[0].series_id).toEqual(expect.any(String));
    expect(Number(feedItems.rows[0].count)).toBe(1);
    expect(Number(discussions.rows[0].count)).toBe(1);
    expect(channels.rows[0].slug).toEqual(expect.any(String));

    const secondRebuild = await withAuth(request(app).post('/api/studio/projections/rebuild'), fixture.auth.token);
    expect(secondRebuild.status).toBe(200);
    expect(secondRebuild.body).toEqual(rebuild.body);

    const restoredFeed = await request(app).get('/api/feed/mixed?limit=10');
    const restoredChannelHome = await request(app).get(`/api/channels/${channels.rows[0].slug}/home`);
    const legacyPublished = await request(app).get(`/api/promptoon/episodes/published/${fixture.publish.body.id}`);

    expect(restoredFeed.body.items.map((item: { publishId: string }) => item.publishId)).toContain(fixture.publish.body.id);
    expect(restoredChannelHome.body.latestEpisodes[0].publishId).toBe(fixture.publish.body.id);
    expect(legacyPublished.status).toBe(200);
    expect(legacyPublished.body.id).toBe(fixture.publish.body.id);
  });

  it('requires studio admin role for projection rebuild', async () => {
    const auth = await registerUser();
    await query(
      `INSERT INTO promptoon_studio_member (user_id, role)
       VALUES ($1, 'viewer')
       ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role`,
      [auth.user.id]
    );

    const rebuild = await withAuth(request(app).post('/api/studio/projections/rebuild'), auth.token);

    expect(rebuild.status).toBe(403);
  });

  it('enforces project member roles across studio and legacy authoring routes', async () => {
    const owner = await registerUser();
    const producer = await registerUser();
    const writer = await registerUser();
    const viewer = await registerUser();
    const project = await withAuth(request(app).post('/api/studio/projects'), owner.token).send({
      title: 'Role Project',
      description: '권한 테스트 프로젝트입니다.'
    });
    const episode = await withAuth(request(app).post(`/api/studio/projects/${project.body.id}/episodes`), owner.token).send({
      title: 'Role Episode',
      episodeNo: 1
    });

    await withAuth(request(app).post(`/api/studio/projects/${project.body.id}/members`), owner.token).send({
      loginId: producer.user.loginId,
      role: 'producer'
    });
    await withAuth(request(app).post(`/api/studio/projects/${project.body.id}/members`), owner.token).send({
      loginId: writer.user.loginId,
      role: 'writer'
    });
    await withAuth(request(app).post(`/api/studio/projects/${project.body.id}/members`), owner.token).send({
      loginId: viewer.user.loginId,
      role: 'viewer'
    });

    const members = await withAuth(request(app).get(`/api/studio/projects/${project.body.id}/members`), owner.token);
    const viewerProjects = await withAuth(request(app).get('/api/studio/projects'), viewer.token);
    const writerPatch = await withAuth(request(app).patch(`/api/studio/episodes/${episode.body.id}`), writer.token).send({
      title: 'Writer Updated Episode'
    });
    const viewerDraft = await withAuth(request(app).get(`/api/studio/episodes/${episode.body.id}/draft`), viewer.token);
    const legacyViewerDraft = await withAuth(request(app).get(`/api/promptoon/episodes/${episode.body.id}/draft`), viewer.token);
    const writerPublish = await withAuth(request(app).post(`/api/studio/projects/${project.body.id}/publish`), writer.token).send({
      episodeId: episode.body.id
    });
    const producerPublish = await withAuth(request(app).post(`/api/studio/projects/${project.body.id}/publish`), producer.token).send({
      episodeId: episode.body.id
    });
    const producerMemberManage = await withAuth(
      request(app).post(`/api/studio/projects/${project.body.id}/members`),
      producer.token
    ).send({
      loginId: `new-${randomUUID()}`,
      role: 'viewer'
    });
    const ownerPatchMember = await withAuth(
      request(app).patch(`/api/studio/projects/${project.body.id}/members/${writer.user.id}`),
      owner.token
    ).send({
      role: 'viewer'
    });
    const demotedWriterPatch = await withAuth(request(app).patch(`/api/studio/episodes/${episode.body.id}`), writer.token).send({
      title: 'Should fail'
    });
    const ownerDeleteMember = await withAuth(
      request(app).delete(`/api/studio/projects/${project.body.id}/members/${writer.user.id}`),
      owner.token
    );
    const ownerDeleteOwner = await withAuth(
      request(app).delete(`/api/studio/projects/${project.body.id}/members/${owner.user.id}`),
      owner.token
    );

    expect(members.status).toBe(200);
    expect(members.body.members.map((member: { role: string }) => member.role)).toEqual(['owner', 'producer', 'writer', 'viewer']);
    expect(viewerProjects.status).toBe(200);
    expect(viewerProjects.body.map((currentProject: { id: string }) => currentProject.id)).toContain(project.body.id);
    expect(writerPatch.status).toBe(200);
    expect(viewerDraft.status).toBe(200);
    expect(legacyViewerDraft.status).toBe(403);
    expect(writerPublish.status).toBe(403);
    expect(producerPublish.status).toBe(409);
    expect(producerMemberManage.status).toBe(403);
    expect(ownerPatchMember.status).toBe(200);
    expect(ownerPatchMember.body.members.find((member: { userId: string }) => member.userId === writer.user.id).role).toBe('viewer');
    expect(demotedWriterPatch.status).toBe(403);
    expect(ownerDeleteMember.status).toBe(200);
    expect(ownerDeleteOwner.status).toBe(400);
  });

  it('serves feed from feed item projections only', async () => {
    const fixture = await createFeedReadyPublishedEpisodeFixture();

    const beforeDelete = await request(app).get('/api/feed/mixed?limit=10');
    expect(beforeDelete.body.items.map((item: { publishId: string }) => item.publishId)).toContain(fixture.publish.body.id);

    await query('DELETE FROM promptoon_feed_item WHERE publish_id = $1', [fixture.publish.body.id]);

    const afterDelete = await request(app).get('/api/feed/mixed?limit=10');
    expect(afterDelete.status).toBe(200);
    expect(afterDelete.body.items.map((item: { publishId: string }) => item.publishId)).not.toContain(fixture.publish.body.id);
  });

  it('rebuilds channel home projections when missing and updates subscription counts', async () => {
    const fixture = await createFeedReadyPublishedEpisodeFixture();
    const subscriber = await registerUser();

    await query('DELETE FROM promptoon_channel_home_projection WHERE channel_id = $1', [fixture.channelId]);

    const rebuilt = await request(app).get(`/api/channels/${fixture.channelSlug}/home`);
    const projectionCount = await query<{ count: string }>('SELECT COUNT(*)::text AS count FROM promptoon_channel_home_projection WHERE channel_id = $1', [
      fixture.channelId
    ]);
    expect(rebuilt.status).toBe(200);
    expect(rebuilt.body.latestEpisodes[0].publishId).toBe(fixture.publish.body.id);
    expect(Number(projectionCount.rows[0].count)).toBe(1);

    const unauthenticatedSubscribe = await request(app).post(`/api/channels/${fixture.channelId}/subscribe`);
    expect(unauthenticatedSubscribe.status).toBe(401);

    const subscribe = await withAuth(request(app).post(`/api/channels/${fixture.channelId}/subscribe`), subscriber.token);
    expect(subscribe.status).toBe(204);

    const subscribedHome = await request(app).get(`/api/channels/${fixture.channelSlug}/home`);
    expect(subscribedHome.body.profile.subscriberCount).toBe(1);

    const unsubscribe = await withAuth(request(app).delete(`/api/channels/${fixture.channelId}/subscribe`), subscriber.token);
    expect(unsubscribe.status).toBe(204);

    const unsubscribedHome = await request(app).get(`/api/channels/${fixture.channelSlug}/home`);
    expect(unsubscribedHome.body.profile.subscriberCount).toBe(0);
  });

  it('tracks public interaction state and updates like and subscription metrics', async () => {
    const fixture = await createFeedReadyPublishedEpisodeFixture();
    const reader = await registerUser();

    const publicFeed = await request(app).get('/api/feed/mixed?limit=10');
    const publicViewer = await request(app).get(`/api/viewer/publishes/${fixture.publish.body.id}`);
    const publicChannel = await request(app).get(`/api/channels/${fixture.channelSlug}/home`);
    expect(publicFeed.status).toBe(200);
    expect(publicViewer.status).toBe(200);
    expect(publicChannel.status).toBe(200);

    const unauthenticatedState = await request(app).get(`/api/feed/state?publishIds=${fixture.publish.body.id}`);
    const unauthenticatedViewerState = await request(app).get(`/api/viewer/publishes/${fixture.publish.body.id}/state`);
    const unauthenticatedLike = await request(app).post(`/api/feed/publishes/${fixture.publish.body.id}/like`);
    expect(unauthenticatedState.status).toBe(401);
    expect(unauthenticatedViewerState.status).toBe(401);
    expect(unauthenticatedLike.status).toBe(401);

    const initialState = await withAuth(
      request(app).get(`/api/feed/state?publishIds=${fixture.publish.body.id}`),
      reader.token
    );
    expect(initialState.status).toBe(200);
    expect(initialState.body.items).toEqual([
      expect.objectContaining({
        publishId: fixture.publish.body.id,
        liked: false,
        bookmarked: false,
        metrics: {
          comments: 0,
          likes: 0,
          shares: 0,
          views: 0
        }
      })
    ]);

    const like = await withAuth(request(app).post(`/api/feed/publishes/${fixture.publish.body.id}/like`), reader.token);
    const likeAgain = await withAuth(request(app).post(`/api/feed/publishes/${fixture.publish.body.id}/like`), reader.token);
    const bookmark = await withAuth(request(app).post(`/api/feed/publishes/${fixture.publish.body.id}/bookmark`), reader.token);
    expect(like.status).toBe(204);
    expect(likeAgain.status).toBe(204);
    expect(bookmark.status).toBe(204);

    const likedState = await withAuth(
      request(app).get(`/api/feed/state?publishIds=${fixture.publish.body.id}`),
      reader.token
    );
    expect(likedState.body.items[0]).toEqual(
      expect.objectContaining({
        liked: true,
        bookmarked: true,
        metrics: expect.objectContaining({
          likes: 1
        })
      })
    );

    const likedFeed = await request(app).get('/api/feed/mixed?limit=10');
    const likedFeedItem = likedFeed.body.items.find((item: { publishId: string }) => item.publishId === fixture.publish.body.id);
    expect(likedFeedItem.metrics.likes).toBe(1);

    const likedChannel = await request(app).get(`/api/channels/${fixture.channelSlug}/home`);
    expect(likedChannel.body.profile.likeCount).toBe(1);

    const subscribe = await withAuth(request(app).post(`/api/channels/${fixture.channelId}/subscribe`), reader.token);
    expect(subscribe.status).toBe(204);

    const subscriptionState = await withAuth(
      request(app).get(`/api/channels/${fixture.channelId}/subscription`),
      reader.token
    );
    expect(subscriptionState.status).toBe(200);
    expect(subscriptionState.body).toEqual({
      channelId: fixture.channelId,
      subscribed: true,
      subscriberCount: 1
    });

    const viewerState = await withAuth(
      request(app).get(`/api/viewer/publishes/${fixture.publish.body.id}/state`),
      reader.token
    );
    expect(viewerState.status).toBe(200);
    expect(viewerState.body).toEqual(
      expect.objectContaining({
        publishId: fixture.publish.body.id,
        liked: true,
        bookmarked: true,
        channelId: fixture.channelId,
        subscribedToChannel: true,
        metrics: expect.objectContaining({
          likes: 1
        })
      })
    );

    const unbookmark = await withAuth(request(app).delete(`/api/feed/publishes/${fixture.publish.body.id}/bookmark`), reader.token);
    const unlike = await withAuth(request(app).delete(`/api/feed/publishes/${fixture.publish.body.id}/like`), reader.token);
    expect(unbookmark.status).toBe(204);
    expect(unlike.status).toBe(204);

    const finalState = await withAuth(
      request(app).get(`/api/feed/state?publishIds=${fixture.publish.body.id}`),
      reader.token
    );
    expect(finalState.body.items[0]).toEqual(
      expect.objectContaining({
        liked: false,
        bookmarked: false,
        metrics: expect.objectContaining({
          likes: 0
        })
      })
    );

    const finalChannel = await request(app).get(`/api/channels/${fixture.channelSlug}/home`);
    expect(finalChannel.body.profile.likeCount).toBe(0);

    const telemetry = await query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM promptoon_telemetry_event WHERE event_name IN ('feed_like', 'feed_bookmark', 'channel_subscribe')"
    );
    expect(Number(telemetry.rows[0].count)).toBeGreaterThanOrEqual(5);
  });

  it('returns related shorts from short clip projections', async () => {
    const fixture = await createFeedReadyPublishedEpisodeFixture();
    await query(
      `INSERT INTO promptoon_short_clip (
         project_id,
         channel_id,
         series_id,
         episode_id,
         publish_id,
         title,
         thumbnail_url,
         duration_sec,
         published_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 15, NOW())`,
      [
        fixture.project.body.id,
        fixture.channelId,
        fixture.seriesId,
        fixture.episode.body.id,
        fixture.publish.body.id,
        '15초 예고편',
        'https://cdn.example.com/short.jpg'
      ]
    );

    const response = await request(app).get(`/api/viewer/publishes/${fixture.publish.body.id}/related-shorts`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      expect.objectContaining({
        title: '15초 예고편',
        thumbnailUrl: 'https://cdn.example.com/short.jpg',
        durationSec: 15,
        href: `/v/${fixture.publish.body.id}`
      })
    ]);
  });

  it('separates generic telemetry events from strict viewer telemetry events', async () => {
    const fixture = await createFeedReadyPublishedEpisodeFixture();
    const generic = await request(app)
      .post('/api/telemetry/events')
      .send({
        eventName: 'channel_view',
        channelId: fixture.channelId,
        publishId: fixture.publish.body.id,
        payload: {
          source: 'test'
        }
      });
    const viewer = await request(app)
      .post('/api/telemetry/viewer-events')
      .send({
        publishId: fixture.publish.body.id,
        anonymousId: randomUUID(),
        sessionId: randomUUID(),
        eventType: 'cut_view',
        cutId: fixture.startCut.body.id
      });

    const genericCount = await query<{ count: string }>("SELECT COUNT(*)::text AS count FROM promptoon_telemetry_event WHERE event_name = 'channel_view'");
    const viewerEventCount = await query<{ count: string }>('SELECT COUNT(*)::text AS count FROM promptoon_viewer_event');
    const viewerTelemetryCount = await query<{ count: string }>("SELECT COUNT(*)::text AS count FROM promptoon_telemetry_event WHERE event_name = 'cut_view'");

    expect(generic.status).toBe(202);
    expect(viewer.status).toBe(202);
    expect(Number(genericCount.rows[0].count)).toBe(1);
    expect(Number(viewerEventCount.rows[0].count)).toBe(1);
    expect(Number(viewerTelemetryCount.rows[0].count)).toBe(1);
  });

  it('returns the public feed with latest publishes only and cursor pagination', async () => {
    const auth = await registerUser();
    const project = await withAuth(request(app).post('/api/promptoon/projects'), auth.token).send({ title: 'Feed Project' });

    async function createEpisodeWithPublish(episodeNo: number, body: string, branchingChoiceCount = 2) {
      const episode = await withAuth(request(app).post(`/api/promptoon/projects/${project.body.id}/episodes`), auth.token).send({
        title: `Episode ${episodeNo}`,
        episodeNo,
        coverImageUrl: `https://cdn.example.com/cover-${episodeNo}.jpg`
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

      return { branchCut, episode, publish, startCut };
    }

    const episodeOne = await createEpisodeWithPublish(1, '첫 번째 버전', 2);
    await createEpisodeWithPublish(2, '한 개 선택지만 있는 에피소드', 1);
    const episodeThree = await createEpisodeWithPublish(3, '세 번째 에피소드', 2);

    await withAuth(request(app).patch(`/api/promptoon/cuts/${episodeOne.startCut.body.id}`), auth.token).send({
      body: '첫 번째 에피소드 최신 버전'
    });
    await withAuth(request(app).patch(`/api/promptoon/cuts/${episodeOne.branchCut.body.id}`), auth.token).send({
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
    expect(firstPage.body.items[0].coverImageUrl).toBe('https://cdn.example.com/cover-1.jpg');
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
      const domainResponse = await request(app)
        .get(`/api/viewer/publishes/${fixture.publish.body.id}/share?e=${fixture.endingCut.body.id}`)
        .set('Host', 'viewer.example.test');

      expect(response.status).toBe(200);
      expect(response.type).toMatch(/html/);
      expect(response.text).toContain('Episode 1 - 나는 &quot;Secret Ending&quot; 엔딩을 봤어!');
      expect(response.text).toContain('비밀 엔딩에 도달했습니다.');
      expect(response.text).toContain('https://cdn.example.com/ending.jpg');
      expect(response.text).toContain('window.location.replace("http://viewer.example.test/v/');
      expect(response.text).toContain(`/v/${fixture.publish.body.id}?e=${fixture.endingCut.body.id}`);
      expect(response.text).toContain(`/api/promptoon/share/${fixture.publish.body.id}?e=${fixture.endingCut.body.id}`);
      expect(domainResponse.status).toBe(200);
      expect(domainResponse.type).toMatch(/html/);
      expect(domainResponse.text).toContain(`/api/viewer/publishes/${fixture.publish.body.id}/share?e=${fixture.endingCut.body.id}`);
      expect(domainResponse.text).toContain(`/v/${fixture.publish.body.id}?e=${fixture.endingCut.body.id}`);
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
    expect(response.text).toContain('https://cdn.example.com/episode-cover.jpg');
  });

  it('accepts telemetry events without authentication and persists them', async () => {
    const anonymousId = randomUUID();
    const sessionId = randomUUID();
    const fixture = await createPublishedEpisodeFixture();
    const choice = await query<{ id: string }>('SELECT id FROM promptoon_choice LIMIT 1');

    const response = await request(app)
      .post('/api/promptoon/telemetry/events')
      .send({
        publishId: fixture.publish.body.id,
        anonymousId,
        sessionId,
        eventType: 'choice_click',
        cutId: fixture.startCut.body.id,
        choiceId: choice.rows[0]?.id,
        durationMs: 1500
      });

    const countResult = await query<{ count: string }>('SELECT COUNT(*)::text AS count FROM promptoon_viewer_event');
    const eventResult = await query<{ session_id: string; duration_ms: number }>('SELECT session_id::text AS session_id, duration_ms FROM promptoon_viewer_event LIMIT 1');

    expect(response.status).toBe(202);
    expect(Number(countResult.rows[0].count)).toBe(1);
    expect(eventResult.rows[0].session_id).toBe(sessionId);
    expect(eventResult.rows[0].duration_ms).toBe(1500);
  });

  it('exports the authenticated user data as a JSON backup', async () => {
    const anonymousId = randomUUID();
    const sessionId = randomUUID();
    const fixture = await createPublishedEpisodeFixture();

    await request(app)
      .post('/api/promptoon/telemetry/events')
      .send({
        publishId: fixture.publish.body.id,
        anonymousId,
        sessionId,
        eventType: 'cut_view',
        cutId: fixture.startCut.body.id
      });

    const response = await withAuth(request(app).get('/api/promptoon/backup/export'), fixture.auth.token);
    const domainResponse = await withAuth(request(app).get('/api/studio/backup/export'), fixture.auth.token);

    expect(response.status).toBe(200);
    expect(domainResponse.status).toBe(200);
    expect(response.headers['content-disposition']).toContain('promptoon-backup-');
    expect(domainResponse.headers['content-disposition']).toContain('promptoon-backup-');
    expect(response.body.schemaVersion).toBe(1);
    expect(domainResponse.body.schemaVersion).toBe(1);
    expect(domainResponse.body.ownerId).toBe(fixture.auth.user.id);
    expect(response.body.ownerId).toBe(fixture.auth.user.id);
    expect(response.body.totals.projects).toBe(1);
    expect(response.body.totals.episodes).toBe(1);
    expect(response.body.totals.cuts).toBe(2);
    expect(response.body.totals.choices).toBe(1);
    expect(response.body.totals.publishes).toBe(1);
    expect(response.body.totals.viewerEvents).toBe(1);
    expect(response.body.projects[0].episodes[0].episode.id).toBe(fixture.episode.body.id);
    expect(response.body.projects[0].episodes[0].cuts.map((cut: { id: string }) => cut.id)).toContain(fixture.startCut.body.id);
    expect(response.body.projects[0].episodes[0].choices[0].afterSelectDelayMs).toEqual(expect.any(Number));
    expect(response.body.projects[0].episodes[0].publishes[0].id).toBe(fixture.publish.body.id);
    expect(response.body.projects[0].episodes[0].viewerEvents[0]).toEqual(expect.objectContaining({
      anonymousId,
      eventType: 'cut_view',
      sessionId
    }));
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
      const sessionId = randomUUID();
      if (index < 80) {
        await request(app)
          .post('/api/promptoon/telemetry/events')
          .send({
            publishId: publish.body.id,
            anonymousId,
            sessionId,
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
            sessionId,
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
          sessionId,
          eventType: 'cut_view',
          cutId: startCut.body.id
        });

      await request(app)
        .post('/api/promptoon/telemetry/events')
        .send({
          publishId: publish.body.id,
          anonymousId,
          sessionId,
          eventType: 'cut_leave',
          cutId: startCut.body.id,
          durationMs: index < 60 ? 1000 : 2000
        });

      if (index < 60) {
        await request(app)
          .post('/api/promptoon/telemetry/events')
          .send({
            publishId: publish.body.id,
            anonymousId,
            sessionId,
            eventType: 'choice_click',
            cutId: startCut.body.id,
            choiceId: choiceA.body.id,
            durationMs: 1200
          });
      } else {
        await request(app)
          .post('/api/promptoon/telemetry/events')
          .send({
            publishId: publish.body.id,
            anonymousId,
            sessionId,
            eventType: 'choice_click',
            cutId: startCut.body.id,
            choiceId: choiceB.body.id,
            durationMs: 2400
          });
      }

      if (index < 65) {
        await request(app)
          .post('/api/promptoon/telemetry/events')
          .send({
            publishId: publish.body.id,
            anonymousId,
            sessionId,
            eventType: 'ending_reach',
            cutId: index < 60 ? endingA.body.id : endingB.body.id
          });
      }

      if (index < 10) {
        await request(app)
          .post('/api/promptoon/telemetry/events')
          .send({
            publishId: publish.body.id,
            anonymousId,
            sessionId: randomUUID(),
            eventType: 'cut_view',
            cutId: startCut.body.id
          });
      }
    }

    const response = await withAuth(request(app).get(`/api/promptoon/analytics/episodes/${episode.body.id}`), auth.token);

    expect(response.status).toBe(200);
    expect(response.body.totalViews).toBe(110);
    expect(response.body.uniqueViewers).toBe(100);
    expect(response.body.completionRate).toBe(65);
    expect(response.body.replayRate).toBe(10);
    expect(response.body.choiceStats[startCut.body.id][0].percentage).toBe(60);
    expect(response.body.choiceStats[startCut.body.id][0].avgHesitationMs).toBe(1200);
    expect(response.body.choiceStats[startCut.body.id][1].percentage).toBe(40);
    expect(response.body.cutEngagement.find((stat: { cutId: string }) => stat.cutId === startCut.body.id).avgDurationMs).toBe(1400);
    expect(response.body.endingDistribution[0].cutId).toBe(endingA.body.id);
    expect(response.body.endingDistribution[0].percentage).toBeCloseTo(92.3, 1);
    expect(response.body.feedEntry.impressions).toBe(80);
    expect(response.body.feedEntry.choiceClicks).toBe(30);
    expect(response.body.feedEntry.conversionRate).toBe(37.5);
    expect(response.body.viewGranularity).toBe('daily');
    expect(response.body.viewsByPeriod).toHaveLength(14);
    expect(response.body.viewsByPeriod.at(-1).views).toBe(110);
    expect(response.body.viewsByPeriod.at(-1).uniqueViewers).toBe(100);

    const weeklyResponse = await withAuth(
      request(app).get(`/api/promptoon/analytics/episodes/${episode.body.id}`).query({ viewsGranularity: 'weekly' }),
      auth.token
    );
    expect(weeklyResponse.status).toBe(200);
    expect(weeklyResponse.body.viewGranularity).toBe('weekly');
    expect(weeklyResponse.body.viewsByPeriod).toHaveLength(12);
    expect(weeklyResponse.body.viewsByPeriod.at(-1).views).toBe(110);
    expect(weeklyResponse.body.viewsByPeriod.at(-1).uniqueViewers).toBe(100);

    const monthlyResponse = await withAuth(
      request(app).get(`/api/promptoon/analytics/episodes/${episode.body.id}`).query({ viewsGranularity: 'monthly' }),
      auth.token
    );
    expect(monthlyResponse.status).toBe(200);
    expect(monthlyResponse.body.viewGranularity).toBe('monthly');
    expect(monthlyResponse.body.viewsByPeriod).toHaveLength(12);
    expect(monthlyResponse.body.viewsByPeriod.at(-1).views).toBe(110);
    expect(monthlyResponse.body.viewsByPeriod.at(-1).uniqueViewers).toBe(100);
  });

  it('filters view chart periods by date range and includes unique viewers', async () => {
    const { auth, episode, publish, startCut } = await createPublishedEpisodeFixture();
    const rangeStart = getDateDaysAgo(5);
    const rangeEnd = getDateDaysAgo(3);
    const outsideRange = getDateDaysAgo(1);
    const anonymousA = randomUUID();
    const anonymousB = randomUUID();
    const anonymousC = randomUUID();

    for (const payload of [
      { anonymousId: anonymousA, sessionId: randomUUID() },
      { anonymousId: anonymousA, sessionId: randomUUID() },
      { anonymousId: anonymousB, sessionId: randomUUID() },
      { anonymousId: anonymousC, sessionId: randomUUID() }
    ]) {
      await request(app)
        .post('/api/promptoon/telemetry/events')
        .send({
          publishId: publish.body.id,
          anonymousId: payload.anonymousId,
          sessionId: payload.sessionId,
          eventType: 'cut_view',
          cutId: startCut.body.id
        });
    }

    await query(
      `UPDATE promptoon_viewer_event
       SET created_at = $1::timestamptz
       WHERE episode_id = $2 AND anonymous_id = $3 AND event_type = 'cut_view'`,
      [`${rangeStart}T12:00:00.000Z`, episode.body.id, anonymousA]
    );
    await query(
      `UPDATE promptoon_viewer_event
       SET created_at = $1::timestamptz
       WHERE episode_id = $2 AND anonymous_id = $3 AND event_type = 'cut_view'`,
      [`${rangeEnd}T12:00:00.000Z`, episode.body.id, anonymousB]
    );
    await query(
      `UPDATE promptoon_viewer_event
       SET created_at = $1::timestamptz
       WHERE episode_id = $2 AND anonymous_id = $3 AND event_type = 'cut_view'`,
      [`${outsideRange}T12:00:00.000Z`, episode.body.id, anonymousC]
    );

    const response = await withAuth(
      request(app).get(`/api/promptoon/analytics/episodes/${episode.body.id}`).query({
        viewsFrom: rangeStart,
        viewsTo: rangeEnd
      }),
      auth.token
    );

    expect(response.status).toBe(200);
    expect(response.body.viewsByPeriod).toHaveLength(3);
    expect(response.body.viewsByPeriod[0]).toMatchObject({ periodStart: rangeStart, views: 2, uniqueViewers: 1 });
    expect(response.body.viewsByPeriod[1]).toMatchObject({ views: 0, uniqueViewers: 0 });
    expect(response.body.viewsByPeriod[2]).toMatchObject({ periodStart: rangeEnd, views: 1, uniqueViewers: 1 });
  });

  it('resets analytics by section and recalculates derived metrics', async () => {
    const { auth, episode, endingCut, publish, startCut } = await createPublishedEpisodeFixture();
    const anonymousId = randomUUID();
    const sessionId = randomUUID();

    await request(app)
      .post('/api/promptoon/telemetry/events')
      .send({
        publishId: publish.body.id,
        anonymousId,
        sessionId,
        eventType: 'cut_view',
        cutId: startCut.body.id
      });
    await request(app)
      .post('/api/promptoon/telemetry/events')
      .send({
        publishId: publish.body.id,
        anonymousId,
        sessionId,
        eventType: 'cut_leave',
        cutId: startCut.body.id,
        durationMs: 900
      });
    await request(app)
      .post('/api/promptoon/telemetry/events')
      .send({
        publishId: publish.body.id,
        anonymousId,
        sessionId,
        eventType: 'ending_reach',
        cutId: endingCut.body.id
      });

    const resetEnding = await withAuth(
      request(app).post(`/api/promptoon/analytics/episodes/${episode.body.id}/reset`),
      auth.token
    ).send({ scope: 'endingDistribution' });
    expect(resetEnding.status).toBe(204);

    const afterEndingReset = await withAuth(request(app).get(`/api/promptoon/analytics/episodes/${episode.body.id}`), auth.token);
    expect(afterEndingReset.body.endingDistribution).toEqual([]);
    expect(afterEndingReset.body.completionRate).toBe(0);
    expect(afterEndingReset.body.totalViews).toBe(1);

    const resetCutEngagement = await withAuth(
      request(app).post(`/api/promptoon/analytics/episodes/${episode.body.id}/reset`),
      auth.token
    ).send({ scope: 'cutEngagement' });
    expect(resetCutEngagement.status).toBe(204);

    const afterCutEngagementReset = await withAuth(request(app).get(`/api/promptoon/analytics/episodes/${episode.body.id}`), auth.token);
    expect(afterCutEngagementReset.body.totalViews).toBe(0);
    expect(afterCutEngagementReset.body.uniqueViewers).toBe(0);
    expect(afterCutEngagementReset.body.viewsByPeriod.every((period: { views: number }) => period.views === 0)).toBe(true);
    expect(
      afterCutEngagementReset.body.cutEngagement.every(
        (stat: { avgDurationMs: number; dropOffCount: number }) => stat.avgDurationMs === 0 && stat.dropOffCount === 0
      )
    ).toBe(true);
  });

  it('resets all analytics events for an owned episode', async () => {
    const { auth, episode, endingCut, publish, startCut } = await createPublishedEpisodeFixture();
    const anonymousId = randomUUID();
    const sessionId = randomUUID();

    for (const eventType of ['feed_impression', 'cut_view', 'ending_reach'] as const) {
      await request(app)
        .post('/api/promptoon/telemetry/events')
        .send({
          publishId: publish.body.id,
          anonymousId,
          sessionId,
          eventType,
          cutId: eventType === 'ending_reach' ? endingCut.body.id : startCut.body.id
        });
    }

    const resetAll = await withAuth(
      request(app).post(`/api/promptoon/analytics/episodes/${episode.body.id}/reset`),
      auth.token
    ).send({ scope: 'all' });
    expect(resetAll.status).toBe(204);

    const response = await withAuth(request(app).get(`/api/promptoon/analytics/episodes/${episode.body.id}`), auth.token);
    expect(response.body.totalViews).toBe(0);
    expect(response.body.uniqueViewers).toBe(0);
    expect(response.body.feedEntry.impressions).toBe(0);
    expect(response.body.endingDistribution).toEqual([]);
  });

  it('rejects analytics reset for episodes owned by another user', async () => {
    const { episode } = await createPublishedEpisodeFixture();
    const otherAuth = await registerUser();

    const response = await withAuth(
      request(app).post(`/api/promptoon/analytics/episodes/${episode.body.id}/reset`),
      otherAuth.token
    ).send({ scope: 'all' });

    expect(response.status).toBe(403);
  });
});

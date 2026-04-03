"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_crypto_1 = require("node:crypto");
const vitest_1 = require("vitest");
const supertest_1 = __importDefault(require("supertest"));
const createApp_1 = require("../src/app/createApp");
const db_1 = require("../src/db");
const migrate_1 = require("../src/db/migrate");
const integrationEnabled = Boolean(process.env.DATABASE_URL);
const maybeDescribe = integrationEnabled ? vitest_1.describe : vitest_1.describe.skip;
maybeDescribe('promptoon api integration', () => {
    const app = (0, createApp_1.createApp)();
    (0, vitest_1.beforeAll)(async () => {
        await (0, migrate_1.runMigrations)();
    });
    (0, vitest_1.beforeEach)(async () => {
        await (0, db_1.query)('DELETE FROM promptoon_publish');
        await (0, db_1.query)('DELETE FROM promptoon_choice');
        await (0, db_1.query)('DELETE FROM promptoon_cut');
        await (0, db_1.query)('DELETE FROM promptoon_episode');
        await (0, db_1.query)('DELETE FROM promptoon_project');
    });
    (0, vitest_1.afterAll)(async () => {
        await (0, db_1.closePool)();
    });
    (0, vitest_1.it)('creates a project when x-user-id header is present', async () => {
        const response = await (0, supertest_1.default)(app)
            .post('/api/promptoon/projects')
            .set('x-user-id', (0, node_crypto_1.randomUUID)())
            .send({ title: 'Project A' });
        (0, vitest_1.expect)(response.status).toBe(201);
        (0, vitest_1.expect)(response.body.title).toBe('Project A');
    });
    (0, vitest_1.it)('rejects project creation without x-user-id', async () => {
        const response = await (0, supertest_1.default)(app)
            .post('/api/promptoon/projects')
            .send({ title: 'Project A' });
        (0, vitest_1.expect)(response.status).toBe(400);
    });
    (0, vitest_1.it)('creates a cut with default position and order index', async () => {
        const project = await (0, supertest_1.default)(app)
            .post('/api/promptoon/projects')
            .set('x-user-id', (0, node_crypto_1.randomUUID)())
            .send({ title: 'Project A' });
        const episode = await (0, supertest_1.default)(app)
            .post(`/api/promptoon/projects/${project.body.id}/episodes`)
            .send({ title: 'Episode 1', episodeNo: 1 });
        const cut = await (0, supertest_1.default)(app)
            .post(`/api/promptoon/episodes/${episode.body.id}/cuts`)
            .send({ title: 'Cut 1', kind: 'scene' });
        (0, vitest_1.expect)(cut.status).toBe(201);
        (0, vitest_1.expect)(cut.body.positionX).toBe(0);
        (0, vitest_1.expect)(cut.body.positionY).toBe(100);
        (0, vitest_1.expect)(cut.body.orderIndex).toBe(0);
    });
    (0, vitest_1.it)('deletes a cut and nulls dependent choice next_cut_id', async () => {
        const userId = (0, node_crypto_1.randomUUID)();
        const project = await (0, supertest_1.default)(app)
            .post('/api/promptoon/projects')
            .set('x-user-id', userId)
            .send({ title: 'Project A' });
        const episode = await (0, supertest_1.default)(app)
            .post(`/api/promptoon/projects/${project.body.id}/episodes`)
            .send({ title: 'Episode 1', episodeNo: 1 });
        const startCut = await (0, supertest_1.default)(app)
            .post(`/api/promptoon/episodes/${episode.body.id}/cuts`)
            .send({ title: 'Start', kind: 'scene', isStart: true });
        const endingCut = await (0, supertest_1.default)(app)
            .post(`/api/promptoon/episodes/${episode.body.id}/cuts`)
            .send({ title: 'End', kind: 'ending', isEnding: true });
        const choice = await (0, supertest_1.default)(app)
            .post(`/api/promptoon/cuts/${startCut.body.id}/choices`)
            .send({ label: 'Go', nextCutId: endingCut.body.id });
        const deleteResponse = await (0, supertest_1.default)(app).delete(`/api/promptoon/cuts/${endingCut.body.id}`);
        (0, vitest_1.expect)(deleteResponse.status).toBe(204);
        const draft = await (0, supertest_1.default)(app).get(`/api/promptoon/episodes/${episode.body.id}/draft`);
        (0, vitest_1.expect)(draft.status).toBe(200);
        (0, vitest_1.expect)(draft.body.choices[0].id).toBe(choice.body.id);
        (0, vitest_1.expect)(draft.body.choices[0].nextCutId).toBeNull();
    });
    (0, vitest_1.it)('publishes a valid episode', async () => {
        const userId = (0, node_crypto_1.randomUUID)();
        const project = await (0, supertest_1.default)(app)
            .post('/api/promptoon/projects')
            .set('x-user-id', userId)
            .send({ title: 'Project A' });
        const episode = await (0, supertest_1.default)(app)
            .post(`/api/promptoon/projects/${project.body.id}/episodes`)
            .send({ title: 'Episode 1', episodeNo: 1 });
        const startCut = await (0, supertest_1.default)(app)
            .post(`/api/promptoon/episodes/${episode.body.id}/cuts`)
            .send({ title: 'Start', kind: 'scene', isStart: true });
        const endingCut = await (0, supertest_1.default)(app)
            .post(`/api/promptoon/episodes/${episode.body.id}/cuts`)
            .send({ title: 'End', kind: 'ending', isEnding: true });
        await (0, supertest_1.default)(app)
            .post(`/api/promptoon/cuts/${startCut.body.id}/choices`)
            .send({ label: 'Go', nextCutId: endingCut.body.id });
        const publish = await (0, supertest_1.default)(app)
            .post(`/api/promptoon/projects/${project.body.id}/publish`)
            .set('x-user-id', userId)
            .send({ episodeId: episode.body.id });
        (0, vitest_1.expect)(publish.status).toBe(201);
        (0, vitest_1.expect)(publish.body.versionNo).toBe(1);
        (0, vitest_1.expect)(publish.body.manifest.cuts).toHaveLength(2);
    });
});
//# sourceMappingURL=promptoon.api.test.js.map
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const DOMAIN_MODULES = ['feed', 'channel', 'viewer', 'studio', 'community', 'telemetry'];
const PUBLIC_DOMAIN_MODULES = ['feed', 'channel', 'viewer', 'community', 'telemetry'];
const AUTHORING_SERVICE_IMPORT_PATTERN = /promptoon-authoring\/promptoon\.service/;
const AUTHORING_REPOSITORY_IMPORT_PATTERN = /promptoon-authoring\/promptoon\.repository/;
const BARE_REEXPORT_PATTERN = /^export\s*\{/m;
const STUDIO_ONLY_EXPORTS = [
  'addProjectMember',
  'createChoice',
  'createCut',
  'createEpisode',
  'createLoopStateSetting',
  'createProject',
  'deleteChoice',
  'deleteCut',
  'deleteLoopStateSetting',
  'deleteProjectMember',
  'exportUserBackup',
  'getEpisodeAnalytics',
  'getEpisodeDraft',
  'getLatestPublishedEpisode',
  'listProjectMembers',
  'listProjects',
  'publishProject',
  'rebuildPublicProjections',
  'reorderEpisodeCuts',
  'resetEpisodeAnalytics',
  'unpublishProject',
  'updateChoice',
  'updateCut',
  'updateEpisode',
  'updateEpisodeCutLayout',
  'updateLoopStateSetting',
  'updateProjectMember',
  'updatePublishedProject',
  'uploadAsset',
  'validateEpisode'
];

function moduleFilePath(moduleName: string, suffix: 'routes' | 'service'): string {
  return path.join(process.cwd(), 'src', 'modules', moduleName, `${moduleName}.${suffix}.ts`);
}

async function readModuleFile(moduleName: string, suffix: 'routes' | 'service'): Promise<string> {
  return readFile(moduleFilePath(moduleName, suffix), 'utf8');
}

describe('product domain boundaries', () => {
  it('keeps domain routers from importing the authoring service directly', async () => {
    for (const moduleName of DOMAIN_MODULES) {
      const source = await readModuleFile(moduleName, 'routes');
      expect(source, `${moduleName}.routes.ts must depend on ${moduleName}.service.ts`).not.toMatch(AUTHORING_SERVICE_IMPORT_PATTERN);
    }
  });

  it('uses explicit domain service wrappers instead of bare re-export facades', async () => {
    for (const moduleName of DOMAIN_MODULES) {
      const source = await readModuleFile(moduleName, 'service');
      expect(source, `${moduleName}.service.ts should define explicit wrappers`).not.toMatch(BARE_REEXPORT_PATTERN);
    }
  });

  it('does not expose Studio-only authoring operations from public domain services', async () => {
    for (const moduleName of PUBLIC_DOMAIN_MODULES) {
      const source = await readModuleFile(moduleName, 'service');
      for (const exportName of STUDIO_ONLY_EXPORTS) {
        expect(source, `${moduleName}.service.ts must not export ${exportName}`).not.toMatch(
          new RegExp(`export\\s+const\\s+${exportName}\\b`)
        );
      }
    }
  });

  it('keeps public domain services from importing the legacy authoring service', async () => {
    for (const moduleName of PUBLIC_DOMAIN_MODULES) {
      const source = await readModuleFile(moduleName, 'service');
      expect(source, `${moduleName}.service.ts must use domain/core services, not promptoon.service.ts`).not.toMatch(
        AUTHORING_SERVICE_IMPORT_PATTERN
      );
    }
  });

  it('keeps public domain services from importing the authoring repository directly', async () => {
    for (const moduleName of PUBLIC_DOMAIN_MODULES) {
      const source = await readModuleFile(moduleName, 'service');
      expect(source, `${moduleName}.service.ts must use promptoon-core/product.repository.ts`).not.toMatch(
        AUTHORING_REPOSITORY_IMPORT_PATTERN
      );
    }
  });

  it('keeps public feed and channel reads on projection boundaries', async () => {
    const projectionSource = await readFile(path.join(process.cwd(), 'src', 'modules', 'promptoon-core', 'projection.service.ts'), 'utf8');
    const productRepositorySource = await readFile(path.join(process.cwd(), 'src', 'modules', 'promptoon-core', 'product.repository.ts'), 'utf8');

    expect(projectionSource).toContain('repository.listFeedItemProjections');
    expect(projectionSource).toContain('repository.getChannelHomeProjection');
    expect(projectionSource).toContain('repository.upsertChannelHomeProjection');
    expect(projectionSource).toContain('./product.repository');
    expect(productRepositorySource).not.toMatch(AUTHORING_REPOSITORY_IMPORT_PATTERN);
    expect(productRepositorySource).toContain('promptoon_feed_item');
    expect(productRepositorySource).toContain('promptoon_channel_home_projection');
    expect(productRepositorySource).toContain('promptoon_episode_discussion');
  });

  it('requires Studio admin before rebuilding public projections from the Studio service', async () => {
    const studioSource = await readFile(path.join(process.cwd(), 'src', 'modules', 'studio', 'publish.service.ts'), 'utf8');
    const authorizationSource = await readFile(path.join(process.cwd(), 'src', 'modules', 'studio', 'authorization.service.ts'), 'utf8');

    expect(studioSource).toContain('authorizationService.ensureStudioAdmin');
    expect(authorizationSource).toContain('repository.getStudioMemberRole');
    expect(authorizationSource).toContain("role !== 'studio_admin'");
    expect(studioSource).toContain('projectionService.rebuildPublicProjections');
  });

  it('keeps editor-only CutState and validation details out of product projection persistence', async () => {
    const productRepositorySource = await readFile(path.join(process.cwd(), 'src', 'modules', 'promptoon-core', 'product.repository.ts'), 'utf8');

    expect(productRepositorySource).not.toContain('state_variants');
    expect(productRepositorySource).not.toContain('state_routes');
    expect(productRepositorySource).not.toContain('validateEpisodeGraph');
    expect(productRepositorySource).not.toContain('cut_state');
    expect(productRepositorySource).not.toContain('denoise');
    expect(productRepositorySource).not.toContain('ref_weight');
  });

  it('splits Studio operations behind dedicated services', async () => {
    const studioSource = await readModuleFile('studio', 'service');
    const authorizationSource = await readFile(path.join(process.cwd(), 'src', 'modules', 'studio', 'authorization.service.ts'), 'utf8');
    const editorSource = await readFile(path.join(process.cwd(), 'src', 'modules', 'studio', 'editor.service.ts'), 'utf8');
    const coreEditorSource = await readFile(path.join(process.cwd(), 'src', 'modules', 'promptoon-core', 'editor.service.ts'), 'utf8');
    const memberSource = await readFile(path.join(process.cwd(), 'src', 'modules', 'studio', 'member.service.ts'), 'utf8');
    const publishSource = await readFile(path.join(process.cwd(), 'src', 'modules', 'studio', 'publish.service.ts'), 'utf8');
    const projectSource = await readFile(path.join(process.cwd(), 'src', 'modules', 'studio', 'project.service.ts'), 'utf8');
    const analyticsSource = await readFile(path.join(process.cwd(), 'src', 'modules', 'studio', 'analytics.service.ts'), 'utf8');
    const accessRepositorySource = await readFile(path.join(process.cwd(), 'src', 'modules', 'studio', 'access.repository.ts'), 'utf8');
    const projectRepositorySource = await readFile(path.join(process.cwd(), 'src', 'modules', 'studio', 'project.repository.ts'), 'utf8');
    const analyticsRepositorySource = await readFile(path.join(process.cwd(), 'src', 'modules', 'studio', 'analytics.repository.ts'), 'utf8');
    const publishRepositorySource = await readFile(path.join(process.cwd(), 'src', 'modules', 'studio', 'publish.repository.ts'), 'utf8');
    const coreEditorRepositorySource = await readFile(path.join(process.cwd(), 'src', 'modules', 'promptoon-core', 'editor.repository.ts'), 'utf8');
    const editorDirectOperations = [
      'createEpisode',
      'updateEpisode',
      'createCut',
      'reorderEpisodeCuts',
      'updateEpisodeCutLayout',
      'createLoopStateSetting',
      'deleteLoopStateSetting',
      'updateLoopStateSetting',
      'updateCut',
      'deleteCut',
      'createChoice',
      'updateChoice',
      'deleteChoice',
      'validateEpisode'
    ];

    expect(studioSource).not.toMatch(AUTHORING_SERVICE_IMPORT_PATTERN);
    expect(studioSource).toContain('./editor.service');
    expect(studioSource).toContain('./member.service');
    expect(studioSource).toContain('./publish.service');
    expect(studioSource).toContain('./analytics.service');
    expect(studioSource).toContain('./project.service');
    expect(authorizationSource).not.toMatch(AUTHORING_SERVICE_IMPORT_PATTERN);
    expect(authorizationSource).not.toMatch(AUTHORING_REPOSITORY_IMPORT_PATTERN);
    expect(memberSource).not.toMatch(AUTHORING_SERVICE_IMPORT_PATTERN);
    expect(memberSource).not.toMatch(AUTHORING_REPOSITORY_IMPORT_PATTERN);
    expect(projectSource).not.toMatch(AUTHORING_SERVICE_IMPORT_PATTERN);
    expect(projectSource).not.toMatch(AUTHORING_REPOSITORY_IMPORT_PATTERN);
    expect(analyticsSource).not.toMatch(AUTHORING_SERVICE_IMPORT_PATTERN);
    expect(analyticsSource).not.toMatch(AUTHORING_REPOSITORY_IMPORT_PATTERN);
    expect(publishSource).not.toMatch(AUTHORING_REPOSITORY_IMPORT_PATTERN);
    expect(coreEditorSource).not.toMatch(AUTHORING_REPOSITORY_IMPORT_PATTERN);
    expect(accessRepositorySource).not.toMatch(AUTHORING_REPOSITORY_IMPORT_PATTERN);
    expect(accessRepositorySource).toContain('promptoon_project_member');
    expect(accessRepositorySource).toContain('promptoon_studio_member');
    expect(projectRepositorySource).not.toMatch(AUTHORING_REPOSITORY_IMPORT_PATTERN);
    expect(projectRepositorySource).toContain('listProjectsWithEpisodes');
    expect(projectRepositorySource).toContain('getUserBackupProjects');
    expect(analyticsRepositorySource).not.toMatch(AUTHORING_REPOSITORY_IMPORT_PATTERN);
    expect(analyticsRepositorySource).toContain('promptoon_viewer_event');
    expect(analyticsRepositorySource).toContain('deleteViewerEventsForAnalyticsScope');
    expect(publishRepositorySource).not.toMatch(AUTHORING_REPOSITORY_IMPORT_PATTERN);
    expect(publishRepositorySource).toContain('promptoon_publish');
    expect(publishRepositorySource).toContain('createPublish');
    expect(coreEditorRepositorySource).not.toMatch(AUTHORING_REPOSITORY_IMPORT_PATTERN);
    expect(coreEditorRepositorySource).toContain('promptoon_cut');
    expect(coreEditorRepositorySource).toContain('promptoon_choice');
    expect(coreEditorRepositorySource).toContain('createEpisode');
    expect(editorSource).not.toMatch(AUTHORING_SERVICE_IMPORT_PATTERN);
    expect(editorSource).not.toMatch(/promptoon-authoring\/promptoon\.repository/);
    expect(editorSource).not.toContain('validateEpisodeGraph');
    expect(editorSource).toContain('../promptoon-core/editor.service');
    expect(editorSource).toContain('authorizationService.ensureEpisodeProjectRole');
    for (const operationName of editorDirectOperations) {
      expect(editorSource).not.toMatch(
        new RegExp(`export\\s+const\\s+${operationName}:\\s*typeof\\s+authoringService\\.${operationName}\\b`)
      );
      expect(editorSource).toMatch(new RegExp(`export\\s+async\\s+function\\s+${operationName}\\b`));
    }
    expect(coreEditorSource).not.toMatch(AUTHORING_SERVICE_IMPORT_PATTERN);
    expect(coreEditorSource).toContain('getEpisodeDraft');
    expect(coreEditorSource).toContain('repository.createEpisode');
    expect(coreEditorSource).toContain('repository.updateEpisode');
    expect(coreEditorSource).toContain('repository.createCut');
    expect(coreEditorSource).toContain('repository.updateCut');
    expect(coreEditorSource).toContain('repository.deleteCut');
    expect(coreEditorSource).toContain('repository.createChoice');
    expect(coreEditorSource).toContain('repository.updateChoice');
    expect(coreEditorSource).toContain('repository.deleteChoice');
    expect(coreEditorSource).toContain('repository.reorderEpisodeCuts');
    expect(coreEditorSource).toContain('repository.updateEpisodeCutLayout');
    expect(coreEditorSource).toContain('validateEpisodeGraph');
    expect(editorSource).toContain('PROJECT_READ_ROLES');
    expect(publishSource).toContain('publishProject');
    expect(publishSource).toContain('rebuildPublicProjections');
    expect(projectSource).toContain('listProjects');
    expect(analyticsSource).toContain('getEpisodeAnalytics');
    expect(analyticsSource).toContain('resetEpisodeAnalytics');
  });
});

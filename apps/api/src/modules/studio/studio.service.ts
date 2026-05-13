import * as analyticsService from './analytics.service';
import * as editorService from './editor.service';
import * as memberService from './member.service';
import * as movingtoonService from './movingtoon.service';
import * as publishService from './publish.service';
import * as projectService from './project.service';

export const rebuildPublicProjections = (userId: string) =>
  publishService.rebuildPublicProjections(userId);

export const listProjects = (userId: string) =>
  projectService.listProjects(userId);

export const createProject = projectService.createProject;

export const updateProject = projectService.updateProject;

export const listProjectAssets = projectService.listProjectAssets;

export const updateAssetMetadata = projectService.updateAssetMetadata;

export const deleteAsset = projectService.deleteAsset;

export const replaceAsset = projectService.replaceAsset;

export const listProjectPublishHistory = projectService.listProjectPublishHistory;

export const diffProjectPublish = publishService.diffProjectPublish;

export const compareProjectPublishes = publishService.compareProjectPublishes;

export const rollbackProjectPublish = publishService.rollbackProjectPublish;

export const listProjectMembers = (projectId: string, userId: string) =>
  memberService.listProjectMembers(projectId, userId);

export const addProjectMember = (projectId: string, request: Parameters<typeof memberService.addProjectMember>[1], userId: string) =>
  memberService.addProjectMember(projectId, request, userId);

export const updateProjectMember = (
  projectId: string,
  targetUserId: string,
  request: Parameters<typeof memberService.updateProjectMember>[2],
  userId: string
) =>
  memberService.updateProjectMember(projectId, targetUserId, request, userId);

export const deleteProjectMember = (projectId: string, targetUserId: string, userId: string) =>
  memberService.deleteProjectMember(projectId, targetUserId, userId);

export const exportUserBackup = (userId: string) =>
  projectService.exportUserBackup(userId);

export const uploadAsset = projectService.uploadAsset;

export const createMovingtoonEpisode = movingtoonService.createMovingtoonEpisode;

export const listUploadQueue = movingtoonService.listUploadQueue;

export const reprocessMovingtoonEpisode = movingtoonService.reprocessMovingtoonEpisode;

export const publishMovingtoonEpisode = movingtoonService.publishMovingtoonEpisode;

export const unpublishMovingtoonEpisode = movingtoonService.unpublishMovingtoonEpisode;

export const createEpisode = editorService.createEpisode;

export const getEpisodeDraft = (episodeId: string, userId: string) =>
  editorService.getEpisodeDraft(episodeId, userId);

export const updateEpisode = editorService.updateEpisode;

export const getLatestPublishedEpisode = (episodeId: string, userId: string) =>
  editorService.getLatestPublishedEpisode(episodeId, userId);

export const getEpisodeTestViewerPublish = (episodeId: string, userId: string) =>
  editorService.getEpisodeTestViewerPublish(episodeId, userId);

export const createCut = editorService.createCut;

export const reorderEpisodeCuts = editorService.reorderEpisodeCuts;

export const updateEpisodeCutLayout = editorService.updateEpisodeCutLayout;

export const createLoopStateSetting = editorService.createLoopStateSetting;

export const deleteLoopStateSetting = editorService.deleteLoopStateSetting;

export const updateLoopStateSetting = editorService.updateLoopStateSetting;

export const updateCut = editorService.updateCut;

export const deleteCut = editorService.deleteCut;

export const createChoice = editorService.createChoice;

export const updateChoice = editorService.updateChoice;

export const deleteChoice = editorService.deleteChoice;

export const validateEpisode = editorService.validateEpisode;

export const publishProject = publishService.publishProject;

export const updatePublishedProject = publishService.updatePublishedProject;

export const unpublishProject = publishService.unpublishProject;

export const getProjectAnalytics = (projectId: string, userId: string) =>
  analyticsService.getProjectAnalytics(projectId, userId);

export const getEpisodeAnalytics = analyticsService.getEpisodeAnalytics;

export const resetEpisodeAnalytics = analyticsService.resetEpisodeAnalytics;

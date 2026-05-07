import type {
  AssetUploadResponse,
  CreateProjectRequest,
  PatchProjectRequest,
  Project,
  ProjectAssetListResponse,
  ProjectAssetSummary,
  ProjectPublishHistoryResponse,
  ProjectWithEpisodes,
  PromptoonBackupExport
} from '@promptoon/shared';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

import { db, withTransaction } from '../../db';
import { HttpError } from '../../lib/http-error';
import { resolveFromApiRoot, resolveFromWorkspaceRoot } from '../../lib/workspace-paths';
import * as productRepository from '../promptoon-core/product.repository';
import * as accessRepository from './access.repository';
import * as assetRepository from './asset.repository';
import * as authorizationService from './authorization.service';
import * as repository from './project.repository';

interface UploadFileWrite {
  fileName: string;
  buffer: Buffer;
}

interface PreparedUploadAsset {
  assetUrl: string;
  metadata: Record<string, unknown>;
}

function assertExists<T>(value: T | null, message: string): T {
  if (!value) {
    throw new HttpError(404, message);
  }

  return value;
}

function getBackupTotals(projects: PromptoonBackupExport['projects']): PromptoonBackupExport['totals'] {
  return projects.reduce(
    (totals, projectBackup) => {
      totals.projects += 1;
      totals.episodes += projectBackup.episodes.length;

      for (const episodeBackup of projectBackup.episodes) {
        totals.cuts += episodeBackup.cuts.length;
        totals.choices += episodeBackup.choices.length;
        totals.publishes += episodeBackup.publishes.length;
        totals.viewerEvents += episodeBackup.viewerEvents.length;
      }

      return totals;
    },
    {
      projects: 0,
      episodes: 0,
      cuts: 0,
      choices: 0,
      publishes: 0,
      viewerEvents: 0
    }
  );
}

function mapDatabaseError(error: unknown): Error {
  if (error instanceof HttpError) {
    return error;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  ) {
    return new HttpError(409, 'Unique constraint violation.');
  }

  return error as Error;
}

function getUploadsDirectory(): string {
  return resolveFromWorkspaceRoot('.data/uploads');
}

function getLegacyUploadsDirectory(): string {
  return resolveFromApiRoot('.data/uploads');
}

function isWritablePathError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && ['EACCES', 'EPERM', 'EROFS'].includes(String(error.code));
}

async function writeUploadFiles(relativeDirectory: string, files: UploadFileWrite[]): Promise<void> {
  const directoryCandidates = [path.join(getUploadsDirectory(), relativeDirectory), path.join(getLegacyUploadsDirectory(), relativeDirectory)];
  let lastError: unknown = null;

  for (const uploadsDirectory of directoryCandidates) {
    try {
      await mkdir(uploadsDirectory, { recursive: true });
      for (const file of files) {
        await writeFile(path.join(uploadsDirectory, file.fileName), file.buffer);
      }

      return;
    } catch (error) {
      lastError = error;
      if (!isWritablePathError(error)) {
        throw error;
      }
    }
  }

  throw lastError;
}

function sanitizeUploadBaseName(fileName: string): string {
  const extension = path.extname(fileName);
  const baseName = path.basename(fileName, extension).trim();
  const sanitized = baseName
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);

  return sanitized || 'image';
}

function padDatePart(value: number): string {
  return String(value).padStart(2, '0');
}

function getDatedUploadSegments(now: Date): [string, string, string] {
  return [String(now.getFullYear()), padDatePart(now.getMonth() + 1), padDatePart(now.getDate())];
}

function getUploadExtension(file: Express.Multer.File): string {
  const originalExtension = path.extname(file.originalname).toLowerCase();
  if (originalExtension) {
    return originalExtension;
  }

  const mimeSubtype = file.mimetype.split('/')[1]?.toLowerCase();
  if (!mimeSubtype) {
    return '.bin';
  }

  if (mimeSubtype === 'jpeg') {
    return '.jpg';
  }

  return `.${mimeSubtype.replace(/[^a-z0-9]/g, '') || 'bin'}`;
}

function buildProjectUploadBaseName(file: Express.Multer.File, now: Date): string {
  return `${sanitizeUploadBaseName(file.originalname)}-${now.getTime()}`;
}

function buildOriginalUploadFileName(file: Express.Multer.File, uploadBaseName: string): string {
  const extension = getUploadExtension(file);
  const originalSuffix = extension === '.webp' ? '-original' : '';

  return `${uploadBaseName}${originalSuffix}${extension}`;
}

function buildWebpUploadFileName(uploadBaseName: string): string {
  return `${uploadBaseName}.webp`;
}

function buildPublicUploadScope(): string {
  return randomUUID().replaceAll('-', '').slice(0, 12);
}

function buildAssetUrl(publicUploadScope: string, fileName: string, now: Date): string {
  return path.posix.join('/uploads', ...getDatedUploadSegments(now), publicUploadScope, fileName);
}

async function convertUploadToWebp(file: Express.Multer.File): Promise<Buffer> {
  try {
    return await sharp(file.buffer).webp().toBuffer();
  } catch {
    throw new HttpError(400, 'Invalid image file.');
  }
}

async function writeImageAssetUpload(file: Express.Multer.File): Promise<PreparedUploadAsset> {
  if (!file.mimetype.startsWith('image/')) {
    throw new HttpError(400, 'Only image uploads are supported.');
  }

  const now = new Date();
  const publicUploadScope = buildPublicUploadScope();
  const relativeDirectory = path.join(...getDatedUploadSegments(now), publicUploadScope);
  const uploadBaseName = buildProjectUploadBaseName(file, now);
  const originalFileName = buildOriginalUploadFileName(file, uploadBaseName);
  const webpFileName = buildWebpUploadFileName(uploadBaseName);
  const webpBuffer = await convertUploadToWebp(file);

  await writeUploadFiles(relativeDirectory, [
    {
      fileName: originalFileName,
      buffer: file.buffer
    },
    {
      fileName: webpFileName,
      buffer: webpBuffer
    }
  ]);

  return {
    assetUrl: buildAssetUrl(publicUploadScope, webpFileName, now),
    metadata: {
      originalName: file.originalname,
      originalMimeType: file.mimetype,
      originalSizeBytes: file.size,
      originalFileName,
      webpFileName,
      uploadedAt: now.toISOString()
    }
  };
}

export async function listProjects(userId: string): Promise<ProjectWithEpisodes[]> {
  return repository.listProjectsWithEpisodes(db, userId);
}

export async function createProject(request: CreateProjectRequest, userId: string): Promise<Project> {
  try {
    return await withTransaction(async (client) => {
      const project = await repository.createProject(client, {
        title: request.title,
        description: request.description,
        kind: request.kind,
        createdBy: userId
      });
      await accessRepository.upsertProjectMember(client, {
        projectId: project.id,
        userId,
        role: 'owner'
      });
      await productRepository.ensureDefaultChannelForProject(client, project, userId);
      return project;
    });
  } catch (error) {
    throw mapDatabaseError(error);
  }
}

export async function updateProject(projectId: string, request: PatchProjectRequest, userId: string): Promise<Project> {
  await authorizationService.ensureProjectWritableByUser(projectId, userId);
  return assertExists(await repository.updateProject(db, projectId, request), 'Project not found.');
}

export async function listProjectAssets(projectId: string, userId: string): Promise<ProjectAssetListResponse> {
  await authorizationService.ensureProjectReadableByUser(projectId, userId);
  const [derived, tracked] = await Promise.all([
    repository.listProjectAssets(db, projectId),
    assetRepository.listTrackedProjectAssets(db, projectId)
  ]);

  return {
    projectId,
    assets: [...tracked, ...derived.assets]
  };
}

export async function listProjectPublishHistory(projectId: string, userId: string): Promise<ProjectPublishHistoryResponse> {
  await authorizationService.ensureProjectReadableByUser(projectId, userId);
  return repository.listProjectPublishHistory(db, projectId);
}

export async function exportUserBackup(userId: string): Promise<PromptoonBackupExport> {
  const projects = await repository.getUserBackupProjects(db, userId);

  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    ownerId: userId,
    projects,
    totals: getBackupTotals(projects)
  };
}

export async function uploadAsset(projectId: string, file: Express.Multer.File, userId: string): Promise<AssetUploadResponse> {
  await authorizationService.ensureProjectWritableByUser(projectId, userId);
  const prepared = await writeImageAssetUpload(file);
  await assetRepository.recordUploadedAsset(db, {
    projectId,
    assetUrl: prepared.assetUrl,
    metadata: prepared.metadata,
    userId
  });

  return {
    assetUrl: prepared.assetUrl
  };
}

export async function updateAssetMetadata(
  projectId: string,
  assetId: string,
  metadata: Record<string, unknown>,
  userId: string
): Promise<ProjectAssetSummary> {
  await authorizationService.ensureProjectWritableByUser(projectId, userId);
  return assertExists(
    await assetRepository.updateAssetMetadata(db, {
      projectId,
      assetId,
      metadata,
      userId
    }),
    'Asset not found.'
  );
}

export async function deleteAsset(projectId: string, assetId: string, userId: string): Promise<void> {
  await authorizationService.ensureProjectWritableByUser(projectId, userId);
  const deleted = await assetRepository.markAssetDeleted(db, {
    projectId,
    assetId,
    userId
  });
  if (!deleted) {
    throw new HttpError(404, 'Asset not found.');
  }
}

export async function replaceAsset(
  projectId: string,
  assetId: string,
  file: Express.Multer.File,
  userId: string
): Promise<ProjectAssetSummary> {
  await authorizationService.ensureProjectWritableByUser(projectId, userId);
  const prepared = await writeImageAssetUpload(file);
  return assertExists(
    await assetRepository.replaceAsset(db, {
      projectId,
      assetId,
      nextAssetUrl: prepared.assetUrl,
      metadata: prepared.metadata,
      userId
    }),
    'Asset not found.'
  );
}

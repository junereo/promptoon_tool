import { execFile } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import { env } from '../../lib/env';
import { resolveFromApiRoot, resolveFromWorkspaceRoot } from '../../lib/workspace-paths';

const execFileAsync = promisify(execFile);

interface FfprobeStream {
  width?: number;
  height?: number;
}

interface FfprobeOutput {
  format?: {
    duration?: string;
  };
  streams?: FfprobeStream[];
}

export interface ProcessedMovingtoonVideo {
  videoUrl: string;
  thumbnailUrl: string | null;
  durationSec: number | null;
}

function buildPublicUrl(relativePath: string): string {
  return path.posix.join('/uploads', ...relativePath.split(path.sep));
}

function isWritablePathError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && ['EACCES', 'EPERM', 'EROFS'].includes(String(error.code));
}

async function getWritableOutputDirectory(relativeDirectory: string): Promise<string> {
  const directoryCandidates = [
    resolveFromWorkspaceRoot('.data/uploads', relativeDirectory),
    resolveFromApiRoot('.data/uploads', relativeDirectory)
  ];
  let lastError: unknown = null;

  for (const outputDirectory of directoryCandidates) {
    try {
      await mkdir(outputDirectory, { recursive: true });
      return outputDirectory;
    } catch (error) {
      lastError = error;
      if (!isWritablePathError(error)) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Unable to create movingtoon output directory.');
}

async function runCommand(command: string, args: string[]): Promise<void> {
  await execFileAsync(command, args, {
    maxBuffer: 1024 * 1024 * 10
  });
}

async function probeVideo(inputPath: string): Promise<{ durationSec: number | null }> {
  try {
    const { stdout } = await execFileAsync(env.movingtoon.ffprobePath, [
      '-v',
      'error',
      '-show_format',
      '-show_streams',
      '-of',
      'json',
      inputPath
    ]);
    const parsed = JSON.parse(stdout) as FfprobeOutput;
    const duration = Number(parsed.format?.duration);
    return {
      durationSec: Number.isFinite(duration) && duration > 0 ? Math.round(duration) : null
    };
  } catch {
    return {
      durationSec: null
    };
  }
}

export async function processMovingtoonVideo(inputPath: string, outputScope: string): Promise<ProcessedMovingtoonVideo> {
  const relativeDirectory = path.join(outputScope.slice(0, 4), outputScope.slice(4, 8), outputScope);
  const videoFileName = 'movingtoon.mp4';
  const thumbnailFileName = 'thumbnail.webp';
  const outputDirectory = await getWritableOutputDirectory(relativeDirectory);
  const videoPath = path.join(outputDirectory, videoFileName);
  const thumbnailPath = path.join(outputDirectory, thumbnailFileName);

  await runCommand(env.movingtoon.ffmpegPath, [
    '-y',
    '-i',
    inputPath,
    '-vf',
    'scale=trunc(iw/2)*2:trunc(ih/2)*2',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '23',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-movflags',
    '+faststart',
    videoPath
  ]);

  let thumbnailUrl: string | null = null;
  try {
    await runCommand(env.movingtoon.ffmpegPath, ['-y', '-ss', '00:00:01', '-i', inputPath, '-frames:v', '1', thumbnailPath]);
    thumbnailUrl = buildPublicUrl(path.join(relativeDirectory, thumbnailFileName));
  } catch {
    try {
      await runCommand(env.movingtoon.ffmpegPath, ['-y', '-ss', '00:00:00', '-i', inputPath, '-frames:v', '1', thumbnailPath]);
      thumbnailUrl = buildPublicUrl(path.join(relativeDirectory, thumbnailFileName));
    } catch {
      thumbnailUrl = null;
    }
  }

  const probed = await probeVideo(videoPath);

  return {
    videoUrl: buildPublicUrl(path.join(relativeDirectory, videoFileName)),
    thumbnailUrl,
    durationSec: probed.durationSec
  };
}

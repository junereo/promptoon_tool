import path from 'node:path';

export function getWorkspaceRoot(): string {
  return path.resolve(__dirname, '../../../..');
}

export function resolveFromWorkspaceRoot(...segments: string[]): string {
  return path.resolve(getWorkspaceRoot(), ...segments);
}

export function resolveFromApiRoot(...segments: string[]): string {
  return path.resolve(getWorkspaceRoot(), 'apps/api', ...segments);
}

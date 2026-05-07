export function formatChannelHandle(value: string | null | undefined): string {
  const normalized = (value ?? '').trim().replace(/^@+/, '');
  return normalized ? `@${normalized}` : '@promptoon';
}

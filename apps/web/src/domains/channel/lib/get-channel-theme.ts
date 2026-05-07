import type { ChannelProfile } from '../model/channel.types';
import type { ChannelTheme } from '../model/channel-theme.types';

export function getChannelTheme(profile: ChannelProfile): ChannelTheme {
  const accentColor = profile.coverImage?.dominantColor ?? '#f5b85b';

  return {
    accentColor,
    accentSoftColor: 'rgba(245, 184, 91, 0.18)',
    surfaceColor: 'rgba(255, 255, 255, 0.06)',
    surfaceElevatedColor: 'rgba(255, 255, 255, 0.09)',
    borderColor: 'rgba(255, 255, 255, 0.12)'
  };
}

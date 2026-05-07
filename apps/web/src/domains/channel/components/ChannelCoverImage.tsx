import type { ChannelTheme } from '../model/channel-theme.types';
import type { ChannelImageAsset } from '../model/channel.types';
import { getChannelCoverStyle } from '../lib/get-channel-cover-style';

interface ChannelCoverImageProps {
  coverImage: ChannelImageAsset | null;
  displayName: string;
  theme: ChannelTheme;
}

export function ChannelCoverImage({ coverImage, displayName, theme }: ChannelCoverImageProps) {
  if (!coverImage) {
    return (
      <div
        aria-label={`${displayName} channel cover fallback`}
        className="absolute inset-0 z-0"
        role="img"
        style={{
          background: `radial-gradient(circle at 28% 24%, ${theme.accentSoftColor}, transparent 34%), linear-gradient(135deg, #1b1b1c 0%, #211c18 46%, #050505 100%)`
        }}
      />
    );
  }

  return (
    <picture className="absolute inset-0 z-0 block">
      <source media="(min-width: 768px)" srcSet={coverImage.desktopUrl} />
      <img
        alt={`${displayName} channel cover`}
        className="h-full w-full object-cover"
        src={coverImage.mobileUrl}
        style={getChannelCoverStyle(coverImage)}
      />
    </picture>
  );
}

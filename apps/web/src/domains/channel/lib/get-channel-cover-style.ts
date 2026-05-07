import type { CSSProperties } from 'react';

import type { ChannelImageAsset } from '../model/channel.types';

export function getChannelCoverStyle(coverImage: ChannelImageAsset | null): CSSProperties {
  if (!coverImage) {
    return {};
  }

  return {
    objectPosition: `${coverImage.focalPointX}% ${coverImage.focalPointY}%`
  };
}

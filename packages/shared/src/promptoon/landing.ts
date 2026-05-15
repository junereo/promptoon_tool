import type { FeedItem } from './feed';

export type LandingTargetType = 'publish' | 'project';
export type LandingItemStatus = 'active' | 'disabled';

export interface LandingResponse {
  enabled: boolean;
  items: FeedItem[];
}

export interface AdminLandingItem {
  id: string;
  targetType: LandingTargetType;
  targetId: string;
  status: LandingItemStatus;
  sortOrder: number;
  title: string | null;
  subtitle: string | null;
  visibleItemCount: number;
  previewItems: FeedItem[];
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminLandingResponse {
  enabled: boolean;
  updatedBy: string | null;
  updatedAt: string | null;
  items: AdminLandingItem[];
}

export interface PatchAdminLandingConfigRequest {
  enabled: boolean;
}

export interface CreateAdminLandingItemRequest {
  targetType: LandingTargetType;
  targetId: string;
}

export interface PatchAdminLandingItemRequest {
  status: LandingItemStatus;
}

export interface UpdateAdminLandingItemOrderRequest {
  itemIds: string[];
}

import type { FeedItem } from '@promptoon/shared';
import { lazy, type ComponentType } from 'react';

import { preloadPromptoonViewerPage, preloadViewerForPublish } from '../features/viewer/lib/preload-viewer';

function lazyNamedPage<TModule extends Record<string, ComponentType>, TExport extends keyof TModule>(
  loader: () => Promise<TModule>,
  exportName: TExport
) {
  return lazy(async () => ({
    default: (await loader())[exportName]
  }));
}

export const preloadChannelHomePage = () => import('../domains/channel/pages/ChannelHomePage');
export const preloadChannelPage = () => import('../domains/channel/pages/ChannelPage');
export const preloadCommunityDiscussionPage = () => import('../domains/community/pages/CommunityDiscussionPage');
export const preloadConsumerHomePage = () => import('../domains/consumer/pages/ConsumerHomePage');
export const preloadConsumerExperimentalPage = () => import('../domains/consumer/pages/ConsumerExperimentalPage');
export const preloadConsumerLibraryPage = () => import('../domains/consumer/pages/ConsumerLibraryPage');
export const preloadConsumerMyPage = () => import('../domains/consumer/pages/ConsumerMyPage');
export const preloadLegalDocumentPage = () => import('../domains/consumer/pages/LegalDocumentPage');
export const preloadDiscoveryPage = () => import('../domains/feed/pages/FeedHomePage');
export const preloadMovingtoonShortViewerPage = () => import('../domains/feed/pages/MovingtoonShortViewerPage');
export const preloadLoginPage = () => import('../pages/LoginPage');
export const preloadRegisterPage = () => import('../pages/RegisterPage');
export const preloadStudioAssetLibraryPage = () => import('../domains/studio/pages/StudioAssetLibraryPage');
export const preloadStudioAnalyticsPage = () => import('../domains/studio/pages/StudioAnalyticsPage');
export const preloadStudioCommunityModerationPage = () => import('../domains/studio/pages/StudioCommunityModerationPage');
export const preloadStudioEpisodeEditorPage = () => import('../domains/studio/pages/StudioEpisodeEditorPage');
export const preloadStudioProjectDashboardPage = () => import('../domains/studio/pages/StudioProjectDashboardPage');
export const preloadStudioProjectDetailPage = () => import('../domains/studio/pages/StudioProjectDetailPage');
export const preloadStudioProjectMembersPage = () => import('../domains/studio/pages/StudioProjectMembersPage');
export const preloadStudioProjectSettingsPage = () => import('../domains/studio/pages/StudioProjectSettingsPage');
export const preloadStudioPublishHistoryPage = () => import('../domains/studio/pages/StudioPublishHistoryPage');
export const preloadStudioPublishPage = () => import('../domains/studio/pages/StudioPublishPage');
export const preloadStudioSeriesPage = () => import('../domains/studio/pages/StudioSeriesPage');

export const ChannelHomePage = lazyNamedPage(preloadChannelHomePage, 'ChannelHomePage');
export const ChannelPage = lazyNamedPage(preloadChannelPage, 'ChannelPage');
export const CommunityDiscussionPage = lazyNamedPage(preloadCommunityDiscussionPage, 'CommunityDiscussionPage');
export const ConsumerHomePage = lazyNamedPage(preloadConsumerHomePage, 'ConsumerHomePage');
export const ConsumerExperimentalPage = lazyNamedPage(preloadConsumerExperimentalPage, 'ConsumerExperimentalPage');
export const ConsumerLibraryPage = lazyNamedPage(preloadConsumerLibraryPage, 'ConsumerLibraryPage');
export const ConsumerMyPage = lazyNamedPage(preloadConsumerMyPage, 'ConsumerMyPage');
export const LegalDocumentPage = lazyNamedPage(preloadLegalDocumentPage, 'LegalDocumentPage');
export const FeedHomePage = lazyNamedPage(preloadDiscoveryPage, 'FeedHomePage');
export const MovingtoonShortViewerPage = lazyNamedPage(preloadMovingtoonShortViewerPage, 'MovingtoonShortViewerPage');
export const LoginPage = lazyNamedPage(preloadLoginPage, 'LoginPage');
export const RegisterPage = lazyNamedPage(preloadRegisterPage, 'RegisterPage');
export const StudioAssetLibraryPage = lazyNamedPage(preloadStudioAssetLibraryPage, 'StudioAssetLibraryPage');
export const StudioAnalyticsPage = lazyNamedPage(preloadStudioAnalyticsPage, 'StudioAnalyticsPage');
export const StudioCommunityModerationPage = lazyNamedPage(
  preloadStudioCommunityModerationPage,
  'StudioCommunityModerationPage'
);
export const StudioEpisodeEditorPage = lazyNamedPage(preloadStudioEpisodeEditorPage, 'StudioEpisodeEditorPage');
export const StudioProjectDashboardPage = lazyNamedPage(preloadStudioProjectDashboardPage, 'StudioProjectDashboardPage');
export const StudioProjectDetailPage = lazyNamedPage(preloadStudioProjectDetailPage, 'StudioProjectDetailPage');
export const StudioProjectMembersPage = lazyNamedPage(preloadStudioProjectMembersPage, 'StudioProjectMembersPage');
export const StudioProjectSettingsPage = lazyNamedPage(preloadStudioProjectSettingsPage, 'StudioProjectSettingsPage');
export const StudioPublishHistoryPage = lazyNamedPage(preloadStudioPublishHistoryPage, 'StudioPublishHistoryPage');
export const StudioPublishPage = lazyNamedPage(preloadStudioPublishPage, 'StudioPublishPage');
export const StudioSeriesPage = lazyNamedPage(preloadStudioSeriesPage, 'StudioSeriesPage');

export const PromptoonViewerPage = lazy(() =>
  preloadPromptoonViewerPage().then((module) => ({ default: module.PromptoonViewerPage }))
);

function getRoutePath(to: string): string {
  return to.split(/[?#]/, 1)[0] ?? to;
}

export function preloadAppRoute(to: string, options: { publishId?: string; itemType?: FeedItem['type'] } = {}): Promise<unknown> {
  const routePath = getRoutePath(to);

  if (routePath === '/') {
    return preloadConsumerHomePage();
  }

  if (routePath === '/discovery' || routePath === '/feed' || routePath === '/overview') {
    return preloadDiscoveryPage();
  }

  if (routePath === '/library') {
    return preloadConsumerLibraryPage();
  }

  if (routePath === '/experimental') {
    return preloadConsumerExperimentalPage();
  }

  if (routePath === '/my') {
    return preloadConsumerMyPage();
  }

  if (routePath === '/privacy' || routePath === '/terms') {
    return preloadLegalDocumentPage();
  }

  if (routePath.startsWith('/v/')) {
    return options.publishId ? preloadViewerForPublish(options.publishId) : preloadPromptoonViewerPage();
  }

  if (routePath.startsWith('/shorts/')) {
    return preloadMovingtoonShortViewerPage();
  }

  if (routePath.startsWith('/channel/')) {
    return preloadChannelPage();
  }

  if (routePath.startsWith('/c/')) {
    return preloadChannelHomePage();
  }

  if (routePath.startsWith('/community/publishes/')) {
    return preloadCommunityDiscussionPage();
  }

  if (routePath === '/login') {
    return preloadLoginPage();
  }

  if (routePath === '/register') {
    return preloadRegisterPage();
  }

  if (options.itemType === 'short_drama') {
    return preloadMovingtoonShortViewerPage();
  }

  return Promise.resolve();
}

export function preloadFeedItemRoute(item: FeedItem, href: string): Promise<unknown> {
  return preloadAppRoute(href, {
    itemType: item.type,
    publishId: item.publishId
  });
}

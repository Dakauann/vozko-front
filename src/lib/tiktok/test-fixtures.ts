import type { TiktokAccount, TiktokComment, TiktokVideo } from "@/lib/tiktok/types";

export function tiktokAccount(overrides: Partial<TiktokAccount> = {}): TiktokAccount {
  return {
    id: "acc-1",
    workspaceId: "ws-1",
    openId: "open-1",
    username: "loja",
    displayName: "Loja",
    hasAdvancedAccess: true,
    isBusinessAccount: true,
    status: "CONNECTED",
    capabilities: {
      canReadVideos: true,
      canReadComments: true,
      canManageComments: true,
      canReceiveMessages: true,
      canSendMessages: true,
      canManageInboxProfile: true,
    },
    grantedScopes: ["user.info.basic", "video.list"],
    webhooksHealthy: true,
    reconnectSoon: false,
    enableAgentResponses: false,
    enableWorkflow: false,
    enableAnalysis: false,
    enableAutoStaging: false,
    enableAutoMemory: false,
    automationDisclosure: "",
    createdAt: "2026-10-19T10:00:00Z",
    updatedAt: "2026-10-19T10:00:00Z",
    ...overrides,
  };
}

export function tiktokComment(overrides: Partial<TiktokComment> = {}): TiktokComment {
  return {
    commentId: "c-1",
    videoId: "v-1",
    kind: "comment",
    authorUsername: "cliente",
    authorDisplayName: "Cliente",
    text: "quanto custa?",
    visibility: "public",
    isOurs: false,
    likedByUs: false,
    likes: 3,
    replies: 0,
    commentedAt: "2026-10-19T12:00:00Z",
    canReply: true,
    canHide: true,
    canLike: true,
    ...overrides,
  };
}

export function tiktokVideo(overrides: Partial<TiktokVideo> = {}): TiktokVideo {
  return {
    itemId: "v-1",
    mediaType: "VIDEO",
    caption: "Lançamento",
    thumbnailUrl: "https://cdn.test/v-1.jpg",
    shareUrl: "https://www.tiktok.com/@loja/video/v-1",
    isAd: false,
    likes: 10,
    comments: 2,
    shares: 1,
    views: 100,
    postedAt: "2026-10-18T10:00:00Z",
    ...overrides,
  };
}

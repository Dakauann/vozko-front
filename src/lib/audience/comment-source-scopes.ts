import { listFacebookPagesAction, listFacebookPostsAction } from "@/app/actions/facebook";
import { listInstagramAccountsAction, listInstagramMediaAction } from "@/app/actions/instagram";
import { ANALYSABLE_COMMENT_SOURCES, type AnalysableCommentSource } from "@/lib/audience/types";
import { tiktokCommentSourceScope } from "@/lib/tiktok/sources";
import type { ResourceAction, ResourceType } from "@/lib/workspace/types";

export interface ScopeAccount {
  id: string;
  source: AnalysableCommentSource;
  label: string;
}

export interface ScopePost {
  id: string;
  text?: string;
  timestamp?: string;
}

interface SourceAccounts {
  accounts: Omit<ScopeAccount, "source">[];
  error?: string;
}

interface CommentSourceScope {
  accountsPage: string;
  readResource: ResourceType;
  loadAccounts: () => Promise<SourceAccounts>;
  loadPosts: (accountId: string) => Promise<ScopePost[]>;
}

const SCOPE_ACCOUNT_LIMIT = 50;
const SCOPE_POST_LIMIT = 50;

export const COMMENT_SOURCE_SCOPES: Record<AnalysableCommentSource, CommentSourceScope> = {
  instagram: {
    accountsPage: "/dashboard/instagram-accounts",
    readResource: "instagram_accounts",
    loadAccounts: async () => {
      const result = await listInstagramAccountsAction(1, SCOPE_ACCOUNT_LIMIT);
      return { accounts: result.accounts.map((a) => ({ id: a.id, label: `@${a.username}` })), error: result.error };
    },
    loadPosts: async (accountId) => {
      const result = await listInstagramMediaAction(accountId, undefined, SCOPE_POST_LIMIT);
      return result.page.items.map((m) => ({ id: m.id, text: m.caption, timestamp: m.timestamp }));
    },
  },
  facebook: {
    accountsPage: "/dashboard/facebook-pages",
    readResource: "facebook_pages",
    loadAccounts: async () => {
      const result = await listFacebookPagesAction(1, SCOPE_ACCOUNT_LIMIT);
      return {
        accounts: result.pages.map((p) => ({ id: p.id, label: p.name })),
        error: "error" in result ? result.error : undefined,
      };
    },
    loadPosts: async (pageId) => {
      const result = await listFacebookPostsAction(pageId, "published", undefined, SCOPE_POST_LIMIT);
      return result.list.items.map((p) => ({ id: p.id, text: p.message || p.story, timestamp: p.createdTime }));
    },
  },
  tiktok: tiktokCommentSourceScope,
};

export function readableCommentSources(can: (resource: ResourceType, action: ResourceAction) => boolean): AnalysableCommentSource[] {
  return ANALYSABLE_COMMENT_SOURCES.filter((source) => can(COMMENT_SOURCE_SCOPES[source].readResource, "read"));
}

export async function loadScopeAccounts(sources: readonly AnalysableCommentSource[]): Promise<{ accounts: ScopeAccount[]; error?: string }> {
  const loaded = await Promise.all(sources.map(async (source) => ({ source, result: await COMMENT_SOURCE_SCOPES[source].loadAccounts() })));
  return {
    accounts: loaded.flatMap(({ source, result }) => result.accounts.map((a) => ({ ...a, source }))),
    error: loaded.find(({ result }) => result.error)?.result.error,
  };
}

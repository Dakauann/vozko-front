export const screenPaths = {
  live_chat: "/dashboard/live-chat",
  funnels: "/dashboard/funnels",
  stage_groups: "/dashboard/stage-groups",
  sales: "/dashboard/sales",
  attendance: "/dashboard/attendance",
  reports: "/dashboard/reports",
  audience: "/dashboard/audience",
  analysis_alerts: "/dashboard/analysis-alerts",
  ai_chat: "/dashboard/ai-chat",
  agents: "/dashboard/agents",
  agents_archived: "/dashboard/agents/archived",
  agent_new: "/dashboard/agents/new",
  agent_detail: "/dashboard/agents/[agentId]",
  agent_edit: "/dashboard/agents/[agentId]/edit",
  agent_simulator: "/dashboard/agents/[agentId]/simulator",
  mcp_servers: "/dashboard/agents/mcp",
  knowledge_bases: "/dashboard/knowledge-bases",
  knowledge_base_new: "/dashboard/knowledge-bases/new",
  knowledge_base_detail: "/dashboard/knowledge-bases/[id]",
  knowledge_base_edit: "/dashboard/knowledge-bases/[id]/edit",
  workflows: "/dashboard/workflows",
  workflow_new: "/dashboard/workflows/new",
  workflow_detail: "/dashboard/workflows/[id]",
  whatsapp_campaigns: "/dashboard/whatsapp-campaigns",
  whatsapp_campaigns_archived: "/dashboard/whatsapp-campaigns/archived",
  whatsapp_campaign_new: "/dashboard/whatsapp-campaigns/new",
  organic_campaigns: "/dashboard/whatsapp-campaigns/organic",
  organic_campaign_new: "/dashboard/whatsapp-campaigns/new-organic",
  whatsapp_campaign_detail: "/dashboard/whatsapp-campaigns/[campaignId]",
  whatsapp_campaign_edit: "/dashboard/whatsapp-campaigns/[campaignId]/edit",
  whatsapp_campaign_crm: "/dashboard/whatsapp-campaigns/[campaignId]/crm",
  whatsapp_templates: "/dashboard/whatsapp-templates",
  whatsapp_template_new: "/dashboard/whatsapp-templates/new",
  whatsapp_template_detail: "/dashboard/whatsapp-templates/[templateId]",
  whatsapp_template_send: "/dashboard/whatsapp-templates/[templateId]/send",
  business_phones: "/dashboard/whatsapp-business-phones",
  business_phone_connect: "/dashboard/whatsapp-business-phones/connect",
  business_phone_guide: "/dashboard/whatsapp-business-phones/register",
  business_phone_detail: "/dashboard/whatsapp-business-phones/[phoneId]",
  unofficial_numbers: "/dashboard/unofficial-whatsapp",
  unofficial_number_connect: "/dashboard/unofficial-whatsapp/connect",
  unofficial_number_detail: "/dashboard/unofficial-whatsapp/[instanceId]",
  unofficial_campaigns: "/dashboard/unofficial-whatsapp-campaigns",
  unofficial_campaigns_archived: "/dashboard/unofficial-whatsapp-campaigns/archived",
  unofficial_campaign_new: "/dashboard/unofficial-whatsapp-campaigns/new",
  unofficial_campaign_detail: "/dashboard/unofficial-whatsapp-campaigns/[campaignId]",
  unofficial_campaign_edit: "/dashboard/unofficial-whatsapp-campaigns/[campaignId]/edit",
  instagram_accounts: "/dashboard/instagram-accounts",
  instagram_connect: "/dashboard/instagram-accounts/connect",
  instagram_account: "/dashboard/instagram-accounts/[accountId]",
  facebook_pages: "/dashboard/facebook-pages",
  facebook_connect: "/dashboard/facebook-pages/connect",
  telegram_accounts: "/dashboard/telegram-accounts",
  telegram_connect: "/dashboard/telegram-accounts/connect",
  sip_trunks: "/dashboard/sip-trunks",
  call_queues: "/dashboard/call-queues",
  call_history: "/dashboard/call-history",
  telegram_account: "/dashboard/telegram-accounts/[accountId]",
  message_shortcuts: "/dashboard/message-shortcuts",
  leads: "/dashboard/leads",
  lead_detail: "/dashboard/leads/[leadId]",
  links: "/dashboard/links",
  link_new: "/dashboard/links/new",
  link_detail: "/dashboard/links/[id]",
  link_edit: "/dashboard/links/[id]/edit",
  calendar: "/dashboard/calendar",
  calendar_settings: "/dashboard/calendar/settings",
  integrations: "/dashboard/integrations",
  issues: "/dashboard/issues",
  issue_new: "/dashboard/issues/new",
  issue_detail: "/dashboard/issues/[issueId]",
  plans: "/dashboard/plans",
  addons: "/dashboard/addons",
  balance: "/dashboard/balance",
  invoices: "/dashboard/invoices",
  workspace: "/dashboard/workspace",
  workspace_invites: "/dashboard/workspace/invites",
} as const;

export type ScreenKey = keyof typeof screenPaths;

export type RouteRule =
  | { kind: "screen"; screen: ScreenKey }
  | { kind: "personal" }
  | { kind: "platform_admin" }
  | { kind: "workspace_manager" };

interface RouteEntry {
  pattern: string;
  rule: RouteRule;
  exact: boolean;
}

const personalRoutes = ["/dashboard", "/dashboard/profile", "/dashboard/settings/general"];

const platformAdminRoutes = [
  "/dashboard/admin",
  "/dashboard/users",
  "/dashboard/workspaces",
  "/dashboard/pricing",
  "/dashboard/plans/manage",
  "/dashboard/addons/manage",
  "/dashboard/whatsapp-templates/manage",
  "/dashboard/whatsapp-business-phones/manage",
  "/dashboard/issues/manage",
];

const workspaceManagerRoutes = ["/dashboard/affiliate"];

const routeTable: RouteEntry[] = [
  ...Object.entries(screenPaths).map(([screen, pattern]) => ({
    pattern,
    rule: { kind: "screen", screen: screen as ScreenKey } as RouteRule,
    exact: false,
  })),
  ...personalRoutes.map((pattern) => ({ pattern, rule: { kind: "personal" } as RouteRule, exact: true })),
  ...platformAdminRoutes.map((pattern) => ({ pattern, rule: { kind: "platform_admin" } as RouteRule, exact: false })),
  ...workspaceManagerRoutes.map((pattern) => ({ pattern, rule: { kind: "workspace_manager" } as RouteRule, exact: false })),
];

function segments(path: string): string[] {
  return path.split(/[?#]/)[0].split("/").filter(Boolean);
}

function isParam(segment: string): boolean {
  return segment.startsWith("[") && segment.endsWith("]");
}

function matchScore(entry: RouteEntry, path: string[]): number | null {
  const pattern = segments(entry.pattern);
  if (pattern.length > path.length || (entry.exact && pattern.length !== path.length)) return null;
  let statics = 0;
  for (let i = 0; i < pattern.length; i++) {
    if (isParam(pattern[i])) continue;
    if (pattern[i] !== path[i]) return null;
    statics++;
  }
  return pattern.length * 100 + statics;
}

export function ruleForPath(pathname: string): RouteRule | null {
  const path = segments(pathname);
  let best: { score: number; rule: RouteRule } | null = null;
  for (const entry of routeTable) {
    const score = matchScore(entry, path);
    if (score !== null && (!best || score > best.score)) best = { score, rule: entry.rule };
  }
  return best?.rule ?? null;
}

const upcomingScreens: ReadonlySet<ScreenKey> = new Set<ScreenKey>();

export function isUpcomingScreen(screen: ScreenKey): boolean {
  return upcomingScreens.has(screen);
}

export function isUpcomingPath(pathname: string): boolean {
  const rule = ruleForPath(pathname);
  return rule?.kind === "screen" && isUpcomingScreen(rule.screen);
}

export function isScreenKey(value: string): value is ScreenKey {
  return Object.prototype.hasOwnProperty.call(screenPaths, value);
}

const safeParam = /^[A-Za-z0-9_-]{1,100}$/;

export function pathForScreen(screen: ScreenKey, params: Record<string, string> = {}): string | null {
  const parts = segments(screenPaths[screen]);
  const used = new Set<string>();
  const resolved: string[] = [];
  for (const part of parts) {
    if (!isParam(part)) {
      resolved.push(part);
      continue;
    }
    const name = part.slice(1, -1);
    const value = params[name];
    if (!value || !safeParam.test(value)) return null;
    used.add(name);
    resolved.push(value);
  }
  if (Object.keys(params).some((name) => !used.has(name))) return null;
  return "/" + resolved.join("/");
}

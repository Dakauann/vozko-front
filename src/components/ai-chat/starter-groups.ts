import type { ResourceAction, ResourceType } from "@/lib/workspace/types";

type Can = (resource: ResourceType, action: ResourceAction) => boolean;

interface StarterDefinition {
  key: string;
  resource: ResourceType;
  action?: ResourceAction;
}

interface GroupDefinition {
  key: StarterGroupKey;
  paths: string[];
  starters: StarterDefinition[];
}

export type StarterGroupKey =
  | "start"
  | "attendance"
  | "conversations"
  | "funnels"
  | "campaigns"
  | "customers"
  | "knowledge"
  | "schedule"
  | "team"
  | "agents"
  | "ads";

export interface StarterGroup {
  key: StarterGroupKey;
  items: string[];
}

const GROUPS: GroupDefinition[] = [
  {
    key: "start",
    paths: [],
    starters: [
      { key: "capabilities", resource: "ai_chat" },
      { key: "setup", resource: "ai_chat" },
      { key: "connect", resource: "business_phones", action: "create" },
      { key: "balance", resource: "balance" },
    ],
  },
  {
    key: "attendance",
    paths: ["/dashboard/attendance"],
    starters: [
      { key: "summary", resource: "attendance" },
      { key: "team", resource: "attendance" },
      { key: "trend", resource: "attendance" },
      { key: "backlog", resource: "attendance" },
      { key: "why", resource: "attendance" },
    ],
  },
  {
    key: "conversations",
    paths: ["/dashboard/live-chat", "/dashboard/leads"],
    starters: [
      { key: "find", resource: "conversations" },
      { key: "contact", resource: "leads" },
      { key: "followup", resource: "conversations", action: "send" },
      { key: "label", resource: "labels", action: "assign" },
    ],
  },
  {
    key: "funnels",
    paths: ["/dashboard/funnels", "/dashboard/sales", "/dashboard/stage-groups"],
    starters: [
      { key: "overview", resource: "stages" },
      { key: "deals", resource: "conversations" },
      { key: "createDeal", resource: "conversations", action: "create" },
      { key: "createStage", resource: "stages", action: "create" },
    ],
  },
  {
    key: "campaigns",
    paths: ["/dashboard/whatsapp-campaigns", "/dashboard/unofficial-whatsapp-campaigns", "/dashboard/whatsapp-templates"],
    starters: [
      { key: "results", resource: "whatsapp_campaigns" },
      { key: "failures", resource: "whatsapp_campaigns" },
      { key: "best", resource: "whatsapp_campaigns" },
      { key: "templates", resource: "whatsapp_templates" },
      { key: "createTemplate", resource: "whatsapp_templates", action: "create" },
      { key: "createCampaign", resource: "whatsapp_campaigns", action: "create" },
      { key: "createQrCampaign", resource: "unofficial_whatsapp_campaigns", action: "create" },
    ],
  },
  {
    key: "customers",
    paths: ["/dashboard/audience"],
    starters: [
      { key: "asked", resource: "audience" },
      { key: "objections", resource: "audience" },
      { key: "hot", resource: "audience" },
    ],
  },
  {
    key: "knowledge",
    paths: ["/dashboard/knowledge-bases"],
    starters: [
      { key: "ask", resource: "knowledge_bases" },
      { key: "add", resource: "knowledge_bases", action: "create" },
    ],
  },
  {
    key: "schedule",
    paths: ["/dashboard/calendar", "/dashboard/workflows"],
    starters: [
      { key: "week", resource: "calendar" },
      { key: "meeting", resource: "calendar", action: "create" },
      { key: "workflows", resource: "workflows" },
    ],
  },
  {
    key: "team",
    paths: ["/dashboard/workspace", "/dashboard/users"],
    starters: [
      { key: "access", resource: "ai_chat" },
      { key: "explain", resource: "ai_chat" },
      { key: "members", resource: "members" },
      { key: "invite", resource: "members", action: "create" },
      { key: "permissions", resource: "members" },
      { key: "grant", resource: "members", action: "update" },
      { key: "department", resource: "departments", action: "update" },
      { key: "roles", resource: "roles" },
    ],
  },
  {
    key: "agents",
    paths: ["/dashboard/agents"],
    starters: [
      { key: "list", resource: "agents" },
      { key: "create", resource: "agents", action: "create" },
      { key: "tools", resource: "agents" },
      { key: "models", resource: "agents" },
    ],
  },
  {
    key: "ads",
    paths: ["/dashboard/advertising"],
    starters: [
      { key: "results", resource: "ads" },
      { key: "best", resource: "ads" },
      { key: "create", resource: "ads", action: "create" },
    ],
  },
];

function onPage(pathname: string, paths: string[]): boolean {
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function starterGroupsFor(can: Can, pathname: string): { groups: StarterGroup[]; open: StarterGroupKey | null } {
  const groups: StarterGroup[] = [];
  let open: StarterGroupKey | null = null;
  for (const group of GROUPS) {
    const items = group.starters.filter((s) => can(s.resource, s.action ?? "read")).map((s) => s.key);
    if (items.length === 0) continue;
    groups.push({ key: group.key, items });
    if (!open && onPage(pathname, group.paths)) open = group.key;
  }
  return { groups, open: open ?? groups[0]?.key ?? null };
}

import type { ResourceAction, ResourceType } from "@/lib/workspace/types";

type Can = (resource: ResourceType, action: ResourceAction) => boolean;

interface StarterDefinition {
  key: string;
  action?: ResourceAction;
}

interface GroupDefinition {
  key: StarterGroupKey;
  resource: ResourceType;
  paths: string[];
  starters: StarterDefinition[];
}

export type StarterGroupKey = "attendance" | "campaigns" | "customers" | "agents";

export interface StarterGroup {
  key: StarterGroupKey;
  items: string[];
}

const GROUPS: GroupDefinition[] = [
  {
    key: "attendance",
    resource: "attendance",
    paths: ["/dashboard/attendance"],
    starters: [{ key: "summary" }, { key: "team" }, { key: "trend" }, { key: "backlog" }, { key: "why" }],
  },
  {
    key: "campaigns",
    resource: "whatsapp_campaigns",
    paths: ["/dashboard/whatsapp-campaigns", "/dashboard/unofficial-whatsapp-campaigns"],
    starters: [{ key: "results" }, { key: "failures" }, { key: "best" }],
  },
  {
    key: "customers",
    resource: "audience",
    paths: ["/dashboard/audience"],
    starters: [{ key: "asked" }, { key: "objections" }, { key: "hot" }],
  },
  {
    key: "agents",
    resource: "agents",
    paths: ["/dashboard/agents"],
    starters: [{ key: "list" }, { key: "create", action: "create" }, { key: "tools" }, { key: "models" }],
  },
];

function onPage(pathname: string, paths: string[]): boolean {
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function starterGroupsFor(can: Can, pathname: string): { groups: StarterGroup[]; open: StarterGroupKey | null } {
  const groups: StarterGroup[] = [];
  let open: StarterGroupKey | null = null;
  for (const group of GROUPS) {
    if (!can(group.resource, "read")) continue;
    const items = group.starters.filter((s) => !s.action || can(group.resource, s.action)).map((s) => s.key);
    if (items.length === 0) continue;
    groups.push({ key: group.key, items });
    if (!open && onPage(pathname, group.paths)) open = group.key;
  }
  return { groups, open: open ?? groups[0]?.key ?? null };
}

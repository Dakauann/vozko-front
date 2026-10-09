import type { Feature, PermissionEntry } from "@/lib/workspace/types";

function need(entry: string): PermissionEntry {
  const [resource, action] = entry.split(":");
  return { resource, action } as PermissionEntry;
}

function capability(key: string, requires: string[]) {
  return { key, description: "", requires: requires.map(need), managersOnly: false, screens: [] };
}

export const LEAD_CATALOG: Feature[] = [
  {
    key: "leads",
    name: "Leads",
    location: "",
    description: "",
    scopes: [],
    capabilities: [
      capability("leads.bulk_edit", ["leads:read", "leads:update", "leads:bulk_update"]),
      capability("leads.assign", ["leads:read", "leads:assign"]),
      capability("leads.block", ["leads:read", "leads:block"]),
      capability("leads.export", ["leads:read", "leads:export", "reports:create", "reports:read"]),
      capability("leads.meta_audience", ["leads:read", "ads:create"]),
      capability("leads.read_addresses", ["leads:read", "leads:read_addresses"]),
      capability("leads.read_sensitive", ["leads:read", "leads:read_sensitive"]),
      capability("leads.send_template", [
        "leads:read",
        "whatsapp_campaigns:create",
        "whatsapp_campaigns:start",
        "whatsapp_templates:send",
        "whatsapp_templates:read",
        "business_phones:read",
        "conversations:read",
      ]),
      capability("leads.send_unofficial", [
        "leads:read",
        "unofficial_whatsapp_campaigns:create",
        "unofficial_whatsapp_campaigns:start",
        "unofficial_whatsapp_instances:read",
      ]),
    ],
  },
  {
    key: "call_lists",
    name: "Listas de ligação",
    location: "",
    description: "",
    scopes: [],
    capabilities: [capability("call_lists.manage", ["call_lists:read", "call_lists:manage", "leads:read"])],
  },
];

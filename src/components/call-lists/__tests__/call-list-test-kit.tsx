import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";

import pt from "@/i18n/messages/pt.json";
import type { CallList, CallListItem, CallListNext } from "@/lib/call-lists/types";
import type { Feature, PermissionEntry } from "@/lib/workspace/types";

function need(entry: string): PermissionEntry {
  const [resource, action] = entry.split(":");
  return { resource, action } as PermissionEntry;
}

function capability(key: string, requires: string[], screens: string[] = []) {
  return { key, description: "", requires: requires.map(need), managersOnly: false, screens };
}

export const CALL_LIST_CATALOG: Feature[] = [
  {
    key: "call_lists",
    name: "Listas de ligação",
    location: "",
    description: "",
    scopes: [],
    capabilities: [
      capability("call_lists.view", ["call_lists:read"], ["call_lists", "call_list_detail"]),
      capability("call_lists.work", ["call_lists:read", "sip_trunks:read", "sip_trunks:call", "call_session:use"]),
      capability("call_lists.manage", ["call_lists:read", "call_lists:manage", "leads:read"]),
    ],
  },
] as unknown as Feature[];

export const WORKER = ["call_lists:read", "sip_trunks:read", "sip_trunks:call", "call_session:use", "members:read"];
export const MANAGER = [...WORKER, "call_lists:manage", "leads:read"];

export function workspaceFor(granted: ReadonlySet<string>) {
  const permissionsMap: Record<string, Set<string>> = {};
  for (const entry of granted) {
    const [resource, action] = entry.split(":");
    (permissionsMap[resource] ??= new Set()).add(action);
  }
  return {
    currentWorkspace: { id: "ws-1" },
    can: (resource: string, action: string) => granted.has(`${resource}:${action}`),
    featureCatalog: { status: "ready", features: CALL_LIST_CATALOG },
    permissionCatalog: [],
    permissionsLoading: false,
    permissionsMap,
    privileged: false,
    systemAdmin: false,
  };
}

export function aList(overrides: Partial<CallList> = {}): CallList {
  return {
    id: "list-1",
    name: "Rematrícula Jardim Silveira",
    status: "active",
    createdBy: "u-boss",
    assigneeIds: ["u-me", "u-rafael"],
    phone: { source: "identity" },
    selected: 1300,
    itemCount: 1204,
    closedCount: 392,
    openCount: 812,
    calledCount: 341,
    callbackCount: 26,
    acceptsOutcomes: true,
    statusMoves: ["paused", "archived"],
    skipped: { blocked: 60, no_number: 36 },
    createdAt: "2026-10-07T12:00:00Z",
    updatedAt: "2026-10-08T12:00:00Z",
    ...overrides,
  };
}

export function anItem(overrides: Partial<CallListItem> = {}): CallListItem {
  return {
    id: "item-1",
    listId: "list-1",
    leadId: "lead-1",
    leadName: "Maria Aparecida Souza",
    phone: "5511900010142",
    position: 1,
    state: "reserved",
    reservedBy: "u-me",
    reservedUntil: new Date(Date.now() + 10 * 60_000).toISOString(),
    closable: false,
    createdAt: "2026-10-07T12:00:00Z",
    updatedAt: "2026-10-08T12:00:00Z",
    ...overrides,
  };
}

export function aNext(overrides: Partial<CallListNext> = {}): CallListNext {
  return {
    list: aList(),
    item: anItem(),
    lead: { id: "lead-1", name: "Maria Aparecida Souza", district: "Jardim Silveira", city: "Barueri", familyCount: 2 },
    lastInteraction: { entryId: "e-1", entryType: "whatsapp", at: "2026-10-08T14:32:00Z" },
    trunks: [{ id: "t-1", name: "Linha Barueri 1" }],
    refused: 0,
    more: false,
    ...overrides,
  };
}

export const MEMBERS = {
  members: [
    { userId: "u-me", username: "Clara Mendes", email: "clara@x.com" },
    { userId: "u-rafael", username: "Rafael Torres", email: "rafael@x.com" },
    { userId: "u-boss", username: "Diretora", email: "boss@x.com" },
  ],
  page: 1,
  pageSize: 200,
  totalPages: 1,
  totalItems: 3,
};

export const OUTCOME_CONFIG = {
  config: {
    outcomeCapture: {
      enabled: true,
      outcomes: [
        { code: "interessada", label: "Interessada", isDurable: true, position: 1 },
        { code: "sem_interesse", label: "Sem interesse", isDurable: true, position: 2 },
      ],
    },
  },
};

export function renderWithProviders(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrap = (node: ReactNode) => (
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={pt} timeZone="America/Sao_Paulo">
        {node}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
  const view = render(wrap(ui));
  return { ...view, rerender: (node: ReactNode) => view.rerender(wrap(node)) };
}

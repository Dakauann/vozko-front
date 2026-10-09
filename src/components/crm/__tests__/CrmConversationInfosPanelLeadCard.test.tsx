import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { toast } from "sonner";

import ptMessages from "@/i18n/messages/pt.json";
import type { CustomFieldDefinition } from "@/lib/crm/custom-fields";
import type { ActiveConversation, InboxEntry } from "@/lib/conversations/types";
import type { LeadCard } from "@/lib/leads/types";

const leadActions = vi.hoisted(() => ({
  blockLeadAction: vi.fn(),
  renameLeadAction: vi.fn(),
  getEntryLeadCardAction: vi.fn(),
  setLeadDistrictAction: vi.fn(),
  setLeadOwnerAction: vi.fn(),
  getLeadByIdAction: vi.fn(),
  optOutLeadAction: vi.fn(),
}));
const fieldDefinitions = vi.hoisted(() => ({ value: [] as CustomFieldDefinition[] }));
const grants = vi.hoisted(() => ({ value: new Set<string>() }));

vi.mock("@/app/actions/leads", () => leadActions);
vi.mock("@/app/actions/opportunities", () => ({
  listOpportunitiesForEntryAction: () => Promise.resolve({ opportunities: [], error: null }),
}));
vi.mock("@/app/actions/custom-fields", () => ({
  listCustomFieldsAction: () => Promise.resolve({ fields: fieldDefinitions.value, error: null }),
}));
vi.mock("@/app/actions/workspace", () => ({
  listAssignableMembersAction: () =>
    Promise.resolve({ members: [{ userId: "u-1", username: "Clara Mendes" }, { userId: "u-2", username: "Rafael Torres" }], page: 1, pageSize: 2, totalPages: 1, totalItems: 2 }),
}));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({
    can: (resource: string, action: string) => grants.value.has(`${resource}:${action}`),
    currentWorkspace: { id: "ws-1" },
  }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import CrmConversationInfosPanel from "../CrmConversationInfosPanel";

const classification: CustomFieldDefinition = {
  id: "f-1",
  workspaceId: "ws-1",
  objectType: "lead",
  key: "interesse",
  label: "Interesse",
  type: "select",
  options: ["Matriculado"],
  optionTones: { Matriculado: "chart-2" },
  required: false,
  sensitive: true,
  legalBasis: "consentimento",
  role: "classification",
  position: 0,
  createdAt: "",
  updatedAt: "",
};

const conversation = {
  entry_id: "e-1",
  entry_type: "instagram",
  lead_id: "lead-1",
  lead_version: 3,
  lead_name: "Maria",
  lead_number: "5511900010142",
  messages: [],
  has_more: false,
  unread_count: 0,
  window_open: true,
  window_expires_at: null,
} as ActiveConversation;

const inboxEntry = {
  entry_id: "e-1",
  entry_type: "instagram",
  lead_id: "lead-1",
  lead_version: 3,
  lead_name: "Maria",
  lead_number: "5511900010142",
  blocked: false,
  unread_count: 0,
  last_message_at: "2026-01-01T00:00:00Z",
  window_open: true,
} as InboxEntry;

function card(overrides: Partial<LeadCard> = {}): LeadCard {
  return {
    leadId: "lead-1",
    version: 3,
    name: "Maria",
    blocked: false,
    owner: "u-1",
    area: { district: "Jardim Silveira", city: "Barueri", state: "SP", cityCode: "3505708" },
    customFields: { interesse: "Matriculado" },
    relativesCount: 2,
    referredCount: 0,
    ...overrides,
  };
}

function renderPanel(entry: InboxEntry = inboxEntry) {
  const onLeadPatched = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = (current: InboxEntry) => (
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <CrmConversationInfosPanel
          open
          onClose={() => {}}
          conversation={conversation}
          inboxEntry={current}
          canBlock={false}
          canManageMemories={false}
          canRenameLead={false}
          onLeadPatched={onLeadPatched}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
  const utils = render(view(entry));
  return { onLeadPatched, rerender: (next: InboxEntry) => utils.rerender(view(next)) };
}

const t = ptMessages.crmContactPanel.lead;

beforeEach(() => {
  vi.clearAllMocks();
  grants.value = new Set(["conversations:read", "members:read"]);
  fieldDefinitions.value = [classification];
  leadActions.getEntryLeadCardAction.mockResolvedValue({ card: card(), error: null });
});

describe("inbox contact panel lead card", () => {
  it("reads the card through the conversation, never through the lead record", async () => {
    renderPanel();
    expect(await screen.findByText("Jardim Silveira · Barueri/SP")).toBeInTheDocument();
    expect(leadActions.getEntryLeadCardAction).toHaveBeenCalledTimes(1);
    expect(leadActions.getEntryLeadCardAction.mock.calls[0].slice(0, 2)).toEqual(["e-1", "instagram"]);
    expect(leadActions.getLeadByIdAction).not.toHaveBeenCalled();
    expect(await screen.findByText("Clara Mendes")).toBeInTheDocument();
    expect(screen.getByText("2 familiares")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: new RegExp(t.openRecord) })).toBeNull();
  });

  it("shows the classification only when the card carries it and the server lets this viewer read it", async () => {
    fieldDefinitions.value = [{ ...classification, readable: true }];
    renderPanel();
    expect(await screen.findByText("Matriculado")).toBeInTheDocument();
  });

  it("leaves out a classification the server marked unreadable", async () => {
    fieldDefinitions.value = [{ ...classification, readable: false }];
    renderPanel();
    await screen.findByText("Jardim Silveira · Barueri/SP");
    expect(screen.queryByText("Matriculado")).toBeNull();
  });

  it("leaves out a sensitive classification the server did not send", async () => {
    leadActions.getEntryLeadCardAction.mockResolvedValue({ card: card({ customFields: {} }), error: null });
    renderPanel();
    await screen.findByText("Jardim Silveira · Barueri/SP");
    expect(screen.queryByText("Interesse")).toBeNull();
  });

  it("links to the full record and the family for holders of leads:read", async () => {
    grants.value.add("leads:read");
    renderPanel();
    const link = await screen.findByRole("link", { name: new RegExp(t.openRecord) });
    expect(link).toHaveAttribute("href", "/dashboard/leads/lead-1");
    expect(screen.getByRole("link", { name: "2 familiares" })).toHaveAttribute("href", "/dashboard/leads/lead-1?tab=family");
  });

  it("edits the bairro through the district command and patches the version", async () => {
    grants.value.add("leads:update");
    leadActions.setLeadDistrictAction.mockResolvedValue({ lead: { id: "lead-1", version: 4 }, error: null });
    const { onLeadPatched } = renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: t.editArea }));
    const form = screen.getByRole("form", { name: t.editArea });
    fireEvent.change(within(form).getByLabelText(t.district), { target: { value: "Centro" } });
    fireEvent.click(within(form).getByRole("button", { name: t.save }));

    await waitFor(() =>
      expect(leadActions.setLeadDistrictAction).toHaveBeenCalledWith("lead-1", {
        district: "Centro",
        city: "Barueri",
        state: "SP",
        cityCode: "3505708",
      }),
    );
    await waitFor(() => expect(onLeadPatched).toHaveBeenCalledWith("lead-1", { lead_version: 4 }));
    expect(toast.success).toHaveBeenCalledWith(t.areaSaved);
  });

  it("records from the conversation that the lead does not want messages, with who decided", async () => {
    grants.value.add("leads:update");
    leadActions.optOutLeadAction.mockResolvedValue({ lead: { id: "lead-1", version: 5, optedOutAt: "2026-10-08T12:00:00Z" }, error: null });
    const { onLeadPatched } = renderPanel();
    const optOut = ptMessages.leadDetail.optOut;

    fireEvent.click(await screen.findByRole("button", { name: ptMessages.leadDetail.actions.optOut }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByRole("button", { name: optOut.confirm })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("radio", { name: optOut.sources.lead_request }));
    fireEvent.click(within(dialog).getByRole("button", { name: optOut.confirm }));

    await waitFor(() => expect(leadActions.optOutLeadAction).toHaveBeenCalledWith("lead-1", "lead_request"));
    await waitFor(() => expect(onLeadPatched).toHaveBeenCalledWith("lead-1", { lead_version: 5 }));
    expect(toast.success).toHaveBeenCalledWith(optOut.done);
    expect(await screen.findByText(t.optedOut)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: ptMessages.leadDetail.actions.optOut })).toBeNull();
  });

  it("shows a lead who already opted out as opted out, with who decided, and never offers it again", async () => {
    grants.value.add("leads:update");
    leadActions.getEntryLeadCardAction.mockResolvedValue({ card: card({ optedOutAt: "2026-10-08T12:00:00Z", optOutSource: "lead_request" }), error: null });
    renderPanel();
    expect(await screen.findByText(t.optedOut)).toBeInTheDocument();
    expect(screen.getByText(/a pedido do lead/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: ptMessages.leadDetail.actions.optOut })).toBeNull();
  });

  it("tells a member who cannot change the lead that it opted out", async () => {
    leadActions.getEntryLeadCardAction.mockResolvedValue({ card: card({ optedOutAt: "2026-10-08T12:00:00Z", optOutSource: "operator" }), error: null });
    renderPanel();
    expect(await screen.findByText(t.optedOut)).toBeInTheDocument();
    expect(screen.getByText(/por decisão da equipe/)).toBeInTheDocument();
  });

  it("names the owner the server sent, even one missing from the member list", async () => {
    leadActions.getEntryLeadCardAction.mockResolvedValue({ card: card({ owner: "u-9", ownerName: "Marina Costa" }), error: null });
    renderPanel();
    expect(await screen.findByText("Marina Costa")).toBeInTheDocument();
  });

  it("offers no opt-out to a member who cannot change the lead", async () => {
    renderPanel();
    await screen.findByText("Jardim Silveira · Barueri/SP");
    expect(screen.queryByRole("button", { name: ptMessages.leadDetail.actions.optOut })).toBeNull();
  });

  it("drops the city code when the city changes", async () => {
    grants.value.add("leads:update");
    leadActions.setLeadDistrictAction.mockResolvedValue({ lead: { id: "lead-1", version: 4 }, error: null });
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: t.editArea }));
    const form = screen.getByRole("form", { name: t.editArea });
    fireEvent.change(within(form).getByLabelText(t.city), { target: { value: "Osasco" } });
    fireEvent.click(within(form).getByRole("button", { name: t.save }));

    await waitFor(() =>
      expect(leadActions.setLeadDistrictAction).toHaveBeenCalledWith("lead-1", { district: "Jardim Silveira", city: "Osasco", state: "SP" }),
    );
  });

  it("explains a refused bairro by its code and keeps the form open", async () => {
    grants.value.add("leads:update");
    leadActions.setLeadDistrictAction.mockResolvedValue({ lead: null, error: { status: 400, code: "lead_address_invalid", message: "pq" } });
    const { onLeadPatched } = renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: t.editArea }));
    fireEvent.click(within(screen.getByRole("form", { name: t.editArea })).getByRole("button", { name: t.save }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(t.areaFailed, { description: ptMessages.leads.errors.lead_address_invalid }),
    );
    expect(onLeadPatched).not.toHaveBeenCalled();
    expect(screen.getByRole("form", { name: t.editArea })).toBeInTheDocument();
  });

  it("offers no bairro edit without leads:update", async () => {
    renderPanel();
    await screen.findByText("Jardim Silveira · Barueri/SP");
    expect(screen.queryByRole("button", { name: t.editArea })).toBeNull();
  });

  it("reads the card again when the lead version moves", async () => {
    const { rerender } = renderPanel();
    await screen.findByText("Jardim Silveira · Barueri/SP");
    leadActions.getEntryLeadCardAction.mockResolvedValue({ card: card({ version: 5, area: { district: "Centro", city: "Barueri", state: "SP" } }), error: null });
    rerender({ ...inboxEntry, lead_version: 5 });
    expect(await screen.findByText("Centro · Barueri/SP")).toBeInTheDocument();
    expect(leadActions.getEntryLeadCardAction).toHaveBeenCalledTimes(2);
  });

  it("shows one error message when the card cannot be read", async () => {
    leadActions.getEntryLeadCardAction.mockResolvedValue({ card: null, error: { status: 403, code: "forbidden" } });
    renderPanel();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(t.loadFailed);
    expect(screen.getAllByText(t.loadFailed)).toHaveLength(1);
  });

  it("keeps the lead rows inside the description list as term and detail groups", async () => {
    grants.value.add("leads:read");
    grants.value.add("leads:update");
    renderPanel();
    await screen.findByRole("link", { name: new RegExp(t.openRecord) });
    fireEvent.click(screen.getByRole("button", { name: t.editArea }));
    await screen.findByRole("form", { name: t.editArea });
    for (const list of document.body.querySelectorAll("dl")) {
      for (const child of list.children) {
        expect(["DIV", "DT", "DD"]).toContain(child.tagName);
        if (child.tagName === "DIV") expect(child.querySelector(":scope > dt")).not.toBeNull();
      }
    }
  });
});

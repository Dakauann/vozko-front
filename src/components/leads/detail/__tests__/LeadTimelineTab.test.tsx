import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { NextIntlClientProvider } from "next-intl";

import { MapPin, PencilSimple } from "@/components/icons";

import ptMessages from "@/i18n/messages/pt.json";
import { leadQueryKeys } from "@/hooks/use-lead-records";
import type { CustomFieldDefinition } from "@/lib/crm/custom-fields";
import type { LeadTimelineItem } from "@/lib/leads/timeline";

const leadActions = vi.hoisted(() => ({ listLeadTimelineAction: vi.fn() }));
const fieldDefinitions = vi.hoisted(() => ({ value: [] as CustomFieldDefinition[] }));
const workspaceConfig = vi.hoisted(() => ({ getWorkspaceConfigAction: vi.fn() }));

vi.mock("@/app/actions/leads", () => leadActions);
vi.mock("@/app/actions/custom-fields", () => ({
  listCustomFieldsAction: () => Promise.resolve({ fields: fieldDefinitions.value, error: null }),
}));
vi.mock("@/app/actions/workspace-config", () => workspaceConfig);
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ can: () => true, currentWorkspace: { id: "ws-1" } }),
}));

import { LeadTimelineTab } from "../LeadTimelineTab";

const t = ptMessages.leadDetail.timeline;

function item(overrides: Partial<LeadTimelineItem> & Pick<LeadTimelineItem, "id" | "kind">): LeadTimelineItem {
  return { at: "2026-10-08T14:32:00Z", ref: { type: "entry", id: "e-1", entryType: "whatsapp" }, summary: {}, ...overrides };
}

function page(items: LeadTimelineItem[], next?: string) {
  return { page: { leadId: "lead-1", items, ...(next ? { next } : {}) }, error: null };
}

function renderTab(props: { onAddMemory?: () => void; leadName?: string } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo" now={new Date("2026-10-08T18:00:00Z")}>
        <LeadTimelineTab leadId="lead-1" leadName={props.leadName ?? "Maria"} onAddMemory={props.onAddMemory} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return client;
}

beforeEach(() => {
  vi.clearAllMocks();
  fieldDefinitions.value = [];
  workspaceConfig.getWorkspaceConfigAction.mockResolvedValue({
    config: { outcomeCapture: { enabled: true, requireOnFinish: false, outcomes: [{ code: "interessado", label: "Interessada", isDurable: false, position: 0 }] } },
  });
});

function iconMarkup(icon: ReactElement) {
  const { container, unmount } = render(icon);
  const markup = container.innerHTML;
  unmount();
  return markup;
}

describe("lead timeline tab", () => {
  it("reads the first page of the lead and tells what happened, newest first", async () => {
    leadActions.listLeadTimelineAction.mockResolvedValue(
      page([
        item({ id: "conversation:whatsapp:e-1", kind: "conversation", summary: { channel: "whatsapp" } }),
        item({ id: "campaign_read:e-2", kind: "campaign_read", ref: { type: "entry", id: "e-2", entryType: "whatsapp" }, summary: { title: "Matrículas 2027" } }),
        item({ id: "call:c-1", kind: "call", actor: "u-1", actorName: "Rafael T.", ref: { type: "call", id: "sip-1" }, summary: { direction: "outbound", durationSec: 134, answeredAt: "2026-10-08T14:00:10Z" } }),
        item({ id: "call:c-2", kind: "call", ref: { type: "call", id: "sip-2" }, summary: { direction: "inbound" } }),
        item({ id: "deal:d-1", kind: "deal", actor: "u-2", actorName: "Clara M.", ref: { type: "deal", id: "d-1" }, summary: { title: "Matrícula Bruna 2027" } }),
        item({ id: "memory:m-1", kind: "memory", ref: { type: "memory", id: "m-1" }, summary: { category: "personal", text: "Tem dois filhos" } }),
      ]),
    );

    renderTab();

    expect(await screen.findByText("Conversa iniciada no WhatsApp")).toBeInTheDocument();
    expect(screen.getByText("Campanha \"Matrículas 2027\" lida")).toBeInTheDocument();
    expect(screen.getByText("Ligação feita")).toBeInTheDocument();
    expect(screen.getByText("atendida, 02:14 · por Rafael T.")).toBeInTheDocument();
    expect(screen.getByText("Ligação recebida")).toBeInTheDocument();
    expect(screen.getByText("não atendida")).toBeInTheDocument();
    expect(screen.getByText("Negócio \"Matrícula Bruna 2027\" criado")).toBeInTheDocument();
    expect(screen.getByText("por Clara M.")).toBeInTheDocument();
    expect(screen.getByText(`Memória (${ptMessages.leadMemories.categories.personal}): Tem dois filhos`)).toBeInTheDocument();
    expect(leadActions.listLeadTimelineAction).toHaveBeenCalledTimes(1);
    expect(leadActions.listLeadTimelineAction.mock.calls[0][0]).toBe("lead-1");
    expect(leadActions.listLeadTimelineAction.mock.calls[0][1]).toMatchObject({ before: undefined, limit: 30 });
  });

  it("opens the conversation a conversation or a campaign send belongs to", async () => {
    leadActions.listLeadTimelineAction.mockResolvedValue(
      page([item({ id: "conversation:unofficial_whatsapp:u-1", kind: "conversation", ref: { type: "entry", id: "u-1", entryType: "unofficial_whatsapp" }, summary: { channel: "unofficial_whatsapp" } })]),
    );

    renderTab();

    const link = await screen.findByRole("link", { name: /Conversa iniciada no WhatsApp \(dispositivo\)/ });
    expect(link.getAttribute("href")).toBe("/dashboard/live-chat?entry=u-1&type=unofficial_whatsapp");
    expect(link.getAttribute("title")).toBe(t.openConversation);
  });

  it("names the changed fields of a record event, custom ones by their label", async () => {
    fieldDefinitions.value = [{ id: "f-1", workspaceId: "ws-1", objectType: "lead", key: "interesse", label: "Interesse", type: "select", required: false, position: 0, createdAt: "", updatedAt: "" } as CustomFieldDefinition];
    leadActions.listLeadTimelineAction.mockResolvedValue(
      page([
        item({ id: "record:ev-1", kind: "record", actor: "u-2", actorName: "Clara M.", ref: { type: "lead_event", id: "ev-1" }, summary: { event: "updated", fields: ["name", "customFields.interesse"] } }),
        item({ id: "record:ev-2", kind: "record", actor: "workflow:w-1", ref: { type: "lead_event", id: "ev-2" }, summary: { event: "blocked", fields: ["blocked"] } }),
        item({ id: "record:ev-3", kind: "record", ref: { type: "lead_event", id: "ev-3" }, summary: { event: "something_new", fields: [] } }),
      ]),
    );

    renderTab();

    expect(await screen.findByText("Clara M. alterou Nome, Interesse")).toBeInTheDocument();
    expect(screen.getByText(`${ptMessages.dealActors.workflow} bloqueou o lead`)).toBeInTheDocument();
    expect(screen.getByText(`${ptMessages.dealActors.system} alterou ${t.wholeRecord}`)).toBeInTheDocument();
  });

  it("names who pinned a position on the map and who used the location the lead sent", async () => {
    leadActions.listLeadTimelineAction.mockResolvedValue(
      page([
        item({ id: "record:ev-4", kind: "record", actor: "u-2", actorName: "Clara M.", ref: { type: "lead_event", id: "ev-4" }, summary: { event: "location_pinned", fields: ["addresses"] } }),
        item({ id: "record:ev-5", kind: "record", actor: "u-3", actorName: "Rui P.", ref: { type: "lead_event", id: "ev-5" }, summary: { event: "location_accepted", fields: ["addresses"] } }),
      ]),
    );

    renderTab();

    expect(await screen.findByText(t.record.location_pinned.replace("{actor}", "Clara M."))).toBeInTheDocument();
    expect(screen.getByText(t.record.location_accepted.replace("{actor}", "Rui P."))).toBeInTheDocument();
  });

  it("tells how a deal moved through its stages and how it ended, by whom", async () => {
    const deal = (id: string, summary: LeadTimelineItem["summary"], actor?: { actor: string; actorName: string }) =>
      item({ id: `deal_event:${id}`, kind: "deal_event", ref: { type: "deal", id: "d-1" }, summary, ...actor });
    leadActions.listLeadTimelineAction.mockResolvedValue(
      page([
        deal("ev-1", { event: "stage_moved", title: "Matrícula Bruna 2027", stageName: "Visita agendada", fromStageName: "Novo contato" }, { actor: "u-2", actorName: "Clara M." }),
        deal("ev-2", { event: "won", title: "Matrícula Bruna 2027", valueCents: 150000, currency: "BRL" }),
        deal("ev-3", { event: "lost" }),
        deal("ev-4", { event: "stage_moved", title: "Matrícula Bruna 2027" }),
        deal("ev-5", { event: "reopened", title: "Matrícula Bruna 2027" }),
        deal("ev-6", { event: "value_changed", title: "Matrícula Bruna 2027" }),
      ]),
    );

    renderTab();

    expect(await screen.findByText("Negócio \"Matrícula Bruna 2027\" movido para Visita agendada")).toBeInTheDocument();
    expect(screen.getByText("antes em Novo contato · por Clara M.")).toBeInTheDocument();
    expect(screen.getByText("Negócio \"Matrícula Bruna 2027\" ganho")).toBeInTheDocument();
    expect(screen.getByText(/^R\$\s1\.500,00$/)).toBeInTheDocument();
    expect(screen.getByText(`Negócio "${t.untitledDeal}" perdido`)).toBeInTheDocument();
    expect(screen.getByText(`Negócio "Matrícula Bruna 2027" movido para ${ptMessages.opportunityHistory.removedStage}`)).toBeInTheDocument();
    expect(screen.getByText("Negócio \"Matrícula Bruna 2027\" reaberto")).toBeInTheDocument();
    expect(screen.getByText("Negócio \"Matrícula Bruna 2027\" atualizado")).toBeInTheDocument();
  });

  it("tells the outcome the call list recorded for a call, by the workspace catalogue", async () => {
    leadActions.listLeadTimelineAction.mockResolvedValue(
      page([
        item({ id: "call:c-1", kind: "call", actor: "u-1", actorName: "Rafael T.", ref: { type: "call", id: "c-1" }, summary: { direction: "outbound", durationSec: 134, answeredAt: "2026-10-08T14:00:10Z", disposition: "interessado", callListId: "cl-1" } }),
        item({ id: "call:c-2", kind: "call", ref: { type: "call", id: "c-2" }, summary: { direction: "outbound", disposition: "_callback", callbackAt: "2026-10-09T12:00:00Z", callListId: "cl-1" } }),
        item({ id: "call:c-3", kind: "call", ref: { type: "call", id: "c-3" }, summary: { direction: "inbound", disposition: "_callback", callListId: "cl-1" } }),
      ]),
    );

    renderTab();

    expect(await screen.findByText("atendida, 02:14 · Interessada · por Rafael T.")).toBeInTheDocument();
    expect(screen.getByText("não atendida · retornar em 09/10, 09:00")).toBeInTheDocument();
    expect(screen.getByText(`não atendida · ${ptMessages.callLists.queue.callbackDisposition}`)).toBeInTheDocument();
  });

  it("marks a map position event with a map pin and other record changes with a pencil", async () => {
    leadActions.listLeadTimelineAction.mockResolvedValue(
      page([
        item({ id: "record:ev-4", kind: "record", actor: "u-2", actorName: "Clara M.", ref: { type: "lead_event", id: "ev-4" }, summary: { event: "location_pinned", fields: ["addresses"] } }),
        item({ id: "record:ev-5", kind: "record", actor: "u-2", actorName: "Clara M.", ref: { type: "lead_event", id: "ev-5" }, summary: { event: "renamed", fields: ["name"] } }),
      ]),
    );
    const pin = iconMarkup(<MapPin />);
    const pencil = iconMarkup(<PencilSimple />);

    renderTab();

    await screen.findByText(t.record.location_pinned.replace("{actor}", "Clara M."));
    const icons = screen.getAllByRole("listitem").map((row) => row.querySelector("[aria-hidden]")?.innerHTML);
    expect(icons).toEqual([pin, pencil]);
  });

  it("says when each thing happened in days the viewer counts: today, yesterday, then the date", async () => {
    const memory = (id: string, at: string) => item({ id: `memory:${id}`, kind: "memory", at, ref: { type: "memory", id }, summary: { text: id } });
    leadActions.listLeadTimelineAction.mockResolvedValue(
      page([memory("m-1", "2026-10-08T14:32:00Z"), memory("m-2", "2026-10-07T13:05:00Z"), memory("m-3", "2026-10-02T15:00:00Z"), memory("m-4", "2025-12-30T15:00:00Z")]),
    );

    renderTab();

    await screen.findByText("Memória: m-1");
    const times = screen.getAllByRole("listitem").map((row) => row.querySelector("time"));
    expect(times.map((time) => time?.textContent)).toEqual(["hoje, 11:32", "ontem, 10:05", "02/10", "30/12/2025"]);
    expect(times[2]?.getAttribute("dateTime")).toBe("2026-10-02T15:00:00Z");
    expect(times[2]?.getAttribute("title")).toMatch(/2026/);
  });

  it("pages with the cursor the server gave and keeps asking past an empty page that still has a cursor", async () => {
    leadActions.listLeadTimelineAction
      .mockResolvedValueOnce(page([item({ id: "memory:m-1", kind: "memory", ref: { type: "memory", id: "m-1" }, summary: { text: "Primeira" } })], "cur-1"))
      .mockResolvedValueOnce(page([], "cur-2"))
      .mockResolvedValueOnce(page([item({ id: "memory:m-2", kind: "memory", ref: { type: "memory", id: "m-2" }, summary: { text: "Segunda" } })]));

    renderTab();

    fireEvent.click(await screen.findByRole("button", { name: t.loadMore }));
    await waitFor(() => expect(leadActions.listLeadTimelineAction).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(t.empty)).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: t.loadMore }));

    expect(await screen.findByText("Memória: Segunda")).toBeInTheDocument();
    expect(leadActions.listLeadTimelineAction.mock.calls[1][1]).toMatchObject({ before: "cur-1" });
    expect(leadActions.listLeadTimelineAction.mock.calls[2][1]).toMatchObject({ before: "cur-2" });
    expect(screen.queryByRole("button", { name: t.loadMore })).toBeNull();
  });

  it("does not call a first page that is empty but still has a cursor an empty timeline", async () => {
    leadActions.listLeadTimelineAction.mockResolvedValue(page([], "cur-1"));

    renderTab();

    expect(await screen.findByRole("button", { name: t.loadMore })).toBeInTheDocument();
    expect(screen.queryByText(t.empty)).toBeNull();
  });

  it("says nothing happened yet and offers to record a memory", async () => {
    leadActions.listLeadTimelineAction.mockResolvedValue(page([]));
    const onAddMemory = vi.fn();

    renderTab({ onAddMemory });

    expect(await screen.findByText(t.empty)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t.addMemory }));
    expect(onAddMemory).toHaveBeenCalledTimes(1);
  });

  it("offers no memory action to a viewer who may not record one", async () => {
    leadActions.listLeadTimelineAction.mockResolvedValue(page([]));

    renderTab();

    expect(await screen.findByText(t.empty)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t.addMemory })).toBeNull();
  });

  it("shows the section error, not an empty timeline, when the read fails", async () => {
    leadActions.listLeadTimelineAction.mockResolvedValue({ page: null, error: { status: 400, code: "lead_page_invalid", message: "bad" } });

    renderTab();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText(t.empty)).toBeNull();
  });

  it("says in the header legend that the timeline is all about the lead, by first name", async () => {
    leadActions.listLeadTimelineAction.mockResolvedValue(page([]));

    renderTab({ leadName: "Maria" });

    expect(await screen.findByText(t.legend.replace("{name}", "Maria"))).toBeInTheDocument();
  });

  it("speaks of this lead in the legend when it has no name", async () => {
    leadActions.listLeadTimelineAction.mockResolvedValue(page([]));

    renderTab({ leadName: "" });

    expect(await screen.findByText(t.legendUnnamed)).toBeInTheDocument();
  });

  it("keeps the loaded items and offers a retry when reading the timeline again fails", async () => {
    leadActions.listLeadTimelineAction
      .mockResolvedValueOnce(page([item({ id: "memory:m-1", kind: "memory", ref: { type: "memory", id: "m-1" }, summary: { text: "Primeira" } })]))
      .mockResolvedValue({ page: null, error: { status: 400, code: "lead_page_invalid", message: "bad" } });

    const client = renderTab();
    await screen.findByText("Memória: Primeira");

    await client.invalidateQueries({ queryKey: leadQueryKeys.timeline("ws-1", "lead-1") });

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Memória: Primeira")).toBeInTheDocument();
  });
});

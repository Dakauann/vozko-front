import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import pt from "@/i18n/messages/pt.json";
import type { CallDetail, CallListFilters, CallListPage } from "@/lib/call-history/types";

const grants = vi.hoisted(() => ({ value: new Set<string>() }));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({
    can: (resource: string, action: string) => grants.value.has(`${resource}:${action}`),
    currentWorkspace: { id: "ws-1" },
  }),
}));

vi.mock("@/i18n/routing", () => ({
  usePathname: () => "/dashboard/call-history",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  Link: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const listCalls = vi.hoisted(() => vi.fn());
const getCall = vi.hoisted(() => vi.fn());
vi.mock("@/app/actions/call-history", () => ({ listCallsAction: listCalls, getCallAction: getCall }));
vi.mock("@/app/actions/workspace", () => ({
  listMembersAction: () => Promise.resolve({ members: [{ userId: "u-bia", username: "Bia", email: "bia@x.com" }] }),
}));
vi.mock("@/app/actions/pricing", () => ({ getExchangeRateAction: () => Promise.resolve({ item: { priceMicros: 5_000_000 } }) }));

import CallHistoryPage from "../page";

const page: CallListPage = {
  items: [
    {
      callId: "sip-out-1",
      direction: "outbound",
      channel: "phone",
      outcome: "answered",
      startedAt: "2026-09-30T14:00:00Z",
      answeredAt: "2026-09-30T14:00:08Z",
      endedAt: "2026-09-30T14:02:08Z",
      talkSeconds: 120,
      ringSeconds: 8,
      contact: { number: "5584994409684", leadId: "lead-1", name: "Maria Souza" },
      placedBy: { id: "u-ana", name: "Ana" },
      answeredBy: { id: "u-bia", name: "Bia" },
      transfers: 1,
      charge: { amountMicros: 200_000, settled: true },
    },
    {
      callId: "wa-in-2",
      direction: "inbound",
      channel: "whatsapp",
      outcome: "missed",
      startedAt: "2026-09-30T13:00:00Z",
      talkSeconds: 0,
      ringSeconds: 30,
      contact: { number: "5511999990000" },
      transfers: 0,
    },
  ],
  page: 1,
  pageSize: 25,
  totalItems: 2,
  totalPages: 1,
};

const detail: CallDetail = {
  ...page.items[0],
  handlers: [
    { id: "u-ana", name: "Ana" },
    { id: "u-bia", name: "Bia" },
  ],
  timeline: [
    { kind: "started", at: "2026-09-30T14:00:00Z", actor: { id: "u-ana", name: "Ana" } },
    { kind: "answered", at: "2026-09-30T14:00:08Z", actor: { id: "u-ana", name: "Ana" } },
    { kind: "transfer_requested", at: "2026-09-30T14:01:00Z", actor: { id: "u-ana", name: "Ana" }, queueId: "q1", queueName: "Suporte", notes: "quer cancelar" },
    { kind: "transfer_connected", at: "2026-09-30T14:01:10Z", actor: { id: "u-bia", name: "Bia" }, queueId: "q1", queueName: "Suporte" },
    { kind: "ended", at: "2026-09-30T14:02:08Z", reason: "ended" },
    { kind: "recording_ready", at: "2026-09-30T14:02:10Z" },
  ],
  recording: { url: "https://files/rec.wav", durationSec: 120 },
};

function renderPage() {
  return render(
    <NextIntlClientProvider locale="pt" messages={pt} timeZone="UTC">
      <CallHistoryPage />
    </NextIntlClientProvider>,
  );
}

describe("CallHistoryPage", () => {
  beforeEach(() => {
    grants.value = new Set(["call_history:read"]);
    listCalls.mockReset().mockResolvedValue({ page });
    getCall.mockReset().mockResolvedValue({ call: detail });
  });

  it("lists the calls of the last week with who handled them, the outcome, talk time and cost", async () => {
    renderPage();
    expect(await screen.findByText("Maria Souza")).toBeTruthy();
    const query = listCalls.mock.calls[0][0] as CallListFilters;
    expect(query.page).toBe(1);
    expect(query.from).toBeTruthy();
    expect(query.memberId).toBeUndefined();
    expect(screen.getByText("Bia")).toBeTruthy();
    expect(screen.getByText("1 transferência")).toBeTruthy();
    expect(screen.getByText("Atendida")).toBeTruthy();
    expect(screen.getByText("Perdida")).toBeTruthy();
    expect(screen.getByText("02:00")).toBeTruthy();
    await waitFor(() => expect(screen.getByText(/R\$\s?1,00/)).toBeTruthy());
  });

  it("offers the member filter only to people who see the whole team", async () => {
    renderPage();
    await screen.findByText("Maria Souza");
    expect(screen.queryByText("Membro")).toBeNull();
    expect(screen.getByText(/ligações que você fez, atendeu ou transferiu/)).toBeTruthy();
  });

  it("describes the whole workspace to a manager", async () => {
    grants.value = new Set(["call_history:read", "call_history:view_others"]);
    renderPage();
    await screen.findByText("Maria Souza");
    expect(screen.getByText("Membro")).toBeTruthy();
    expect(screen.getByText(/Todas as ligações do workspace/)).toBeTruthy();
  });

  it("opens a call's timeline, its handlers and its recording", async () => {
    renderPage();
    fireEvent.click(await screen.findByText("Maria Souza"));
    expect(await screen.findByText("Ana ligou")).toBeTruthy();
    expect(getCall).toHaveBeenCalledWith("sip-out-1");
    expect(screen.getByText("Ana enviou para a fila Suporte")).toBeTruthy();
    expect(screen.getByText("Bia atendeu pela fila Suporte")).toBeTruthy();
    expect(screen.getByText("quer cancelar")).toBeTruthy();
    expect(screen.getByText("Ligação encerrada: desligada normalmente")).toBeTruthy();
    expect(screen.getByText("Ana → Bia")).toBeTruthy();
    expect(screen.getByLabelText("Gravação", { selector: "audio" }).getAttribute("src")).toBe("https://files/rec.wav");
    expect(screen.getByText("Abrir contato").getAttribute("href")).toBe("/dashboard/leads/lead-1");
  });

  it("hides the recording when the viewer may not hear it", async () => {
    getCall.mockResolvedValue({ call: { ...detail, recording: undefined } });
    renderPage();
    fireEvent.click(await screen.findByText("Maria Souza"));
    await screen.findByText("Ana ligou");
    expect(screen.queryByLabelText("Gravação", { selector: "audio" })).toBeNull();
  });

  it("explains a failed load and retries", async () => {
    listCalls.mockResolvedValueOnce({ error: "timeout" });
    renderPage();
    expect(await screen.findByText("Não foi possível carregar as ligações")).toBeTruthy();
    fireEvent.click(screen.getByText("Tentar de novo"));
    expect(await screen.findByText("Maria Souza")).toBeTruthy();
  });
});

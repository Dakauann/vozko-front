import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const carrierChannels = vi.hoisted(() => ({ launched: new Set<string>(["rcs", "sms"]) }));
vi.mock("@/lib/carrier-messaging/use-carrier-channels", () => ({
  useCarrierChannels: () => ({ status: "ready", launched: (channel: string) => carrierChannels.launched.has(channel) }),
}));

const rcs = vi.hoisted(() => ({
  listRcsSendersAction: vi.fn(),
  createRcsSenderAction: vi.fn(),
  updateRcsSenderAction: vi.fn(),
  transitionRcsSenderAction: vi.fn(),
  deleteRcsSenderAction: vi.fn(),
}));
const toast = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }));

vi.mock("@/app/actions/rcs", () => rcs);
vi.mock("@/app/actions/medias", () => ({ uploadMediaAction: vi.fn() }));
vi.mock("@/hooks/use-exchange-rate", () => ({ useExchangeRate: () => 5 }));
vi.mock("sonner", () => ({ toast }));
vi.mock("framer-motion", () => import("@/test/framer-motion-stub"));
vi.mock("@/components/dashboard/DashboardPageHeader", () => ({
  DashboardPageHeader: ({ badge, title, actions, back }: { badge: string; title?: string; actions?: ReactNode; back?: { onClick: () => void; label: string } }) => (
    <header>
      <h1>{title ?? badge}</h1>
      {back ? (
        <button type="button" onClick={back.onClick}>
          {back.label}
        </button>
      ) : null}
      {actions}
    </header>
  ),
}));

import rawPt from "@/i18n/messages/pt.json";
import { senderFixture } from "@/lib/rcs/test-fixtures";
import { brandedMessages } from "@/test/branded-messages";

import { RcsSendersPage } from "./RcsSendersPage";

const pt = brandedMessages(rawPt);
const copy = pt.carrierMessaging.pages.rcsSenders;

function renderPage(initialSenderId?: string) {
  return render(
    <NextIntlClientProvider locale="pt" messages={pt} timeZone="America/Sao_Paulo">
      <RcsSendersPage initialSenderId={initialSenderId} />
    </NextIntlClientProvider>,
  );
}

const launched = senderFixture();
const draft = senderFixture({ id: "snd-2", brand_name: "Café Lua", status: "draft", editable: true, can_send: false, launched_at: null, submitted_at: null });

describe("RcsSendersPage", () => {
  beforeEach(() => {
    for (const fn of Object.values(rcs)) fn.mockReset();
    toast.success.mockReset();
    toast.error.mockReset();
    rcs.listRcsSendersAction.mockResolvedValue({ data: { senders: [launched, draft] }, error: null });
  });

  it("shows a coming soon page and never calls the RCS sender endpoints", () => {
    carrierChannels.launched = new Set(["sms"]);
    renderPage();
    expect(screen.getByText(pt.carrierMessaging.comingSoon.rcs.title)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: pt.carrierMessaging.comingSoon.rcs.toSms })).toHaveAttribute("href", expect.stringContaining("/dashboard/rcs-sms/sms-senders"));
    expect(rcs.listRcsSendersAction).not.toHaveBeenCalled();
    carrierChannels.launched = new Set(["rcs", "sms"]);
  });

  it("lists the senders with their status and counts", async () => {
    renderPage();
    expect(await screen.findByText("Café Lua")).toBeInTheDocument();
    expect(screen.getByText("Padaria Sol")).toBeInTheDocument();
    expect(screen.getAllByText(pt.rcs.senders.status.launched).length).toBeGreaterThan(0);
    expect(screen.getByText(copy.stats.inReview)).toBeInTheDocument();
  });

  it("shows the coded refusal with a retry when the list fails", async () => {
    rcs.listRcsSendersAction.mockResolvedValueOnce({ data: null, error: { code: "carrier_provider_unavailable", message: "x" } });
    renderPage();
    expect(await screen.findByText(pt.carrierMessaging.errors.carrier_provider_unavailable)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: copy.retry }));
    expect(await screen.findByText("Café Lua")).toBeInTheDocument();
  });

  it("creates a draft from the onboarding form", async () => {
    rcs.createRcsSenderAction.mockResolvedValue({ data: draft, error: null });
    renderPage();
    await screen.findByText("Café Lua");
    fireEvent.click(screen.getAllByRole("button", { name: copy.create })[0]);
    expect(screen.getByRole("heading", { name: copy.editor.newTitle })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(pt.rcs.senders.form.brand.name), { target: { value: "Café Lua" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: copy.editor.save }));
    });
    expect(rcs.createRcsSenderAction.mock.calls[0][0].brand_name).toBe("Café Lua");
    expect(toast.success).toHaveBeenCalledWith(copy.editor.saved);
    expect(screen.getByRole("heading", { name: "Café Lua" })).toBeInTheDocument();
  });

  it("saves before submitting and shows a field refusal next to the field", async () => {
    rcs.updateRcsSenderAction.mockResolvedValue({ data: null, error: { code: "rcs_sender_incomplete", message: "x", details: { field: "cnpj" } } });
    renderPage("snd-2");
    await screen.findByRole("heading", { name: "Café Lua" });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: copy.editor.submit }));
    });
    expect(rcs.updateRcsSenderAction).toHaveBeenCalledWith("snd-2", expect.objectContaining({ brand_name: "Café Lua" }));
    expect(rcs.transitionRcsSenderAction).not.toHaveBeenCalled();
    expect(screen.getByText(pt.rcs.errors.rcs_sender_incomplete)).toBeInTheDocument();
  });

  it("submits a saved draft for approval", async () => {
    const submitted = { ...draft, status: "submitted" as const, editable: false };
    rcs.updateRcsSenderAction.mockResolvedValue({ data: draft, error: null });
    rcs.transitionRcsSenderAction.mockResolvedValue({ data: submitted, error: null });
    renderPage("snd-2");
    await screen.findByRole("heading", { name: "Café Lua" });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: copy.editor.submit }));
    });
    expect(rcs.transitionRcsSenderAction).toHaveBeenCalledWith("snd-2", "submit");
    expect(toast.success).toHaveBeenLastCalledWith(copy.editor.done.submit);
    expect(screen.queryByRole("button", { name: copy.editor.submit })).not.toBeInTheDocument();
  });

  it("deletes a draft after confirming", async () => {
    rcs.deleteRcsSenderAction.mockResolvedValue({ data: true, error: null });
    renderPage("snd-2");
    await screen.findByRole("heading", { name: "Café Lua" });
    fireEvent.click(screen.getByRole("button", { name: copy.editor.delete }));
    const dialog = await screen.findByRole("alertdialog");
    await act(async () => {
      fireEvent.click(dialog.querySelector("button:last-of-type") as HTMLButtonElement);
    });
    await waitFor(() => expect(rcs.deleteRcsSenderAction).toHaveBeenCalledWith("snd-2"));
    expect(await screen.findByText("Padaria Sol")).toBeInTheDocument();
  });

  it("offers pause on an active sender", async () => {
    renderPage("snd-1");
    await screen.findByRole("heading", { name: "Padaria Sol" });
    expect(screen.getByRole("button", { name: copy.editor.pause })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: copy.editor.save })).not.toBeInTheDocument();
  });


  it("shows one panel for RCS and SMS without the SMS link while no channel is launched", () => {
    carrierChannels.launched = new Set();
    renderPage();
    expect(screen.getByText(pt.carrierMessaging.comingSoon.all.title)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: pt.carrierMessaging.comingSoon.rcs.toSms })).not.toBeInTheDocument();
    expect(rcs.listRcsSendersAction).not.toHaveBeenCalled();
    carrierChannels.launched = new Set(["rcs", "sms"]);
  });

  it("keeps the RCS senders working while only SMS is parked", async () => {
    carrierChannels.launched = new Set(["rcs"]);
    renderPage();
    expect(await screen.findByText("Padaria Sol")).toBeInTheDocument();
    expect(screen.queryByText(pt.carrierMessaging.comingSoon.all.title)).not.toBeInTheDocument();
    carrierChannels.launched = new Set(["rcs", "sms"]);
  });
});

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const carrierChannels = vi.hoisted(() => ({ launched: new Set<string>(["rcs", "sms"]) }));
vi.mock("@/lib/carrier-messaging/use-carrier-channels", () => ({
  useCarrierChannels: () => ({ status: "ready", launched: (channel: string) => carrierChannels.launched.has(channel) }),
}));

const api = vi.hoisted(() => ({
  adminListCarrierSendersAction: vi.fn(),
  adminPauseCarrierSenderAction: vi.fn(),
  adminResumeCarrierSenderAction: vi.fn(),
  adminListSmsRoutesAction: vi.fn(),
  adminAssignSmsNumberAction: vi.fn(),
  adminReleaseSmsNumberAction: vi.fn(),
}));
const toast = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }));

vi.mock("@/app/actions/carrier-messaging", () => api);
vi.mock("@/hooks/use-exchange-rate", () => ({ useExchangeRate: () => 5 }));
vi.mock("sonner", () => ({ toast }));
vi.mock("framer-motion", () => import("@/test/framer-motion-stub"));
vi.mock("@/components/dashboard/DashboardPageHeader", () => ({
  DashboardPageHeader: ({ badge, actions }: { badge: string; actions?: ReactNode }) => (
    <header>
      <h1>{badge}</h1>
      {actions}
    </header>
  ),
}));

import rawPt from "@/i18n/messages/pt.json";
import { routeFixture } from "@/lib/carrier-messaging/test-fixtures";
import { senderFixture } from "@/lib/rcs/test-fixtures";
import { brandedMessages } from "@/test/branded-messages";

import { CarrierAdminPage } from "./CarrierAdminPage";

const pt = brandedMessages(rawPt);
const copy = pt.carrierMessaging.pages.admin;

function renderPage() {
  return render(
    <NextIntlClientProvider locale="pt" messages={pt} timeZone="America/Sao_Paulo">
      <CarrierAdminPage />
    </NextIntlClientProvider>,
  );
}

async function confirm(label: string) {
  const dialog = await screen.findByRole("alertdialog");
  await act(async () => {
    fireEvent.click(within(dialog).getByRole("button", { name: label }));
  });
}

describe("CarrierAdminPage", () => {
  beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset();
    toast.success.mockReset();
    toast.error.mockReset();
    api.adminListCarrierSendersAction.mockResolvedValue({ data: { senders: [senderFixture({ workspace_id: "ws-42" })] }, error: null });
    api.adminListSmsRoutesAction.mockResolvedValue({ data: { routes: [routeFixture({ workspace_id: "ws-7" })] }, error: null });
  });

  it("lists senders of every workspace", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: copy.tabs.senders }));
    expect(await screen.findByText("ws-42")).toBeInTheDocument();
    expect(api.adminListCarrierSendersAction).toHaveBeenCalledWith(undefined, expect.anything());
  });

  it("pauses a sender with the default reason", async () => {
    api.adminPauseCarrierSenderAction.mockResolvedValue({ data: senderFixture({ status: "paused", paused_by: "platform", pause_reason: "complaints", workspace_id: "ws-42" }), error: null });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: copy.tabs.senders }));
    const row = (await screen.findByText("ws-42")).closest("tr") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: copy.senders.pause }));
    await confirm(copy.senders.pause);
    expect(api.adminPauseCarrierSenderAction).toHaveBeenCalledWith("snd-1", "complaints");
    expect(await screen.findByText(pt.rcs.senders.track.now.pauseReasons.complaints)).toBeInTheDocument();
  });

  it("shows RCS senders as coming soon and never asks the admin endpoint", async () => {
    carrierChannels.launched = new Set(["sms"]);
    renderPage();
    expect(await screen.findByText("ws-7")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: copy.tabs.senders }));
    expect(screen.getByText(pt.carrierMessaging.comingSoon.rcs.title)).toBeInTheDocument();
    expect(api.adminListCarrierSendersAction).not.toHaveBeenCalled();
    carrierChannels.launched = new Set(["rcs", "sms"]);
  });

  it("assigns a dedicated number to an SMS route", async () => {
    api.adminAssignSmsNumberAction.mockResolvedValue({ data: routeFixture({ kind: "dedicated", number: "29090" }), error: null });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: copy.tabs.routes }));
    const row = (await screen.findByText("ws-7")).closest("tr") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: copy.routes.assign }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.change(within(dialog).getByLabelText(copy.routes.number), { target: { value: "29090" } });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: copy.routes.assignConfirm }));
    });
    expect(api.adminAssignSmsNumberAction).toHaveBeenCalledWith("rt-1", "29090");
    expect(await screen.findByText("29090")).toBeInTheDocument();
    expect(screen.getByText("ws-7")).toBeInTheDocument();
  });

  it("keeps the dialog open and explains a taken number", async () => {
    api.adminAssignSmsNumberAction.mockResolvedValue({ data: null, error: { code: "sms_number_taken", message: "x" } });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: copy.tabs.routes }));
    const row = (await screen.findByText("ws-7")).closest("tr") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: copy.routes.assign }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.change(within(dialog).getByLabelText(copy.routes.number), { target: { value: "29090" } });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: copy.routes.assignConfirm }));
    });
    expect(within(await screen.findByRole("alertdialog")).getByText(pt.sms.errors.sms_number_taken)).toBeInTheDocument();
  });


  it("shows both tabs as coming soon and never asks the admin endpoints while no channel is launched", () => {
    carrierChannels.launched = new Set();
    renderPage();
    expect(screen.getByRole("button", { name: new RegExp(copy.tabs.routes) })).toHaveTextContent(pt.carrierMessaging.comingSoon.chip);
    expect(screen.getByRole("button", { name: new RegExp(copy.tabs.senders) })).toHaveTextContent(pt.carrierMessaging.comingSoon.chip);
    expect(screen.getByText(pt.carrierMessaging.comingSoon.sms.title)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: new RegExp(copy.tabs.senders) }));
    expect(screen.getByText(pt.carrierMessaging.comingSoon.rcs.title)).toBeInTheDocument();
    expect(api.adminListCarrierSendersAction).not.toHaveBeenCalled();
    expect(api.adminListSmsRoutesAction).not.toHaveBeenCalled();
    carrierChannels.launched = new Set(["rcs", "sms"]);
  });
});

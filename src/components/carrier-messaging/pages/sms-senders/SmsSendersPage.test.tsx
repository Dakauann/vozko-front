import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const carrierChannels = vi.hoisted(() => ({ launched: new Set<string>(["rcs", "sms"]) }));
vi.mock("@/lib/carrier-messaging/use-carrier-channels", () => ({
  useCarrierChannels: () => ({ status: "ready", launched: (channel: string) => carrierChannels.launched.has(channel) }),
}));

const sms = vi.hoisted(() => ({
  listSmsRoutesAction: vi.fn(),
  createSmsRouteAction: vi.fn(),
  updateSmsRouteAction: vi.fn(),
  transitionSmsRouteAction: vi.fn(),
  deleteSmsRouteAction: vi.fn(),
}));
const toast = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }));

vi.mock("@/app/actions/sms", () => sms);
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
import { brandedMessages } from "@/test/branded-messages";

import { SmsSendersPage } from "./SmsSendersPage";

const pt = brandedMessages(rawPt);
const copy = pt.carrierMessaging.pages.smsSenders;

function renderPage() {
  return render(
    <NextIntlClientProvider locale="pt" messages={pt} timeZone="America/Sao_Paulo">
      <SmsSendersPage />
    </NextIntlClientProvider>,
  );
}

const shared = routeFixture();
const dedicated = routeFixture({ id: "rt-2", brand_prefix: "Cafe Lua", kind: "dedicated", number: "29090" });

describe("SmsSendersPage", () => {
  beforeEach(() => {
    for (const fn of Object.values(sms)) fn.mockReset();
    toast.success.mockReset();
    toast.error.mockReset();
    sms.listSmsRoutesAction.mockResolvedValue({ data: { routes: [shared, dedicated] }, error: null });
  });

  it("lists the routes with their number and status", async () => {
    renderPage();
    expect(await screen.findByText("Cafe Lua")).toBeInTheDocument();
    expect(screen.getByText("29090")).toBeInTheDocument();
    expect(screen.getByText(copy.sharedNumber)).toBeInTheDocument();
    expect(screen.getByText(copy.kinds.dedicated)).toBeInTheDocument();
  });

  it("creates a route from the sheet and shows a refusal inline", async () => {
    sms.createSmsRouteAction.mockResolvedValueOnce({ data: null, error: { code: "sms_route_invalid", message: "x" } });
    renderPage();
    await screen.findByText("Cafe Lua");
    fireEvent.click(screen.getAllByRole("button", { name: copy.create })[0]);
    const input = await screen.findByLabelText(copy.sheet.prefix);
    fireEvent.change(input, { target: { value: "Loja Sol" } });
    expect(screen.getByText("Loja Sol:")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: copy.sheet.create }));
    });
    expect(sms.createSmsRouteAction).toHaveBeenCalledWith({ brand_prefix: "Loja Sol" });
    expect(screen.getByText(pt.sms.errors.sms_route_invalid)).toBeInTheDocument();
    sms.createSmsRouteAction.mockResolvedValueOnce({ data: routeFixture({ id: "rt-3", brand_prefix: "Loja Sol" }), error: null });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: copy.sheet.create }));
    });
    expect(toast.success).toHaveBeenCalledWith("Remetente Loja Sol salvo.");
  });

  it("pauses an active route", async () => {
    sms.transitionSmsRouteAction.mockResolvedValue({ data: { ...shared, status: "paused", can_send: false }, error: null });
    renderPage();
    const row = (await screen.findByText("Padaria Sol")).closest("tr") as HTMLElement;
    await act(async () => {
      fireEvent.click(within(row).getByRole("button", { name: copy.pause }));
    });
    expect(sms.transitionSmsRouteAction).toHaveBeenCalledWith("rt-1", "pause");
    expect(await screen.findByText(copy.status.paused)).toBeInTheDocument();
  });

  it("reports a refused transition", async () => {
    sms.transitionSmsRouteAction.mockResolvedValue({ data: null, error: { code: "sms_route_not_found", message: "x" } });
    renderPage();
    const row = (await screen.findByText("Padaria Sol")).closest("tr") as HTMLElement;
    await act(async () => {
      fireEvent.click(within(row).getByRole("button", { name: copy.pause }));
    });
    expect(toast.error).toHaveBeenCalledWith(pt.sms.errors.sms_route_not_found);
  });


  it("shows one panel for RCS and SMS and never asks for routes while no channel is launched", () => {
    carrierChannels.launched = new Set();
    renderPage();
    expect(screen.getByText(pt.carrierMessaging.comingSoon.all.title)).toBeInTheDocument();
    expect(sms.listSmsRoutesAction).not.toHaveBeenCalled();
    carrierChannels.launched = new Set(["rcs", "sms"]);
  });

  it("shows SMS as coming soon and never asks for routes while only RCS is launched", () => {
    carrierChannels.launched = new Set(["rcs"]);
    renderPage();
    expect(screen.getByText(pt.carrierMessaging.comingSoon.sms.title)).toBeInTheDocument();
    expect(sms.listSmsRoutesAction).not.toHaveBeenCalled();
    carrierChannels.launched = new Set(["rcs", "sms"]);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import ptMessages from "@/i18n/messages/pt.json";
import type { MessageLocation } from "@/lib/conversations/types";

const leadActions = vi.hoisted(() => ({ acceptLeadLocationAction: vi.fn() }));
const grants = vi.hoisted(() => ({ value: new Set<string>() }));
const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("@/app/actions/leads", () => leadActions);
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ can: (resource: string, action: string) => grants.value.has(`${resource}:${action}`) }),
}));
vi.mock("sonner", () => ({ toast: toasts }));
const visibility = vi.hoisted(() => ({ inView: true }));
vi.mock("@/hooks/use-in-view", () => ({ useInView: () => [() => undefined, visibility.inView] }));
vi.mock("@/components/maps/MiniMap", () => ({
  MiniMap: (props: { position: { lat: number; lng: number } | null; precision?: string | null; interactive?: boolean; draggable?: boolean; ariaLabel?: string }) => (
    <div
      role="img"
      aria-label={props.ariaLabel}
      data-testid="mini-map"
      data-position={props.position ? `${props.position.lat},${props.position.lng}` : ""}
      data-precision={props.precision ?? ""}
      data-interactive={props.interactive ? "true" : "false"}
      data-draggable={props.draggable ? "true" : "false"}
    />
  ),
}));

import { LocationMessageCard } from "../LocationMessageCard";

const t = ptMessages.crm.locationMessage;

const shared: MessageLocation = {
  latitude: -23.5113,
  longitude: -46.8761,
  name: "Casa",
  address: "R. das Acácias, Jardim Silveira",
  candidate: true,
};

function renderCard(overrides: Partial<{ location: MessageLocation; leadId: string | undefined; leadName: string; leadNumber: string }> = {}) {
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <LocationMessageCard
        messageId="msg-1"
        location={overrides.location ?? shared}
        leadId={"leadId" in overrides ? overrides.leadId : "lead-1"}
        leadName={overrides.leadName ?? "Maria Aparecida Souza"}
        leadNumber={overrides.leadNumber ?? "5511900010142"}
      />
    </NextIntlClientProvider>,
  );
}

const acceptName = (name: string) => t.accept.replace("{name}", name);

beforeEach(() => {
  vi.clearAllMocks();
  visibility.inView = true;
  grants.value = new Set(["leads:update"]);
  leadActions.acceptLeadLocationAction.mockResolvedValue({ lead: { id: "lead-1", version: 7 }, error: null });
});

describe("LocationMessageCard", () => {
  it("draws the shared place on a real map, pinned at the exact coordinates, with the place text", () => {
    renderCard();
    const map = screen.getByRole("img", { name: t.mapLabel });
    expect(map).toHaveAttribute("data-position", "-23.5113,-46.8761");
    expect(map).toHaveAttribute("data-precision", "exact");
    expect(map).toHaveAttribute("data-interactive", "false");
    expect(map).toHaveAttribute("data-draggable", "false");
    expect(screen.getByText(t.caption.replace("{place}", "Casa, R. das Acácias, Jardim Silveira"))).toBeInTheDocument();
  });

  it("mounts no map while the card is far from the screen", () => {
    visibility.inView = false;
    renderCard();
    expect(screen.queryByTestId("mini-map")).not.toBeInTheDocument();
    expect(screen.getByText(t.caption.replace("{place}", "Casa, R. das Acácias, Jardim Silveira"))).toBeInTheDocument();
  });

  it("shows the coordinates when the lead shared no place text", () => {
    renderCard({ location: { latitude: -23.5113, longitude: -46.8761, candidate: true } });
    expect(screen.getByText(t.caption.replace("{place}", "-23,51130, -46,87610"))).toBeInTheDocument();
  });

  it("accepts the location for the lead of the conversation", async () => {
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: acceptName("Maria") }));
    await waitFor(() => expect(leadActions.acceptLeadLocationAction).toHaveBeenCalledWith("lead-1", "msg-1"));
    expect(await screen.findByText(t.accepted.replace("{name}", "Maria"))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: acceptName("Maria") })).not.toBeInTheDocument();
  });

  it("announces the success once, in the status line, and moves focus there", async () => {
    renderCard();
    const status = screen.getByRole("status");
    expect(status).toBeEmptyDOMElement();
    fireEvent.click(screen.getByRole("button", { name: acceptName("Maria") }));
    await waitFor(() => expect(status).toHaveTextContent(t.accepted.replace("{name}", "Maria")));
    await waitFor(() => expect(document.activeElement).toBe(status));
    expect(toasts.success).not.toHaveBeenCalled();
  });

  it("names the lead generically when the conversation has no name", () => {
    renderCard({ leadName: "" });
    expect(screen.getByRole("button", { name: t.acceptUnnamed })).toBeInTheDocument();
  });

  it("names the lead generically when the conversation's name is only the number", () => {
    renderCard({ leadName: "5511900010142" });
    expect(screen.getByRole("button", { name: t.acceptUnnamed })).toBeInTheDocument();
  });

  it("disables the action while it saves, so one click makes one request", async () => {
    let finish: (value: unknown) => void = () => undefined;
    leadActions.acceptLeadLocationAction.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderCard();
    const button = screen.getByRole("button", { name: acceptName("Maria") });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(leadActions.acceptLeadLocationAction).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("button", { name: t.accepting })).toBeDisabled();
    finish({ lead: { id: "lead-1", version: 7 }, error: null });
    expect(await screen.findByText(t.accepted.replace("{name}", "Maria"))).toBeInTheDocument();
  });

  it("explains a refusal and keeps the action available", async () => {
    leadActions.acceptLeadLocationAction.mockResolvedValue({ lead: null, error: { status: 404, code: "lead_location_not_found" } });
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: acceptName("Maria") }));
    await waitFor(() => expect(toasts.error).toHaveBeenCalledWith(t.errors.lead_location_not_found));
    expect(screen.getByRole("button", { name: acceptName("Maria") })).toBeEnabled();
  });

  it("falls back to the generic failure for a code it does not know", async () => {
    leadActions.acceptLeadLocationAction.mockResolvedValue({ lead: null, error: { status: 500, code: "boom" } });
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: acceptName("Maria") }));
    await waitFor(() => expect(toasts.error).toHaveBeenCalledWith(t.failed));
  });

  it("offers nothing for a location the server did not mark as a candidate", () => {
    renderCard({ location: { ...shared, candidate: false } });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: t.mapLabel })).toBeInTheDocument();
  });

  it("offers nothing without leads:update", () => {
    grants.value = new Set();
    renderCard();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("offers nothing when the conversation has no lead", () => {
    renderCard({ leadId: undefined });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

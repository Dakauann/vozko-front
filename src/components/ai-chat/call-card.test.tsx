import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import pt from "@/i18n/messages/pt.json";
import type { CallSessionApi } from "@/hooks/use-call-session-ws";
import type { CallCard } from "@/lib/aichat/types";

const grants = vi.hoisted(() => ({ value: new Set<string>() }));
const session = vi.hoisted(() => ({ value: {} as Partial<CallSessionApi> }));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({
    can: (resource: string, action: string) => grants.value.has(`${resource}:${action}`),
    permissionsLoading: false,
    currentWorkspace: { id: "ws-1" },
  }),
}));
vi.mock("@/contexts/call-session-context", () => ({ useCallSession: () => session.value }));

import { ActionCardView } from "./action-card";
import {
  subscribeCallRequest,
  subscribeDialPreset,
  type CallRequest,
  type DialPreset,
} from "@/lib/call-session/call-session-control";

const copy = pt.calling.assistantCard;
const reasons = pt.calling.dialTargets.reasons;

function card(call: CallCard["call"]): CallCard {
  return { kind: "place_call", call };
}

function renderCard(value: CallCard) {
  return render(
    <NextIntlClientProvider locale="pt" messages={pt}>
      <ActionCardView card={value} />
    </NextIntlClientProvider>,
  );
}

describe("place_call card", () => {
  let requests: CallRequest[];
  let presets: DialPreset[];
  let stop: Array<() => void>;

  beforeEach(() => {
    grants.value = new Set(["sip_trunks:call", "call_session:use"]);
    session.value = { status: "connected", callState: null };
    requests = [];
    presets = [];
    stop = [subscribeCallRequest((r) => requests.push(r)), subscribeDialPreset((p) => presets.push(p))];
  });

  afterEach(() => stop.forEach((fn) => fn()));

  it("places the call through the chosen trunk only when the member clicks", () => {
    renderCard(card({ phoneNumber: "+5584999990000", trunkId: "t1", trunkName: "Principal" }));
    expect(screen.getByText("Pela linha Principal")).toBeTruthy();
    expect(requests).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: copy.call }));
    expect(requests).toEqual([{ phoneNumber: "+5584999990000", trunkId: "t1", label: "Principal" }]);
    expect(screen.getByText(copy.started)).toBeTruthy();
  });

  it("hands the number to the dialer when the member must pick a trunk", () => {
    renderCard(card({ phoneNumber: "100" }));
    fireEvent.click(screen.getByRole("button", { name: copy.openDialer }));
    expect(presets).toEqual([{ phoneNumber: "100" }]);
    expect(requests).toEqual([]);
  });

  it("still hands the number to the dialer while the call service connects or a call is live", () => {
    session.value = { status: "connecting", callState: { phoneNumber: "200", status: "answered" } };
    renderCard(card({ phoneNumber: "100" }));
    const button = screen.getByRole("button", { name: copy.openDialer });
    expect(button).toHaveProperty("disabled", false);
    fireEvent.click(button);
    expect(presets).toEqual([{ phoneNumber: "100" }]);
    expect(requests).toEqual([]);
    expect(screen.getByText(copy.handedOver)).toBeTruthy();
  });

  it("will not hand the number over without permission", () => {
    grants.value = new Set(["sip_trunks:call"]);
    renderCard(card({ phoneNumber: "100" }));
    const button = screen.getByRole("button", { name: copy.openDialer });
    expect(button).toHaveProperty("disabled", true);
    fireEvent.click(button);
    expect(presets).toEqual([]);
    expect(screen.getByText(reasons.noPermission)).toBeTruthy();
  });

  it("will not call without permission", () => {
    grants.value = new Set(["call_session:use"]);
    renderCard(card({ phoneNumber: "100", trunkId: "t1", trunkName: "Principal" }));
    const button = screen.getByRole("button", { name: copy.call });
    expect(button).toHaveProperty("disabled", true);
    fireEvent.click(button);
    expect(requests).toEqual([]);
    expect(screen.getByText(reasons.noPermission)).toBeTruthy();
  });

  it("will not start a second call or dial while the call service is offline", () => {
    session.value = { status: "connected", callState: { phoneNumber: "200", status: "answered" } };
    const { unmount } = renderCard(card({ phoneNumber: "100", trunkId: "t1", trunkName: "Principal" }));
    expect(screen.getByRole("button", { name: copy.call })).toHaveProperty("disabled", true);
    expect(screen.getByText(reasons.busy)).toBeTruthy();
    unmount();

    session.value = { status: "connecting", callState: null };
    renderCard(card({ phoneNumber: "100", trunkId: "t1", trunkName: "Principal" }));
    expect(screen.getByRole("button", { name: copy.call })).toHaveProperty("disabled", true);
    expect(screen.getByText(reasons.connecting)).toBeTruthy();
  });
});

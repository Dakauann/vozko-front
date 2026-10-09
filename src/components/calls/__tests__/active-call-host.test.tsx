import { act, render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import pt from "@/i18n/messages/pt.json";
import type { CallSessionApi } from "@/hooks/use-call-session-ws";

const startCall = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/call-session-context", () => ({
  useCallSession: () =>
    ({
      callState: null,
      startCall,
      endCall: vi.fn(),
      muted: false,
      setMuted: vi.fn(),
    }) as unknown as CallSessionApi,
}));

import { ActiveCallHost } from "@/components/calls/active-call-host";
import { requestCall } from "@/lib/call-session/call-session-control";

function renderHost() {
  return render(
    <NextIntlClientProvider locale="pt" messages={pt}>
      <ActiveCallHost />
    </NextIntlClientProvider>,
  );
}

describe("ActiveCallHost", () => {
  beforeEach(() => startCall.mockClear());

  it("starts trunk calls with the typed dial string and WhatsApp calls with a clean number", () => {
    const { unmount } = renderHost();
    act(() => requestCall({ phoneNumber: "*100#", trunkId: "t1", label: "Principal" }));
    act(() => requestCall({ phoneNumber: "+55 (11) 99999-0000", whatsAppPhoneId: "wa-1" }));
    act(() => requestCall({ phoneNumber: "100" }));
    unmount();

    expect(startCall).toHaveBeenNthCalledWith(1, "*100#", { trunkId: "t1" });
    expect(startCall).toHaveBeenNthCalledWith(2, "+5511999990000", { whatsAppPhoneId: "wa-1" });
    expect(startCall).toHaveBeenCalledTimes(2);
  });

  it("forwards the lead the call is about", () => {
    const { unmount } = renderHost();
    act(() => requestCall({ phoneNumber: "100", trunkId: "t1", leadId: "lead-1" }));
    act(() => requestCall({ phoneNumber: "+55 11 99999-0000", whatsAppPhoneId: "wa-1", leadId: "lead-2" }));
    unmount();

    expect(startCall.mock.calls).toStrictEqual([
      ["100", { trunkId: "t1", leadId: "lead-1" }],
      ["+5511999990000", { whatsAppPhoneId: "wa-1", leadId: "lead-2" }],
    ]);
  });

  it("forwards the call list item a trunk call works on", () => {
    const { unmount } = renderHost();
    act(() => requestCall({ phoneNumber: "5511987654321", trunkId: "t1", leadId: "lead-1", callListItemId: "item-1" }));
    unmount();

    expect(startCall.mock.calls).toStrictEqual([["5511987654321", { trunkId: "t1", leadId: "lead-1", callListItemId: "item-1" }]]);
  });

  it("forwards the request id the caller chose, so the caller can follow its own call", () => {
    const { unmount } = renderHost();
    act(() => requestCall({ phoneNumber: "5511987654321", trunkId: "t1", leadId: "lead-1", callListItemId: "item-1", requestId: "req-1" }));
    unmount();

    expect(startCall.mock.calls).toStrictEqual([["5511987654321", { trunkId: "t1", leadId: "lead-1", callListItemId: "item-1", requestId: "req-1" }]]);
  });

  it("sends no lead when the request names none", () => {
    const { unmount } = renderHost();
    act(() => requestCall({ phoneNumber: "100", trunkId: "t1" }));
    unmount();

    expect(startCall.mock.calls).toStrictEqual([["100", { trunkId: "t1" }]]);
  });
});

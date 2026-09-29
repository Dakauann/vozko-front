import { act, render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

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

describe("ActiveCallHost", () => {
  it("starts trunk calls with the typed dial string and WhatsApp calls with a clean number", () => {
    render(
      <NextIntlClientProvider locale="pt" messages={pt}>
        <ActiveCallHost />
      </NextIntlClientProvider>,
    );
    act(() => requestCall({ phoneNumber: "*100#", trunkId: "t1", label: "Principal" }));
    act(() => requestCall({ phoneNumber: "+55 (11) 99999-0000", whatsAppPhoneId: "wa-1" }));
    act(() => requestCall({ phoneNumber: "100" }));

    expect(startCall).toHaveBeenNthCalledWith(1, "*100#", { trunkId: "t1" });
    expect(startCall).toHaveBeenNthCalledWith(2, "+5511999990000", { whatsAppPhoneId: "wa-1" });
    expect(startCall).toHaveBeenCalledTimes(2);
  });
});

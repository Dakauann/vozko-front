import { describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import deMessages from "@/i18n/messages/de.json";
import enMessages from "@/i18n/messages/en.json";
import esMessages from "@/i18n/messages/es.json";
import ptMessages from "@/i18n/messages/pt.json";
import { FILTERABLE_MESSAGE_CHANNELS } from "@/lib/conversations/types";

import { useChannelName } from "./use-channel-name";

function wrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

describe("useChannelName", () => {
  it("tells the official line from the QR code line, the way the channel filter does", () => {
    const { result } = renderHook(() => useChannelName(), { wrapper });
    expect(result.current("whatsapp")).toBe("WhatsApp oficial");
    expect(result.current("unofficial_whatsapp")).toBe(ptMessages.liveChat.filterUnofficialWhatsapp);
  });

  it("labels the Facebook channel as Messenger", () => {
    const { result } = renderHook(() => useChannelName(), { wrapper });
    expect(result.current("facebook")).toBe("Messenger");
  });

  it("names nothing for a channel it does not know", () => {
    const { result } = renderHook(() => useChannelName(), { wrapper });
    expect(result.current("fax")).toBeNull();
    expect(result.current(null)).toBeNull();
    expect(result.current(undefined)).toBeNull();
  });

  it("has a name for every message channel in all four catalogs", () => {
    for (const messages of [ptMessages, enMessages, esMessages, deMessages]) {
      const names = messages.channelNames as Record<string, string>;
      for (const channel of FILTERABLE_MESSAGE_CHANNELS) expect(names[channel], channel).toBeTruthy();
    }
  });
});

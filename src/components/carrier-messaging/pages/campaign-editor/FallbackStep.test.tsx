import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

const carrierChannels = vi.hoisted(() => ({ launched: new Set<string>(["rcs"]) }));
vi.mock("@/lib/carrier-messaging/use-carrier-channels", () => ({
  useCarrierChannels: () => ({ status: "ready", launched: (channel: string) => carrierChannels.launched.has(channel) }),
}));

const sms = vi.hoisted(() => ({ checkSmsTextAction: vi.fn(), smsTextToGsmAction: vi.fn() }));
vi.mock("@/app/actions/sms", () => sms);

import rawPt from "@/i18n/messages/pt.json";
import { emptyCampaignDraft } from "@/lib/carrier-messaging/campaigns";
import { brandedMessages } from "@/test/branded-messages";

import { FallbackStep } from "./FallbackStep";

const pt = brandedMessages(rawPt);

describe("FallbackStep", () => {
  it("shows the SMS fallback as coming soon and never measures text while SMS is parked", () => {
    render(
      <NextIntlClientProvider locale="pt" messages={pt} timeZone="America/Sao_Paulo">
        <FallbackStep draft={emptyCampaignDraft("rcs")} onChange={() => undefined} routes={[]} smsComingSoon />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText(pt.carrierMessaging.comingSoon.sms.title)).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: pt.carrierMessaging.pages.campaignEditor.fallback.route })).not.toBeInTheDocument();
    expect(sms.checkSmsTextAction).not.toHaveBeenCalled();
  });
});
